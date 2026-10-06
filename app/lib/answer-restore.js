import { query, transaction } from './db';
import { gradeAnswers, upsertStudentAnswers } from './grading';
import { logActivity } from './logger';

/**
 * PEMULIHAN JAWABAN DARI ARSIP
 * ==============================
 * Arsip jawaban (rhs_temporary_answer_archive) adalah sumber pemulihan.
 *
 * Sebelum menimpa, jawaban saat ini dicadangkan ke `rhs_answer_restore_backup`
 * sehingga tindakan ini selalu bisa dibatalkan (undo).
 *
 * Dua mode:
 *  - 'rescore' : jawaban dipulihkan & skor dihitung ulang, attempt tetap `completed`
 *  - 'reopen'  : sama seperti di atas, lalu attempt dikembalikan ke `in_progress`
 *                supaya siswa bisa melanjutkan ujian dengan jawaban lama
 *
 * Bila attempt aslinya sudah dihapus (mis. admin melakukan Reset Ujian),
 * sistem membuat attempt BARU dari arsip — jawaban tetap bisa dipulihkan.
 * Penanda khusus (question_id = 0) dipakai agar undo bisa menghapus kembali
 * attempt yang dibuat ulang tersebut.
 */

export const RESTORE_MODES = ['rescore', 'reopen'];
const RECREATE_MARKER_QUESTION = 0;

export async function ensureRestoreBackupTable() {
    try {
        await query({
            query: `
                CREATE TABLE IF NOT EXISTS rhs_answer_restore_backup (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    attempt_id INT NOT NULL,
                    user_id INT NOT NULL,
                    exam_id INT NOT NULL,
                    question_id INT NOT NULL,
                    selected_option TEXT,
                    is_correct BOOLEAN NOT NULL DEFAULT 0,
                    score_earned FLOAT NOT NULL DEFAULT 0,
                    restored_by VARCHAR(255),
                    restore_mode VARCHAR(20),
                    is_undone TINYINT(1) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_attempt (attempt_id),
                    INDEX idx_created (created_at)
                )
            `,
            values: []
        });
    } catch (err) {
        console.error('[AnswerRestore] Gagal membuat tabel backup:', err.message);
    }
}

/** Hitung ulang skor satu attempt (menghormati scoring_mode seperti recalculateExamScores) */
export async function recalculateAttemptScore(attemptId) {
    const attempt = await query({
        query: `SELECT ea.id, ea.exam_id, ea.user_id, e.scoring_mode
                FROM rhs_exam_attempts ea
                JOIN rhs_exams e ON e.id = ea.exam_id
                WHERE ea.id = ?`,
        values: [attemptId],
        one: true
    });
    if (!attempt) return null;

    const answers = await query({
        query: 'SELECT question_id, selected_option FROM rhs_student_answer WHERE attempt_id = ?',
        values: [attemptId]
    });

    const answersMap = {};
    answers.forEach(a => { answersMap[String(a.question_id)] = a.selected_option; });

    const { earnedPoints, maxPoints, rows } = await gradeAnswers(attempt.exam_id, answersMap);
    const finalScore = (attempt.scoring_mode === 'raw')
        ? earnedPoints
        : (maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0);

    await transaction(async (txQuery) => {
        await upsertStudentAnswers(txQuery, {
            userId: attempt.user_id,
            examId: attempt.exam_id,
            attemptId,
            rows
        });
        await txQuery({
            query: 'UPDATE rhs_exam_attempts SET score = ? WHERE id = ?',
            values: [finalScore, attemptId]
        });
    });

    return { score: finalScore, earnedPoints, maxPoints, answerCount: rows.length };
}

