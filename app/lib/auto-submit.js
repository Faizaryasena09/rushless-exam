import { query, transaction } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';
import { gradeAnswers, upsertStudentAnswers } from '@/app/lib/grading';
import { archiveTempAnswers } from '@/app/lib/temp-archive';

/**
 * Calculates the scheduled end timestamp (UNIX seconds) for a given attempt.
 */
function calcEndTs(settings, attempt) {
    if (settings.timer_mode === 'async') {
        return Number(attempt.start_time_ts) + (Number(settings.duration_minutes) * 60) + (Number(attempt.time_extension || 0) * 60);
    } else {
        return Number(settings.end_time_ts) + (Number(attempt.time_extension || 0) * 60);
    }
}

/**
 * Kumpulkan jawaban terakhir siswa.
 * Sumber: MySQL (rhs_temporary_answer) + Redis (temp:ans) sebagai pelengkap,
 * karena Redis ditulis lebih dulu dan bisa Holds jawaban yang gagal masuk MySQL.
 */
async function collectTempAnswers(userId, examId) {
    const answersMap = {};

    const tempAnswers = await query({
        query: 'SELECT question_id, selected_option FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
        values: [userId, examId],
    });

    tempAnswers.forEach(ta => {
        if (ta.selected_option !== null && ta.selected_option !== undefined && ta.selected_option !== '') {
            answersMap[String(ta.question_id)] = ta.selected_option;
        }
    });

    if (isRedisReady()) {
        const cached = await redis.hgetall(`temp:ans:${userId}:${examId}`).catch(() => ({}));
        if (cached && Object.keys(cached).length > 0) {
            Object.keys(cached).forEach(qid => {
                const val = cached[qid];
                if (val !== null && val !== undefined && val !== '') {
                    answersMap[String(qid)] = val;
                }
            });
        }
    }

    return answersMap;
}

/**
 * Auto-submits a single expired attempt inside a transaction.
 * The UPDATE is the first step — if affectedRows = 0 it means another process
 * already submitted this attempt, so we exit early (idempotent guard).
 * Returns true on success, false on error or if already submitted.
 */
export async function autoSubmitAttempt(attempt) {
    try {
        // Jawaban terakhir siswa (MySQL + Redis)
        const answersMap = await collectTempAnswers(attempt.user_id, attempt.exam_id);

        // Penilaian memakai helper yang SAMA dengan submit manual
        // (support PGK, essay keyword, matching, bobot poin)
        const { score, maxPoints, earnedPoints, rows } = await gradeAnswers(attempt.exam_id, answersMap);

        // Atomically claim + complete the attempt inside a transaction
        const submitted = await transaction(async (txQuery) => {
            // Step 1 (IDEMPOTENT GATE): Try to claim this attempt.
            // The WHERE clause ensures only one concurrent process can succeed.
            const updateResult = await txQuery({
                query: `UPDATE rhs_exam_attempts SET status = 'completed', end_time = NOW(), score = ? WHERE id = ? AND status = 'in_progress'`,
                values: [score, attempt.id],
            });

            // Step 2: Save permanent student answers (upsert, tidak menimpa nilai manual)
            await upsertStudentAnswers(txQuery, {
                userId: attempt.user_id,
                examId: attempt.exam_id,
                attemptId: attempt.id,
                rows,
            });

            // Step 3: Arsipkan jawaban sementara lalu bersihkan tabel live
            await archiveTempAnswers(txQuery, {
                userId: attempt.user_id,
                examId: attempt.exam_id,
                attemptId: attempt.id,
                reason: 'auto_submit'
            });

            // Step 4: Log
            await txQuery({
                query: `INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, 'SUBMIT', 'Dikumpulkan otomatis oleh server: Waktu habis')`,
                values: [attempt.id],
            });

            // Step 5: Invalidate Redis Caches
            if (isRedisReady()) {
                await Promise.all([
                    redis.del(`exam:active-attempt:${attempt.user_id}:${attempt.exam_id}`),
                    redis.del(`exam:attempt-meta:${attempt.user_id}:${attempt.exam_id}`),
                    redis.del(`temp:ans:${attempt.user_id}:${attempt.exam_id}`),
                    redis.srem(`user:active_exams:${attempt.user_id}`, attempt.exam_id)
                ]).catch(() => {});
            }

            return updateResult.affectedRows > 0;
        });

        if (submitted) {
            console.log(`[AutoSubmit] Attempt ${attempt.id} (user=${attempt.user_id}, exam=${attempt.exam_id}) auto-submitted. Score: ${score.toFixed(1)} (${earnedPoints.toFixed(1)}/${maxPoints.toFixed(1)} poin, ${Object.keys(answersMap).length} jawaban)`);
        } else {
            console.log(`[AutoSubmit] Attempt ${attempt.id} sudah selesai diproses proses lain (jawaban tetap disimpan).`);
        }
        return submitted;
    } catch (err) {
        console.error(`[AutoSubmit] Failed for attempt ${attempt.id}:`, err.message);
        return false;
    }
}

