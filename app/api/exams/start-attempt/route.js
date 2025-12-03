import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// Helper function to calculate remaining seconds on the server using UNIX timestamps
function calculateRemainingSeconds(settings, attempt, now_ts) {
    let examEndTime_ts;
    if (settings.timer_mode === 'async') {
        // start_time_ts is already a UNIX timestamp (in seconds)
        examEndTime_ts = attempt.start_time_ts + (settings.duration_minutes * 60);
    } else {
        // end_time_ts is already a UNIX timestamp
        examEndTime_ts = settings.end_time_ts;
    }
    const remaining = Math.floor(examEndTime_ts - now_ts);
    return remaining > 0 ? remaining : 0;
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

    // 1. Fetch all exam settings at once, using UNIX_TIMESTAMP
    const examSettingsResult = await query({
        query: `
            SELECT 
                e.timer_mode, e.duration_minutes,
                UNIX_TIMESTAMP(s.start_time) as start_time_ts, 
                UNIX_TIMESTAMP(s.end_time) as end_time_ts
            FROM rhs_exams e
            LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
            WHERE e.id = ?
        `,
        values: [examId]
    });

    if (examSettingsResult.length === 0) {
        return NextResponse.json({ message: 'Exam configuration not found.' }, { status: 404 });
    }
    const settings = examSettingsResult[0];


    // 2. Check for an existing 'in_progress' attempt
    const existingAttempts = await query({
        query: `
            SELECT id, user_id, exam_id, UNIX_TIMESTAMP(start_time) as start_time_ts, status 
            FROM rhs_exam_attempts 
            WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
        `,
        values: [userId, examId]
    });

    // Get current server time as a UNIX timestamp
    const nowResult = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` });
    const now_ts = nowResult[0].server_now_ts;


    if (existingAttempts.length > 0) {
        const attempt = existingAttempts[0];

        // For async mode, check if the existing attempt has expired
        if (settings.timer_mode === 'async') {
            const examEndTime_ts = attempt.start_time_ts + (settings.duration_minutes * 60);
            if (now_ts > examEndTime_ts) {
                // The old attempt has expired. Mark it as completed and proceed to create a new one.
                await query({ query: `UPDATE rhs_exam_attempts SET status = 'completed' WHERE id = ?`, values: [attempt.id] });
                // By not returning here, we allow the code to fall through and create a new attempt.
            } else {
                // Attempt is still valid, return it and the calculated remaining time.
                const initial_seconds_left = calculateRemainingSeconds(settings, attempt, now_ts);
                const originalAttempt = await query({ query: `SELECT * from rhs_exam_attempts WHERE id = ?`, values: [attempt.id]});
                return NextResponse.json({
                    attempt: originalAttempt[0],
                    initial_seconds_left: initial_seconds_left
                });
            }
        } else {
            // For sync mode, the attempt is always valid until the global end time.
            const initial_seconds_left = calculateRemainingSeconds(settings, attempt, now_ts);
            const originalAttempt = await query({ query: `SELECT * from rhs_exam_attempts WHERE id = ?`, values: [attempt.id]});
            return NextResponse.json({
                attempt: originalAttempt[0],
                initial_seconds_left: initial_seconds_left
            });
        }
    }

    // 3. No existing attempt, so create a new one
    // First, verify the exam is within its availability window
    if (settings.start_time_ts && settings.end_time_ts) {
        if (now_ts < settings.start_time_ts) {
            return NextResponse.json({ message: 'Exam has not started yet.' }, { status: 403 });
        }
        if (now_ts > settings.end_time_ts) {
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

    // Fetch the newly created record and the current server time to return it
    const [newAttempt, finalNowResult] = await Promise.all([
        query({
            query: `
                SELECT id, user_id, exam_id, UNIX_TIMESTAMP(start_time) as start_time_ts, status
                FROM rhs_exam_attempts
                WHERE id = ?
            `,
            values: [result.insertId]
        }),
        query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` })
    ]);
    
    const attempt = newAttempt[0];
    const final_now_ts = finalNowResult[0].server_now_ts;
    const initial_seconds_left = calculateRemainingSeconds(settings, attempt, final_now_ts);
    
    const originalNewAttempt = await query({ query: `SELECT * from rhs_exam_attempts WHERE id = ?`, values: [attempt.id]});

    return NextResponse.json({
        attempt: originalNewAttempt[0],
        initial_seconds_left: initial_seconds_left
    }, { status: 201 });

  } catch (error) {
    console.error('Failed to start/resume exam attempt:', error);
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}

