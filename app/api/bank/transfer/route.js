import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { invalidateExamCache, recalculateExamScores, distributeExamPoints } from '@/app/lib/exams';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { mode, examId, folderId, questionIds } = await request.json();

    if (mode === 'exam_to_bank') {
      if (!examId || !folderId || !questionIds || !Array.isArray(questionIds)) {
        return NextResponse.json({ message: 'Missing required fields for exam_to_bank' }, { status: 400 });
      }

      await transaction(async (tQuery) => {
        for (const qId of questionIds) {
          // Fetch question from exam
          const sourceQ = await tQuery({
            query: `SELECT * FROM rhs_exam_questions WHERE id = ? AND exam_id = ?`,
            values: [qId, examId]
          });

          if (sourceQ.length > 0) {
            const q = sourceQ[0];
            // Insert into bank
            await tQuery({
              query: `INSERT INTO rhs_question_bank (
                folder_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              values: [
                folderId,
                q.question_text,
                typeof q.options === 'string' ? q.options : JSON.stringify(q.options),
                q.correct_option,
                q.question_type,
                q.points,
                q.scoring_strategy,
                typeof q.scoring_metadata === 'string' ? q.scoring_metadata : JSON.stringify(q.scoring_metadata),
                session.user.id
              ]
            });
          }
        }
      });

      return NextResponse.json({ message: `${questionIds.length} questions exported to bank successfully` });

    } else if (mode === 'bank_to_exam') {
      if (!examId || !questionIds || !Array.isArray(questionIds)) {
        return NextResponse.json({ message: 'Missing required fields for bank_to_exam' }, { status: 400 });
      }

      await transaction(async (tQuery) => {
        // Get current max sort_order for the exam
        const maxSortResult = await tQuery({
          query: `SELECT MAX(sort_order) as maxSort FROM rhs_exam_questions WHERE exam_id = ?`,
          values: [examId]
        });
        let nextSort = (maxSortResult[0].maxSort || 0) + 1;

        for (const qId of questionIds) {
          // Fetch from bank
          const sourceQ = await tQuery({
            query: `SELECT * FROM rhs_question_bank WHERE id = ?`,
            values: [qId]
          });

          if (sourceQ.length > 0) {
            const q = sourceQ[0];
            // Insert into exam questions
            await tQuery({
              query: `INSERT INTO rhs_exam_questions (
                exam_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              values: [
                examId,
                q.question_text,
                typeof q.options === 'string' ? q.options : JSON.stringify(q.options),
                q.correct_option,
                q.question_type,
                q.points,
                q.scoring_strategy,
                typeof q.scoring_metadata === 'string' ? q.scoring_metadata : JSON.stringify(q.scoring_metadata),
                nextSort++
              ]
            });
          }
        }
      });

      // Post-import logic (Cache invalidation & Score recalculation)
      await invalidateExamCache(examId);
      
      const examSettings = await query({
        query: 'SELECT auto_distribute FROM rhs_exams WHERE id = ?',
        values: [examId],
      });

      if (examSettings.length > 0 && examSettings[0].auto_distribute) {
        await distributeExamPoints(examId);
      }
      await recalculateExamScores(examId);
      await invalidateExamCache(examId);

      return NextResponse.json({ message: `${questionIds.length} questions imported from bank successfully` });

    } else {
      return NextResponse.json({ message: 'Invalid mode' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in bank transfer:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
