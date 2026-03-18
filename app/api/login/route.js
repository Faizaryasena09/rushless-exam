import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import redis, { isRedisReady } from '@/app/lib/redis';
import { logActivity, getClientIP } from '@/app/lib/logger';

async function getBruteforceSettings() {
  const cacheKey = 'settings:bruteforce';
  
  if (isRedisReady()) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
  }

  // Fallback to DB
  try {
    const rows = await query({
      query: `SELECT setting_key, setting_value FROM rhs_settings WHERE setting_key IN ('bruteforce_max_attempts', 'bruteforce_lockout_minutes')`,
    });
    const s = {};
    rows.forEach(r => { s[r.setting_key] = parseInt(r.setting_value) || 0; });
    
    const settings = {
      maxAttempts: s.bruteforce_max_attempts || 5,
      lockoutMinutes: s.bruteforce_lockout_minutes || 15,
    };

    if (isRedisReady()) {
      await redis.set(cacheKey, JSON.stringify(settings), 'EX', 3600).catch(() => {});
    }
    return settings;
  } catch {
    return { maxAttempts: 5, lockoutMinutes: 15 };
  }
}

export async function POST(request) {
  const ip = getClientIP(request);

  try {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);

    const { username, password } = await request.json();

    // 1. Check Redis for Brute Force Lockout (Fast path)
    const redisReady = isRedisReady();
    const bfSettings = await getBruteforceSettings();
    const redisBfKey = `bf:lock:${username}`;
    
    if (redisReady) {
      const isLocked = await redis.get(redisBfKey);
      if (isLocked) {
        logActivity({ username, ip, action: 'LOGIN_BRUTEFORCE_LOCKED', level: 'warn', details: 'Account locked (Redis)' });
        return NextResponse.json({
          message: `Akun terkunci karena terlalu banyak percobaan login gagal. Mohon tunggu beberapa saat.`
        }, { status: 429 });
      }
    }

    // 2. Find user
    const users = await query({
      query: 'SELECT id, username, name, password, role, class_id, session_id, is_locked, failed_login_attempts, UNIX_TIMESTAMP(locked_until) as locked_until_ts, UNIX_TIMESTAMP(last_activity) as last_activity_ts FROM rhs_users WHERE username = ?',
      values: [username],
    });

    if (users.length === 0) {
      logActivity({ username, ip, action: 'LOGIN_FAILED', level: 'warn', details: 'User not found' });
      return NextResponse.json({ message: 'Invalid username or password' }, { status: 401 });
    }

    const user = users[0];

    // 3. Admin lock check
    if (user.is_locked) {
      logActivity({ userId: user.id, username, ip, action: 'LOGIN_LOCKED', level: 'warn', details: 'Account is locked by admin' });
      return NextResponse.json({ message: 'Username Anda dikunci oleh admin. Mohon hubungi pengawas.' }, { status: 403 });
    }

    // 4. MySQL Brute Force Lockout check (Fallback/Persistence)
    const now = Math.floor(Date.now() / 1000);
    if (user.role !== 'admin' && user.locked_until_ts && user.locked_until_ts > now) {
      const remainingMinutes = Math.ceil((user.locked_until_ts - now) / 60);
      return NextResponse.json({
        message: `Akun terkunci. Coba lagi dalam ${remainingMinutes} menit.`,
        locked_until_ts: user.locked_until_ts
      }, { status: 429 });
    }

    // 5. Password verify
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const redisAttemptKey = `bf:att:${username}`;
      let attempts = 0;

      if (redisReady) {
        attempts = await redis.incr(redisAttemptKey);
        await redis.expire(redisAttemptKey, 600); // 10 min window
      } else {
        attempts = (user.failed_login_attempts || 0) + 1;
      }

      if (attempts >= bfSettings.maxAttempts) {
        // Lock in Redis
        if (redisReady) {
          await redis.set(redisBfKey, '1', 'EX', bfSettings.lockoutMinutes * 60);
        }
        
        // Lock in MySQL (Async, don't block response)
        query({
          query: 'UPDATE rhs_users SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
          values: [attempts, bfSettings.lockoutMinutes, user.id]
        }).catch(() => {});

        logActivity({ userId: user.id, username, ip, action: 'LOGIN_BRUTEFORCE_TRIGGERED', level: 'error', details: `Locked for ${bfSettings.lockoutMinutes}m` });
        return NextResponse.json({
          message: `Akun terkunci selama ${bfSettings.lockoutMinutes} menit karena terlalu banyak percobaan gagal.`
        }, { status: 429 });
      } else {
        // Update MySQL failure counter (Async)
        if (!redisReady) {
          query({
            query: 'UPDATE rhs_users SET failed_login_attempts = ? WHERE id = ?',
            values: [attempts, user.id]
          }).catch(() => {});
        }
        
        logActivity({ userId: user.id, username, ip, action: 'LOGIN_FAILED', level: 'warn', details: `Wrong password (${attempts}/${bfSettings.maxAttempts})` });
        return NextResponse.json({
          message: `Username atau password salah. ${bfSettings.maxAttempts - attempts} percobaan tersisa.`
        }, { status: 401 });
      }
    }

    // 6. Active Session Check (Redis-First)
    if (user.session_id) {
      const elapsed = now - (user.last_activity_ts || 0);
      let isSessionActive = elapsed < 3600;

      if (!isSessionActive && redisReady) {
        // Check Redis Set first (Zero Query)
        const activeExamsCount = await redis.scard(`user:active_exams:${user.id}`);
        if (activeExamsCount > 0) isSessionActive = true;
      } else if (!isSessionActive) {
        // Fallback to DB if Redis is down
        const activeAttempts = await query({
          query: "SELECT id FROM rhs_exam_attempts WHERE user_id = ? AND status = 'in_progress' LIMIT 1",
          values: [user.id]
        });
        if (activeAttempts.length > 0) isSessionActive = true;
      }

      if (isSessionActive) {
        logActivity({ userId: user.id, username, ip, action: 'LOGIN_DENIED', level: 'warn', details: 'Dual login attempt' });
        return NextResponse.json({ message: 'Akun ini sedang aktif di perangkat lain.' }, { status: 409 });
      }
    }

    // 7. Success
    const sessionId = crypto.randomUUID();
    const redisSessionKey = `session:${user.id}`;

    // Update MySQL (Critical: session_id must match for persistence)
    // Non-critical updates like last_activity can be handled here too
    await query({
      query: 'UPDATE rhs_users SET session_id = ?, last_activity = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      values: [sessionId, user.id]
    });

    // Update Redis (Session & Safety Cleanups)
    if (redisReady) {
      Promise.all([
        redis.set(redisSessionKey, sessionId, 'EX', 3600),
        redis.del(`bf:att:${username}`),
        redis.del(redisBfKey),
        redis.del(`user:locked:${user.id}`),
        redis.del(`user:lastlockcheck:${user.id}`)
      ]).catch(() => {});
    }

    session.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      roleName: user.role,
      class_id: user.class_id,
      session_id: sessionId,
    };
    await session.save();

    logActivity({ userId: user.id, username, ip, action: 'LOGIN_SUCCESS', level: 'info' });
    return NextResponse.json({ message: 'Login successful' }, { status: 200 });

  } catch (error) {
    logActivity({ ip, action: 'LOGIN_ERROR', level: 'error', details: error.message });
    return NextResponse.json({ message: 'Terjadi kesalahan sistem.', error: error.message }, { status: 500 });
  }
}

