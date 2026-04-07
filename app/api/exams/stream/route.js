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

            const sendData = async (data) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            // 1. Initial Data
            try {
                const [exams, categories] = await Promise.all([
                    getExamsList(user),
                    user.roleName !== 'student' ? getCategoriesList(user) : Promise.resolve([])
                ]);
                sendData({ type: 'initial', exams, categories });
            } catch (err) {
                console.error('SSE Initial Fetch Error:', err);
            }

            // 2. Listen for changes
            const onExamChange = async (event) => {
                try {
                    // When any exam changes, we refresh the whole list for this user
                    // (Simplest approach to ensure permissions/categories are correct)
                    const [exams, categories] = await Promise.all([
                        getExamsList(user, true),
                        user.roleName !== 'student' ? getCategoriesList(user) : Promise.resolve([])
                    ]);
                    sendData({ type: 'update', exams, categories });
                } catch (err) {
                    console.error('SSE Update Error:', err);
                }
            };

            eventBus.on('exam_change', onExamChange);

            // 3. Heartbeat to keep connection alive
            const heartbeat = setInterval(() => {
                controller.enqueue(encoder.encode(': heartbeat\n\n'));
            }, 30000);

            // 4. Cleanup on close
            request.signal.addEventListener('abort', () => {
                clearInterval(heartbeat);
                eventBus.off('exam_change', onExamChange);
                controller.close();
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
