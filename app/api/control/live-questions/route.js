import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { MATRIX_TYPE, normalizeMatrixColumns, normalizeMatrixItems, normalizeMatrixKeys, getMatrixKeys } from '@/app/lib/matrix';

/**
 * Metadata soal untuk modal "Jawaban" di panel kontrol.
 *
 * Kunci jawaban SENGAJA tidak dikirim secara default. Guru yang supervising
 * tidak boleh bisa judging sambil mengarahkan siswa, dan kunci yang ikut
 * terkirim ke browser adalah kebocoran yang tidak perlu terjadi.
 * `?reveal=1` mengirim kunci + metadata penilaian supaya guru bisa menghitung
 * skor sendiri di modal.
 *
 * Access dibatasi ke kelas yang diampu guru, dan hanya untuk ujian yang
 * benar-benar sedang dikerjakan siswa miliknya.
 */
export async function GET(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
        return Response.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = Number(searchParams.get('exam_id'));
    const reveal = searchParams.get('reveal') === '1';

    if (!examId || Number.isNaN(examId)) {
        return Response.json({ message: 'exam_id wajib diisi' }, { status: 400 });
    }

    try {
        const userId = session.user.id;
        const isTeacher = session.user.roleName === 'teacher';

        // Guru hanya boleh melihat soal ujian yang sedang dikerjakan siswa
        // dari kelas yang diampu-nya. Admin bebas.
        if (isTeacher) {
            const owned = await query({
                query: `SELECT COUNT(*) as total
                        FROM rhs_exam_attempts ea
                        JOIN rhs_users u ON u.id = ea.user_id
                        JOIN rhs_teacher_classes tc ON tc.class_id = u.class_id AND tc.teacher_id = ?
                        WHERE ea.exam_id = ? AND ea.status = 'in_progress'`,
                values: [userId, examId],
            });
            if (!owned.length || Number(owned[0].total) === 0) {
                return Response.json({ message: 'Tidak ada siswa kelas Anda yang sedang mengerjakan ujian ini.' }, { status: 403 });
            }
        }

        const rows = await query({
            query: `SELECT id, exam_id, question_text, options, matrix_items,
                           correct_option, question_type, points, scoring_strategy, scoring_metadata
                    FROM rhs_exam_questions
                    WHERE exam_id = ?
                    ORDER BY sort_order ASC, id ASC`,
            values: [examId],
        });

        const questions = rows.map(row => {
            const isMatrix = row.question_type === MATRIX_TYPE;
            const base = {
                id: row.id,
                question_text: row.question_text,
                question_type: row.question_type,
                points: Number(row.points) || 1,
                scoring_strategy: row.scoring_strategy || 'standard',
            };

            // score_info hanya berisi KUNCI, jadi jelas harus disembunyikan sampai
            // guru menekan tombolnya. Bentuknya sengaja sama persis dengan qInfo
            // milik app/lib/scoring.js supaya modal cukup memanggil
            // calculateQuestionScore() dan angka yang tampil tidak pernah
            // menyimpang dari penilaian resmi.
            if (reveal) {
                base.score_info = {
                    type: row.question_type,
                    correct: row.correct_option,
                    points: base.points,
                    strategy: row.scoring_strategy || 'standard',
                    metadata: { matrixKeys: getMatrixKeys(row.scoring_metadata) },
                };
            }

            if (isMatrix) {
                const columns = normalizeMatrixColumns(row.options);
                const items = normalizeMatrixItems(row.matrix_items);
                base.options = columns;
                base.matrix_items = items;
                // matrix_keys adalah kunci jawaban -> WAJIB ikut tersembunyi
                // sampai guru menekan tombol buka kunci.
                if (reveal) {
                    base.matrix_keys = getMatrixKeys(row.scoring_metadata);
                    base.score_info.metadata.matrixItemIds = items.map(item => item.id);
                }
                return base;
            }

            let parsedOptions = {};
            try {
                parsedOptions = typeof row.options === 'string' ? JSON.parse(row.options || '{}') : (row.options || {});
            } catch {
                parsedOptions = {};
            }

            if (row.question_type === 'matching') {
                const pairs = parsedOptions.pairs || [];
                base.options = {
                    pairs: pairs.map(pair => ({ id: pair.id, p: pair.p })),
                    responses: pairs.map(pair => pair.r),
                };
                if (reveal) {
                    // scoring.js butuh sisi kanan (kunci) untuk mencocokkan.
                    base.score_info.options = { pairs };
                    // Petakan kunci per baris di server. Client tidak boleh
                    // mengurai string "1-y,2-x" sendiri karena teks respons
                    // bisa mengandung tanda hubung dan merusakpecahan.
                    const keyMap = new Map(
                        String(row.correct_option || '')
                            .split(',')
                            .map(p => p.trim().split('-'))
                            .filter(p => p.length === 2)
                            .map(([id, response]) => [String(id), response])
                    );
                    base.pair_keys = pairs.map(pair => keyMap.get(String(pair.id)) || null);
                }
                return base;
            }

            base.options = Object.entries(parsedOptions)
                .filter(([, text]) => String(text ?? '').trim() !== '')
                .map(([key, text]) => ({ key, text }));

            if (reveal) {
                base.scoring_metadata = row.scoring_metadata;
                base.score_info.metadata = (() => {
                    try {
                        const meta = typeof row.scoring_metadata === 'string' ? JSON.parse(row.scoring_metadata) : (row.scoring_metadata || {});
                        return meta && typeof meta === 'object' ? meta : {};
                    } catch { return {}; }
                })();
            }
            return base;
        });

        return Response.json({ exam_id: examId, revealed: reveal, questions });
    } catch (error) {
        console.error('Live answers questions error:', error);
        return Response.json({ message: 'Gagal memuat soal ujian', error: error.message }, { status: 500 });
    }
}