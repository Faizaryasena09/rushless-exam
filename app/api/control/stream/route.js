import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { autoSubmitExpiredAttempts } from '@/app/lib/auto-submit';
import { eventBus } from '@/app/lib/event-bus';
import redis, { isRedisReady } from '@/app/lib/redis';

export async function GET(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
        return new Response('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const isTeacher = session.user.roleName === 'teacher';

    const encoder = new TextEncoder();
    let intervalId;
    let heartbeatId;

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

            const safeEnqueue = (message) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(message));
                } catch (err) {
                    console.error('SSE Enqueue Error:', err);
                    isClosed = true;
                }
            };

            // Get teacher class IDs once
            let teacherClassIds = [];
            if (isTeacher) {
                try {
                    const assignments = await query({
                        query: 'SELECT class_id FROM rhs_teacher_classes WHERE teacher_id = ?',
                        values: [userId],
                    });
                    teacherClassIds = assignments.map(a => a.class_id);
                    if (teacherClassIds.length === 0) {
                        safeEnqueue('data: {"students": [], "redisActive": ' + isRedisReady() + '}\n\n');
                    }
                } catch (err) {
                    console.error('Teacher class fetch error:', err);
                }
            }

            const sendData = async () => {
                if (isClosed) return;
                try {
                    const redisActive = isRedisReady();

                    // Process auto-submit in background
                    if (redisActive) {
                        const lockKey = 'lock:auto-submit';
                        const locked = await redis.set(lockKey, '1', 'EX', 10, 'NX');
                        if (locked) {
                            autoSubmitExpiredAttempts().catch(e => console.error('AutoSubmit error:', e));
                        }
                    } else {
                        autoSubmitExpiredAttempts().catch(() => {});
                    }

                    const classFilter = isTeacher
                        ? `AND u.class_id IN (${teacherClassIds.length > 0 ? teacherClassIds.map(() => '?').join(',') : 'NULL'})`
                        : '';

                    const sql = `
                        SELECT 
                            u.id, u.username, u.name, u.role, u.is_locked, u.class_id, u.is_online_realtime,
                            UNIX_TIMESTAMP(u.last_activity) as last_activity_ts,
                            c.class_name,
                            ea.id as attempt_id,
                            ea.status as attempt_status,
                            ea.time_extension,
                            ea.is_violation_locked,
                            ea.exam_id,
                            UNIX_TIMESTAMP(ea.start_time) as attempt_start_ts,
                            e.exam_name,
                            e.timer_mode,
                            e.duration_minutes,
                            UNIX_TIMESTAMP(s.end_time) as exam_end_ts,
                            UNIX_TIMESTAMP(NOW()) as now_ts
                        FROM rhs_users u
                        LEFT JOIN rhs_classes c ON u.class_id = c.id
                        LEFT JOIN rhs_exam_attempts ea ON u.id = ea.user_id AND ea.status = 'in_progress'
                        LEFT JOIN rhs_exams e ON ea.exam_id = e.id
                        LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
                        WHERE u.role = 'student' ${classFilter}
                    `;

                    const students = await query({
                        query: sql,
                        values: isTeacher ? teacherClassIds : [],
                    });

                    const now = Math.floor(Date.now() / 1000);
                    const statusMap = {};
                    if (redisActive && students.length > 0) {
                        const studentIds = students.map(s => s.id);
                        const onlineKeys = studentIds.map(id => `online:${id}`);
                        const activityKeys = studentIds.map(id => `last_activity:${id}`);
                        
                        const [onlineStatuses, activityTimes] = await Promise.all([
                            redis.mget(...onlineKeys),
                            redis.mget(...activityKeys)
                        ]).catch(() => [[], []]);

                        studentIds.forEach((id, idx) => {
                            statusMap[id] = {
                                online: !!onlineStatuses[idx],
                                lastActivity: activityTimes[idx] ? parseInt(activityTimes[idx]) : 0
                            };
                        });
                    }

                    const processedStudents = students.map(s => {
                        let seconds_left = null;
                        if (s.attempt_id) {
                            let endTs;
                            if (s.timer_mode === 'async') {
                                endTs = Number(s.attempt_start_ts) + (Number(s.duration_minutes) * 60) + (Number(s.time_extension || 0) * 60);
                            } else {
                                endTs = Number(s.exam_end_ts) + (Number(s.time_extension || 0) * 60);
                            }
                            seconds_left = Math.max(0, Math.floor(endTs - s.now_ts));
                        }

                        const isOnline = redisActive ? (statusMap[s.id]?.online ?? false) : !!s.is_online_realtime;
                        const lastActivity = redisActive ? (statusMap[s.id]?.lastActivity ?? 0) : s.last_activity_ts;

                        return {
                            id: s.id,
                            username: s.username,
                            name: s.name,
                            class_name: s.class_name,
                            is_locked: !!s.is_locked,
                            is_violation_locked: !!s.is_violation_locked,
                            is_online: isOnline,
                            last_activity_seconds_ago: lastActivity ? now - lastActivity : 86400,
                            current_exam: s.exam_name || null,
                            attempt_id: s.attempt_id || null,
                            seconds_left,
                        };
                    });

                    safeEnqueue(`data: ${JSON.stringify({ students: processedStudents, redisActive })}\n\n`);
                } catch (err) {
                    console.error('Control SSE error:', err);
                }
            };

            // Initial push
            await sendData();

            // Push every 3 seconds
            intervalId = setInterval(sendData, 3000);
            
            // Heartbeat every 30 seconds
            heartbeatId = setInterval(() => {
                safeEnqueue(': heartbeat\n\n');
            }, 30000);

            // Listen for NEW Logs
            const onLogAdded = (log) => {
                safeEnqueue(`data: ${JSON.stringify({ log_update: log })}\n\n`);
            };
            eventBus.on('log_added', onLogAdded);

            const cleanup = () => {
                isClosed = true;
                if (intervalId) clearInterval(intervalId);
                if (heartbeatId) clearInterval(heartbeatId);
                eventBus.off('log_added', onLogAdded);
            };

            request.signal.addEventListener('abort', cleanup);
        },
        cancel() {
            if (intervalId) clearInterval(intervalId);
            if (heartbeatId) clearInterval(heartbeatId);
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
