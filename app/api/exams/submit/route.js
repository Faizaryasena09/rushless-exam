import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { logFromRequest } from '@/app/lib/logger';
import { calculateQuestionScore } from '@/app/lib/scoring';
import redis, { isRedisReady } from '@/app/lib/redis';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// POST handler for final exam submission
export async function POST(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, answers, attemptId, isForce } = await request.json();

    if (!examId || !answers || !attemptId) {
      return NextResponse.json({ message: 'Missing examId, answers, or attemptId' }, { status: 400 });
    }

    // 1. Get all questions for the exam to get the total number and correct options
    const allQuestions = await query({
      query: 'SELECT id, correct_option, question_type, points, scoring_strategy, scoring_metadata FROM rhs_exam_questions WHERE exam_id = ?',
      values: [examId],
    });

    // Check require_all_answered setting
    const settingsRows = await query({
      query: 'SELECT require_all_answered FROM rhs_exam_settings WHERE exam_id = ?',
      values: [examId],
    });
    const requireAllAnswered = settingsRows.length > 0 && Boolean(settingsRows[0].require_all_answered);

    if (requireAllAnswered && allQuestions.length > 0 && !isForce) {
      const answeredQuestionIds = new Set(Object.keys(answers).filter(id => answers[id] !== null && answers[id] !== undefined));
      const unansweredCount = allQuestions.filter(q => !answeredQuestionIds.has(String(q.id))).length;
      if (unansweredCount > 0) {
        return NextResponse.json(
          { message: `Semua soal harus dijawab sebelum mengumpulkan. Masih ada ${unansweredCount} soal yang belum dijawab.` },
          { status: 422 }
        );
      }
    }

    if (allQuestions.length === 0) {
      // No questions in the exam, so score is 0. Use transaction for atomicity.
      await transaction(async (txQuery) => {
        await txQuery({
          query: `
            UPDATE rhs_exam_attempts 
            SET status = 'completed', end_time = NOW(), score = 0 
            WHERE id = ? AND user_id = ? AND status = 'in_progress'
          `,
          values: [attemptId, session.user.id],
        });
      });
      return NextResponse.json({ message: 'Exam submitted. No questions found, score is 0.' });
    }

    // 2. Calculate score
    let earnedPointsTotal = 0;
    let maxPointsTotal = 0;
    const itemScores = {}; // Map to store earned points per question for DB insertion
    
    const questionInfoMap = allQuestions.reduce((acc, q) => {
      acc[q.id] = { 
        correct: q.correct_option, 
        type: q.question_type,
        points: q.points || 1,
        strategy: q.scoring_strategy || 'standard',
        metadata: typeof q.scoring_metadata === 'string' ? JSON.parse(q.scoring_metadata) : (q.scoring_metadata || {})
      };
      return acc;
    }, {});

    for (const q of allQuestions) {
      const qId = String(q.id);
      const qInfo = questionInfoMap[qId];
      if (!qInfo) continue;

      maxPointsTotal += qInfo.points;
      const studentAnswer = answers[qId];
      
      let earnedForThisQuestion = 0;
      if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
        earnedForThisQuestion = calculateQuestionScore(qInfo, studentAnswer);
      }
       earnedPointsTotal += earnedForThisQuestion;
       itemScores[qId] = earnedForThisQuestion;
    }

    const score = maxPointsTotal > 0 ? (earnedPointsTotal / maxPointsTotal) * 100 : 0;

    // 3-5. Atomically: update attempt + save answers + clean up temp answers
    await transaction(async (txQuery) => {
      // IDEMPOTENT GATE: Claim the attempt by updating status.
      // WHERE status = 'in_progress' ensures only one process wins (auto-submit or manual submit).
      const updateResult = await txQuery({
        query: `
          UPDATE rhs_exam_attempts 
          SET status = 'completed', end_time = NOW(), score = ? 
          WHERE id = ? AND user_id = ? AND status = 'in_progress'
        `,
        values: [score, attemptId, session.user.id],
      });

      // If affectedRows = 0, auto-submit already completed this attempt. That's fine — just skip.
      if (updateResult.affectedRows === 0) {
        return;
      }

      // 4. Save the answers to the permanent student_answer table
      const receivedQuestionIds = Object.keys(answers).filter(id => answers[id] !== null);
      if (receivedQuestionIds.length > 0) {
        const valueTuples = receivedQuestionIds.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flattenedValues = [];
        receivedQuestionIds.forEach(qId => {
          const selectedOption = answers[qId];
          const qInfo = questionInfoMap[qId];
          let isCorrect = false;
          if (qInfo) {
              if (qInfo.type === 'essay') {
                  isCorrect = (itemScores[qId] || 0) > 0; // Better indicator
              } else if (qInfo.type === 'multiple_choice_complex') {
                  isCorrect = qInfo.correct === selectedOption;
              } else {
                  isCorrect = qInfo.correct === selectedOption;
              }
          }
          const earned = itemScores[qId] || 0;
          flattenedValues.push(session.user.id, examId, attemptId, qId, selectedOption, isCorrect, earned);
        });

        // INSERT IGNORE: if auto-submit already saved some answers, skip duplicates
        await txQuery({
          query: `
            INSERT IGNORE INTO rhs_student_answer (user_id, exam_id, attempt_id, question_id, selected_option, is_correct, score_earned) 
            VALUES ${valueTuples}
          `,
          values: flattenedValues,
        });
      }

      // 5. Clean up temporary answers
      await txQuery({
        query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
        values: [session.user.id, examId],
      });

      // 6. Invalidate Redis Caches
      if (isRedisReady()) {
        const userId = session.user.id;
        await Promise.all([
            redis.del(`exam:active-attempt:${userId}:${examId}`),
            redis.del(`exam:attempt-meta:${userId}:${examId}`),
            redis.del(`temp:ans:${userId}:${examId}`),
            redis.srem(`user:active_exams:${userId}`, examId)
        ]).catch(() => {});
      }
    });

    logFromRequest(request, session, 'EXAM_SUBMIT', 'info', { examId, score: score.toFixed(1), earned: earnedPointsTotal.toFixed(1), max: maxPointsTotal });

    return NextResponse.json({ message: 'Exam submitted successfully', score: score });

  } catch (error) {
    console.error('Submit Error:', error);
    return NextResponse.json({ message: 'Failed to submit exam', error: error.message }, { status: 500 });
  }
}