/** Bandingkan jawaban arsip vs jawaban saat ini (untuk preview sebelum restore) */
export async function previewRestore(attemptId) {
    await ensureRestoreBackupTable();

    const archived = await query({
        query: 'SELECT user_id, exam_id, question_id, selected_option, archived_at FROM rhs_temporary_answer_archive WHERE attempt_id = ? ORDER BY question_id',
        values: [attemptId]
    });

    const current = await query({
        query: 'SELECT question_id, selected_option, is_correct, score_earned FROM rhs_student_answer WHERE attempt_id = ? ORDER BY question_id',
        values: [attemptId]
    });

    const currentMap = new Map(current.map(c => [String(c.question_id), c]));
    const archivedIds = new Set(archived.map(a => String(a.question_id)));

    const diff = archived.map(a => {
        const qid = String(a.question_id);
        const before = currentMap.get(qid);
        return {
            question_id: qid,
            archived: a.selected_option,
            current: before ? before.selected_option : null,
            current_score: before ? before.score_earned : null,
            change: !before ? 'missing' : (String(before.selected_option) === String(a.selected_option) ? 'same' : 'changed')
        };
    });

    const extraInCurrent = current
        .filter(c => !archivedIds.has(String(c.question_id)))
        .map(c => ({
            question_id: String(c.question_id),
            archived: null,
            current: c.selected_option,
            current_score: c.score_earned,
            change: 'removed'
        }));

    const all = [...diff, ...extraInCurrent].sort((a, b) => Number(a.question_id) - Number(b.question_id));

    const summary = {
        missing: diff.filter(d => d.change === 'missing').length,
        changed: diff.filter(d => d.change === 'changed').length,
        same: diff.filter(d => d.change === 'same').length,
        removed: extraInCurrent.length
    };

    // Snapshot nama dari arsip (user/ujian boleh sudah dihapus)
    const meta = archived[0] || {};
    const examExists = archived.length > 0
        ? !!await query({ query: 'SELECT id FROM rhs_exams WHERE id = ?', values: [meta.exam_id], one: true })
        : false;
    const attempt = archived.length > 0
        ? await query({ query: 'SELECT id, status, score FROM rhs_exam_attempts WHERE id = ?', values: [attemptId], one: true })
        : null;

    return {
        attemptId: Number(attemptId),
        userId: meta.user_id ?? null,
        examId: meta.exam_id ?? null,
        username: meta.username ?? null,
        studentName: meta.student_name ?? null,
        examName: meta.exam_name ?? null,
        className: meta.class_name ?? null,
        attemptExists: !!attempt,
        examExists,
        status: attempt ? attempt.status : null,
        score: attempt ? attempt.score : null,
        archivedCount: archived.length,
        currentCount: current.length,
        summary,
        diff: all
    };
}

/**
 * Pulihkan jawaban dari arsip ke percobaan siswa.
 * Otomatis membuat attempt baru bila attempt aslinya sudah dihapus.
 */
