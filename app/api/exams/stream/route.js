import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { eventBus } from '@/app/lib/event-bus';
import { getExamsList, getCategoriesList } from '@/app/lib/exams';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user || !await validateUserSession(session)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const { user } = session;

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            let isClosed = false;

            const sendData = async (data) => {
                if (isClosed) return;
                try {
                    const message = `data: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(message));
                } catch (err) {
                    isClosed = true;
                }
            };

            // 1. Initial Data
            try {
                const [exams, categories] = await Promise.all([
                    getExamsList(user),
                    getCategoriesList(user)
                ]);
                sendData({ type: 'initial', exams, categories });
            } catch (err) {
                console.error('SSE Initial Fetch Error:', err);
            }

            // 2. Listen for changes
            const onExamChange = async (event) => {
                if (isClosed) return;
                try {
                    // When any exam changes, we refresh the whole list for this user
                    // (Simplest approach to ensure permissions/categories are correct)
                    const [exams, categories] = await Promise.all([
                        getExamsList(user, true),
                        getCategoriesList(user)
                    ]);
                    sendData({ type: 'update', exams, categories });
                } catch (err) {
                    console.error('SSE Update Error:', err);
                }
            };

            eventBus.on('exam_change', onExamChange);

            // 3. Listen for Admin Signals
            const onRefresh = (data) => {
                if (isClosed) return;
                if (data.userId === 'all' || data.userId == user.id) {
                    sendData({ type: 'refresh_signal' });
                }
            };
            const onForceSubmit = (data) => {
                if (isClosed) return;
                if (data.userId === 'all' || data.userId == user.id) {
                    sendData({ type: 'force_submit_signal', attemptId: data.attemptId });
                }
            };

            eventBus.on('refresh', onRefresh);
            eventBus.on('force_submit', onForceSubmit);

            // 3. Heartbeat to keep connection alive
            const heartbeat = setInterval(() => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch (err) {
                    isClosed = true;
                }
            }, 30000);

            // 4. Cleanup on close
            request.signal.addEventListener('abort', () => {
                isClosed = true;
                clearInterval(heartbeat);
                eventBus.off('exam_change', onExamChange);
                eventBus.off('refresh', onRefresh);
                eventBus.off('force_submit', onForceSubmit);
                try { controller.close(); } catch(e){}
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
