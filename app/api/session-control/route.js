import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { logFromRequest } from '@/app/lib/logger';
import { publish } from '@/app/lib/redis-pubsub';
import redis, { isRedisReady } from '@/app/lib/redis';

export const dynamic = 'force-dynamic';

const IDLE_TIMEOUT = 3600; // 1 jam, samakan dengan validateUserSession

// Cache pemeriksaan kolom (module scope, hot-reload aman)
let lastLoginColumnChecked = false;

async function getAdminSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user || session.user.roleName !== 'admin') return null;
    return session;
}

/**
 * Bersihkan semua jejak sesi seorang user (Redis + DB).
 * Dipakai oleh aksi "Restart Sesi" dan "Unlock".
 */
async function purgeUserSession(userId, username) {
    if (isRedisReady()) {
        const normalized = (username || '').toLowerCase();
        const keys = [
            `session:${userId}`,
            `online:${userId}`,
            `last_activity:${userId}`,
            `user:locked:${userId}`,
            `user:lastlockcheck:${userId}`,
        ];
        if (normalized) {
            keys.push(`bf:lock:${normalized}`, `bf:att:${normalized}`);
        }
        await redis.del(...keys).catch(() => {});
    }

    await query({
        query: `UPDATE rhs_users
                SET session_id = NULL,
                    last_activity = '1970-01-01 00:00:00',
                    is_online_realtime = 0
                WHERE id = ?`,
        values: [userId]
    }).catch(() => {});
}

/**
 * Reset brute-force / lock state (akun terkunci karena salah sandi).
 */
async function purgeUserLock(userId, username) {
    if (isRedisReady()) {
        const normalized = (username || '').toLowerCase();
        const keys = [`user:locked:${userId}`, `user:lastlockcheck:${userId}`];
        if (normalized) keys.push(`bf:lock:${normalized}`, `bf:att:${normalized}`);
        await redis.del(...keys).catch(() => {});
    }

    await query({
        query: 'UPDATE rhs_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
        values: [userId]
    }).catch(() => {});
}

