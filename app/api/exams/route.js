import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';

export async function GET() {
  // Check for active session to protect the route
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const exams = await query({
      query: 'SELECT id, exam_name, description, created_at FROM rhs_exams ORDER BY created_at DESC',
      values: [],
    });
    return NextResponse.json({ exams }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  // 1. Check for active session to protect the route
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get data from the request body
  const { exam_name, description } = await request.json();

  // 3. Validate input
  if (!exam_name) {
    return NextResponse.json({ message: 'Exam name is required' }, { status: 400 });
  }

  // 4. Insert into the database
  try {
    const result = await query({
      query: 'INSERT INTO rhs_exams (exam_name, description) VALUES (?, ?)',
      values: [exam_name, description],
    });

    if (result.affectedRows) {
      return NextResponse.json({ message: 'Exam created successfully', examId: result.insertId }, { status: 201 });
    } else {
      throw new Error('Failed to insert exam into database');
    }

  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}
