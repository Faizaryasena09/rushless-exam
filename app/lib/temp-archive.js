import { query } from './db';

/**
 * ARSIP JAWABAN SEMENTARA
 * ========================
 * Jawaban sementara (rhs_temporary_answer) tidak pernah hilang begitu saja.
 * Sebelum dihapus, isinya disalin ke `rhs_temporary_answer_archive` supaya:
 *   - bisa dicari / diaudit admin lewat halaman "Arsip Jawaban"
 *   - tetap aman walaupun attempt, ujian, atau user dihapus
 *     (tabel arsip sengaja TANPA foreign key)
 * Arsip dibersihkan otomatis setelah 30 hari (lihat app/lib/temp-purge.js).
 */

export const ARCHIVE_SOURCES = [
    'submit',
    'auto_submit',
    'reset_exam',
    'delete_attempt',
    'safeguard'
];

let tableEnsured = false;
let uniqueKeyWarned = false;

/**
 * Pastikan tabel arsip ada (aman dipanggil berkali-kali).
 * Sengaja memakai koneksi pool terpisah: DDL di koneksi lain tidak
 * mengganggu transaksi yang sedang berjalan.
 */
export async function ensureArchiveTable() {
    if (tableEnsured) return true;
    try {
        await query({
            query: `
                CREATE TABLE IF NOT EXISTS rhs_temporary_answer_archive (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    attempt_id INT NOT NULL,
                    user_id INT NOT NULL,
                    exam_id INT NOT NULL,
                    question_id INT NOT NULL,
                    selected_option TEXT,
                    answer_source VARCHAR(32) NOT NULL DEFAULT 'submit',
                    username VARCHAR(255),
                    student_name VARCHAR(255),
                    exam_name VARCHAR(255),
                    class_name VARCHAR(255),
                    created_at DATETIME NULL DEFAULT NULL,
                    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uniq_attempt_question (attempt_id, question_id),
                    INDEX idx_archived_at (archived_at),
                    INDEX idx_user (user_id),
                    INDEX idx_exam (exam_id)
                )
            `,
            values: []
        });
        tableEnsured = true;
    } catch (err) {
        console.error('[TempArchive] Gagal membuat tabel arsip:', err.message);
    }
    return tableEnsured;
}

/**
 * Ambil nama-nama untuk disimpan sebagai snapshot di arsip.
 * Kalau user/ujian sudah dihapus, tetap tidak error (snapshot kosong).
 */
async function loadSnapshot(txQuery, userId, examId) {
    let username = null, studentName = null, className = null;
    try {
        const u = await txQuery({
            query: `SELECT u.username, u.name AS student_name, c.class_name
                    FROM rhs_users u
                    LEFT JOIN rhs_classes c ON u.class_id = c.id
                    WHERE u.id = ?`,
            values: [userId]
        });
        if (u.length) {
            username = u[0].username;
            studentName = u[0].student_name;
            className = u[0].class_name;
        }
    } catch (e) { /* user mungkin sudah dihapus */ }

    let examName = null;
    try {
        const e = await txQuery({ query: 'SELECT exam_name FROM rhs_exams WHERE id = ?', values: [examId] });
        if (e.length) examName = e[0].exam_name;
    } catch (e) { /* ujian mungkin sudah dihapus */ }

    return { username, studentName, className, examName };
}

/**
 * Arsipkan jawaban sementara lalu hapus dari tabel live.
 * WAJIB dipanggil di dalam transaksi (txQuery) yang sama dengan operasi
 * aslinya, agar tidak pernah ada celah data hilang.
 *
 * @param {Function} txQuery fungsi query milik transaksi
 * @param {object} params { userId, examId, attemptId, reason }
 * @returns {Promise<{archived:number, deleted:boolean}>}
 */
export async function archiveTempAnswers(txQuery, { userId, examId, attemptId, reason = 'submit' }) {
    if (!userId || !examId || !attemptId) {
        return { archived: 0, deleted: false, skipped: true };
    }

    try {
        await ensureArchiveTable();

        const snap = await loadSnapshot(txQuery, userId, examId);
        const source = ARCHIVE_SOURCES.includes(reason) ? reason : 'submit';

        const insertResult = await txQuery({
            query: `
                INSERT IGNORE INTO rhs_temporary_answer_archive
                    (attempt_id, user_id, exam_id, question_id, selected_option,
                     answer_source, username, student_name, exam_name, class_name,
                     created_at, archived_at)
                SELECT ?, ta.user_id, ta.exam_id, ta.question_id, ta.selected_option,
                       ?, ?, ?, ?, ?, ta.created_at, NOW()
                FROM rhs_temporary_answer ta
                WHERE ta.user_id = ? AND ta.exam_id = ?
            `,
            values: [
                attemptId, source,
                snap.username, snap.studentName, snap.examName, snap.className,
                userId, examId
            ]
        });

        // Hapus dari tabel live SETELAH arsip tersalin
        await txQuery({
            query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
            values: [userId, examId]
        });

        const archived = insertResult?.affectedRows || 0;
        if (archived === 0 && !uniqueKeyWarned) {
            // Bukan error fatal. Dua kemungkinan: tidak ada jawaban tersisa,
            // atau unique key belum ada sehingga INSERT diabaikan diam-diam.
            console.warn('[TempArchive] Tidak ada baris diarsipkan. ' +
                'Pastikan migrasi /api/setup sudah dijalankan (unique key uniq_attempt_question).');
            uniqueKeyWarned = true;
        }
        if (archived > 0) {
            console.log(`[TempArchive] ${archived} jawaban diarsipkan (source=${source}, attempt=${attemptId})`);
        }

        return { archived, deleted: true };
    } catch (err) {
        // JANGAN sampai menggagalkan submit siswa karena masalah arsip.
        // Data siswa sudah aman di tabel student_answer; arsip hanya bonus.
        console.error('[TempArchive] Gagal mengarsipkan jawaban sementara:', err.message);
        return { archived: 0, deleted: false, error: err.message };
    }
}

/**
 * Statistik arsip untuk dashboard / halaman arsip.
 */
export async function getArchiveStats() {
    await ensureArchiveTable();
    try {
        const rows = await query({
            query: `SELECT COUNT(*) AS total,
                           COUNT(DISTINCT attempt_id) AS attempts,
                           MIN(archived_at) AS oldest,
                           MAX(archived_at) AS newest
                    FROM rhs_temporary_answer_archive`,
            values: []
        });
        return rows[0] || { total: 0, attempts: 0, oldest: null, newest: null };
    } catch (err) {
        console.error('[TempArchive] Gagal mengambil statistik:', err.message);
        return { total: 0, attempts: 0, oldest: null, newest: null };
    }
}