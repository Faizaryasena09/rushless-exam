import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

// Ensure the table exists (runs once per cold start)
let tableChecked = false;
async function ensureTable() {
    if (tableChecked) return;
    try {
        await query({
            query: `CREATE TABLE IF NOT EXISTS rhs_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                username VARCHAR(255),
                ip_address VARCHAR(45),
                action VARCHAR(100) NOT NULL,
                level ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_level (level),
                INDEX idx_user_id (user_id),
                INDEX idx_action (action)
            )`
        });
        tableChecked = true;
    } catch (err) {
        console.error('[ActivityLogs] Failed to ensure table:', err.message);
    }
}

export async function GET(request) {
    try {
        // Auth check — admin only
        const cookieStore = await cookies();
        const session = await getIronSession(cookieStore, sessionOptions);
        if (!session.user || session.user.roleName !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await ensureTable();

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50')));
        const level = searchParams.get('level') || '';
        const search = searchParams.get('search') || '';
        const from = searchParams.get('from') || '';
        const to = searchParams.get('to') || '';
        const offset = (page - 1) * limit;

        // Build WHERE clauses
        const conditions = [];
        const values = [];

        if (level && ['info', 'warn', 'error'].includes(level)) {
            conditions.push('level = ?');
            values.push(level);
        }

        if (search) {
            conditions.push('(username LIKE ? OR action LIKE ? OR ip_address LIKE ? OR details LIKE ?)');
            const searchWild = `%${search}%`;
            values.push(searchWild, searchWild, searchWild, searchWild);
        }

        if (from) {
            conditions.push('created_at >= ?');
            values.push(from);
        }

        if (to) {
            conditions.push('created_at <= ?');
            values.push(to + ' 23:59:59');
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // Get total count
        const countResult = await query({
            query: `SELECT COUNT(*) as total FROM rhs_activity_logs ${whereClause}`,
            values
        });
        const total = countResult[0].total;

        // Get logs — use inline LIMIT/OFFSET to avoid prepared statement type issues
        const logs = await query({
            query: `SELECT id, user_id, username, ip_address, action, level, details, created_at FROM rhs_activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            values
        });

        return NextResponse.json({
            logs,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('[ActivityLogs] GET error:', error);
        return NextResponse.json({ message: 'Failed to fetch logs', error: error.message }, { status: 500 });
    }
}
