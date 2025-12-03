import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// POST handler to update attempt state (doubtful questions, current index)
export async function POST(request) {
  const session = await getSession(request);

  if (!session.user || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { attemptId, doubtfulQuestions, lastQuestionIndex } = await request.json();

    if (!attemptId) {
      return NextResponse.json({ message: 'Attempt ID is required' }, { status: 400 });
    }

    const fieldsToUpdate = [];
    const values = [];

    if (doubtfulQuestions !== undefined) {
        fieldsToUpdate.push('doubtful_questions = ?');
        values.push(JSON.stringify(doubtfulQuestions));
    }

    if (lastQuestionIndex !== undefined) {
        fieldsToUpdate.push('last_question_index = ?');
        values.push(lastQuestionIndex);
    }

    if (fieldsToUpdate.length === 0) {
        return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    values.push(attemptId, session.user.id);

    const sql = `
        UPDATE rhs_exam_attempts 
        SET ${fieldsToUpdate.join(', ')} 
        WHERE id = ? AND user_id = ?
    `;

    const result = await query({
        query: sql,
        values: values,
    });

    if (result.affectedRows === 0) {
        return NextResponse.json({ message: 'Attempt not found or you are not authorized to update it.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Attempt updated successfully' });

  } catch (error) {
    console.error('Failed to update exam attempt:', error);
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}
