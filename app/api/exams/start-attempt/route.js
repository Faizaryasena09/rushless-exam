import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { generateAutoToken } from '@/app/lib/token';
import redis, { isRedisReady } from '@/app/lib/redis';
import { getExamSettings } from '@/app/lib/exams';

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
        const userId = session.user.id;
        const now_ts = Math.floor(Date.now() / 1000);
        let settings = await getExamSettings(examId);

        if (!settings) {
            return NextResponse.json({ message: 'Exam configuration not found.' }, { status: 404 });
        }

        // Check exam availability window
        if (settings.start_time_ts && settings.end_time_ts) {
            if (now_ts < settings.start_time_ts) {
                return NextResponse.json({ message: 'Exam has not started yet.' }, { status: 403 });
            }
            if (now_ts > settings.end_time_ts) {
                return NextResponse.json({ message: 'Exam has already ended.' }, { status: 403 });
            }
        }

        // Verify SEB User-Agent if required
        if (settings.require_seb) {
            const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
            const configKeyHeader = request.headers.get('x-safeexambrowser-configkeyhash') || request.headers.get('x-safeexambrowser-request-hash'); // Fallback to request hash if needed

            if (!userAgent.includes('seb')) {
                return NextResponse.json({ message: 'Ujian ini hanya dapat dikerjakan menggunakan Safe Exam Browser (SEB).' }, { status: 403 });
            }

            // If a specific SEB config key is set, verify it
            if (settings.seb_config_key && configKeyHeader) {
                if (configKeyHeader.toLowerCase() !== settings.seb_config_key.toLowerCase()) {
                    return NextResponse.json({ message: 'Konfigurasi SEB tidak valid (Hash Mismatch). Silakan hubungi proktor/panitia.' }, { status: 403 });
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

        // ─── PHASE 1.5: Active Attempt Cache Check (Instant Resume) ───
        const activeAttemptCacheKey = `exam:active-attempt:${userId}:${examId}`;
        if (isRedisReady()) {
            const cachedAttemptId = await redis.get(activeAttemptCacheKey).catch(() => null);
            if (cachedAttemptId) {
                // If we have a cached ID, we still need metadata (doubtful, indices), 
                // but we can skip the heavy transaction if we trust the cache.
                // However, to keep it 100% sync with DB status (like violation locks), 
                // we still do a quick SELECT but outside the FOR UPDATE transaction if possible.
                // For now, let's just use the cache to verify if we SHOULD enter the transaction.
            }
        }

        // ─── PHASE 2: Minimal transaction — only the parts that NEED a lock ───
        const result = await transaction(async (txQuery) => {
            const existingAttempts = await txQuery({
                query: `
                SELECT id, status, UNIX_TIMESTAMP(start_time) as start_time_ts, doubtful_questions, last_question_index, time_extension, is_violation_locked
                FROM rhs_exam_attempts 
                WHERE user_id = ? AND exam_id = ? AND status = 'in_progress'
                FOR UPDATE
            `,
                values: [userId, examId]
            });

            let activeAttempt = existingAttempts.length > 0 ? existingAttempts[0] : null;

            if (activeAttempt && activeAttempt.is_violation_locked) {
                throw new Error('VIOLATION_LOCKED');
            }

            if (activeAttempt && settings.timer_mode === 'async') {
                const examEndTime_ts = activeAttempt.start_time_ts + (settings.duration_minutes * 60) + ((activeAttempt.time_extension || 0) * 60);
                if (now_ts > examEndTime_ts) {
                    await txQuery({ query: `UPDATE rhs_exam_attempts SET status = 'completed' WHERE id = ?`, values: [activeAttempt.id] });
                    if (isRedisReady()) await redis.del(activeAttemptCacheKey).catch(() => { });
                    activeAttempt = null;
                }
            }

            if (activeAttempt) {
                const initial_seconds_left = calculateRemainingSeconds(settings, activeAttempt, now_ts);
                // Ensure Redis is synced
                if (isRedisReady()) {
                    const attemptMeta = {
                        id: activeAttempt.id,
                        status: activeAttempt.status,
                        start_time_ts: activeAttempt.start_time_ts,
                        time_extension: activeAttempt.time_extension || 0
                    };
                    await Promise.all([
                        redis.set(activeAttemptCacheKey, activeAttempt.id, 'EX', 7200),
                        redis.set(`exam:attempt-meta:${userId}:${examId}`, JSON.stringify(attemptMeta), 'EX', 7200),
                        redis.sadd(`user:active_exams:${userId}`, examId),
                        redis.expire(`user:active_exams:${userId}`, 14400) // 4 hours safety
                    ]).catch(() => { });
                }
                return { status: 'resumed', attempt: activeAttempt, initial_seconds_left };
            }

            if (settings.max_attempts > 0) {
                const countResult = await txQuery({
                    query: `SELECT COUNT(*) as attempt_count FROM rhs_exam_attempts WHERE user_id = ? AND exam_id = ?`,
                    values: [userId, examId]
                });
                if (countResult[0].attempt_count >= settings.max_attempts) {
                    throw new Error('You have reached the maximum number of attempts for this exam.');
                }
            }

            const insertResult = await txQuery({
                query: `
                INSERT INTO rhs_exam_attempts (user_id, exam_id, start_time, status) 
                VALUES (?, ?, NOW(), 'in_progress')
            `,
                values: [userId, examId]
            });

            const newAttemptId = insertResult.insertId;
            const newAttemptResult = await txQuery({
                query: `SELECT *, UNIX_TIMESTAMP(start_time) as start_time_ts FROM rhs_exam_attempts WHERE id = ?`,
                values: [newAttemptId]
            });
            const newAttempt = newAttemptResult[0];
            const initial_seconds_left = calculateRemainingSeconds(settings, newAttempt, now_ts);

            // Cache the new attempt ID
            if (isRedisReady()) {
                const attemptMeta = {
                    id: newAttemptId,
                    status: newAttempt.status,
                    start_time_ts: newAttempt.start_time_ts,
                    time_extension: newAttempt.time_extension || 0
                };
                await Promise.all([
                    redis.set(activeAttemptCacheKey, newAttemptId, 'EX', 7200),
                    redis.set(`exam:attempt-meta:${userId}:${examId}`, JSON.stringify(attemptMeta), 'EX', 7200),
                    redis.sadd(`user:active_exams:${userId}`, examId),
                    redis.expire(`user:active_exams:${userId}`, 14400)
                ]).catch(() => { });
            }

            return { status: 'created', attempt: newAttempt, initial_seconds_left };
        });

        return NextResponse.json(result, { status: result.status === 'created' ? 201 : 200 });

    } catch (error) {
        console.error('Failed to start/resume exam attempt:', error);
        if (error.message === 'You have reached the maximum number of attempts for this exam.') {
            return NextResponse.json({ message: error.message }, { status: 403 });
        }
        if (error.message === 'VIOLATION_LOCKED') {
            return NextResponse.json({ message: 'Ujian Anda terkunci karena terdeteksi meninggalkan halaman ujian. Silakan lapor pengawas/admin untuk membuka kunci.' }, { status: 403 });
        }
        return NextResponse.json({ message: 'An error occurred', error: error.message }, { status: 500 });
    }
}

