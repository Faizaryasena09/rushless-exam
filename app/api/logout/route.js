import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { logActivity, getClientIP } from '@/app/lib/logger';
import redis, { isRedisReady } from '@/app/lib/redis';

export async function POST(request) {
  const ip = getClientIP(request);

  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    if (session.user && session.user.id) {
      const username = session.user.username;
      const userId = session.user.id;

      // 1. Database Update (NON-BLOCKING)
      // Fire-and-forget asinkron agar tidak memakan antrian koneksi (Queue)
      query({
        query: "UPDATE rhs_users SET session_id = NULL, last_activity = '1970-01-02 00:00:01', is_online_realtime = 0 WHERE id = ?",
        values: [userId]
      }).catch(e => console.error("[Logout DB Error]", e.message));
      
      // 2. Redis Cleanup (NON-BLOCKING)
      if (isRedisReady()) {
        redis.del(`session:${userId}`).catch(() => {});
        redis.del(`online:${userId}`).catch(() => {});
        redis.del(`last_activity:${userId}`).catch(() => {});
      }

      // 3. Log Activity (ASINKRON)
      logActivity({ userId, username, ip, action: 'LOGOUT', level: 'info' });
    }

    // 4. Client Session Destruction (BLOCKING - MUST WORK)
    // Sesi di browser harus hancur meskipun DB sedang sangat sibuk
    session.destroy();
    await session.save();

    return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  } catch (error) {
    console.error("Critical Logout Failure:", error.message);
    return NextResponse.json({ message: 'Failed to logout', error: error.message }, { status: 500 });
  }
}
