import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function checkAdmin(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  return session.user && session.user.roleName === 'admin';
}

// GET handler to fetch all questions for an exam
export async function GET(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('examId');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    const questions = await query({
      query: 'SELECT * FROM rhs_exam_questions WHERE exam_id = ? ORDER BY created_at ASC',
      values: [examId],
    });
    return NextResponse.json(questions);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve questions', error: error.message }, { status: 500 });
  }
}

// POST handler to add a new question
export async function POST(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, questionText, options, correctOption } = await request.json();
    if (!examId || !questionText || !options || !correctOption) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const result = await query({
      query: 'INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option) VALUES (?, ?, ?, ?)',
      values: [examId, questionText, JSON.stringify(options), correctOption],
    });

    return NextResponse.json({ message: 'Question added successfully', id: result.insertId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to add question', error: error.message }, { status: 500 });
  }
}

// DELETE handler to remove a question
export async function DELETE(request) {
    if (!await checkAdmin(request)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    try {
      const { id } = await request.json();
      if (!id) {
        return NextResponse.json({ message: 'Question ID is required' }, { status: 400 });
      }
  
      const result = await query({
        query: 'DELETE FROM rhs_exam_questions WHERE id = ?',
        values: [id],
      });

      if (result.affectedRows === 0) {
        return NextResponse.json({ message: 'Question not found' }, { status: 404 });
      }
  
      return NextResponse.json({ message: 'Question deleted successfully' });
    } catch (error) {
      return NextResponse.json({ message: 'Failed to delete question', error: error.message }, { status: 500 });
    }
  }