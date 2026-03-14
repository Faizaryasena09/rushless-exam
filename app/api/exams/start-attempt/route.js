import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { transaction } from '@/app/lib/db'; // Import transaction instead of query
import { validateUserSession } from '@/app/lib/auth';
import { generateAutoToken } from '@/app/lib/token';

async function getSession() {
    const cookieStore = await cookies();
    return getIronSession(cookieStore, sessionOptions);
}

// This helper function remains the same, no database calls here.
function calculateRemainingSeconds(settings, attempt, now_ts) {
    let examEndTime_ts;
    // The properties on settings and attempt are now consistently named (e.g., duration_minutes, end_time_ts)
    if (settings.timer_mode === 'async') {
        examEndTime_ts = attempt.start_time_ts + (settings.duration_minutes * 60) + ((attempt.time_extension || 0) * 60);
    } else {
        examEndTime_ts = settings.end_time_ts + ((attempt.time_extension || 0) * 60);
    }
    const remaining = Math.floor(examEndTime_ts - now_ts);
    return remaining > 0 ? remaining : 0;
}

// POST handler refactored to use a single database transaction
export async function POST(request) {
    const session = await getSession();

    if (!session.user || !session.user.id || !await validateUserSession(session)) {
        return NextResponse.json({ message: 'Unauthorized or Session Expired' }, { status: 401 });
    }

    try {
        const { examId, token } = await request.json();
        if (!examId) {
            return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
        }

        const userId = session.user.id;

        // ─── PHASE 1: All read-only validation OUTSIDE the transaction ───
        // These queries do not need locks. Keeping them outside minimises the
        // time the transaction holds locks, which is the root cause of gap-lock
        // deadlocks when two students start the same exam simultaneously.

        const now_ts_result = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` });
        const now_ts = now_ts_result[0].server_now_ts;

        const examSettingsResult = await query({
            query: `
            SELECT 
                e.id, e.timer_mode, e.duration_minutes, e.max_attempts,
                UNIX_TIMESTAMP(s.start_time) as start_time_ts, 
                UNIX_TIMESTAMP(s.end_time) as end_time_ts,
                s.require_seb, s.seb_config_key, s.show_result,
                s.require_token, s.token_type, s.current_token
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

        // Check exam availability window
        if (settings.start_time_ts && settings.end_time_ts) {
            if (now_ts < settings.start_time_ts) {
                return NextResponse.json({ message: 'Exam has not started yet.' }, { status: 403 });
            }
            if (now_ts > settings.end_time_ts) {
                return NextResponse.json({ message: 'Exam has already ended.' }, { status: 403 });
            }
        }

        // Verify SEB headers if required
        if (settings.require_seb) {
            const sebConfigKeyHeader = request.headers.get('x-safeexambrowser-configkey') || '';
            const sebRequestHashHeader = request.headers.get('x-safeexambrowser-requesthash') || '';

            if (!sebConfigKeyHeader && !sebRequestHashHeader) {
                return NextResponse.json({ message: 'Safe Exam Browser headers missing. Please use SEB to start the exam.' }, { status: 403 });
            }
            if (settings.seb_config_key && settings.seb_config_key.trim() !== '') {
                if (sebConfigKeyHeader !== settings.seb_config_key) {
                    return NextResponse.json({ message: 'SEB Configuration Key mismatch. Please ensure you are using the correct SEB config file.' }, { status: 403 });
                }
            }
        }

        // Token validation (only relevant for NEW attempts, but we validate here to fail fast)
        if (settings.require_token) {
            if (!token) {
                return NextResponse.json({ message: 'Token Ujian diperlukan untuk memulai ujian ini.' }, { status: 403 });
            }
            const isAuto = settings.token_type === 'auto';
            const expectedToken = isAuto ? generateAutoToken(settings.id) : (settings.current_token || '');
            if (token.toString().trim().toUpperCase() !== expectedToken.toString().trim().toUpperCase()) {
                return NextResponse.json({ message: 'Token Ujian tidak valid atau sudah kadaluarsa.' }, { status: 403 });
            }
        }

        // ─── PHASE 2: Minimal transaction — only the parts that NEED a lock ───
        // Scope: SELECT FOR UPDATE (to detect/claim active attempt) + optional INSERT.
        // This transaction should commit in milliseconds, eliminating gap-lock deadlocks.
        const result = await transaction(async (txQuery) => {
            // Lock existing in_progress attempt (if any) for this user+exam.
            // The composite index (user_id, exam_id, status) ensures this lock
            // targets only the exact rows we care about.
            const existingAttempts = await txQuery({
                query: `
                SELECT id, status, UNIX_TIMESTAMP(start_time) as start_time_ts, doubtful_questions, last_question_index, time_extension
                FROM rhs_exam_attempts 
                WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
                FOR UPDATE
            `,
                values: [userId, examId]
            });

            let activeAttempt = existingAttempts.length > 0 ? existingAttempts[0] : null;

            // Handle expired in_progress attempt (async timer mode only)
            if (activeAttempt && settings.timer_mode === 'async') {
                const examEndTime_ts = activeAttempt.start_time_ts + (settings.duration_minutes * 60) + ((activeAttempt.time_extension || 0) * 60);
                if (now_ts > examEndTime_ts) {
                    await txQuery({ query: `UPDATE rhs_exam_attempts SET status = 'completed' WHERE id = ?`, values: [activeAttempt.id] });
                    activeAttempt = null;
                }
            }

            // Resume existing valid attempt (no INSERT needed)
            if (activeAttempt) {
                const initial_seconds_left = calculateRemainingSeconds(settings, activeAttempt, now_ts);
                return { status: 'resumed', attempt: activeAttempt, initial_seconds_left };
            }

            // Check max attempts before creating a new one
            if (settings.max_attempts > 0) {
                const countResult = await txQuery({
                    query: `SELECT COUNT(*) as attempt_count FROM rhs_exam_attempts WHERE user_id = ? AND exam_id = ?`,
                    values: [userId, examId]
                });
                if (countResult[0].attempt_count >= settings.max_attempts) {
                    throw new Error('You have reached the maximum number of attempts for this exam.');
                }
            }

            // All checks passed — create a new attempt
            const insertResult = await txQuery({
                query: `
                INSERT INTO rhs_exam_attempts (user_id, exam_id, start_time, status) 
                VALUES (?, ?, NOW(), 'in_progress')
            `,
                values: [userId, examId]
            });

            const newAttemptResult = await txQuery({
                query: `SELECT *, UNIX_TIMESTAMP(start_time) as start_time_ts FROM rhs_exam_attempts WHERE id = ?`,
                values: [insertResult.insertId]
            });
            const newAttempt = newAttemptResult[0];
            const initial_seconds_left = calculateRemainingSeconds(settings, newAttempt, now_ts);

            return { status: 'created', attempt: newAttempt, initial_seconds_left };
        });

        if (result.status === 'created') {
            return NextResponse.json(result, { status: 201 });
        }
        return NextResponse.json(result);

    } catch (error) {
        console.error('Failed to start/resume exam attempt:', error);
        if (error.message === 'You have reached the maximum number of attempts for this exam.') {
            return NextResponse.json({ message: error.message }, { status: 403 });
        }
        return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
    }
}

