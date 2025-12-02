import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    const { username, password } = await request.json();

    // Find the user in the database
    const users = await query({
      query: 'SELECT id, username, password, role FROM rhs_users WHERE username = ?',
      values: [username],
    });

    if (users.length === 0) {
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    const user = users[0];

    // Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    // Save user info in the session
    session.user = {
      id: user.id,
      username: user.username,
      roleName: user.role, // Directly use the 'role' column from rhs_users
    };
    await session.save();

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'An error occurred during login.', error: error.message }, { status: 500 });
  }
}
