import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { logFromRequest } from '@/app/lib/logger';

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
    const { examId, answers, attemptId } = await request.json();

    if (!examId || !answers || !attemptId) {
      return NextResponse.json({ message: 'Missing examId, answers, or attemptId' }, { status: 400 });
    }

    // 1. Get all questions for the exam to get the total number and correct options
    const allQuestions = await query({
      query: 'SELECT id, correct_option FROM rhs_exam_questions WHERE exam_id = ?',
      values: [examId],
    });

    // Check require_all_answered setting
    const settingsRows = await query({
      query: 'SELECT require_all_answered FROM rhs_exam_settings WHERE exam_id = ?',
      values: [examId],
    });
    const requireAllAnswered = settingsRows.length > 0 && Boolean(settingsRows[0].require_all_answered);

    if (requireAllAnswered && allQuestions.length > 0) {
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
    let correctCount = 0;
    const correctOptionsMap = allQuestions.reduce((acc, q) => {
      acc[q.id] = q.correct_option;
      return acc;
    }, {});

    for (const questionId in answers) {
      if (answers[questionId] === correctOptionsMap[questionId]) {
        correctCount++;
      }
    }

    const totalQuestions = allQuestions.length;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

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
        const valueTuples = receivedQuestionIds.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const flattenedValues = [];
        receivedQuestionIds.forEach(qId => {
          const selectedOption = answers[qId];
          const isCorrect = correctOptionsMap[qId] === selectedOption;
          flattenedValues.push(session.user.id, examId, attemptId, qId, selectedOption, isCorrect);
        });

        // INSERT IGNORE: if auto-submit already saved some answers, skip duplicates
        await txQuery({
          query: `
            INSERT IGNORE INTO rhs_student_answer (user_id, exam_id, attempt_id, question_id, selected_option, is_correct) 
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
    });

    logFromRequest(request, session, 'EXAM_SUBMIT', 'info', { examId, score: score.toFixed(1), correct: correctCount, total: totalQuestions });

    return NextResponse.json({ message: 'Exam submitted successfully', score: score });

  } catch (error) {
    console.error('Submit Error:', error);
    return NextResponse.json({ message: 'Failed to submit exam', error: error.message }, { status: 500 });
  }
}