export async function restoreArchivedAnswers({ attemptId, mode = 'rescore', adminUsername = null }) {
    if (!RESTORE_MODES.includes(mode)) {
        throw new Error(`Mode pemulihan tidak dikenal: ${mode}`);
    }

    await ensureRestoreBackupTable();

    // Data arsip (attempt & user boleh sudah dihapus)
    const archivedRows = await query({
        query: `SELECT attempt_id, user_id, exam_id, question_id, selected_option
                FROM rhs_temporary_answer_archive WHERE attempt_id = ?`,
        values: [attemptId]
    });
    if (archivedRows.length === 0) {
        throw new Error('Tidak ada jawaban terarsip untuk percobaan ini');
    }

    const archivedUserId = Number(archivedRows[0].user_id);
    const archivedExamId = Number(archivedRows[0].exam_id);

    const answersMap = {};
    archivedRows.forEach(a => { answersMap[String(a.question_id)] = a.selected_option; });

    // Penilaian memakai logika yang sama dengan submit
    const { maxPoints, earnedPoints, rows } = await gradeAnswers(archivedExamId, answersMap);
    const examRow = await query({
        query: 'SELECT id, scoring_mode FROM rhs_exams WHERE id = ?',
        values: [archivedExamId],
        one: true
    });
    const finalScore = (examRow?.scoring_mode === 'raw')
        ? earnedPoints
        : (maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0);

    // Apakah attempt aslinya masih ada?
    const existing = await query({
        query: 'SELECT id, user_id, exam_id, status, score FROM rhs_exam_attempts WHERE id = ?',
        values: [attemptId],
        one: true
    });
    const recreated = !existing;

    if (recreated && !examRow) {
        throw new Error('Ujian sudah dihapus, jawaban tidak dapat dipulihkan. Arsip tetap tersedia sebagai bukti.');
    }

    let backupGroupId = null;
    let targetAttemptId = Number(attemptId);

    await transaction(async (txQuery) => {
        // 0. Tandai awal grup pemulihan (dipakai undo untuk menentukan batas batch)
        const marker = await txQuery({
            query: `INSERT INTO rhs_answer_restore_backup
                    (attempt_id, user_id, exam_id, question_id, selected_option,
                     is_correct, score_earned, restored_by, restore_mode, is_undone)
                    VALUES (?, ?, ?, ?, NULL, 0, 0, ?, ?, 0)`,
            values: [
                recreated ? 0 : attemptId, archivedUserId, archivedExamId,
                RECREATE_MARKER_QUESTION, adminUsername,
                recreated ? `recreate_${mode}` : mode
            ]
        });
        backupGroupId = marker.insertId;

        if (recreated) {
            // 0b. Attempt sudah dihapus -> buat attempt baru dari arsip
            const status = mode === 'reopen' ? 'in_progress' : 'completed';
            const created = await txQuery({
                query: `INSERT INTO rhs_exam_attempts (user_id, exam_id, start_time, end_time, status, score)
                        VALUES (?, ?, NOW(), ?, ?, ?)`,
                values: [
                    archivedUserId,
                    archivedExamId,
                    mode === 'reopen' ? null : new Date(),
                    status,
                    finalScore
                ]
            });
            targetAttemptId = created.insertId;

            // Penanda terikat ke attempt yang baru dibuat
            await txQuery({
                query: 'UPDATE rhs_answer_restore_backup SET attempt_id = ? WHERE id = ?',
                values: [targetAttemptId, backupGroupId]
            });
        } else {
            // 1. Cadangkan jawaban saat ini (biar bisa di-undo)
            const current = await txQuery({
                query: 'SELECT question_id, selected_option, is_correct, score_earned FROM rhs_student_answer WHERE attempt_id = ?',
                values: [attemptId]
            });

            if (current.length > 0) {
                const tuples = current.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').join(', ');
                const values = [];
                current.forEach(c => {
                    values.push(
                        attemptId, existing.user_id, existing.exam_id, c.question_id,
                        c.selected_option, c.is_correct, c.score_earned,
                        adminUsername, mode
                    );
                });
                await txQuery({
                    query: `INSERT INTO rhs_answer_restore_backup
                            (attempt_id, user_id, exam_id, question_id, selected_option,
                             is_correct, score_earned, restored_by, restore_mode, is_undone)
                            VALUES ${tuples}`,
                    values
                });
            }
        }

        // 2. Terapkan jawaban dari arsip (upsert)
        await upsertStudentAnswers(txQuery, {
            userId: recreated ? archivedUserId : existing.user_id,
            examId: recreated ? archivedExamId : existing.exam_id,
            attemptId: targetAttemptId,
            rows
        });

        // 3. Perbarui attempt (yang dibuat ulang sudah di-set saat insert)
        if (!recreated) {
            if (mode === 'reopen') {
                await txQuery({
                    query: `UPDATE rhs_exam_attempts
                            SET status = 'in_progress', end_time = NULL, score = ?
                            WHERE id = ?`,
                    values: [finalScore, targetAttemptId]
                });
            } else {
                await txQuery({
                    query: 'UPDATE rhs_exam_attempts SET score = ? WHERE id = ?',
                    values: [finalScore, targetAttemptId]
                });
            }
        }

        // 4. Catat di log ujian
        await txQuery({
            query: `INSERT INTO rhs_exam_logs (attempt_id, action_type, description)
                    VALUES (?, 'RESTORE', ?)`,
            values: [
                targetAttemptId,
                recreated
                    ? `Attempt dibuat ulang dari arsip oleh ${adminUsername || 'admin'} (mode=${mode}, ${rows.length} jawaban)`
                    : `Jawaban dipulihkan dari arsip oleh ${adminUsername || 'admin'} (mode=${mode}, ${rows.length} jawaban)`
            ]
        });
    });

    logActivity({
        userId: archivedUserId,
        username: adminUsername,
        action: recreated ? 'ANSWER_RESTORE_RECREATE' : 'ANSWER_RESTORE',
        level: 'warn',
        details: recreated
            ? `Recreate attempt dari arsip ${attemptId} → attempt baru ${targetAttemptId} (mode=${mode}, ${rows.length} jawaban, skor ${finalScore.toFixed(2)})`
            : `Restore attempt ${attemptId} mode=${mode}: ${rows.length} jawaban, skor ${finalScore.toFixed(2)} (sebelumnya ${existing.score})`
    });

    console.log(`[AnswerRestore] ${recreated ? 'Recreate' : 'Restore'} attempt ${attemptId}` +
        (recreated ? ` -> ${targetAttemptId}` : '') +
        ` (mode=${mode}, ${rows.length} jawaban, skor=${finalScore.toFixed(2)})`);

    return {
        attemptId: Number(attemptId),
        newAttemptId: recreated ? targetAttemptId : null,
        recreated,
        mode,
        restored: rows.length,
        score: finalScore,
        previousScore: recreated ? null : (existing.score ?? null),
        backupId: backupGroupId,
        status: mode === 'reopen' ? 'in_progress' : 'completed'
    };
}

