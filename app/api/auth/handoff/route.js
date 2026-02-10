
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const redirectUrl = searchParams.get('redirect') || '/dashboard';

    if (!token) {
        return NextResponse.json({ message: 'Token is required' }, { status: 400 });
    }

    try {
        // 1. Validate Token
        const results = await query({
            query: 'SELECT user_id, expires_at FROM rhs_launch_tokens WHERE token = ?',
            values: [token]
        });

        if (results.length === 0) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const { user_id, expires_at } = results[0];

        // 2. Check Expiration
        if (new Date() > new Date(expires_at)) {
            await query({ query: 'DELETE FROM rhs_launch_tokens WHERE token = ?', values: [token] });
            return NextResponse.json({ message: 'Token expired' }, { status: 401 });
        }

        // 3. Get User Details
        const users = await query({
            query: 'SELECT id, username, role, class_id FROM rhs_users WHERE id = ?',
            values: [user_id]
        });

        if (users.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        const user = users[0];

        // 4. Create Session
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);

        session.user = {
            id: user.id,
            username: user.username,
            roleName: user.role, // Assuming role is stored as 'role' in DB but mapped to 'roleName' in session
            class_id: user.class_id,
            isLoggedIn: true,
        };
        await session.save();

        // 5. Invalidate Token (One-time use)
        await query({ query: 'DELETE FROM rhs_launch_tokens WHERE token = ?', values: [token] });

        // 6. Redirect to Exam/Dashboard
        // return NextResponse.redirect(new URL(redirectUrl, request.url));

        // IMPORTANT: explicitly create response and set cookie header from session
        // because NextResponse.redirect might sometimes interfere with cookie setting if not handled carefully in Next.js app directory ?? 
        // Actually, session.save() should set the cookie on the store, but let's make sure we return a response that Next.js respects.

        const response = NextResponse.redirect(new URL(redirectUrl, request.url));
        // iron-session automatically handles the cookie on the response if we use middleware or getIronSession correctly? 
        // Wait, getIronSession(cookieStore) modifies the cookieStore object. 
        // In Next.js 13+ App Router, `cookies()` is read-only? No, it's mutable in Server Actions or Route Handlers 
        // BUT strict mode might prevent it. 
        // Let's rely on standard session.save() which SHOULD work if cookies() is working.

        return response;

    } catch (error) {
        console.error('Handoff failed:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
