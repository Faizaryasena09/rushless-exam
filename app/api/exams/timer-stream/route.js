import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { autoSubmitAttemptIfExpired } from '@/app/lib/auto-submit';
import { eventBus } from '@/app/lib/event-bus';

// Helper to calculate remaining time
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

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user || !await validateUserSession(session)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');

    if (!examId) {
        return new Response('Exam ID required', { status: 400 });
    }

    const userId = session.user.id;

    // We will establish an SSE stream
    let intervalId;
    // Guard flag: prevents a new interval tick from running an auto-submit
    // while the previous tick's auto-submit is still in progress.
    let isSubmitting = false;

    const stream = new ReadableStream({
        async start(controller) {
            // Get initial server time to ignore previous refresh requests
            const initialNowResult = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as start_ts` });
            let lastKnownRefresh_ts = initialNowResult[0].start_ts;

            // Function to fetch and send data
            const sendUpdate = async () => {
                try {
                    const nowResult = await query({ query: `SELECT UNIX_TIMESTAMP(NOW()) as server_now_ts` });
                    const now_ts = nowResult[0].server_now_ts;

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

                    if (examSettingsResult.length === 0) {
                        controller.enqueue('data: {"error": "Not found"}\n\n');
                        return;
                    }
                    const settings = examSettingsResult[0];

                    const attemptResult = await query({
                        query: `
                            SELECT id, status, UNIX_TIMESTAMP(start_time) as start_time_ts, time_extension
                            FROM rhs_exam_attempts 
                            WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
                        `,
                        values: [userId, examId]
                    });

                    if (attemptResult.length === 0) {
                        controller.enqueue('data: {"error": "No active attempt"}\n\n');
                        return;
                    }

                    const attempt = attemptResult[0];

                    // Removed: Periodic database check for refresh_requested_at
                    // Removed: const refreshCheck = await query({
                    // Removed:     query: 'SELECT UNIX_TIMESTAMP(refresh_requested_at) as refresh_ts FROM rhs_users WHERE id = ?',
                    // Removed:     values: [userId]
                    // Removed: });
                    // Removed: if (refreshCheck.length > 0 && refreshCheck[0].refresh_ts && Number(refreshCheck[0].refresh_ts) > Number(lastKnownRefresh_ts)) {
                    // Removed:     try {
                    // Removed:         await query({
                    // Removed:             query: 'INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, "SECURITY", ?)',
                    // Removed:             values: [attempt.id, `🔄 Refresh dipicu oleh Admin (DB Alert: ${refreshCheck[0].refresh_ts} > ${lastKnownRefresh_ts})`]
                    // Removed:         });
                    // Removed:     } catch (logErr) { console.error("Logging failed", logErr); }
                    // Removed:     controller.enqueue(`data: ${JSON.stringify({ refresh: true })}\n\n`);
                    // Removed:     lastKnownRefresh_ts = refreshCheck[0].refresh_ts;
                    // Removed: }

                    const seconds_left = calculateRemainingSeconds(settings, attempt, now_ts);

                    // If timer expired server-side, auto-submit the attempt.
                    // The isSubmitting guard prevents overlapping concurrent submissions
                    // from multiple interval ticks firing close together.
                    if (seconds_left === 0) {
                        if (!isSubmitting) {
                            isSubmitting = true;
                            try {
                                await autoSubmitAttemptIfExpired(attempt.id, examId, userId);
                            } finally {
                                isSubmitting = false;
                            }
                        }
                        // Notify client that the attempt is now completed
                        controller.enqueue(`data: ${JSON.stringify({ seconds_left: 0, status: 'completed', auto_submitted: true })}\n\n`);
                        clearInterval(intervalId);
                        return;
                    }

                    const payload = JSON.stringify({
                        seconds_left,
                        time_extension: attempt.time_extension,
                        status: attempt.status
                    });

                    controller.enqueue(`data: ${payload}\n\n`);
                } catch (error) {
                    console.error('SSE Error:', error);
                    controller.enqueue(`data: {"error": "Internal Server Error"}\n\n`);
                }
            };

            // Send initial update instantly
            await sendUpdate();

            // Then send updates every 3 seconds (reduces DB load compared to 1s but feels real-time for time extensions)
            intervalId = setInterval(sendUpdate, 3000);

            // Listen for refresh events from the Control Panel (real-time signaling)
            const onRefresh = async (data) => {
                if (data.userId === 'all' || data.userId == userId) {
                    // Diagnostic Log - Visible in Student Log Panel (Log Realtime)
                    try {
                        await query({
                            query: 'INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, "SECURITY", ?)',
                            values: [attempt.id, `🔄 Refresh dipicu oleh Admin (Real-time SSE Signal)`]
                        });
                    } catch (logErr) { console.error("Logging failed", logErr); }

                    controller.enqueue(`data: ${JSON.stringify({ refresh: true })}\n\n`);
                }
            };
            eventBus.on('refresh', onRefresh);

            // Listen for force submit events
            const onForceSubmit = async (data) => {
                if (data.userId === 'all' || data.userId == userId) {
                    try {
                        await query({
                            query: 'INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, "SECURITY", ?)',
                            values: [attempt.id, `🚀 Force Submit dipicu oleh Admin (Real-time SSE Signal)`]
                        });
                    } catch (logErr) { console.error("Logging failed", logErr); }

                    controller.enqueue(`data: ${JSON.stringify({ force_submit: true })}\n\n`);
                }
            };
            eventBus.on('force_submit', onForceSubmit);

            // Store the cleanup function
            this.cleanup = () => {
                clearInterval(intervalId);
                eventBus.off('refresh', onRefresh);
                eventBus.off('force_submit', onForceSubmit);
            };
        },
        cancel() {
            if (this.cleanup) this.cleanup();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no' // Prevent Nginx buffering if used
        }
    });
}
