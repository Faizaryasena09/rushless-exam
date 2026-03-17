import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);

        if (session.user && session.user.roleName === 'student') {
            await query({
                query: 'UPDATE rhs_users SET is_online_realtime = 0 WHERE id = ?',
                values: [session.user.id]
            });
        }

        return new Response(null, { status: 204 });
    } catch (error) {
        console.error('Offline notification error:', error);
        return new Response(null, { status: 500 });
    }
}
