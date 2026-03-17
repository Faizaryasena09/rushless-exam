import { query } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';

/**
 * Validates the user session against Redis (primary) and DB (fallback).
 * 1. Single Device: Checks if cookie session_id matches Redis session_id.
 * 2. Timeout: Checks if inactivity > 1 hour (via Redis TTL).
 * 3. Updates activity in Redis if valid.
 */
export async function validateUserSession(session) {
    if (!session || !session.user || !session.user.id || !session.user.session_id) {
        return false;
    }

    const userId = session.user.id;
    const cookieSessionId = session.user.session_id;

    try {
        // 1. Check Redis for session (ONLY if Redis is ready)
        const redisKey = `session:${userId}`;
        if (isRedisReady()) {
            const cachedSessionId = await redis.get(redisKey);

            if (cachedSessionId) {
                // CHECK 1: Single Device Enforcement (Cache Match)
                if (cachedSessionId !== cookieSessionId) {
                    console.log(`Session mismatch for user ${userId} in Redis.`);
                    return false;
                }

                // CHECK 2: Account Locked (Still need to check DB for this as it's admin-controlled)
                const userLocks = await query({
                    query: 'SELECT is_locked FROM rhs_users WHERE id = ?',
                    values: [userId]
                });
                if (userLocks.length > 0 && userLocks[0].is_locked) {
                    return false;
                }

                // Update TTL in Redis (1 hour)
                await redis.expire(redisKey, 3600);
                return true;
            }
        }

        // 2. Cache Miss or Redis Offline: Fallback to DB
        const users = await query({
            query: 'SELECT session_id, is_locked, UNIX_TIMESTAMP(last_activity) as last_activity_ts FROM rhs_users WHERE id = ?',
            values: [userId]
        });

        if (users.length === 0) return false;
        const user = users[0];

        if (user.is_locked) return false;

        // Verify session ID from DB
        if (user.session_id !== cookieSessionId) return false;

        // Check timeout
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - (user.last_activity_ts || 0);

        if (elapsed > 3600) {
            // Check for active exams before expiring
            const activeAttempts = await query({
                query: `SELECT id FROM rhs_exam_attempts WHERE user_id = ? AND status = 'in_progress'`,
                values: [userId]
            });
            if (activeAttempts.length === 0) return false;
        }

        // Repopulate Redis Cache (ONLY if Redis is ready)
        if (isRedisReady()) {
            await redis.set(redisKey, cookieSessionId, 'EX', 3600).catch(() => {});
        }
        
        return true;

    } catch (error) {
        console.error("Auth validation error:", error);
        // If it's a DB error, we must return false. 
        // If it was just a Redis error handled by the wrapper, we already fell back.
        return false;
    }
}
