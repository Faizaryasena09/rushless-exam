import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

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
    const stream = new ReadableStream({
        async start(controller) {
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
                    const seconds_left = calculateRemainingSeconds(settings, attempt, now_ts);

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
        },
        cancel() {
            clearInterval(intervalId);
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
