import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { ensureArchiveTable, getArchiveStats, ARCHIVE_SOURCES } from '@/app/lib/temp-archive';
import { purgeExpiredTempAnswers, TEMP_RETENTION_DAYS } from '@/app/lib/temp-purge';
import { logFromRequest } from '@/app/lib/logger';
import {
    previewRestore, restoreArchivedAnswers, undoRestore,
    getRestoreHistory, RESTORE_MODES, recalculateAttemptScore
} from '@/app/lib/answer-restore';

export const dynamic = 'force-dynamic';

/**
 * Escape nilai untuk CSV (buka di Excel/InWords)
 */
function csvCell(value) {
    if (value === null || value === undefined) return '';
    let s = String(value);
    // Cegah formula injection saat dibuka di Excel
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (s.includes('"') || s.includes('\n') || s.includes(',')) {
        s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

const SOURCE_LABELS = {
    submit: 'Submit Manual',
    auto_submit: 'Auto Submit',
    reset_exam: 'Reset Ujian',
    delete_attempt: 'Hapus Attempt',
    safeguard: 'Safeguard'
};

async function getAdminSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user || session.user.roleName !== 'admin') return null;
    return session;
}

/**
 * GET
 *  - default        : daftar arsip dikelompokkan per attempt (ber paging + filter)
 *  - ?attempt_id=.. : rincian jawaban pada satu attempt
 *  - ?meta=1        : statistik arsip (total, tertua, terbaru)
 */
