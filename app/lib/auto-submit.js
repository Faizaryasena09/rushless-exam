import { query, transaction } from '@/app/lib/db';

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
 * Auto-submits a single expired attempt inside a transaction.
 * The UPDATE is the first step — if affectedRows = 0 it means another process
 * already submitted this attempt, so we exit early (idempotent guard).
 * Returns true on success, false on error or if already submitted.
 */
async function autoSubmitAttempt(attempt) {
    try {
        // Score calculation is done OUTSIDE the transaction (read-only, no lock needed)
        const allQuestions = await query({
            query: 'SELECT id, correct_option FROM rhs_exam_questions WHERE exam_id = ?',
            values: [attempt.exam_id],
        });

        const tempAnswers = await query({
            query: 'SELECT question_id, selected_option FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
            values: [attempt.user_id, attempt.exam_id],
        });

        const answersMap = {};
        tempAnswers.forEach(ta => {
            if (ta.selected_option !== null) {
                answersMap[ta.question_id] = ta.selected_option;
            }
        });

        const totalQuestions = allQuestions.length;
        let correctCount = 0;
        const correctOptionsMap = {};
        allQuestions.forEach(q => { correctOptionsMap[q.id] = q.correct_option; });
        allQuestions.forEach(q => {
            if (answersMap[q.id] && answersMap[q.id] === correctOptionsMap[q.id]) correctCount++;
        });
        const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

        // Atomically claim + complete the attempt inside a transaction
        const submitted = await transaction(async (txQuery) => {
            // Step 1 (IDEMPOTENT GATE): Try to claim this attempt.
            // The WHERE clause ensures only one concurrent process can succeed.
            const updateResult = await txQuery({
                query: `UPDATE rhs_exam_attempts SET status = 'completed', end_time = NOW(), score = ? WHERE id = ? AND status = 'in_progress'`,
                values: [score, attempt.id],
            });

            // If affectedRows = 0, another process already submitted this attempt. Bail out.
            if (updateResult.affectedRows === 0) {
                return false;
            }

            // Step 2: Save permanent student answers
            const answeredIds = Object.keys(answersMap).filter(id => answersMap[id]);
            if (answeredIds.length > 0) {
                const valueTuples = answeredIds.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                const flatValues = [];
                answeredIds.forEach(qId => {
                    const selectedOption = answersMap[qId];
                    const isCorrect = correctOptionsMap[qId] === selectedOption;
                    flatValues.push(attempt.user_id, attempt.exam_id, attempt.id, qId, selectedOption, isCorrect);
                });
                await txQuery({
                    query: `INSERT IGNORE INTO rhs_student_answer (user_id, exam_id, attempt_id, question_id, selected_option, is_correct) VALUES ${valueTuples}`,
                    values: flatValues,
                });
            }

            // Step 3: Clean up temporary answers
            await txQuery({
                query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
                values: [attempt.user_id, attempt.exam_id],
            });

            // Step 4: Log
            await txQuery({
                query: `INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, 'SUBMIT', 'Auto-submitted by server: timer expired')`,
                values: [attempt.id],
            });

            return true;
        });

        if (submitted) {
            console.log(`[AutoSubmit] Attempt ${attempt.id} (user=${attempt.user_id}, exam=${attempt.exam_id}) auto-submitted. Score: ${score.toFixed(1)}`);
        } else {
            console.log(`[AutoSubmit] Attempt ${attempt.id} skipped — already submitted by another process.`);
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
                WHERE ea.id = ? AND ea.user_id = ? AND ea.exam_id = ? AND ea.status = 'in_progress'
            `,
            values: [attemptId, userId, examId],
        });

        if (rows.length === 0) return false; // Already submitted or doesn't exist

        const attempt = rows[0];
        const endTs = calcEndTs(attempt, attempt);
        if (attempt.now_ts < endTs) return false; // Not expired yet

        return await autoSubmitAttempt(attempt);
    } catch (err) {
        console.error('[AutoSubmit] Error in autoSubmitAttemptIfExpired:', err.message);
        return false;
    }
}