// GET -> Daftar user beserta status sesi, last login, dan status online
export async function GET(request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role') || '';
        const search = (searchParams.get('search') || '').trim();

        const where = [];
        const values = [];

        // Pastikan kolom last_login tersedia.
        // Dicek lewat information_schema (bukan ALTER tiap request) supaya tidak
        // terjadi DDL/lock table berulang — halaman ini polling tiap 5 detik.
        if (!lastLoginColumnChecked) {
            const probe = await query({
                query: `SELECT COUNT(*) as c FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rhs_users'
                        AND COLUMN_NAME = 'last_login'`,
                values: []
            }).catch(() => null);

            if (probe && Number(probe[0]?.c || 0) > 0) {
                lastLoginColumnChecked = true;
            } else {
                // Kolom belum ada -> coba buat SEKALI saja, lalu jangan ulangi
                const ok = await query({
                    query: 'ALTER TABLE rhs_users ADD COLUMN last_login DATETIME NULL DEFAULT NULL',
                    values: []
                }).then(() => true).catch(() => false);
                lastLoginColumnChecked = ok;
            }
        }

        if (['admin', 'teacher', 'student'].includes(role)) {
            where.push('u.role = ?');
            values.push(role);
        }

        if (search) {
            where.push('(u.username LIKE ? OR u.name LIKE ?)');
            values.push(`%${search}%`, `%${search}%`);
        }

        const users = await query({
            query: `
                SELECT
                    u.id, u.username, u.name, u.role, u.class_id,
                    u.is_locked, u.session_id, u.is_online_realtime,
                    u.last_login, u.last_activity,
                    u.failed_login_attempts, u.locked_until,
                    UNIX_TIMESTAMP(u.last_login) AS last_login_ts,
                    UNIX_TIMESTAMP(u.last_activity) AS last_activity_ts,
                    UNIX_TIMESTAMP(u.locked_until) AS locked_until_ts,
                    UNIX_TIMESTAMP(NOW()) AS now_ts,
                    c.class_name,
                    ea.id AS attempt_id,
                    e.exam_name
                FROM rhs_users u
                LEFT JOIN rhs_classes c ON u.class_id = c.id
                LEFT JOIN rhs_exam_attempts ea ON u.id = ea.user_id AND ea.status = 'in_progress'
                LEFT JOIN rhs_exams e ON ea.exam_id = e.id
                ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY u.is_online_realtime DESC, u.last_activity DESC
            `,
            values
        });

        const now = Math.floor(Date.now() / 1000);
        const redisReady = isRedisReady();

        // Ambil status online real-time dari Redis (lebih akurat daripada DB)
        const onlineFlags = {};
        if (redisReady) {
            const pipeline = redis.pipeline();
            users.forEach(u => pipeline.exists(`online:${u.id}`));
            const results = await pipeline.exec().catch(() => null);
            if (results) {
                users.forEach((u, i) => { onlineFlags[u.id] = results[i]?.[1] === 1; });
            }
        }

        const result = users.map(u => {
            const isOnline = redisReady && onlineFlags[u.id] !== undefined
                ? onlineFlags[u.id]
                : !!u.is_online_realtime;

            const hasSession = !!u.session_id;
            const idleSeconds = now - (Number(u.last_activity_ts) || 0);
            const isIdle = !u.last_activity_ts || idleSeconds > IDLE_TIMEOUT;
            const hasActiveExam = !!u.attempt_id;

            // Sesi "nyangkut": masih ada session_id tapi tidak ada aktivitas,
            // tidak online, dan tidak sedang ujian ->ztidak bisa login lagi.
            const isStuck = hasSession && !isOnline && isIdle && !hasActiveExam;

            const isBruteLocked = !!u.locked_until_ts && u.locked_until_ts > Number(u.now_ts);

            return {
                id: u.id,
                username: u.username,
                name: u.name,
                role: u.role,
                class_name: u.class_name,
                has_session: hasSession,
                session_id_short: hasSession ? String(u.session_id).slice(0, 8) : null,
                is_online: isOnline,
                is_idle: hasSession && isIdle,
                is_stuck: isStuck,
                is_locked: !!u.is_locked,
                is_brute_locked: isBruteLocked,
                failed_attempts: u.failed_login_attempts || 0,
                locked_until: u.locked_until,
                last_login: u.last_login,
                last_login_ts: u.last_login_ts ? Number(u.last_login_ts) : null,
                last_activity: u.last_activity,
                idle_seconds: hasSession && u.last_activity_ts ? Math.max(0, idleSeconds) : null,
                current_exam: u.exam_name || null,
                attempt_id: u.attempt_id || null,
            };
        });

        const summary = {
            total: result.length,
            online: result.filter(u => u.is_online).length,
            with_session: result.filter(u => u.has_session).length,
            stuck: result.filter(u => u.is_stuck).length,
            locked: result.filter(u => u.is_locked || u.is_brute_locked).length
        };

        return NextResponse.json({ users: result, summary, redis: redisReady });
    } catch (error) {
        console.error('Session control list error:', error);
        return NextResponse.json({ message: 'Gagal memuat data sesi', error: error.message }, { status: 500 });
    }
}