/**
 * Batalkan pemulihan terakhir untuk satu attempt.
 * - Recovery biasa: jawaban dikembalikan seperti semula, skor dihitung ulang.
 * - Recovery hasil "recreate": attempt yang dibuat ulang dihapus lagi,
 *   sehingga kembali ke kondisi sebelum pemulihan.
 */
export async function undoRestore({ attemptId, adminUsername = null }) {
    await ensureRestoreBackupTable();

    const backups = await query({
        query: `SELECT * FROM rhs_answer_restore_backup
                WHERE attempt_id = ? AND is_undone = 0
                ORDER BY id ASC`,
        values: [attemptId]
    });
    if (backups.length === 0) throw new Error('Tidak ada pemulihan yang bisa dibatalkan');

    // Grup pemulihan terakhir = mulai dari marker (question_id = 0) paling akhir
    // sampai baris sebelum marker berikutnya (atau baris terakhir bila tidak ada).
    const markers = backups
        .map((b, idx) => ({ b, idx }))
        .filter(({ b }) => Number(b.question_id) === RECREATE_MARKER_QUESTION);
    const lastMarkerIdx = markers.length ? markers[markers.length - 1].idx : 0;
    const group = backups.slice(lastMarkerIdx);
    const groupIds = group.map(b => b.id);
    const isRecreate = backups[lastMarkerIdx] &&
        Number(backups[lastMarkerIdx].question_id) === RECREATE_MARKER_QUESTION &&
        String(backups[lastMarkerIdx].restore_mode || '').startsWith('recreate_');

    const attempt = await query({
        query: 'SELECT id, user_id, exam_id FROM rhs_exam_attempts WHERE id = ?',
        values: [attemptId],
        one: true
    });
    if (!attempt && !isRecreate) throw new Error('Percobaan tidak ditemukan');

    let scoreAfter = null;

    await transaction(async (txQuery) => {
        if (isRecreate) {
            // Attempt ini dibuat oleh pemulihan -> hapus lagi
            await txQuery({ query: 'DELETE FROM rhs_student_answer WHERE attempt_id = ?', values: [attemptId] });
            await txQuery({ query: 'DELETE FROM rhs_exam_attempts WHERE id = ?', values: [attemptId] });
        } else {
            // 1. Kembalikan jawaban dari backup
            const realRows = group.filter(b => Number(b.question_id) !== RECREATE_MARKER_QUESTION);
            if (realRows.length > 0) {
                const tuples = realRows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
                const values = [];
                realRows.forEach(b => {
                    values.push(attempt.user_id, attempt.exam_id, attemptId, b.question_id,
                        b.selected_option, b.is_correct, b.score_earned);
                });
                await txQuery({
                    query: `INSERT INTO rhs_student_answer
                            (user_id, exam_id, attempt_id, question_id, selected_option, is_correct, score_earned)
                            VALUES ${tuples}
                            ON DUPLICATE KEY UPDATE
                                selected_option = VALUES(selected_option),
                                is_correct = VALUES(is_correct),
                                score_earned = VALUES(score_earned)`,
                    values
                });

                // 2. Hapus jawaban yang tidak ada di backup (dibuat oleh pemulihan)
                const keepIds = realRows.map(b => b.question_id);
                await txQuery({
                    query: `DELETE FROM rhs_student_answer
                            WHERE attempt_id = ? AND question_id NOT IN (${keepIds.map(() => '?').join(',')})`,
                    values: [attemptId, ...keepIds]
                });
            } else {
                await txQuery({ query: 'DELETE FROM rhs_student_answer WHERE attempt_id = ?', values: [attemptId] });
            }

            // 3. Hitung ulang skor
            const answers = await txQuery({
                query: 'SELECT question_id, selected_option FROM rhs_student_answer WHERE attempt_id = ?',
                values: [attemptId]
            });
            const answersMap = {};
            answers.forEach(a => { answersMap[String(a.question_id)] = a.selected_option; });
            const { earnedPoints, maxPoints } = await gradeAnswers(attempt.exam_id, answersMap);
            const examRow = await txQuery({
                query: 'SELECT scoring_mode FROM rhs_exams WHERE id = ?',
                values: [attempt.exam_id]
            });
            scoreAfter = (examRow[0]?.scoring_mode === 'raw')
                ? earnedPoints
                : (maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0);

            await txQuery({
                query: 'UPDATE rhs_exam_attempts SET score = ? WHERE id = ?',
                values: [scoreAfter, attemptId]
            });
        }

        // 4. Tandai backup sebagai sudah dibatalkan
        await txQuery({
            query: `UPDATE rhs_answer_restore_backup SET is_undone = 1 WHERE id IN (${groupIds.map(() => '?').join(',')})`,
            values: groupIds
        });
    });

    logActivity({
        userId: attempt ? attempt.user_id : group[0].user_id,
        username: adminUsername,
        action: 'ANSWER_RESTORE_UNDO',
        level: 'warn',
        details: isRecreate
            ? `Undo recovery: attempt ${attemptId} yang dibuat ulang dihapus kembali`
            : `Undo pemulihan attempt ${attemptId}: ${group.length} jawaban dikembalikan`
    });

    return {
        attemptId: Number(attemptId),
        undone: group.filter(b => Number(b.question_id) !== RECREATE_MARKER_QUESTION).length,
        removedAttempt: isRecreate,
        score: scoreAfter
    };
}

/** Riwayat pemulihan untuk satu attempt (untuk tombol undo) */
export async function getRestoreHistory(attemptId) {
    await ensureRestoreBackupTable();
    const rows = await query({
        query: `SELECT id, restored_by, restore_mode, is_undone, created_at
                FROM rhs_answer_restore_backup
                WHERE attempt_id = ?
                ORDER BY id DESC
                LIMIT 20`,
        values: [attemptId]
    });
    return rows;
}