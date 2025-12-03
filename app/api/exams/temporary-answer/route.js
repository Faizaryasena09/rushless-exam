import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch temporary answers for a user in an exam
export async function GET(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const answers = await query({
      query: `
        SELECT question_id, selected_option 
        FROM rhs_temporary_answer 
        WHERE user_id = ? AND exam_id = ?
      `,
      values: [session.user.id, examId],
    });

    // Convert the array of objects to a more convenient { questionId: selectedOption } format
    const answersMap = answers.reduce((acc, answer) => {
      acc[answer.question_id] = answer.selected_option;
      return acc;
    }, {});

    return NextResponse.json(answersMap);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve temporary answers', error: error.message }, { status: 500 });
  }
}

// POST handler to save (upsert) a temporary answer
export async function POST(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, questionId, selectedOption } = await request.json();

    if (examId === undefined || questionId === undefined) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    await query({
      query: `
        INSERT INTO rhs_temporary_answer (user_id, exam_id, question_id, selected_option)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option)
      `,
      values: [session.user.id, examId, questionId, selectedOption],
    });

    return NextResponse.json({ message: 'Answer saved temporarily' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save temporary answer', error: error.message }, { status: 500 });
  }
}
