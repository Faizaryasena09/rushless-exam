import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';

async function GET() {
  // Check for active session to protect the route
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const examsQuery = `
        SELECT 
          e.id, 
          e.exam_name, 
          e.description, 
          e.created_at,
          e.max_attempts,
          s.start_time,
          s.end_time
        FROM rhs_exams e
        LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
        ORDER BY e.created_at DESC
    `;
    const exams = await query({ query: examsQuery, values: [] });

    if (session.user.roleName === 'student') {
        const allUserAttempts = await query({
            query: `SELECT exam_id, status FROM rhs_exam_attempts WHERE user_id = ?`,
            values: [session.user.id]
        });
        
        const attemptsInfo = allUserAttempts.reduce((acc, attempt) => {
            if (!acc[attempt.exam_id]) {
                acc[attempt.exam_id] = { count: 0, hasInProgress: false };
            }
            acc[attempt.exam_id].count++;
            if (attempt.status === 'in_progress') {
                acc[attempt.exam_id].hasInProgress = true;
            }
            return acc;
        }, {});

        exams.forEach(exam => {
            const info = attemptsInfo[exam.id];
            exam.user_attempts = info ? info.count : 0;
            exam.has_in_progress = info ? info.hasInProgress : false;
        });
    }

    return NextResponse.json({ exams }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

async function POST(request) {
  // 1. Check for active session and admin role
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || session.user.roleName !== 'admin') {
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

async function PUT(request) {
  // 1. Check for active session and admin role
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get data from the request body
  const { id, exam_name, description } = await request.json();

  // 3. Validate input
  if (!id || !exam_name) {
    return NextResponse.json({ message: 'Exam ID and name are required' }, { status: 400 });
  }

  // 4. Update the database
  try {
    const result = await query({
      query: 'UPDATE rhs_exams SET exam_name = ?, description = ? WHERE id = ?',
      values: [exam_name, description, id],
    });

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'Exam not found or no changes made' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Exam updated successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

export { GET, POST, PUT };
