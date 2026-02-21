import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

async function getSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user) return null;
    const isValid = await validateUserSession(session);
    if (!isValid) return null;
    return session;
}

// Default settings
const DEFAULT_SETTINGS = {
    admin_can_change_password: true,
    admin_can_change_username: true,
    teacher_can_change_password: true,
    teacher_can_change_username: true,
    student_can_change_password: false,
    student_can_change_username: false,
};

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
                values: [key, value ? '1' : '0'],
            });
        }
    } catch (error) {
        console.error('Failed to ensure settings table:', error);
    }
}

// GET — Fetch all settings (admin only) or just the user's role permissions (any logged in user)
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await ensureSettingsTable();

        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

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

        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value === '1';
        });

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
        const { key, value } = body;

        if (!key) {
            return NextResponse.json({ message: 'Key is required' }, { status: 400 });
        }

        // Only allow known setting keys
        const allowedKeys = Object.keys(DEFAULT_SETTINGS);
        if (!allowedKeys.includes(key)) {
            return NextResponse.json({ message: 'Invalid setting key' }, { status: 400 });
        }

        await query({
            query: `INSERT INTO rhs_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
            values: [key, value ? '1' : '0', value ? '1' : '0'],
        });

        return NextResponse.json({ message: 'Setting updated', key, value: !!value });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to update setting', error: error.message }, { status: 500 });
    }
}
