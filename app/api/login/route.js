import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { logActivity, getClientIP } from '@/app/lib/logger';

// Ensure brute force columns exist (runs once per cold start)
let columnsChecked = false;
async function ensureBruteforceColumns() {
  if (columnsChecked) return;
  try {
    await query({ query: `ALTER TABLE rhs_users ADD COLUMN failed_login_attempts INT DEFAULT 0` }).catch(() => { });
    await query({ query: `ALTER TABLE rhs_users ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL` }).catch(() => { });
    columnsChecked = true;
  } catch { }
}

// Get brute force settings from DB
async function getBruteforceSettings() {
  try {
    const rows = await query({
      query: `SELECT setting_key, setting_value FROM rhs_settings WHERE setting_key IN ('bruteforce_max_attempts', 'bruteforce_lockout_minutes')`,
    });
    const s = {};
    rows.forEach(r => { s[r.setting_key] = parseInt(r.setting_value) || 0; });
    return {
      maxAttempts: s.bruteforce_max_attempts || 5,
      lockoutMinutes: s.bruteforce_lockout_minutes || 15,
    };
  } catch {
    return { maxAttempts: 5, lockoutMinutes: 15 };
  }
}

export async function POST(request) {
  const ip = getClientIP(request);

  try {
    await ensureBruteforceColumns();
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    const { username, password } = await request.json();

    // Find the user in the database
    const users = await query({
      query: 'SELECT id, username, name, password, role, class_id, session_id, is_locked, failed_login_attempts, UNIX_TIMESTAMP(locked_until) as locked_until_ts, UNIX_TIMESTAMP(last_activity) as last_activity_ts FROM rhs_users WHERE username = ?',
      values: [username],
    });

    if (users.length === 0) {
      logActivity({ username, ip, action: 'LOGIN_FAILED', level: 'warn', details: 'User not found' });
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    const user = users[0];

    // Check admin lock
    if (user.is_locked) {
      logActivity({ userId: user.id, username, ip, action: 'LOGIN_LOCKED', level: 'warn', details: 'Account is locked by admin' });
      return NextResponse.json({ message: 'Username Anda dikunci oleh admin. Mohon hubungi pengawas.' }, { status: 403 });
    }

    // Check brute force lockout
    const bfSettings = await getBruteforceSettings();
    const now = Math.floor(Date.now() / 1000);

    if (user.locked_until_ts && user.locked_until_ts > now) {
      const remainingMinutes = Math.ceil((user.locked_until_ts - now) / 60);
      logActivity({ userId: user.id, username, ip, action: 'LOGIN_BRUTEFORCE_LOCKED', level: 'warn', details: `Locked for ${remainingMinutes} more minutes` });
      return NextResponse.json({
        message: `Akun terkunci karena terlalu banyak percobaan login gagal. Coba lagi dalam ${remainingMinutes} menit.`,
        locked_until_ts: user.locked_until_ts
      }, { status: 429 });
    }

    // If lockout has expired, reset the counter
    if (user.locked_until_ts && user.locked_until_ts <= now && user.failed_login_attempts > 0) {
      await query({
        query: 'UPDATE rhs_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        values: [user.id]
      });
      user.failed_login_attempts = 0;
    }

    // Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;

      if (newAttempts >= bfSettings.maxAttempts) {
        // Lock the account
        await query({
          query: 'UPDATE rhs_users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          values: [newAttempts, bfSettings.lockoutMinutes, user.id]
        });
        const lockedUntilTs = now + (bfSettings.lockoutMinutes * 60);
        logActivity({ userId: user.id, username, ip, action: 'LOGIN_BRUTEFORCE_TRIGGERED', level: 'error', details: `Locked for ${bfSettings.lockoutMinutes} min after ${newAttempts} failed attempts` });
        return NextResponse.json({
          message: `Akun terkunci selama ${bfSettings.lockoutMinutes} menit karena ${newAttempts} percobaan login gagal.`,
          locked_until_ts: lockedUntilTs
        }, { status: 429 });
      } else {
        await query({
          query: 'UPDATE rhs_users SET failed_login_attempts = ? WHERE id = ?',
          values: [newAttempts, user.id]
        });
        logActivity({ userId: user.id, username, ip, action: 'LOGIN_FAILED', level: 'warn', details: `Wrong password (attempt ${newAttempts}/${bfSettings.maxAttempts})` });
        const remaining = bfSettings.maxAttempts - newAttempts;
        return NextResponse.json({
          message: `Username atau password salah. ${remaining} percobaan tersisa sebelum akun terkunci.`
        }, { status: 401 });
      }
    }

    // --- CHECK FOR EXISTING ACTIVE SESSION ---
    if (user.session_id) {
      const lastActivity = user.last_activity_ts || 0;
      const elapsed = now - lastActivity;

      let isSessionActive = false;

      if (elapsed < 3600) {
        isSessionActive = true;
      } else {
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

    // Login successful — reset failed attempts
    const sessionId = crypto.randomUUID();

    await query({
      query: 'UPDATE rhs_users SET session_id = ?, last_activity = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      values: [sessionId, user.id]
    });

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
