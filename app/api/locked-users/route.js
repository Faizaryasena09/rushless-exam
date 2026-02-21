import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { logFromRequest } from '@/app/lib/logger';

async function getAdminSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user || session.user.roleName !== 'admin') return null;
    return session;
}

// GET — List users that are currently brute-force locked or have failed attempts
export async function GET() {
    try {
        const session = await getAdminSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const users = await query({
            query: `SELECT id, username, name, role, failed_login_attempts, 
                    locked_until, UNIX_TIMESTAMP(locked_until) as locked_until_ts,
                    UNIX_TIMESTAMP(NOW()) as now_ts
                    FROM rhs_users 
                    WHERE failed_login_attempts > 0 OR locked_until IS NOT NULL
                    ORDER BY locked_until DESC, failed_login_attempts DESC`,
        });

        const result = users.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            failedAttempts: u.failed_login_attempts,
            lockedUntil: u.locked_until,
            isCurrentlyLocked: u.locked_until_ts && u.locked_until_ts > u.now_ts,
        }));

        return NextResponse.json({ users: result });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to fetch locked users', error: error.message }, { status: 500 });
    }
}

// PUT — Unlock a specific user (reset failed attempts + locked_until)
export async function PUT(request) {
    try {
        const session = await getAdminSession();
        if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

        const { userId } = await request.json();
        if (!userId) return NextResponse.json({ message: 'userId is required' }, { status: 400 });

        // Get username for logging
        const users = await query({ query: 'SELECT username FROM rhs_users WHERE id = ?', values: [userId] });
        const targetUsername = users[0]?.username || 'unknown';

        await query({
            query: 'UPDATE rhs_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
            values: [userId],
        });

        logFromRequest(request, session, 'USER_BRUTEFORCE_UNLOCK', 'info', { targetUser: targetUsername });

        return NextResponse.json({ message: `User ${targetUsername} unlocked` });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to unlock user', error: error.message }, { status: 500 });
    }
}
