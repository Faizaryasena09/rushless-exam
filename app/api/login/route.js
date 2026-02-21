import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logActivity, getClientIP } from '@/app/lib/logger';

export async function POST(request) {
  const ip = getClientIP(request);

  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    const { username, password } = await request.json();

    // Find the user in the database
    const users = await query({
      query: 'SELECT id, username, name, password, role, class_id, session_id, is_locked, UNIX_TIMESTAMP(last_activity) as last_activity_ts FROM rhs_users WHERE username = ?',
      values: [username],
    });

    if (users.length === 0) {
      logActivity({ username, ip, action: 'LOGIN_FAILED', level: 'warn', details: 'User not found' });
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    const user = users[0];

    if (user.is_locked) {
      logActivity({ userId: user.id, username, ip, action: 'LOGIN_LOCKED', level: 'warn', details: 'Account is locked' });
      return NextResponse.json({ message: 'Username Anda dikunci oleh admin. Mohon hubungi pengawas.' }, { status: 403 });
    }

    // Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      logActivity({ userId: user.id, username, ip, action: 'LOGIN_FAILED', level: 'warn', details: 'Wrong password' });
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    // --- CHECK FOR EXISTING ACTIVE SESSION ---
    if (user.session_id) {
      const now = Math.floor(Date.now() / 1000);
      const lastActivity = user.last_activity_ts || 0;
      const elapsed = now - lastActivity;

      let isSessionActive = false;

      // 1. Check basic inactivity timeout (1 hour)
      if (elapsed < 3600) {
        isSessionActive = true;
      } else {
        // 2. If timed out, check if they are taking an exam (which extends session validity)
        const activeAttempts = await query({
          query: `SELECT id FROM rhs_exam_attempts WHERE user_id = ? AND status = 'in_progress'`,
          values: [user.id]
        });
        if (activeAttempts.length > 0) {
          isSessionActive = true;
        }
      }

      if (isSessionActive) {
        logActivity({ userId: user.id, username, ip, action: 'LOGIN_DENIED', level: 'warn', details: 'Active session on another device' });
        return NextResponse.json({
          message: 'Account is currently active on another device. Login denied.'
        }, { status: 409 });
      }
    }
    // -----------------------------------------

    // Generate Session ID
    const sessionId = crypto.randomUUID();

    // Update DB with new session info
    await query({
      query: 'UPDATE rhs_users SET session_id = ?, last_activity = NOW() WHERE id = ?',
      values: [sessionId, user.id]
    });

    // Save user info in the session
    session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      roleName: user.role,
      class_id: user.class_id,
      session_id: sessionId,
    };
    await session.save();

    logActivity({ userId: user.id, username, ip, action: 'LOGIN_SUCCESS', level: 'info', details: `Role: ${user.role}` });

    return NextResponse.json({ message: 'Login successful' }, { status: 200 });
  } catch (error) {
    logActivity({ ip, action: 'LOGIN_ERROR', level: 'error', details: error.message });
    return NextResponse.json({ message: 'An error occurred during login.', error: error.message }, { status: 500 });
  }
}
