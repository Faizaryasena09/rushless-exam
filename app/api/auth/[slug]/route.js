import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { logActivity, getClientIP } from '@/app/lib/logger';

const SECRET_URL_SLUG = 'reset-all-sessions=@Rushless123';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

export async function GET(request, { params }) {
  const { slug } = await params;
  const ip = getClientIP(request);
  const now = Math.floor(Date.now() / 1000);

  try {
    // 0. Ensure rhs_settings table exists (self-healing)
    await query({
      query: `CREATE TABLE IF NOT EXISTS rhs_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,
      values: []
    });

    // 1. Get current brute force state for global reset from settings
    const settingsRows = await query({
      query: `SELECT setting_key, setting_value FROM rhs_settings WHERE setting_key IN ('reset_attempts', 'reset_locked_until', 'reset_max_attempts', 'reset_lockout_minutes')`,
      values: []
    });

    const state = {};
    settingsRows.forEach(r => { state[r.setting_key] = r.setting_value; });

    const attempts = parseInt(state.reset_attempts) || 0;
    const lockedUntil = parseInt(state.reset_locked_until) || 0;
    const maxAttempts = parseInt(state.reset_max_attempts) || MAX_ATTEMPTS;
    const lockoutMinutes = parseInt(state.reset_lockout_minutes) || LOCKOUT_MINUTES;

    // 2. Check Lockout
    if (lockedUntil > now) {
      const remaining = Math.ceil((lockedUntil - now) / 60);
      return new NextResponse(`<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
        <h1 style="color:#ef4444;">Access Denied</h1>
        <p>Terlalu banyak percobaan gagal. Endpoint terkunci. Coba lagi dalam <b>${remaining} menit</b>.</p>
      </body></html>`, { status: 429, headers: { 'Content-Type': 'text/html' } });
    }

    // 3. Verify URL Slug
    if (slug !== SECRET_URL_SLUG) {
      const newAttempts = attempts + 1;
      
      if (newAttempts >= maxAttempts) {
        // Trigger Lockout
        const lockTime = now + (lockoutMinutes * 60);
        await query({
          query: `INSERT INTO rhs_settings (setting_key, setting_value) VALUES ('reset_attempts', ?), ('reset_locked_until', ?) 
                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          values: [newAttempts.toString(), lockTime.toString()]
        });
        
        logActivity({ ip, action: 'SESSION_RESET_LOCKED', level: 'error', details: `Global session reset locked for ${lockoutMinutes}m after ${newAttempts} failures` });
        
        return new NextResponse(`<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
          <h1 style="color:#ef4444;">Endpoint Locked</h1>
          <p>Kredensial salah. Endpoint dikunci selama ${lockoutMinutes} menit.</p>
        </body></html>`, { status: 429, headers: { 'Content-Type': 'text/html' } });
      } else {
        // Increment attempts
        await query({
          query: `INSERT INTO rhs_settings (setting_key, setting_value) VALUES ('reset_attempts', ?) 
                  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          values: [newAttempts.toString()]
        });
        
        logActivity({ ip, action: 'SESSION_RESET_FAILED', level: 'warn', details: `Invalid slug access: ${slug}. Attempt ${newAttempts}/${maxAttempts}` });
        
        return new NextResponse(`<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
          <h1 style="color:#f59e0b;">Invalid Credential</h1>
          <p>Kredensial salah. ${maxAttempts - newAttempts} percobaan tersisa.</p>
        </body></html>`, { status: 401, headers: { 'Content-Type': 'text/html' } });
      }
    }

    // 4. Success - Reset All Sessions
    await query({
      query: 'UPDATE rhs_users SET session_id = NULL',
      values: []
    });

    // Reset attempt counters on success
    await query({
        query: `UPDATE rhs_settings SET setting_value = '0' WHERE setting_key = 'reset_attempts'`,
        values: []
    });
    await query({
        query: `DELETE FROM rhs_settings WHERE setting_key = 'reset_locked_until'`,
        values: []
    });

    logActivity({ ip, action: 'SESSION_RESET_ALL', level: 'info', details: 'All user sessions have been globally reset via secure URL' });

    return new NextResponse(`<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;">
      <h1 style="color:#10b981;">Success!</h1>
      <p>Semua sesi login berhasil direset secara global.</p>
      <hr style="width:50%;margin:20px auto;opacity:0.2;">
      <p style="font-size:0.8rem;color:#64748b;">Aktivitas ini telah dicatat oleh sistem.</p>
    </body></html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });

  } catch (error) {
    console.error('Session reset error:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
  }
}
