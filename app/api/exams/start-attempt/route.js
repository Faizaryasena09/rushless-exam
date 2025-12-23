import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { transaction } from '@/app/lib/db'; // Import transaction instead of query

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}

// This helper function remains the same, no database calls here.
function calculateRemainingSeconds(settings, attempt, now_ts) {
    let examEndTime_ts;
    // The properties on settings and attempt are now consistently named (e.g., duration_minutes, end_time_ts)
    if (settings.timer_mode === 'async') {
        examEndTime_ts = attempt.start_time_ts + (settings.duration_minutes * 60);
    } else {
        examEndTime_ts = settings.end_time_ts;
    }
    const remaining = Math.floor(examEndTime_ts - now_ts);
    return remaining > 0 ? remaining : 0;
}

// POST handler refactored to use a single database transaction
export async function POST(request) {
  const session = await getSession();

  if (!session.user || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { examId } = await request.json();
    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }
    
    const userId = session.user.id;

    // The entire logic is now wrapped in a transaction
    const result = await transaction(async (query) => {
        // 1. Get current time and exam settings inside the transaction
        const nowResult = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` });
        const now_ts = nowResult[0].server_now_ts;

        const examSettingsResult = await query({
            query: `
                SELECT 
                    e.id, e.timer_mode, e.duration_minutes, e.max_attempts,
                    UNIX_TIMESTAMP(s.start_time) as start_time_ts, 
                    UNIX_TIMESTAMP(s.end_time) as end_time_ts
                FROM rhs_exams e
                LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
                WHERE e.id = ?
            `,
            values: [examId]
        });

        if (examSettingsResult.length === 0) {
            // Throwing an error here will cause the transaction to rollback
            throw new Error('Exam configuration not found.');
        }
        const settings = examSettingsResult[0];

        // 2. Check for an existing 'in_progress' attempt with row locking
        const existingAttempts = await query({
            query: `
                SELECT id, status, UNIX_TIMESTAMP(start_time) as start_time_ts 
                FROM rhs_exam_attempts 
                WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
                FOR UPDATE
            `,
            values: [userId, examId]
        });

        let activeAttempt = existingAttempts.length > 0 ? existingAttempts[0] : null;

        // 3. Handle expired 'in_progress' attempt
        if (activeAttempt && settings.timer_mode === 'async') {
            const examEndTime_ts = activeAttempt.start_time_ts + (settings.duration_minutes * 60);
            if (now_ts > examEndTime_ts) {
                // The attempt has expired. Mark it as completed.
                await query({ query: `UPDATE rhs_exam_attempts SET status = 'completed' WHERE id = ?`, values: [activeAttempt.id] });
                activeAttempt = null; // It's no longer an active attempt.
            }
        }
        
        // 4. If there's a valid, active attempt, resume it.
        if (activeAttempt) {
            const initial_seconds_left = calculateRemainingSeconds(settings, activeAttempt, now_ts);
            return {
                status: 'resumed',
                attempt: activeAttempt,
                initial_seconds_left: initial_seconds_left
            };
        }

        // 5. If no active attempt, check max attempts and create a new one
        if (settings.max_attempts > 0) {
            const completedAttemptsResult = await query({
                query: `SELECT COUNT(*) as attempt_count FROM rhs_exam_attempts WHERE user_id = ? AND exam_id = ?`,
                values: [userId, examId]
            });
            const attemptCount = completedAttemptsResult[0].attempt_count;

            if (attemptCount >= settings.max_attempts) {
                throw new Error('You have reached the maximum number of attempts for this exam.');
            }
        }
        
        // 6. Verify the exam is within its availability window
        if (settings.start_time_ts && settings.end_time_ts) {
            if (now_ts < settings.start_time_ts) {
                throw new Error('Exam has not started yet.');
            }
            if (now_ts > settings.end_time_ts) {
                throw new Error('Exam has already ended.');
            }
        }
    
        // 7. All checks passed, create a new attempt
        const insertResult = await query({
            query: `
                INSERT INTO rhs_exam_attempts (user_id, exam_id, start_time, status) 
                VALUES (?, ?, NOW(), 'in_progress')
            `,
            values: [userId, examId]
        });

        const newAttemptResult = await query({
            query: `
                SELECT *, UNIX_TIMESTAMP(start_time) as start_time_ts
                FROM rhs_exam_attempts
                WHERE id = ?
            `,
            values: [insertResult.insertId]
        });
        const newAttempt = newAttemptResult[0];

        // We need the most up-to-date timestamp for calculation
        const finalNowResult = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` });
        const final_now_ts = finalNowResult[0].server_now_ts;

        const initial_seconds_left = calculateRemainingSeconds(settings, newAttempt, final_now_ts);

        return {
            status: 'created',
            attempt: newAttempt,
            initial_seconds_left: initial_seconds_left
        };
    });

    // Determine the response based on the transaction result
    if (result.status === 'created') {
        return NextResponse.json(result, { status: 201 });
    }
    return NextResponse.json(result);

  } catch (error) {
    console.error('Failed to start/resume exam attempt:', error);
    // Handle specific, user-friendly error messages thrown from the transaction
    const userFacingErrors = [
        'Exam configuration not found.',
        'You have reached the maximum number of attempts for this exam.',
        'Exam has not started yet.',
        'Exam has already ended.'
    ];
    if (userFacingErrors.includes(error.message)) {
        return NextResponse.json({ message: error.message }, { status: 403 });
    }
    return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
  }
}

