import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import { eventBus } from '@/app/lib/event-bus';
import { logActivity } from '@/app/lib/logger';
import redis, { isRedisReady } from '@/app/lib/redis';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
    const session = await getSession(request);

    if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }


    try {
        const payload = await request.json();
        const { action, userId, attemptId, minutes } = payload;

        if (!userId && !attemptId && action !== 'add_time_batch' && action !== 'refresh_exams_all') {
            return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
        }

        switch (action) {
            case 'force_logout':
                await query({
                    query: "UPDATE rhs_users SET session_id = NULL, last_activity = '1970-01-01 00:00:00' WHERE id = ?",
                    values: [userId]
                });

                // Clear Redis session cache for immediate invalidation
                if (isRedisReady()) {
                    await redis.del(`session:${userId}`).catch(() => {});
                }

                // Emit force_logout event to trigger real-time redirection to /
                eventBus.emit('force_logout', { userId });
                
                return NextResponse.json({ message: 'User logged out.' });

            case 'lock_login':
                const lockResult = await query({
                    query: 'UPDATE rhs_users SET is_locked = NOT is_locked WHERE id = ?',
                    values: [userId]
                });
                
                // Fetch the new state to sync with Redis
                const userState = await query({
                    query: 'SELECT is_locked FROM rhs_users WHERE id = ?',
                    values: [userId]
                });

                if (userState.length > 0 && isRedisReady()) {
                    const lockedKey = `user:locked:${userId}`;
                    if (userState[0].is_locked) {
                        await redis.set(lockedKey, '1', 'EX', 3600);
                    } else {
                        await redis.del(lockedKey);
                    }
                }
                return NextResponse.json({ message: 'Login lock toggled.' });

            case 'reset_exam':
                if (!attemptId) return NextResponse.json({ message: 'Attempt ID required' }, { status: 400 });

                // Wrap entire reset in a transaction.
                // FOR UPDATE on SELECT prevents auto-submit from touching this attempt
                // while the reset is in progress, avoiding cascade lock conflicts.
                await transaction(async (txQuery) => {
                    // Step 1: Lock the attempt row and get exam/user info
                    const attemptInfo = await txQuery({
                        query: 'SELECT user_id, exam_id FROM rhs_exam_attempts WHERE id = ? FOR UPDATE',
                        values: [attemptId]
                    });

                    if (attemptInfo.length > 0) {
                        const { user_id, exam_id } = attemptInfo[0];

                        // Step 2: Delete temporary answers first (foreign key safe)
                        await txQuery({
                            query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
                            values: [user_id, exam_id]
                        });
                    }

                    // Step 3: Delete the attempt (cascades to rhs_student_answer)
                    await txQuery({
                        query: 'DELETE FROM rhs_exam_attempts WHERE id = ?',
                        values: [attemptId]
                    });

                    // Step 4: Force logout the student
                    await txQuery({
                        query: "UPDATE rhs_users SET session_id = NULL, last_activity = '1970-01-01 00:00:00' WHERE id = ?",
                        values: [userId]
                    });

                    // Step 5: Invalidate Redis Caches (Attempt & Temp Answers)
                    if (isRedisReady()) {
                        const { user_id, exam_id } = attemptInfo[0];
                        await Promise.all([
                            redis.del(`exam:active-attempt:${user_id}:${exam_id}`),
                            redis.del(`exam:attempt-meta:${user_id}:${exam_id}`),
                            redis.del(`temp:ans:${user_id}:${exam_id}`),
                            redis.srem(`user:active_exams:${user_id}`, exam_id)
                        ]).catch(() => {});
                    }
                });
                return NextResponse.json({ message: 'Ujian direset dan siswa dikeluarkan.' });

            case 'delete_attempt':
                if (!attemptId) return NextResponse.json({ message: 'Attempt ID required' }, { status: 400 });

                await transaction(async (txQuery) => {
                    // 1. Get attempt info
                    const attemptInfo = await txQuery({
                        query: 'SELECT user_id, exam_id FROM rhs_exam_attempts WHERE id = ? FOR UPDATE',
                        values: [attemptId]
                    });

                    if (attemptInfo.length > 0) {
                        const { user_id, exam_id } = attemptInfo[0];

                        // 2. Clear Temporary Answers
                        await txQuery({
                            query: 'DELETE FROM rhs_temporary_answer WHERE user_id = ? AND exam_id = ?',
                            values: [user_id, exam_id]
                        });

                        // 3. Delete Attempt (Cascades to answers and logs)
                        await txQuery({
                            query: 'DELETE FROM rhs_exam_attempts WHERE id = ?',
                            values: [attemptId]
                        });

                        // 4. Invalidate Redis Cache
                        if (isRedisReady()) {
                            await Promise.all([
                                redis.del(`exam:active-attempt:${user_id}:${exam_id}`),
                                redis.del(`exam:attempt-meta:${user_id}:${exam_id}`),
                                redis.del(`temp:ans:${user_id}:${exam_id}`),
                                redis.srem(`user:active_exams:${user_id}`, exam_id)
                            ]).catch(() => {});
                        }
                    }
                });
                return NextResponse.json({ message: 'Attempt deleted successfully' });

            case 'add_time':
                if (!attemptId || !minutes) return NextResponse.json({ message: 'Params required' }, { status: 400 });
                // Only add time if attempt is still in progress
                const updateResult = await query({
                    query: 'UPDATE rhs_exam_attempts SET time_extension = COALESCE(time_extension, 0) + ? WHERE id = ? AND status = "in_progress"',
                    values: [minutes, attemptId]
                });
                if (updateResult.affectedRows > 0 && isRedisReady()) {
                    // Fetch user/exam ID to clear cache
                    const attemptData = await query({
                        query: 'SELECT user_id, exam_id FROM rhs_exam_attempts WHERE id = ?',
                        values: [attemptId]
                    });
                    if (attemptData.length > 0) {
                        const { user_id, exam_id } = attemptData[0];
                        await redis.del(`exam:attempt-meta:${user_id}:${exam_id}`).catch(() => {});
                    }
                }
                return NextResponse.json({ message: `Menambahkan waktu ${minutes} menit.` });

            case 'add_time_batch':
                const { attemptIds } = payload;
                const batchMinutes = payload.minutes;

                if (!attemptIds || !Array.isArray(attemptIds) || attemptIds.length === 0 || !batchMinutes) {
                    return NextResponse.json({ message: 'Params required' }, { status: 400 });
                }
                
                // Construct the IN clause dynamically
                const placeholders = attemptIds.map(() => '?').join(',');
                const updateValues = [batchMinutes, ...attemptIds];

                const batchUpdateResult = await query({
                    query: `UPDATE rhs_exam_attempts SET time_extension = COALESCE(time_extension, 0) + ? WHERE id IN (${placeholders}) AND status = "in_progress"`,
                    values: updateValues
                });

                if (batchUpdateResult.affectedRows > 0 && isRedisReady()) {
                    // Fetch all affected user/exam pairs to clear caches
                    const affected = await query({
                        query: `SELECT user_id, exam_id FROM rhs_exam_attempts WHERE id IN (${placeholders})`,
                        values: attemptIds
                    });
                    await Promise.all(affected.map(row => 
                        redis.del(`exam:attempt-meta:${row.user_id}:${row.exam_id}`)
                    )).catch(() => {});
                }
                return NextResponse.json({ message: `Menambahkan waktu ${batchMinutes} menit ke ${batchUpdateResult.affectedRows} siswa.` });
            
            case 'refresh_exams':
                if (!userId) return NextResponse.json({ message: 'User ID required' }, { status: 400 });
                
                // Keep DB update as a minor side-effect but focus on EventBus
                await query({
                    query: 'UPDATE rhs_users SET refresh_requested_at = NOW() WHERE id = ?',
                    values: [userId]
                });
                
                // Diagnostic log
                logActivity({
                    userId: session.user.id,
                    username: session.user.username,
                    action: 'REFRESH_ACTION',
                    details: `ID Siswa Target: ${userId}`
                });

                eventBus.emit('refresh', { userId });
                return NextResponse.json({ message: 'Refresh signal sent to student.' });

            case 'refresh_exams_all':
                await query({
                    query: 'UPDATE rhs_users SET refresh_requested_at = NOW()'
                });

                // Diagnostic log
                logActivity({
                    userId: session.user.id,
                    username: session.user.username,
                    action: 'REFRESH_ALL_ACTION',
                    details: 'Target: Semua Siswa'
                });

                eventBus.emit('refresh', { userId: 'all' });
                return NextResponse.json({ message: 'Sinyal refresh dikirim ke semua siswa aktif.' });

            case 'force_submit':
                if (!userId || !attemptId) return NextResponse.json({ message: 'Params required' }, { status: 400 });
                
                // 1. Emit SSE signal for real-time submission (best for data integrity)
                eventBus.emit('force_submit', { userId, attemptId });

                // 2. Server-side fallback: check online status
                const userStatus = await query({
                    query: 'SELECT (last_activity > NOW() - INTERVAL 15 SECOND) as is_online FROM rhs_users WHERE id = ?',
                    values: [userId]
                });

                if (userStatus.length === 0 || !userStatus[0].is_online) {
                    // Student is offline, trigger auto-submit from server
                    const { autoSubmitAttempt } = await import('@/app/lib/auto-submit');
                    
                    const attemptRows = await query({
                        query: `
                            SELECT ea.*, e.timer_mode, e.duration_minutes, UNIX_TIMESTAMP(es.end_time) as end_time_ts
                            FROM rhs_exam_attempts ea
                            JOIN rhs_exams e ON ea.exam_id = e.id
                            LEFT JOIN rhs_exam_settings es ON e.id = es.exam_id
                            WHERE ea.id = ? AND ea.status = 'in_progress'
                        `,
                        values: [attemptId]
                    });

                    if (attemptRows.length > 0) {
                        await autoSubmitAttempt(attemptRows[0]);
                    }
                }

                return NextResponse.json({ message: 'Sinyal kumpul paksa dikirim.' });

            case 'force_submit_all':
                eventBus.emit('force_submit', { userId: 'all' });
                
                // Server-side fallback for offline students
                (async () => {
                    try {
                        const { autoSubmitAttempt } = await import('@/app/lib/auto-submit');
                        const offlineAttempts = await query({
                            query: `
                                SELECT ea.*, e.timer_mode, e.duration_minutes, UNIX_TIMESTAMP(es.end_time) as end_time_ts
                                FROM rhs_exam_attempts ea
                                JOIN rhs_exams e ON ea.exam_id = e.id
                                LEFT JOIN rhs_exam_settings es ON e.id = es.exam_id
                                JOIN rhs_users u ON ea.user_id = u.id
                                WHERE ea.status = 'in_progress'
                                AND (u.last_activity IS NULL OR u.last_activity < NOW() - INTERVAL 20 SECOND)
                            `
                        });

                        for (const attempt of offlineAttempts) {
                            await autoSubmitAttempt(attempt);
                        }
                    } catch (e) {
                        console.error("Batch fallback submit failed:", e);
                    }
                })();

                return NextResponse.json({ message: 'Sinyal kumpul paksa dikirim ke semua siswa aktif.' });

            case 'unlock_exam':
                if (!attemptId) return NextResponse.json({ message: 'ID Ujian diperlukan' }, { status: 400 });
                await query({
                    query: 'UPDATE rhs_exam_attempts SET is_violation_locked = 0 WHERE id = ?',
                    values: [attemptId]
                });
                
                // Step 4: Log
                await query({
                    query: `INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, 'UNLOCK', 'Kunci pelanggaran ujian dihapus oleh admin')`,
                    values: [attemptId],
                });
                
                // Signal the student to refresh and clear the lock overlay
                eventBus.emit('refresh', { userId });
                
                return NextResponse.json({ message: 'Kunci pelanggaran ujian dihapus.' });

            default:
                return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({ message: 'Action failed', error: error.message }, { status: 500 });
    }
}
