import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { logActivity, getClientIP } from '@/app/lib/logger';

export async function POST(request) {
  const ip = getClientIP(request);

  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (session.user && session.user.id) {
      const username = session.user.username;
      const userId = session.user.id;

      try {
        await query({
          query: 'UPDATE rhs_users SET session_id = NULL WHERE id = ?',
          values: [userId]
        });
      } catch (e) {
        console.error("Failed to clear DB session on logout", e);
      }

      logActivity({ userId, username, ip, action: 'LOGOUT', level: 'info' });
    }

    session.destroy();
    await session.save();

    return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to logout', error: error.message }, { status: 500 });
  }
}
