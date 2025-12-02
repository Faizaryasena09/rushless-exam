import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';

export async function POST() {
  try {
    const cookieStore = await cookies(); // Await the cookies() call as per our workaround
    const session = await getIronSession(cookieStore, sessionOptions);

    session.destroy();
    await session.save(); // Ensure the session is actually destroyed in the cookie

    return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to logout', error: error.message }, { status: 500 });
  }
}
