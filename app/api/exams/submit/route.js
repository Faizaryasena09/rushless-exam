import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// POST handler for final exam submission
export async function POST(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, answers } = await request.json();

    if (!examId || !answers) {
      return NextResponse.json({ message: 'Missing examId or answers' }, { status: 400 });
    }

    const receivedQuestionIds = Object.keys(answers).filter(id => answers[id] !== null);

    if (receivedQuestionIds.length === 0) {
      await query({
        query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
        values: [session.user.id, examId],
      });
      return NextResponse.json({ message: 'Exam submitted with no answers.' });
    }

    const placeholders = receivedQuestionIds.map(() => '?').join(',');
    const validQuestions = await query({
      query: `SELECT id, correct_option FROM rhs_exam_questions WHERE id IN (${placeholders})`,
      values: receivedQuestionIds,
    });

    if (validQuestions.length > 0) {
      const valueTuples = validQuestions.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const flattenedValues = [];
      validQuestions.forEach(q => {
        const selectedOption = answers[q.id];
        const isCorrect = q.correct_option === selectedOption;
        flattenedValues.push(session.user.id, examId, q.id, selectedOption, isCorrect);
      });

      await query({
        query: `
          INSERT INTO rhs_student_answer (user_id, exam_id, question_id, selected_option, is_correct) 
          VALUES ${valueTuples}
        `,
        values: flattenedValues,
      });
    }

    await query({
      query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
      values: [session.user.id, examId],
    });

    return NextResponse.json({ message: 'Exam submitted successfully' });

  } catch (error) {
    console.error('Submit Error:', error);
    return NextResponse.json({ message: 'Failed to submit exam', error: error.message }, { status: 500 });
  }
}