export async function GET(request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        await ensureArchiveTable();
        const { searchParams } = new URL(request.url);

        // --- Export CSV (cadangan di luar aplikasi) ---
        if (searchParams.get('export') === 'csv') {
            const csvAttemptId = searchParams.get('attempt_id');
            const csvSearch = (searchParams.get('search') || '').trim();
            const conditions = [];
            const csvValues = [];

            if (csvAttemptId) {
                conditions.push('a.attempt_id = ?');
                csvValues.push(csvAttemptId);
            }
            if (csvSearch) {
                conditions.push('(a.student_name LIKE ? OR a.username LIKE ? OR a.exam_name LIKE ?)');
                const w = `%${csvSearch}%`;
                csvValues.push(w, w, w);
            }
            const csvWhere = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

            const rows = await query({
                query: `
                    SELECT a.attempt_id, a.username, a.student_name, a.class_name, a.exam_name,
                           a.question_id, a.selected_option, a.answer_source,
                           a.created_at, a.archived_at,
                           q.question_text,
                           sa.selected_option AS final_answer,
                           sa.is_correct, sa.score_earned,
                           at.status AS attempt_status, at.score AS attempt_score
                    FROM rhs_temporary_answer_archive a
                    LEFT JOIN rhs_exam_questions q ON q.id = a.question_id
                    LEFT JOIN rhs_student_answer sa
                           ON sa.attempt_id = a.attempt_id AND sa.question_id = a.question_id
                    LEFT JOIN rhs_exam_attempts at ON at.id = a.attempt_id
                    ${csvWhere}
                    ORDER BY a.archived_at DESC, a.attempt_id DESC, a.question_id ASC
                    LIMIT 20000
                `,
                values: csvValues
            });

            const header = [
                'attempt_id', 'username', 'student_name', 'class_name', 'exam_name',
                'question_id', 'question_text', 'archived_answer', 'answer_source',
                'final_answer', 'is_correct', 'score_earned',
                'attempt_status', 'attempt_score', 'created_at', 'archived_at'
            ];

            const lines = [header.join(',')];
            rows.forEach(r => {
                lines.push([
                    r.attempt_id, r.username, r.student_name, r.class_name, r.exam_name,
                    r.question_id, r.question_text, r.selected_option, r.answer_source,
                    r.final_answer, r.is_correct, r.score_earned,
                    r.attempt_status, r.attempt_score, r.created_at, r.archived_at
                ].map(csvCell).join(','));
            });

            // BOM agar Excel membaca UTF-8 dengan benar
            const csv = '\uFEFF' + lines.join('\r\n');
            const stamp = new Date().toISOString().slice(0, 10);

            logFromRequest(request, session, 'ARCHIVE_EXPORT_CSV', 'warn', {
                details: `Export ${rows.length} baris arsip`
            });

            return new NextResponse(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="arsip-jawaban-${csvAttemptId ? `attempt-${csvAttemptId}-` : ''}${stamp}.csv"`
                }
            });
        }

        // --- Rincian satu attempt ---
        const attemptId = searchParams.get('attempt_id');
        if (attemptId) {
            const detail = await query({
                query: `
                    SELECT a.id, a.question_id, a.selected_option, a.answer_source,
                           a.created_at, a.archived_at,
                           a.username, a.student_name, a.exam_name, a.class_name,
                           q.question_text,
                           sa.selected_option AS final_answer,
                           sa.is_correct, sa.score_earned
                    FROM rhs_temporary_answer_archive a
                    LEFT JOIN rhs_exam_questions q ON q.id = a.question_id
                    LEFT JOIN rhs_student_answer sa
                           ON sa.attempt_id = a.attempt_id AND sa.question_id = a.question_id
                    WHERE a.attempt_id = ?
                    ORDER BY a.question_id ASC
                `,
                values: [attemptId],
            });

            // Pratinjau pemulihan + riwayat undo (opsional)
            let preview = null;
            let history = [];
            if (searchParams.get('preview') === '1') {
                preview = await previewRestore(attemptId).catch(() => null);
                history = await getRestoreHistory(attemptId).catch(() => []);
            }

            return NextResponse.json({
                attemptId: Number(attemptId),
                answers: detail,
                preview,
                history
            });
        }

        // --- Statistik ---
        if (searchParams.get('meta') === '1') {
            const stats = await getArchiveStats();
            const sources = await query({
                query: `SELECT answer_source, COUNT(*) AS c
                        FROM rhs_temporary_answer_archive
                        GROUP BY answer_source`,
                values: [],
            });
            return NextResponse.json({
                stats,
                sources: sources.map(s => ({
                    value: s.answer_source,
                    label: SOURCE_LABELS[s.answer_source] || s.answer_source,
                    count: s.c
                })),
                retentionDays: TEMP_RETENTION_DAYS,
                validSources: ARCHIVE_SOURCES
            });
        }

        // --- Daftar (kelompok per attempt) ---
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(200, Math.max(10, parseInt(searchParams.get('limit') || '25')));
        const offset = (page - 1) * limit;
        const search = (searchParams.get('search') || '').trim();
        const source = (searchParams.get('source') || '').trim();
        const examId = (searchParams.get('exam_id') || '').trim();
        const from = (searchParams.get('from') || '').trim();
        const to = (searchParams.get('to') || '').trim();

        const conditions = [];
        const values = [];

        if (search) {
            conditions.push('(a.student_name LIKE ? OR a.username LIKE ? OR a.exam_name LIKE ?)');
            const w = `%${search}%`;
            values.push(w, w, w);
        }
        if (source && ARCHIVE_SOURCES.includes(source)) {
            conditions.push('a.answer_source = ?');
            values.push(source);
        }
        if (examId) {
            conditions.push('a.exam_id = ?');
            values.push(examId);
        }
        if (from) {
            conditions.push('a.archived_at >= ?');
            values.push(from);
        }
        if (to) {
            conditions.push('a.archived_at <= ?');
            values.push(to + ' 23:59:59');
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const total = await query({
            query: `SELECT COUNT(DISTINCT a.attempt_id) AS total FROM rhs_temporary_answer_archive a ${where}`,
            values,
        });
        const totalAttempts = Number(total[0]?.total || 0);

        const groups = await query({
            query: `
                SELECT a.attempt_id, a.user_id, a.exam_id,
                       MAX(a.username) AS username,
                       MAX(a.student_name) AS student_name,
                       MAX(a.exam_name) AS exam_name,
                       MAX(a.class_name) AS class_name,
                       MAX(a.answer_source) AS answer_source,
                       COUNT(*) AS answer_count,
                       MAX(a.archived_at) AS archived_at,
                       MIN(a.created_at) AS first_answer_at,
                       MAX(a.created_at) AS last_answer_at,
                       at.id AS attempt_exists,
                       at.status AS attempt_status,
                       at.score AS attempt_score,
                       e.id AS exam_exists
                FROM rhs_temporary_answer_archive a
                LEFT JOIN rhs_exam_attempts at ON at.id = a.attempt_id
                LEFT JOIN rhs_exams e ON e.id = a.exam_id
                ${where}
                GROUP BY a.attempt_id, a.user_id, a.exam_id, at.id, at.status, at.score, e.id
                ORDER BY archived_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `,
            values,
        });

        const stats = await getArchiveStats();

        return NextResponse.json({
            groups: groups.map(g => ({
                ...g,
                answer_source_label: SOURCE_LABELS[g.answer_source] || g.answer_source,
                exam_id: Number(g.exam_id),
                attempt_exists: !!g.attempt_exists,
                exam_exists: !!g.exam_exists,
                attempt_id: Number(g.attempt_id),
                attempt_score: g.attempt_score !== null && g.attempt_score !== undefined
                    ? Number(Number(g.attempt_score).toFixed(2))
                    : null
            })),
            total: totalAttempts,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(totalAttempts / limit)),
            stats,
            retentionDays: TEMP_RETENTION_DAYS,
            sources: ARCHIVE_SOURCES.map(s => ({ value: s, label: SOURCE_LABELS[s] || s }))
        });
    } catch (error) {
        console.error('[ArchiveAnswers] GET error:', error);
        return NextResponse.json({ message: 'Gagal memuat arsip jawaban', error: error.message }, { status: 500 });
    }
}

/**
 * POST
 *  { action: 'purge' }                                  -> bersihkan arsip yang lewat retensi
 *  { action: 'purge', dryRun: true }                    -> hanya hitung berapa yang akan dihapus
 *  { action: 'restore', attemptId, mode }               -> pulihkan jawaban dari arsip
 *  { action: 'undo', attemptId }                        -> batalkan pemulihan terakhir
 *  { action: 'recalculate', attemptId }                 -> hitung ulang skor saja
 */
export async function POST(request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { action, dryRun } = body;

        if (action === 'purge') {
            const result = await purgeExpiredTempAnswers(TEMP_RETENTION_DAYS, !!dryRun);
            const stats = await getArchiveStats();

            return NextResponse.json({
                message: dryRun
                    ? `${result.wouldDelete} baris akan dihapus (retensi ${result.retentionDays} hari)`
                    : `${result.deleted} baris arsip dihapus. Sisa ${result.remaining} baris.`,
                ...result,
                stats,
                triggeredBy: session.user.username
            });
        }

        if (action === 'restore') {
            const { attemptId, mode = 'rescore' } = body;
            if (!attemptId) return NextResponse.json({ message: 'attemptId wajib diisi' }, { status: 400 });
            if (!RESTORE_MODES.includes(mode)) {
                return NextResponse.json({ message: `Mode tidak dikenal: ${mode}` }, { status: 400 });
            }

            const result = await restoreArchivedAnswers({
                attemptId,
                mode,
                adminUsername: session.user.username
            });

            return NextResponse.json({
                message: result.recreated
                    ? (mode === 'reopen'
                        ? `Percobaan lama sudah dihapus, dibuat percobaan baru #${result.newAttemptId} berisi ${result.restored} jawaban dari arsip dan dibuka untuk siswa.`
                        : `Percobaan lama sudah dihapus, dibuat percobaan baru #${result.newAttemptId} berisi ${result.restored} jawaban dari arsip (skor ${Number(result.score).toFixed(2)}).`)
                    : (mode === 'reopen'
                        ? `${result.restored} jawaban dipulihkan, ujian dibuka kembali untuk siswa.`
                        : `${result.restored} jawaban dipulihkan dan skor diperbarui (${Number(result.previousScore || 0).toFixed(2)} → ${Number(result.score).toFixed(2)}).`),
                ...result
            });
        }

        if (action === 'undo') {
            const { attemptId } = body;
            if (!attemptId) return NextResponse.json({ message: 'attemptId wajib diisi' }, { status: 400 });

            const result = await undoRestore({ attemptId, adminUsername: session.user.username });
            return NextResponse.json({
                message: `Pemulihan dibatalkan, ${result.undone} jawaban dikembalikan ke kondisi sebelumnya.`,
                ...result
            });
        }

        if (action === 'recalculate') {
            const { attemptId } = body;
            if (!attemptId) return NextResponse.json({ message: 'attemptId wajib diisi' }, { status: 400 });

            const result = await recalculateAttemptScore(attemptId);
            if (!result) return NextResponse.json({ message: 'Percobaan tidak ditemukan' }, { status: 404 });

            return NextResponse.json({
                message: `Skor dihitung ulang: ${Number(result.score).toFixed(2)} (${result.answerCount} jawaban)`,
                ...result
            });
        }

        return NextResponse.json({ message: `Aksi tidak dikenal: ${action}` }, { status: 400 });
    } catch (error) {
        console.error('[ArchiveAnswers] POST error:', error);
        return NextResponse.json({
            message: error.message || 'Aksi gagal',
            error: error.message
        }, { status: 500 });
    }
}