// POST -> Aksi kontrol sesi
export async function POST(request) {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    try {
        const { action, userId, userIds } = await request.json();

        // Restart semua sesi (semua user)
        if (action === 'restart_all') {
            const users = await query({ query: 'SELECT id, username FROM rhs_users WHERE id != ?', values: [session.user.id] });
            for (const u of users) {
                await purgeUserSession(u.id, u.username);
            }
            publish('force_logout', { userId: 'all' });
            logFromRequest(request, session, 'SESSION_RESTART_ALL', 'warn', {
                details: `Restart sesi untuk ${users.length} user`
            });
            return NextResponse.json({ message: `Sesi di-restart untuk ${users.length} user.` });
        }

        // Unlock semua akun terkunci
        if (action === 'unlock_all') {
            const users = await query({ query: 'SELECT id, username FROM rhs_users' });
            for (const u of users) {
                await purgeUserLock(u.id, u.username);
            }
            await query({ query: 'UPDATE rhs_users SET is_locked = 0' }).catch(() => {});
            if (isRedisReady()) {
                const lockKeys = await redis.keys('user:locked:*').catch(() => []);
                if (lockKeys.length) await redis.del(...lockKeys).catch(() => {});
            }
            logFromRequest(request, session, 'USER_UNLOCK_ALL', 'warn', {
                details: 'Reset seluruh lock akun (brute-force & admin lock)'
            });
            return NextResponse.json({ message: 'Semua akun berhasil di-unlock.' });
        }

        if (!userId) {
            return NextResponse.json({ message: 'userId is required' }, { status: 400 });
        }

        const targets = Array.isArray(userIds) && userIds.length
            ? userIds
            : [userId];

        const users = await query({
            query: `SELECT id, username, name, session_id FROM rhs_users WHERE id IN (${targets.map(() => '?').join(',')})`,
            values: targets
        });

        if (users.length === 0) {
            return NextResponse.json({ message: 'User tidak ditemukan' }, { status: 404 });
        }

        const affected = [];

        for (const user of users) {
            switch (action) {
                case 'restart_session':
                    await purgeUserSession(user.id, user.username);
                    publish('force_logout', { userId: user.id });
                    affected.push(user.username);
                    break;

                case 'unlock':
                    await purgeUserLock(user.id, user.username);
                    await query({
                        query: 'UPDATE rhs_users SET is_locked = 0 WHERE id = ?',
                        values: [user.id]
                    }).catch(() => {});
                    if (isRedisReady()) await redis.del(`user:locked:${user.id}`).catch(() => {});
                    // User yang tadinya terkunci mungkin sedang punya sesi basi
                    if (user.session_id) {
                        publish('refresh', { userId: user.id });
                    }
                    affected.push(user.username);
                    break;

                case 'clear_stuck':
                    // Hanya bersihkan sesi nyangkut (tidak memaksa logout user yang online)
                    await purgeUserSession(user.id, user.username);
                    affected.push(user.username);
                    break;

                case 'toggle_lock': {
                    const state = await query({
                        query: 'SELECT is_locked FROM rhs_users WHERE id = ?',
                        values: [user.id]
                    });
                    const nextValue = state[0]?.is_locked ? 0 : 1;
                    await query({
                        query: 'UPDATE rhs_users SET is_locked = ? WHERE id = ?',
                        values: [nextValue, user.id]
                    });
                    if (isRedisReady()) {
                        if (nextValue) await redis.set(`user:locked:${user.id}`, '1', 'EX', 3600).catch(() => {});
                        else await redis.del(`user:locked:${user.id}`).catch(() => {});
                    }
                    if (nextValue) {
                        await purgeUserSession(user.id, user.username);
                        publish('force_logout', { userId: user.id });
                    }
                    affected.push(user.username);
                    break;
                }

                default:
                    return NextResponse.json({ message: `Aksi tidak dikenal: ${action}` }, { status: 400 });
            }
        }

        const logMap = {
            restart_session: ['SESSION_RESTART', 'warn'],
            unlock: ['USER_UNLOCK', 'info'],
            clear_stuck: ['SESSION_CLEAR_STUCK', 'warn'],
            toggle_lock: ['USER_LOCK_TOGGLE', 'warn']
        };
        const [logAction, logLevel] = logMap[action] || ['SESSION_ACTION', 'info'];
        logFromRequest(request, session, logAction, logLevel, {
            targetUser: affected.join(', '),
            details: `Aksi: ${action}`
        });

        return NextResponse.json({
            message: `Berhasil diterapkan ke ${affected.length} user: ${affected.join(', ')}`
        });
    } catch (error) {
        console.error('Session control action error:', error);
        return NextResponse.json({ message: 'Aksi gagal', error: error.message }, { status: 500 });
    }
}