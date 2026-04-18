import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user) {
        return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const now = Math.floor(Date.now() / 1000);

    // Initial online status
    if (session.user.roleName === 'student') {
        if (isRedisReady()) {
            const pipeline = redis.pipeline();
            pipeline.set(`online:${userId}`, 1, 'EX', 30);
            pipeline.set(`last_activity:${userId}`, now, 'EX', 3600);
            await pipeline.exec().catch(() => {});
        } else {
            // Fallback to MySQL for initial connection
            await query({
                query: 'UPDATE rhs_users SET last_activity = NOW(), is_online_realtime = 1 WHERE id = ?',
                values: [userId]
            }).catch(() => {});
        }
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

                    // validateUserSession now checks/updates Redis session key (handles fallback internally)
                    const isValid = await validateUserSession(currentSession);

                    if (isClosed) return;

                    if (!isValid) {
                        isClosed = true;
                        try { controller.enqueue('data: {"status": "invalid"}\n\n'); } catch (e) {}
                        try { controller.close(); } catch (e) {}
                        if (intervalId) clearInterval(intervalId);
                        return;
                    }

                    // Update real-time online status and activity
                    if (currentSession.user.roleName === 'student') {
                        if (isRedisReady()) {
                            const pulseNow = Math.floor(Date.now() / 1000);
                            const pipeline = redis.pipeline();
                            pipeline.set(`online:${userId}`, 1, 'EX', 30);
                            pipeline.set(`last_activity:${userId}`, pulseNow, 'EX', 3600);
                            pipeline.exec().catch(() => {});
                        } else {
                            // Fallback to MySQL heartbeat
                            await query({
                                query: 'UPDATE rhs_users SET last_activity = NOW(), is_online_realtime = 1 WHERE id = ?',
                                values: [userId]
                            }).catch(() => {});
                        }
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

            // Listen for Admin refresh/logout signals (Real-time signaling)
            const onRefresh = (data) => {
                if (isClosed) return;
                if (data.userId === 'all' || data.userId == userId) {
                    sendUpdate();
                }
            };
            const onForceLogout = (data) => {
                if (isClosed) return;
                if (data.userId == userId) {
                    isClosed = true;
                    try { controller.enqueue('data: {"status": "force_logout"}\n\n'); } catch (e) {}
                    try { controller.close(); } catch (e) {}
                    if (intervalId) clearInterval(intervalId);
                }
            };
            eventBus.on('refresh', onRefresh);
            eventBus.on('force_logout', onForceLogout);

            // Poll every 15 seconds as fallback
            intervalId = setInterval(sendUpdate, 15000);

            // Function to mark offline (Connection lost/Tab closed)
            const markOffline = async () => {
                isClosed = true;
                eventBus.off('refresh', onRefresh);
                eventBus.off('force_logout', onForceLogout);
                if (session.user.roleName === 'student') {
                    if (isRedisReady()) {
                        await redis.del(`online:${userId}`).catch(() => {});
                    }
                    
                    // Always try to update DB as online indicator for fallback
                    await query({
                        query: "UPDATE rhs_users SET is_online_realtime = 0 WHERE id = ?",
                        values: [userId]
                    }).catch(() => {});

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
