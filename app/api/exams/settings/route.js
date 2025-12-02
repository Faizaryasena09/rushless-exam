import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

// Admin check
async function checkAdmin(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  return session.user && session.user.roleName === 'admin';
}

// GET handler to fetch exam settings
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
    // Fetch both exam details and settings in one go
    const results = await query({
      query: `
        SELECT 
          e.id as exam_id, 
          e.exam_name, 
          s.start_time, 
          s.end_time 
        FROM rhs_exams e
        LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
        WHERE e.id = ?
      `,
      values: [examId],
    });

    if (results.length === 0) {
      return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
    }

    return NextResponse.json(results[0]);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve exam settings', error: error.message }, { status: 500 });
  }
}

// POST handler to create or update exam settings
export async function POST(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId, startTime, endTime } = await request.json();
    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    // Use INSERT ... ON DUPLICATE KEY UPDATE for an "upsert" operation
    const result = await query({
      query: `
        INSERT INTO rhs_exam_settings (exam_id, start_time, end_time)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time)
      `,
      values: [examId, startTime, endTime],
    });

    return NextResponse.json({ message: 'Settings saved successfully', affectedRows: result.affectedRows });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to save settings', error: error.message }, { status: 500 });
  }
}
