import { query, transaction } from './db';
import { calculateQuestionScore } from './scoring';

/**
 * Recalculates all scores for a given exam.
 * Useful when questions are updated, deleted, or points are changed.
 */
export async function recalculateExamScores(examId) {
    console.log(`[Recalculation] Starting for exam ${examId}`);
    
    // 1. Get all current questions for this exam
    const questions = await query({
        query: 'SELECT id, correct_option, question_type, points, scoring_strategy, scoring_metadata FROM rhs_exam_questions WHERE exam_id = ?',
        values: [examId]
    });

    if (questions.length === 0) {
        // If no questions, all attempts should ideally be 0? 
        // But usually this means questions were deleted.
        await query({
            query: "UPDATE rhs_exam_attempts SET score = 0 WHERE exam_id = ? AND status = 'completed'",
            values: [examId]
        });
        return;
    }

    const questionInfoMap = questions.reduce((acc, q) => {
        acc[q.id] = {
            correct: q.correct_option,
            type: q.question_type,
            points: (q.points !== undefined && q.points !== null) ? q.points : 1.0,
            strategy: q.scoring_strategy || 'standard',
            metadata: typeof q.scoring_metadata === 'string' ? JSON.parse(q.scoring_metadata) : (q.scoring_metadata || {})
        };
        return acc;
    }, {});

    const totalMaxPoints = questions.reduce((sum, q) => {
        const p = (q.points !== undefined && q.points !== null) ? q.points : 1.0;
        return sum + p;
    }, 0);

    // 2. Get all completed attempts
    const attempts = await query({
        query: "SELECT id FROM rhs_exam_attempts WHERE exam_id = ? AND status = 'completed'",
        values: [examId]
    });

    for (const attempt of attempts) {
        const attemptId = attempt.id;

        // Fetch student answers for this attempt
        const answers = await query({
            query: "SELECT question_id, selected_option FROM rhs_student_answer WHERE attempt_id = ?",
            values: [attemptId]
        });

        let earnedTotal = 0;

        await transaction(async (txQuery) => {
            for (const ans of answers) {
                const qInfo = questionInfoMap[ans.question_id];
                if (!qInfo) {
                    // Question was likely deleted, score earned for it should be 0
                    await txQuery({
                        query: "UPDATE rhs_student_answer SET score_earned = 0, is_correct = 0 WHERE attempt_id = ? AND question_id = ?",
                        values: [attemptId, ans.question_id]
                    });
                    continue;
                }

                const earned = calculateQuestionScore(qInfo, ans.selected_option);
                earnedTotal += earned;

                // Update individual answer
                let isCorrect = false;
                if (qInfo.type === 'essay') {
                    isCorrect = earned > 0;
                } else {
                    isCorrect = qInfo.correct === ans.selected_option;
                }

                await txQuery({
                    query: "UPDATE rhs_student_answer SET score_earned = ?, is_correct = ? WHERE attempt_id = ? AND question_id = ?",
                    values: [earned, isCorrect, attemptId, ans.question_id]
                });
            }

            // Update entire attempt score
            const examSettings = await txQuery({
                query: "SELECT scoring_mode FROM rhs_exams WHERE id = ?",
                values: [examId]
            });
            const scoringMode = examSettings[0]?.scoring_mode || 'percentage';

            const finalScore = (scoringMode === 'raw') 
                ? earnedTotal 
                : (totalMaxPoints > 0 ? (earnedTotal / totalMaxPoints) * 100 : 0);

            await txQuery({
                query: "UPDATE rhs_exam_attempts SET score = ? WHERE id = ?",
                values: [finalScore, attemptId]
            });
        });
    }

    console.log(`[Recalculation] Finished for exam ${examId}. Processed ${attempts.length} attempts.`);
}

/**
 * Distributes total_target_score equally among all questions in an exam.
 */
export async function distributeExamPoints(examId) {
    console.log(`[Distribution] Starting for exam ${examId}`);
    
    const examData = await query({
        query: "SELECT total_target_score FROM rhs_exams WHERE id = ?",
        values: [examId]
    });

    if (examData.length === 0) return;
    const targetScore = examData[0].total_target_score || 100;

    const questions = await query({
        query: "SELECT id FROM rhs_exam_questions WHERE exam_id = ?",
        values: [examId]
    });

    if (questions.length === 0) return;

    const pointsPerQuestion = targetScore / questions.length;

    await transaction(async (txQuery) => {
        for (const q of questions) {
            await txQuery({
                query: "UPDATE rhs_exam_questions SET points = ? WHERE id = ?",
                values: [pointsPerQuestion, q.id]
            });
        }
    });

    console.log(`[Distribution] Finished. Set ${pointsPerQuestion} points for ${questions.length} questions.`);
}
