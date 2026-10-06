import { query } from './db';
import { calculateQuestionScore } from './scoring';

/**
 * Parse JSON dengan aman (MySQL JSON bisa come back string / object)
 */
export function parseJsonSafe(value, fallback = {}) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
        const parsed = JSON.parse(value);
        return (parsed && typeof parsed === 'object') ? parsed : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Ambil daftar soal + metadata penilaiannya.
 */
export async function loadExamQuestions(examId) {
    const allQuestions = await query({
        query: `SELECT id, options, correct_option, question_type, points, scoring_strategy, scoring_metadata
                FROM rhs_exam_questions WHERE exam_id = ?`,
        values: [examId],
    });

    const questionInfoMap = allQuestions.reduce((acc, q) => {
        acc[String(q.id)] = {
            correct: q.correct_option,
            type: q.question_type,
            options: q.options,
            points: q.points || 1,
            strategy: q.scoring_strategy || 'standard',
            metadata: parseJsonSafe(q.scoring_metadata, {})
        };
        return acc;
    }, {});

    return { allQuestions, questionInfoMap };
}

/**
 * Nilai satu soal → flag is_correct (logic ini harus identik dengan penilaian manual)
 */
export function resolveIsCorrect(qInfo, studentAnswer, earned) {
    if (!qInfo) return false;
    if (qInfo.type === 'essay') {
        return earned > 0;
    }
    if (qInfo.type === 'matching') {
        return earned >= qInfo.points;
    }
    return qInfo.correct === studentAnswer;
}

/**
 * Menghitung skor + menyiapkan baris untuk disimpan ke rhs_student_answer.
 * Dipakai oleh submit manual (client) maupun auto-submit (server) agar
 * hasilnya selalu identik.
 *
 * @param {number} examId
 * @param {object} answers  map { question_id: selected_option }
 */
export async function gradeAnswers(examId, answers = {}) {
    const { allQuestions, questionInfoMap } = await loadExamQuestions(examId);

    let earnedPointsTotal = 0;
    let maxPointsTotal = 0;
    const itemScores = {};

    for (const q of allQuestions) {
        const qId = String(q.id);
        const qInfo = questionInfoMap[qId];
        if (!qInfo) continue;

        maxPointsTotal += qInfo.points;
        const studentAnswer = answers[qId];

        let earned = 0;
        if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
            earned = calculateQuestionScore(qInfo, studentAnswer) || 0;
        }

        earnedPointsTotal += earned;
        itemScores[qId] = earned;
    }

    const score = maxPointsTotal > 0 ? (earnedPointsTotal / maxPointsTotal) * 100 : 0;

    const rows = [];
    Object.keys(answers).forEach(qId => {
        const selectedOption = answers[qId];
        if (selectedOption === null || selectedOption === undefined) return;
        // Hanya simpan jawaban untuk soal yang benar-benar milik ujian ini
        // (mencegah id soal dari ujian lain ikut tersimpan).
        const qInfo = questionInfoMap[qId];
        if (!qInfo) return;
        const earned = itemScores[qId] || 0;
        rows.push({
            question_id: Number(qId),
            selected_option: typeof selectedOption === 'string' ? selectedOption : JSON.stringify(selectedOption),
            is_correct: resolveIsCorrect(qInfo, selectedOption, earned),
            score_earned: earned
        });
    });

    return {
        score,
        maxPoints: maxPointsTotal,
        earnedPoints: earnedPointsTotal,
        itemScores,
        questionInfoMap,
        questionIds: allQuestions.map(q => String(q.id)),
        rows
    };
}

/**
 * Simpan jawaban ke rhs_student_answer dengan UPSERT.
 * Tabel punya UNIQUE (attempt_id, question_id) sehingga aman dipanggil
 * berulang kali (mis. submit_manual setelah auto-submit) tanpa duplikat.
 */
export async function upsertStudentAnswers(txQuery, { userId, examId, attemptId, rows }) {
    if (!rows || rows.length === 0) return 0;

    // Batasi per-batch agar tidak melewati batas placeholder MySQL
    const CHUNK = 200;
    let written = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const valueTuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = [];
        chunk.forEach(row => {
            flatValues.push(userId, examId, attemptId, row.question_id, row.selected_option, row.is_correct, row.score_earned);
        });

        await txQuery({
            query: `
                INSERT INTO rhs_student_answer (user_id, exam_id, attempt_id, question_id, selected_option, is_correct, score_earned)
                VALUES ${valueTuples}
                ON DUPLICATE KEY UPDATE
                    selected_option = VALUES(selected_option),
                    is_correct = VALUES(is_correct),
                    score_earned = VALUES(score_earned)
            `,
            values: flatValues,
        });

        written += chunk.length;
    }

    return written;
}