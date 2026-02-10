
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import crypto from 'crypto';

export async function POST(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (!session.user) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // 2. Set expiration (e.g., 5 minutes from now)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 3. Store in DB
        await query({
            query: 'INSERT INTO rhs_launch_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
            values: [token, session.user.id, expiresAt]
        });

        return NextResponse.json({ token });
    } catch (error) {
        console.error('Failed to generate token:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
