import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}

// Helper to calculate remaining time, consistent with start-attempt
function calculateRemainingSeconds(settings, attempt, now_ts) {
    let examEndTime_ts;
    if (settings.timer_mode === 'async') {
        examEndTime_ts = attempt.start_time_ts + (settings.duration_minutes * 60) + ((attempt.time_extension || 0) * 60);
    } else {
        examEndTime_ts = settings.end_time_ts + ((attempt.time_extension || 0) * 60);
    }
    const remaining = Math.floor(examEndTime_ts - now_ts);
    return remaining > 0 ? remaining : 0;
}

export async function GET(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get('exam_id');

  if (!examId) {
    return NextResponse.json({ message: 'Exam ID required' }, { status: 400 });
  }

  try {
    const userId = session.user.id;

    // 1. Get current time
    const nowResult = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` });
    const now_ts = nowResult[0].server_now_ts;

    // 2. Get settings
    const examSettingsResult = await query({
        query: `
            SELECT 
                e.id, e.timer_mode, e.duration_minutes,
                UNIX_TIMESTAMP(s.start_time) as start_time_ts, 
                UNIX_TIMESTAMP(s.end_time) as end_time_ts
            FROM rhs_exams e
            LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
            WHERE e.id = ?
        `,
        values: [examId]
    });

    if (examSettingsResult.length === 0) return NextResponse.json({ message: 'Not found' }, { status: 404 });
    const settings = examSettingsResult[0];

    // 3. Get current active attempt
    const attemptResult = await query({
        query: `
            SELECT id, status, UNIX_TIMESTAMP(start_time) as start_time_ts, time_extension
            FROM rhs_exam_attempts 
            WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
        `,
        values: [userId, examId]
    });

    if (attemptResult.length === 0) {
        return NextResponse.json({ message: 'No active attempt' }, { status: 404 });
    }
    const attempt = attemptResult[0];

    const seconds_left = calculateRemainingSeconds(settings, attempt, now_ts);

    return NextResponse.json({ 
        seconds_left,
        time_extension: attempt.time_extension,
        status: attempt.status
    });

  } catch (error) {
    console.error('Error fetching attempt details:', error);
    return NextResponse.json({ message: 'Error', error: error.message }, { status: 500 });
  }
}