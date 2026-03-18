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
        // 1. Check Redis for session and lock status
        const redisKey = `session:${userId}`;
        const lockedKey = `user:locked:${userId}`;

        if (isRedisReady()) {
            const [cachedSessionId, isLockedCache] = await Promise.all([
                redis.get(redisKey),
                redis.get(lockedKey)
            ]);

            if (cachedSessionId) {
                // CHECK 1: Single Device Enforcement
                if (cachedSessionId !== cookieSessionId) {
                    return false;
                }

                // CHECK 2: Account Locked (Cached - updated instantly by Admin API)
                if (isLockedCache === '1') {
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

        if (user.is_locked) {
            if (isRedisReady()) await redis.set(lockedKey, '1', 'EX', 3600);
            return false;
        }

        // Verify session ID from DB
        if (user.session_id !== cookieSessionId) return false;

        // Check timeout
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - (user.last_activity_ts || 0);

        if (elapsed > 3600) {
            // Check for active exams before expiring (Redis-First)
            if (isRedisReady()) {
                const activeCount = await redis.scard(`user:active_exams:${userId}`);
                if (activeCount > 0) {
                    // Update TTL and return valid
                    await redis.set(redisKey, cookieSessionId, 'EX', 3600);
                    return true;
                }
            }
            
            // Fallback to DB
            const activeAttempts = await query({
                query: `SELECT id FROM rhs_exam_attempts WHERE user_id = ? AND status = 'in_progress' LIMIT 1`,
                values: [userId]
            });
            if (activeAttempts.length === 0) return false;
        }

        // Repopulate Redis Cache
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
