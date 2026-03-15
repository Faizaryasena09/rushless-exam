import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
import { logFromRequest } from '@/app/lib/logger';
import fs from 'fs/promises';
import { existsSync, writeFileSync, mkdirSync } from 'fs'; // For sync checks if needed, but we prefer async
import path from 'path';

async function getSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user) return null;
    const isValid = await validateUserSession(session);
    if (!isValid) return null;
    return session;
}

// Default settings — booleans use '0'/'1', numbers use string of number
const DEFAULT_SETTINGS = {
    admin_can_change_password: '1',
    admin_can_change_username: '1',
    teacher_can_change_password: '1',
    teacher_can_change_username: '1',
    student_can_change_password: '0',
    student_can_change_username: '0',
    bruteforce_max_attempts: '5',
    bruteforce_lockout_minutes: '15',
    reset_max_attempts: '3',
    reset_lockout_minutes: '15',
};

// Keys that are numeric (not boolean toggles)
const NUMERIC_KEYS = ['bruteforce_max_attempts', 'bruteforce_lockout_minutes', 'reset_max_attempts', 'reset_lockout_minutes'];

async function ensureSettingsTable() {
    try {
        await query({
            query: `CREATE TABLE IF NOT EXISTS rhs_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,
            values: [],
        });

        // Insert default settings if they don't exist
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
            await query({
                query: `INSERT IGNORE INTO rhs_settings (setting_key, setting_value) VALUES (?, ?)`,
                values: [key, value],
            });
        }
    } catch (error) {
        console.error('Failed to ensure settings table:', error);
    }
}

// GET — Fetch all settings (admin only) or just the user's role permissions (any logged in user)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

        // Fetch web branding settings universally if requested (Public info)
        if (mode === 'branding') {
            const brandingRows = await query({
                query: `SELECT setting_key, setting_value FROM rhs_web_settings WHERE setting_key IN ('site_name', 'site_logo', 'app_language')`,
                values: []
            });
            const branding = { site_name: 'Rushless Exam', site_logo: '/favicon.ico', app_language: 'id' };
            brandingRows.forEach(row => branding[row.setting_key] = row.setting_value);
            return NextResponse.json(branding);
        }

        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // Fetch application config for the Android app (Authenticated)
        if (mode === 'app-config') {
            const rows = await query({
                query: `SELECT setting_key, setting_value FROM rhs_web_settings WHERE setting_key = 'app_emergency_password'`,
                values: []
            });
            const config = { app_emergency_password: '' };
            rows.forEach(row => config[row.setting_key] = row.setting_value);
            return NextResponse.json(config);
        }

        await ensureSettingsTable();

        // If mode=my-permissions, return only the current user's role permissions
        if (mode === 'my-permissions') {
            const role = session.user.roleName;
            const rows = await query({
                query: `SELECT setting_key, setting_value FROM rhs_settings WHERE setting_key LIKE ?`,
                values: [`${role}_%`],
            });

            const permissions = {};
            rows.forEach(row => {
                const key = row.setting_key.replace(`${role}_`, '');
                permissions[key] = row.setting_value === '1';
            });

            return NextResponse.json(permissions);
        }

        // Full settings — admin only
        if (session.user.roleName !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const rows = await query({
            query: `SELECT setting_key, setting_value FROM rhs_settings`,
            values: [],
        });
        
        const brandingRows = await query({
            query: `SELECT setting_key, setting_value FROM rhs_web_settings`,
            values: []
        });

        const settings = {};
        rows.forEach(row => {
            if (NUMERIC_KEYS.includes(row.setting_key)) {
                settings[row.setting_key] = parseInt(row.setting_value) || 0;
            } else {
                settings[row.setting_key] = row.setting_value === '1';
            }
        });
        brandingRows.forEach(row => settings[row.setting_key] = row.setting_value);

        return NextResponse.json(settings);
    } catch (error) {
        return NextResponse.json({ message: 'Failed to fetch settings', error: error.message }, { status: 500 });
    }
}

// PUT — Update settings (admin only)
export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session || session.user.roleName !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await ensureSettingsTable();

        const body = await request.json();
        let { key, value } = body;

        if (!key) {
            return NextResponse.json({ message: 'Key is required' }, { status: 400 });
        }

        // Special Actions
        if (key === 'unlock_session_reset') {
            await query({
                query: `UPDATE rhs_settings SET setting_value = '0' WHERE setting_key = 'reset_attempts'`,
                values: []
            });
            await query({
                query: `DELETE FROM rhs_settings WHERE setting_key = 'reset_locked_until'`,
                values: []
            });
            logFromRequest(request, session, 'SESSION_RESET_UNLOCK', 'info', { action: 'Manual unlock from dashboard' });
            return NextResponse.json({ message: 'Endpoint session reset berhasil di-unlock.' });
        }

        // Handle Web Settings (Branding & App Config)
        if (['site_name', 'site_logo', 'app_language', 'app_emergency_password'].includes(key)) {
            // Validate app_language
            if (key === 'app_language' && !['id', 'en'].includes(value)) {
                return NextResponse.json({ message: 'Invalid language value. Use id or en.' }, { status: 400 });
            }

            // Intercept site_logo base64 and save as file
            if (key === 'site_logo' && value.startsWith('data:image')) {
                try {
                    const matches = value.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (matches.length !== 3) throw new Error('Invalid base64 string');
                    const buffer = Buffer.from(matches[2], 'base64');
                    // Ensure public/uploads exists
                    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
                    await fs.mkdir(uploadDir, { recursive: true });
                    
                    const filePath = path.join(uploadDir, 'site-logo.png');
                    await fs.writeFile(filePath, buffer);
                    
                    // Update value to the dynamic media URL + timestamp cache buster
                    value = `/api/media/site-logo.png?v=${Date.now()}`;
                } catch (err) {
                    console.error('Failed to save logo file:', err);
                    return NextResponse.json({ message: 'Failed to process logo file.' }, { status: 500 });
                }
            }

            await query({
                query: `INSERT INTO rhs_web_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
                values: [key, value, value],
            });
            logFromRequest(request, session, 'BRANDING_CHANGE', 'info', { setting: key, value_length: value?.length });
            return NextResponse.json({ message: 'Branding updated', key, value });
        }

        // Only allow known setting keys for rhs_settings
        const allowedKeys = Object.keys(DEFAULT_SETTINGS);
        if (!allowedKeys.includes(key)) {
            return NextResponse.json({ message: 'Invalid setting key' }, { status: 400 });
        }

        // Determine how to store the value
        let storeValue;
        if (NUMERIC_KEYS.includes(key)) {
            const num = parseInt(value);
            if (isNaN(num) || num < 1) {
                return NextResponse.json({ message: 'Value must be a positive number' }, { status: 400 });
            }
            storeValue = String(num);
        } else {
            storeValue = value ? '1' : '0';
        }

        await query({
            query: `INSERT INTO rhs_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
            values: [key, storeValue, storeValue],
        });

        logFromRequest(request, session, 'SETTING_CHANGE', 'info', { setting: key, value: NUMERIC_KEYS.includes(key) ? parseInt(storeValue) : !!value });

        return NextResponse.json({ message: 'Setting updated', key, value: NUMERIC_KEYS.includes(key) ? parseInt(storeValue) : !!value });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to update setting', error: error.message }, { status: 500 });
    }
}
