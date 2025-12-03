import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// POST handler to start or resume an exam attempt
export async function POST(request) {
  const session = await getSession(request);

  if (!session.user || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId } = await request.json();
    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }
    
    const userId = session.user.id;

    // 1. Check for an existing 'in_progress' attempt
    const existingAttempts = await query({
        query: `
            SELECT id, user_id, exam_id, start_time, status 
            FROM rhs_exam_attempts 
            WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
        `,
        values: [userId, examId]
    });

    if (existingAttempts.length > 0) {
        // Attempt already exists, return its details
        return NextResponse.json(existingAttempts[0]);
    }

    // 2. No existing attempt, so create a new one
    // First, verify the exam is within its availability window
    const examSettings = await query({
        query: 'SELECT start_time, end_time FROM rhs_exam_settings WHERE exam_id = ?',
        values: [examId]
    });

    // Only perform time window check if the exam is scheduled
    if (examSettings.length > 0 && examSettings[0].start_time && examSettings[0].end_time) {
        const now = new Date();
        const startTime = new Date(examSettings[0].start_time);
        const endTime = new Date(examSettings[0].end_time);

        if (now < startTime) {
            return NextResponse.json({ message: 'Exam has not started yet.' }, { status: 403 });
        }
        if (now > endTime) {
            return NextResponse.json({ message: 'Exam has already ended.' }, { status: 403 });
        }
    }
    
    // All good, create the new attempt
    const result = await query({
        query: `
            INSERT INTO rhs_exam_attempts (user_id, exam_id, start_time, status) 
            VALUES (?, ?, NOW(), 'in_progress')
        `,
        values: [userId, examId]
    });

    // Fetch the newly created record to return it
    const newAttempt = await query({
        query: `
            SELECT id, user_id, exam_id, start_time, status
            FROM rhs_exam_attempts
            WHERE id = ?
        `,
        values: [result.insertId]
    });

    return NextResponse.json(newAttempt[0], { status: 201 });

  } catch (error) {
    console.error('Failed to start/resume exam attempt:', error);
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}
