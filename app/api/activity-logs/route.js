import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { ensureActivityLogsSchema } from '@/app/lib/activity-log-schema';
import { logSystemError } from '@/app/lib/logger';

const VALID_LEVELS = ['info', 'warn', 'error'];

function buildFilters(searchParams) {
    const conditions = [];
    const values = [];

    const level = searchParams.get('level') || '';
    if (VALID_LEVELS.includes(level)) {
        conditions.push('level = ?');
        values.push(level);
    }

    const action = searchParams.get('action') || '';
    if (action) {
        conditions.push('action = ?');
        values.push(action);
    }

    const userId = searchParams.get('user_id') || '';
    if (userId && /^\d+$/.test(userId)) {
        conditions.push('user_id = ?');
        values.push(Number(userId));
    }

    const from = searchParams.get('from') || '';
    if (from) {
        conditions.push('created_at >= ?');
        values.push(from);
    }

    const to = searchParams.get('to') || '';
    if (to) {
        conditions.push('created_at <= ?');
        values.push(to.length <= 10 ? `${to} 23:59:59` : to);
    }

    const search = (searchParams.get('search') || '').trim();
    if (search) {
        conditions.push(`(
            username LIKE ? OR action LIKE ? OR ip_address LIKE ? OR details LIKE ?
            OR path LIKE ? OR method LIKE ? OR request_id LIKE ? OR error_name LIKE ?
            OR user_agent LIKE ? OR stack_trace LIKE ?
        )`);
        const wild = `%${search}%`;
        values.push(wild, wild, wild, wild, wild, wild, wild, wild, wild, wild);
    }

    return {
        whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
        values
    };
}

function toCsv(logs) {
    const headers = [
        'id', 'created_at', 'level', 'action', 'user_id', 'username',
        'ip_address', 'method', 'path', 'status_code', 'request_id',
        'duration_ms', 'user_agent', 'error_name', 'details'
    ];

    const escape = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/\r?\n/g, ' ');
        return /[",;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const rows = logs.map((log) => headers.map((h) => escape(log[h])).join(','));
    return [headers.join(','), ...rows].join('\n');
}

export async function GET(request) {
    let session = null;
    try {
        // Auth check — admin only
        const cookieStore = await cookies();
        session = await getIronSession(cookieStore, sessionOptions);
        if (!session.user || session.user.roleName !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await ensureActivityLogsSchema();

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
        const limit = Math.min(2000, Math.max(10, parseInt(searchParams.get('limit') || '50') || 50));
        const format = (searchParams.get('format') || '').toLowerCase();
        const { whereClause, values } = buildFilters(searchParams);

        const columns = `id, user_id, username, ip_address, action, level, details,
            request_id, method, path, status_code, user_agent, error_name, stack_trace, duration_ms, created_at`;

        // Ekspor CSV (mengikuti filter yang aktif)
        if (format === 'csv') {
            const rows = await query({
                query: `SELECT ${columns} FROM rhs_activity_logs ${whereClause} ORDER BY created_at DESC LIMIT 10000`,
                values
            });
            const csv = toCsv(rows);
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="activity-logs-${new Date().toISOString().slice(0, 10)}.csv"`
                }
            });
        }

        const offset = (page - 1) * limit;

        const [countResult, logs, levelCounts, actionList] = await Promise.all([
            query({ query: `SELECT COUNT(*) as total FROM rhs_activity_logs ${whereClause}`, values }),
            // LIMIT/OFFSET di-inline agar tipe prepared statement tidak bermasalah
            query({
                query: `SELECT ${columns} FROM rhs_activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
                values
            }),
            query({
                query: `SELECT level, COUNT(*) as total FROM rhs_activity_logs ${whereClause} GROUP BY level`,
                values
            }),
            query({ query: 'SELECT DISTINCT action FROM rhs_activity_logs ORDER BY action ASC LIMIT 500' })
        ]);

        const total = countResult[0].total;
        const counts = { info: 0, warn: 0, error: 0 };
        levelCounts.forEach((row) => { counts[row.level] = row.total; });

        return NextResponse.json({
            logs,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            levelCounts: counts,
            actions: actionList.map((row) => row.action).filter(Boolean)
        });
    } catch (error) {
        await logSystemError(error, {
            action: 'SYSTEM_ACTIVITY_LOGS_READ_FAILED',
            request,
            session,
            context: { endpoint: '/api/activity-logs' }
        });
        return NextResponse.json({ message: 'Failed to fetch logs' }, { status: 500 });
    }
}