// Module-level guard: prevents concurrent scans from multiple simultaneous
// HTTP requests (e.g. admin polling /control/users every second) from both
// fetching the same expired attempts and racing to submit them.
let isScanning = false;

/**
 * Finds all in_progress attempts whose timer has expired and auto-submits them.
 * Call this from any server-side polling endpoint (control/users, timer-stream etc.).
 * Returns the number of attempts auto-submitted.
 */
export async function autoSubmitExpiredAttempts() {
    // If a scan is already in progress (e.g. from another concurrent request),
    // skip this call entirely — the other scan will handle it.
    if (isScanning) return 0;
    isScanning = true;
    try {
        // Find all in_progress attempts, joined with exam settings to calculate end time
        const expiredAttempts = await query({
            query: `
                SELECT
                    ea.id,
                    ea.user_id,
                    ea.exam_id,
                    ea.time_extension,
                    UNIX_TIMESTAMP(ea.start_time) as start_time_ts,
                    e.timer_mode,
                    e.duration_minutes,
                    UNIX_TIMESTAMP(s.end_time) as end_time_ts,
                    UNIX_TIMESTAMP(NOW()) as now_ts
                FROM rhs_exam_attempts ea
                JOIN rhs_exams e ON ea.exam_id = e.id
                LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
                WHERE ea.status = 'in_progress'
            `,
            values: [],
        });

        let submittedCount = 0;
        for (const attempt of expiredAttempts) {
            const endTs = calcEndTs(attempt, attempt); // settings fields are on same row
            if (attempt.now_ts >= endTs) {
                const ok = await autoSubmitAttempt(attempt);
                if (ok) submittedCount++;
            }
        }
        return submittedCount;
    } catch (err) {
        console.error('[AutoSubmit] Error scanning for expired attempts:', err.message);
        return 0;
    } finally {
        isScanning = false;
    }
}

/**
 * Auto-submits a specific attempt by ID if its timer has expired.
 * Use this from timer-stream when seconds_left hits 0 for a specific user.
 */
export async function autoSubmitAttemptIfExpired(attemptId, examId, userId) {
    try {
        const rows = await query({
            query: `
                SELECT
                    ea.id,
                    ea.user_id,
                    ea.exam_id,
                    ea.time_extension,
                    UNIX_TIMESTAMP(ea.start_time) as start_time_ts,
                    e.timer_mode,
                    e.duration_minutes,
                    UNIX_TIMESTAMP(s.end_time) as end_time_ts,
                    UNIX_TIMESTAMP(NOW()) as now_ts
                FROM rhs_exam_attempts ea
                JOIN rhs_exams e ON ea.exam_id = e.id
                LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
                WHERE ea.id = ? AND ea.user_id = ? AND ea.exam_id = ? AND status = 'in_progress'
            `,
            values: [attemptId, userId, examId],
        });

        if (rows.length === 0) {
            // Attempt sudah selesai / tidak ada. Jawaban yang mungkin belum
            // tersimpan tetap diamankan agar tidak hilang.
            await safeguardAnswers(attemptId, examId, userId);
            return false;
        }

        const attempt = rows[0];
        const endTs = calcEndTs(attempt, attempt);
        if (attempt.now_ts < endTs) return false; // Not expired yet

        return await autoSubmitAttempt(attempt);
    } catch (err) {
        console.error('[AutoSubmit] Error in autoSubmitAttemptIfExpired:', err.message);
        return false;
    }
}

/**
 * Fallback keamanan: jika attempt sudah `completed` (mis. sudah auto-submit),
 * tetap pastikan jawaban terakhir tersimpan di rhs_student_answer.
 * Menghindari jawaban hilang saat klien menekan "Kumpulkan" bersamaan.
 */
export async function safeguardAnswers(attemptId, examId, userId) {
    try {
        const attemptRow = await query({
            query: 'SELECT id FROM rhs_exam_attempts WHERE id = ? AND user_id = ? AND exam_id = ?',
            values: [attemptId, userId, examId],
        });
        if (attemptRow.length === 0) return false;

        const answersMap = await collectTempAnswers(userId, examId);
        if (Object.keys(answersMap).length === 0) return false;

        const { rows } = await gradeAnswers(examId, answersMap);

        await transaction(async (txQuery) => {
            await upsertStudentAnswers(txQuery, { userId, examId, attemptId, rows });

            // Arsipkan sebelum dihapus (tidak hilang begitu saja)
            await archiveTempAnswers(txQuery, {
                userId,
                examId,
                attemptId,
                reason: 'safeguard'
            });
        });

        if (isRedisReady()) {
            await redis.del(`temp:ans:${userId}:${examId}`).catch(() => {});
        }

        console.log(`[AutoSubmit] Safeguard: ${rows.length} jawaban diamankan untuk attempt ${attemptId}`);
        return true;
    } catch (err) {
        console.error('[AutoSubmit] safeguardAnswers error:', err.message);
        return false;
    }
}