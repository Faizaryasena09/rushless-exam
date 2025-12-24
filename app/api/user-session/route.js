import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies(); // Await the cookies() call as per our workaround
    const session = await getIronSession(cookieStore, sessionOptions);

    if (session.user) {
      // Validate session against DB (Check single device & inactivity)
      const isValid = await validateUserSession(session);

      if (!isValid) {
          session.destroy();
          return NextResponse.json({ message: 'Session expired or logged in on another device' }, { status: 401 });
      }

      return NextResponse.json({ user: session.user }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'No active session' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve session', error: error.message }, { status: 500 });
  }
}
