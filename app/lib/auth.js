import { query } from '@/app/lib/db';

/**
 * Validates the user session against the database constraints.
 * 1. Single Device: Checks if cookie session_id matches DB session_id.
 * 2. Timeout: Checks if inactivity > 1 hour (unless taking an exam).
 * 3. Updates last_activity if valid.
 * 
 * @param {Object} session - The iron-session object
 * @returns {Promise<boolean>} - True if valid, False if invalid (should logout)
 */
export async function validateUserSession(session) {
    if (!session || !session.user || !session.user.id || !session.user.session_id) {
        return false;
    }

    const userId = session.user.id;
    const cookieSessionId = session.user.session_id;

    try {
        // 1. Fetch user status from DB
        const users = await query({
            query: 'SELECT session_id, is_locked, UNIX_TIMESTAMP(last_activity) as last_activity_ts FROM rhs_users WHERE id = ?',
            values: [userId]
        });

        if (users.length === 0) return false;
        const user = users[0];

        // CHECK 0: Account Locked
        if (user.is_locked) {
            console.log(`Access denied for locked user ${userId}`);
            return false;
        }

        // CHECK 1: Single Device Enforcement
        if (user.session_id !== cookieSessionId) {
            console.log(`Session mismatch for user ${userId}. Cookie: ${cookieSessionId}, DB: ${user.session_id}`);
            return false; // Logged in elsewhere
        }

        // CHECK 2: Inactivity Timeout (1 hour = 3600 seconds)
        const now = Math.floor(Date.now() / 1000);
        const lastActivity = user.last_activity_ts || 0;
        const elapsed = now - lastActivity;

        if (elapsed > 3600) {
            // Timeout threshold reached. Check for active exams.
            const activeAttempts = await query({
                query: `SELECT id FROM rhs_exam_attempts WHERE user_id = ? AND status = 'in_progress'`,
                values: [userId]
            });

            if (activeAttempts.length === 0) {
                console.log(`Session timed out for user ${userId}. Inactivity: ${elapsed}s`);
                return false; // No active exam, session expired
            }
            // If active exam exists, we allow the session to continue (and update activity)
        }

        // 3. Update last_activity
        // We do this asynchronously to not block the response too much, 
        // but we await it here to ensure DB consistency for this request.
        await query({
            query: 'UPDATE rhs_users SET last_activity = NOW() WHERE id = ?',
            values: [userId]
        });

        return true;

    } catch (error) {
        console.error("Auth validation error:", error);
        // On DB error, default to allowing if session exists? Or strict?
        // Strict is safer for "Single Device", but riskier for stability.
        // Let's return false to force re-login if DB fails heavily.
        return false;
    }
}
