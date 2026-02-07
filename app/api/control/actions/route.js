import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
    const session = await getSession(request);

    if (!session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action, userId, attemptId, minutes } = await request.json();

        if (!userId && !attemptId) {
            return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
        }

        switch (action) {
            case 'force_logout':
                await query({
                    query: "UPDATE rhs_users SET session_id = NULL, last_activity = '1970-01-01 00:00:00' WHERE id = ?",
                    values: [userId]
                });
                return NextResponse.json({ message: 'User logged out.' });

            case 'lock_login':
                await query({
                    query: 'UPDATE rhs_users SET is_locked = NOT is_locked WHERE id = ?',
                    values: [userId]
                });
                return NextResponse.json({ message: 'Login lock toggled.' });

            case 'reset_exam':
                if (!attemptId) return NextResponse.json({ message: 'Attempt ID required' }, { status: 400 });
                // Delete the attempt (this will cascade delete answers if configured, or just mark as invalid)
                // Ideally DELETE if we want a full reset, or update status to 'cancelled'.
                // User asked for "dihapus" (deleted)
                await query({
                    query: 'DELETE FROM rhs_exam_attempts WHERE id = ?',
                    values: [attemptId]
                });
                // Also force logout to ensure clean state? 
                // "reset ujian(maka exam pada yang sedang dikerjakan oleh student dihapus lalu di logout juga)"
                await query({
                    query: "UPDATE rhs_users SET session_id = NULL, last_activity = '1970-01-01 00:00:00' WHERE id = ?",
                    values: [userId]
                });
                return NextResponse.json({ message: 'Exam reset and user logged out.' });

            case 'add_time':
                if (!attemptId || !minutes) return NextResponse.json({ message: 'Params required' }, { status: 400 });
                // Only add time if attempt is still in progress
                const updateResult = await query({
                    query: 'UPDATE rhs_exam_attempts SET time_extension = time_extension + ? WHERE id = ? AND status = "in_progress"',
                    values: [minutes, attemptId]
                });
                if (updateResult.affectedRows === 0) {
                    return NextResponse.json({ message: 'Cannot add time. Exam may have already been submitted or ended.' }, { status: 400 });
                }
                return NextResponse.json({ message: `Added ${minutes} minutes.` });

            default:
                return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({ message: 'Action failed', error: error.message }, { status: 500 });
    }
}
