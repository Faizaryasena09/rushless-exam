import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;

    // Mark as online on connection
    if (session.user.roleName === 'student') {
        await query({
            query: 'UPDATE rhs_users SET last_activity = NOW() WHERE id = ?',
            values: [userId]
        }).catch(err => console.error('Initial online update failed:', err));
    }

    let intervalId;

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

            const sendUpdate = async () => {
                if (isClosed) return;
                try {
                    const currentCookieStore = await cookies();
                    const currentSession = await getIronSession(currentCookieStore, sessionOptions);

                    if (!currentSession.user) {
                        isClosed = true;
                        try { controller.enqueue('data: {"status": "expired"}\n\n'); } catch (e) {}
                        try { controller.close(); } catch (e) {}
                        if (intervalId) clearInterval(intervalId);
                        return;
                    }

                    // validateUserSession already updates last_activity in DB
                    const isValid = await validateUserSession(currentSession);

                    if (isClosed) return;

                    if (!isValid) {
                        isClosed = true;
                        try { controller.enqueue('data: {"status": "invalid"}\n\n'); } catch (e) {}
                        try { controller.close(); } catch (e) {}
                        if (intervalId) clearInterval(intervalId);
                        return;
                    }

                    // Update real-time online status
                    if (currentSession.user.roleName === 'student') {
                        await query({
                            query: 'UPDATE rhs_users SET is_online_realtime = 1 WHERE id = ?',
                            values: [userId]
                        });
                    }

                    // Send heartbeat
                    try {
                        controller.enqueue(`data: {"status": "active", "user": ${JSON.stringify(currentSession.user)}}\n\n`);
                    } catch (e) {
                        isClosed = true;
                    }
                } catch (error) {
                    console.error('SSE Session Stream Error:', error);
                }
            };

            // Send initial state
            await sendUpdate();

            // Poll every 15 seconds
            intervalId = setInterval(sendUpdate, 15000);

            // Function to mark offline (Connection lost/Tab closed)
            const markOffline = async () => {
                isClosed = true;
                if (session.user.roleName === 'student') {
                    // ONLY set is_online_realtime to 0. DO NOT touch last_activity so session stays alive.
                    await query({
                        query: "UPDATE rhs_users SET is_online_realtime = 0 WHERE id = ?",
                        values: [userId]
                    });
                    console.log(`User ${userId} marked offline (connection lost)`);
                }
            };

            // Listen for closure via signal
            request.signal.addEventListener('abort', () => {
                isClosed = true;
                if (intervalId) clearInterval(intervalId);
                markOffline();
            });

            this.markOffline = markOffline;
        },
        cancel() {
            if (intervalId) clearInterval(intervalId);
            if (this.markOffline) this.markOffline();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}
