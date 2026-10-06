'use strict';

/**
 * Perintah terkait sesi & login.
 * Semua operasi mengikuti aturan yang sama dengan aplikasi:
 *   - sesi disimpan di rhs_users.session_id
 *   - heartbeat online disimpan di Redis (online:{id}) bila Redis aktif
 *   - session TTL 1 jam, lock brute-force ada di rhs_users + Redis
 */

const db = require('../lib/db');
const redis = require('../lib/redis');
const { humanDuration } = require('../lib/output');

const IDLE_LIMIT = 3600; // detik, sama dengan validateUserSession()

/** Ambil user berdasarkan id ATAU username (atau sebagian nama). */
async function findUser(identifier) {
    if (!identifier) return null;
    const value = String(identifier).trim();
    if (/^\d+$/.test(value)) {
        const byId = await db.queryOne('SELECT * FROM rhs_users WHERE id = ?', [Number(value)]);
        if (byId) return byId;
    }
    const byName = await db.queryOne('SELECT * FROM rhs_users WHERE username = ?', [value]);
    if (byName) return byName;
    return db.queryOne('SELECT * FROM rhs_users WHERE username LIKE ? LIMIT 1', [`%${value}%`]);
}

async function requireUser(identifier) {
    const user = await findUser(identifier);
    if (!user) {
        const err = new Error(`User "${identifier}" tidak ditemukan`);
        err.code = 'RHSLS_USER_NOT_FOUND';
        throw err;
    }
    return user;
}

/** Status online + aktivitas dari Redis (fallback ke MySQL) */
async function decorateUsers(users) {
    if (!users.length) return [];
    const ids = users.map((u) => u.id);
    const onlineMap = await redis.existsMany(ids.map((id) => `online:${id}`));
    const activityMap = await redis.mgetMany(ids.map((id) => `last_activity:${id}`));

    const now = Math.floor(Date.now() / 1000);
    const redisOk = Object.keys(onlineMap).length > 0;

    return users.map((u) => {
        const isOnline = redisOk ? !!onlineMap[`online:${u.id}`] : !!u.is_online_realtime;
        const lastActivityTs = redisOk
            ? parseInt(activityMap[`last_activity:${u.id}`] || '0', 10) || Number(u.last_activity_ts) || 0
            : Number(u.last_activity_ts) || 0;
        const idleSeconds = lastActivityTs ? now - lastActivityTs : null;
        const hasSession = !!u.session_id;
        const isLocked = !!u.is_locked;
        const bruteLocked = !!u.locked_until && new Date(u.locked_until) > new Date();

        return {
            ...u,
            isOnline,
            hasSession,
            idleSeconds,
            isIdle: hasSession && (idleSeconds === null || idleSeconds > IDLE_LIMIT),
            isLocked,
            bruteLocked,
            isLockedAny: isLocked || bruteLocked,
            // sesi nyangkut: punya session_id tapi idle & tidak ada ujian berjalan
            isStuck: hasSession && !isOnline && (idleSeconds === null || idleSeconds > IDLE_LIMIT),
        };
    });
}

/** Reset sesi: hapus di MySQL + Redis, opsional publish ke SSE user */
async function resetSessions(targets, { reason = 'reset_session' } = {}) {
    const result = { done: 0, skipped: 0, ids: [] };

    for (const user of targets) {
        if (!user.hasSession && !user.isOnline) {
            result.skipped += 1;
            continue;
        }
        await db.execute(
            `UPDATE rhs_users
             SET session_id = NULL, last_activity = '1970-01-01 00:00:00', is_online_realtime = 0
             WHERE id = ?`,
            [user.id]
        );
        await redis.del([`session:${user.id}`, `online:${user.id}`, `last_activity:${user.id}`]);
        await redis.publish('force_logout', { userId: user.id, reason });
        result.done += 1;
        result.ids.push(user.id);
        if (reason) {
            await db.logActivity({
                userId: user.id, username: user.username, action: 'SESSION_RESET_CLI',
                level: 'warn', details: reason
            });
        }
    }

    return result;
}

function formatIdle(seconds) {
    if (seconds === null || seconds === undefined) return '-';
    if (seconds < 60) return `${seconds}d`;
    return humanDuration(seconds).replace(' menit', 'm').replace(' jam', 'j').replace(' detik', 'd');
}

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const diff = Date.now() - d.getTime();
    if (diff >= 0 && diff < 86400000) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const commands = [
    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:list',
        aliases: ['sessions'],
        description: 'Daftar user beserta status sesi & online',
        usage: 'rhsls session:list [--role student] [--class "Kelas 1"] [--online] [--search a] [--limit 50]',
        examples: ['rhsls session:list --online', 'rhsls session:list --role teacher --json'],
        async run(ctx) {
            const { flags } = ctx;
            const conditions = [];
            const values = [];

            if (flags.role) { conditions.push('u.role = ?'); values.push(flags.role); }
            if (flags.class) { conditions.push('c.class_name = ?'); values.push(flags.class); }
            if (flags.search) {
                conditions.push('(u.username LIKE ? OR u.name LIKE ?)');
                values.push(`%${flags.search}%`, `%${flags.search}%`);
            }
            if (flags.locked) conditions.push('(u.is_locked = 1 OR u.locked_until IS NOT NULL)');
            if (flags.online) conditions.push('u.is_online_realtime = 1');

            const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
            const limit = Math.min(1000, Number(flags.limit) || 50);

            const users = await db.query(
                `SELECT u.id, u.username, u.name, u.role, u.is_locked, u.locked_until,
                        u.session_id, u.is_online_realtime, u.last_activity, u.last_login,
                        u.failed_login_attempts, c.class_name
                 FROM rhs_users u
                 LEFT JOIN rhs_classes c ON u.class_id = c.id
                 ${where}
                 ORDER BY u.last_activity DESC
                 LIMIT ${limit}`,
                values
            );

            const decorated = await decorateUsers(users);
            const rows = decorated.map((u) => ({
                id: u.id,
                username: u.username,
                nama: u.name,
                role: u.role,
                kelas: u.class_name || '-',
                status: u.isLockedAny ? 'TERKUNCI'
                    : u.isOnline ? 'ONLINE'
                        : u.hasSession ? 'OFFLINE' : 'TIDAK LOGIN',
                sesi: u.hasSession ? 'ada' : '-',
                'last login': formatDate(u.last_login),
                'idle': formatIdle(u.idleSeconds)
            }));

            ctx.out.emit({ users: decorated, count: decorated.length });
            ctx.out.title('Status Sesi');
            ctx.out.table(rows, ['id', 'username', 'nama', 'role', 'kelas', 'status', 'sesi', 'last login', 'idle']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:show',
        description: 'Detail sesi satu user',
        usage: 'rhsls session:show <id|username>',
        examples: ['rhsls session:show aqq'],
        async run(ctx) {
            const user = await requireUser(ctx.positional[0]);
            const [decorated] = await decorateUsers([user]);

            const attempts = await db.query(
                `SELECT ea.id, ea.status, ea.score, e.exam_name, UNIX_TIMESTAMP(ea.start_time) AS start_ts
                 FROM rhs_exam_attempts ea
                 LEFT JOIN rhs_exams e ON e.id = ea.exam_id
                 WHERE ea.user_id = ?
                 ORDER BY ea.id DESC LIMIT 5`,
                [user.id]
            );

            ctx.out.title(`Sesi: ${user.name || user.username} (@${user.username})`);
            ctx.out.keyValues([
                ['User ID', user.id],
                ['Role', user.role],
                ['Kelas', user.class_name || '-'],
                ['Status online', decorated.isOnline ? ctx.out.ok('ONLINE') : ctx.out.dim('offline')],
                ['Punya sesi', decorated.hasSession ? 'ya' : 'tidak'],
                ['Session ID', user.session_id ? String(user.session_id).slice(0, 16) + '…' : '-'],
                ['Idle', formatIdle(decorated.idleSeconds)],
                ['Sesi nyangkut', decorated.isStuck ? ctx.out.warnColor('YA') : 'tidak'],
                ['Terkunci admin', user.is_locked ? ctx.out.bad('ya') : 'tidak'],
                ['Brute-force lock', user.locked_until ? `${ctx.out.bad('ya')} (sampai ${formatDate(user.locked_until)})` : 'tidak'],
                ['Percobaan login gagal', user.failed_login_attempts || 0],
                ['Last activity', formatDate(user.last_activity)],
                ['Last login', formatDate(user.last_login)]
            ]);

            if (attempts.length) {
                ctx.out.section('Percobaan ujian terakhir');
                ctx.out.table(attempts.map((a) => ({
                    id: a.id,
                    ujian: a.exam_name || '-',
                    status: a.status,
                    skor: a.score ?? '-'
                })), ['id', 'ujian', 'status', 'skor']);
            }

            ctx.out.emit({ user, session: decorated, attempts });
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:reset',
        aliases: ['reset-session', 'reset-sesi'],
        description: 'Reset sesi user (paksa login ulang)',
        usage: 'rhsls session:reset [--user <id|username> | --all | --stuck | --older-than <menit>] [--except-admins] [--dry-run] [--yes]',
        examples: [
            'rhsls session:reset --user aqq --yes',
            'rhsls session:reset --stuck --yes',
            'rhsls session:reset --all --yes'
        ],
        async run(ctx) {
            const { flags, out } = ctx;
            const mode = flags.all ? 'all' : flags.stuck ? 'stuck' : flags['older-than'] ? 'older' : (flags.user ? 'user' : null);

            if (!mode) {
                throw Object.assign(new Error('Pilih target: --user <id|username>, --all, --stuck, atau --older-than <menit>'), { code: 'RHSLS_NEED_TARGET' });
            }

            let users;
            if (mode === 'user') {
                users = [await requireUser(flags.user)];
            } else {
                const conditions = [];
                if (mode === 'stuck') conditions.push('u.session_id IS NOT NULL');
                if (mode === 'all') conditions.push('(u.session_id IS NOT NULL OR u.is_online_realtime = 1)');
                const values = [];
                if (flags.role) { conditions.push('u.role = ?'); values.push(flags.role); }
                if (mode === 'older') {
                    const minutes = Number(flags['older-than']);
                    if (!Number.isFinite(minutes) || minutes <= 0) throw new Error('--older-than harus berupa menit (mis. 60)');
                    conditions.push(`(u.last_activity IS NULL OR u.last_activity < DATE_SUB(NOW(), INTERVAL ${Math.floor(minutes)} MINUTE))`);
                }
                if (flags['except-admins']) conditions.push("u.role <> 'admin'");
                const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
                users = await db.query(
                    `SELECT u.* FROM rhs_users u ${where} ORDER BY u.last_activity ASC LIMIT 2000`,
                    values
                );
            }

            const decorated = (await decorateUsers(users)).filter((u) => {
                if (mode === 'stuck' && !u.isStuck) return false;
                if (mode === 'older') {
                    const minutes = Number(flags['older-than']);
                    if (u.last_activity && Date.now() - new Date(u.last_activity).getTime() < minutes * 60000) return false;
                }
                if (flags['except-admins'] && u.role === 'admin') return false;
                return true;
            });

            if (decorated.length === 0) {
                out.warn('Tidak ada sesi yang cocok dengan target tersebut.');
                out.emit({ reset: 0 });
                return;
            }

            out.title('Target Reset Sesi');
            out.table(decorated.slice(0, 20).map((u) => ({
                id: u.id,
                username: u.username,
                role: u.role,
                status: u.isOnline ? 'online' : (u.hasSession ? 'offline' : '-'),
                nyangkut: u.isStuck ? 'YA' : '-',
                idle: formatIdle(u.idleSeconds)
            })), ['id', 'username', 'role', 'status', 'nyangkut', 'idle']);

            if (decorated.length > 20) out.dim(`… dan ${decorated.length - 20} lainnya`);

            if (flags['dry-run']) {
                out.warn(`DRY RUN — tidak ada yang diubah. ${decorated.length} sesi akan direset.`);
                out.emit({ dryRun: true, wouldReset: decorated.length });
                return;
            }

            await ctx.confirmAction(`Akan mereset ${decorated.length} sesi aktif (siswa harus login ulang).`);

            const result = await resetSessions(decorated, { reason: `rhsls session:reset --${mode}` });
            out.emit({ ...result, mode });
            out.success(`Sesi direset.`);
            out.summary(result.done, result.skipped, `mode=${mode}`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:kick',
        aliases: ['kick'],
        description: 'Reset sesi satu user (shortcut)',
        usage: 'rhsls session:kick <id|username> [--yes]',
        examples: ['rhsls session:kick aqq --yes'],
        async run(ctx) {
            const user = await requireUser(ctx.positional[0]);
            const [decorated] = await decorateUsers([user]);

            if (!decorated.hasSession && !decorated.isOnline) {
                ctx.out.warn(`${user.username} sedang tidak login.`);
                ctx.out.emit({ kicked: 0 });
                return;
            }

            await ctx.confirmAction(`Akan mengeluarkan @${user.username} dari sesinya.`);
            const result = await resetSessions([decorated], { reason: 'rhsls session:kick' });
            ctx.out.emit(result);
            ctx.out.success(`@${user.username} dikeluarkan dari sesi.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:invalidate-all',
        aliases: ['logout-all'],
        description: 'Paksa semua user (kecuali admin bila diminta) login ulang',
        usage: 'rhsls session:invalidate-all [--except-admins] [--dry-run] [--yes]',
        examples: ['rhsls session:invalidate-all --except-admins --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            const conditions = ['(session_id IS NOT NULL OR is_online_realtime = 1)'];
            const values = [];
            if (flags['except-admins']) conditions.push("role <> 'admin'");

            const users = await db.query(
                `SELECT * FROM rhs_users WHERE ${conditions.join(' AND ')} LIMIT 5000`,
                values
            );
            const decorated = await decorateUsers(users);

            if (!decorated.length) {
                out.warn('Tidak ada sesi aktif.');
                out.emit({ invalidated: 0 });
                return;
            }

            out.info(`Total ${decorated.length} sesi aktif akan direset.`);
            if (flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang diubah.');
                out.emit({ dryRun: true, wouldReset: decorated.length });
                return;
            }

            await ctx.confirmAction(`Akan mereset ${decorated.length} sesi. Semua user harus login ulang.`);
            const result = await resetSessions(decorated, { reason: 'rhsls session:invalidate-all' });
            out.emit(result);
            out.success('Semua sesi direset.');
            out.summary(result.done, result.skipped);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:stats',
        description: 'Ringkasan sesi, user, dan kunci',
        usage: 'rhsls session:stats [--json]',
        async run(ctx) {
            const totals = await db.queryOne(
                `SELECT COUNT(*) AS total,
                        SUM(session_id IS NOT NULL) AS with_session,
                        SUM(is_locked = 1) AS admin_locked,
                        SUM(locked_until IS NOT NULL AND locked_until > NOW()) AS brute_locked,
                        SUM(failed_login_attempts > 0) AS failed_attempts
                 FROM rhs_users`
            );

            const onlineIds = await db.query(
                'SELECT id FROM rhs_users WHERE is_online_realtime = 1 LIMIT 2000'
            );
            const redisMap = await redis.existsMany(onlineIds.map((r) => `online:${r.id}`));
            const onlineReal = Object.values(redisMap).filter(Boolean).length;
            const onlineFallback = Number(totals.with_session || 0);

            const recent = await db.queryOne(
                `SELECT COUNT(*) AS c FROM rhs_activity_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`
            );

            const byRole = await db.query('SELECT role, COUNT(*) AS c FROM rhs_users GROUP BY role ORDER BY role');
            const redisOk = Object.keys(redisMap).length > 0;

            const stats = {
                totalUser: Number(totals.total || 0),
                sesiAktif: Number(totals.with_session || 0),
                online: redisOk ? onlineReal : onlineFallback,
                terkunciAdmin: Number(totals.admin_locked || 0),
                terkunciBruteForce: Number(totals.brute_locked || 0),
                percobaanGagal: Number(totals.failed_attempts || 0),
                aktivitas24Jam: Number(recent.c || 0),
                byRole: byRole.map((r) => ({ role: r.role, jumlah: Number(r.c) }))
            };

            ctx.out.emit(stats);
            ctx.out.title('Ringkasan Sesi');
            ctx.out.keyValues([
                ['Total user', stats.totalUser],
                ['Sesi aktif', stats.sesiAktif],
                ['Online sekarang', `${stats.online}${redisOk ? '' : ctx.out.dim(' (fallback MySQL)')}`],
                ['Terkunci (admin)', stats.terkunciAdmin],
                ['Terkunci (brute-force)', stats.terkunciBruteForce],
                ['Punya percobaan gagal', stats.percobaanGagal],
                ['Aktivitas 24 jam', stats.aktivitas24Jam]
            ]);
            ctx.out.section('Per role');
            ctx.out.table(stats.byRole, ['role', 'jumlah']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:sync-online',
        description: 'Selaraskan flag online di MySQL dengan Redis',
        usage: 'rhsls session:sync-online [--dry-run] [--yes]',
        examples: ['rhsls session:sync-online --yes'],
        async run(ctx) {
            const { out } = ctx;
            const users = await db.query('SELECT id, username, is_online_realtime FROM rhs_users WHERE is_online_realtime = 1 LIMIT 5000');
            const map = await redis.existsMany(users.map((u) => `online:${u.id}`));

            const stale = users.filter((u) => !map[`online:${u.id}`]);
            const cleared = [];
            for (const user of stale) {
                cleared.push(user);
            }

            out.title('Selaraskan Status Online');
            out.info(`${users.length} user ditandai online di MySQL, ${cleared.length} tidak ada di Redis (basi).`);

            if (!cleared.length) {
                out.success('Semua flag online sudah konsisten.');
                out.emit({ stale: 0, fixed: 0 });
                return;
            }

            if (ctx.flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang diubah.');
                out.emit({ dryRun: true, stale: cleared.length });
                return;
            }

            await ctx.confirmAction(`Akan membersihkan ${cleared.length} flag online basi di MySQL.`);
            const ids = cleared.map((u) => u.id);
            const p = await db.getPool();
            await p.query('UPDATE rhs_users SET is_online_realtime = 0 WHERE id IN (?)', [ids]);

            await db.logActivity({
                username: 'cli', action: 'SESSION_SYNC_ONLINE', level: 'warn',
                details: `${cleared.length} flag online dibersihkan`
            });

            out.success(`${cleared.length} flag online dibersihkan.`);
            out.emit({ stale: cleared.length, fixed: cleared.length });
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:audit',
        description: 'Riwayat login/logout/gagal login dari activity log',
        usage: 'rhsls session:audit [user] [--limit 30] [--level warn,error] [--all]',
        examples: ['rhsls session:audit aqq', 'rhsls session:audit --all --level error --limit 50'],
        async run(ctx) {
            const { flags, out } = ctx;
            const limit = Math.min(500, Number(flags.limit) || 30);
            const conditions = ["action LIKE 'LOGIN%' OR action LIKE 'SESSION%' OR action LIKE 'USER_BRUTEFORCE%' OR action LIKE 'EXAM%'"];
            const values = [];

            if (flags.level) {
                conditions.push('level = ?');
                values.push(flags.level);
            }
            if (flags.all) {
                // semua user
            } else if (ctx.positional[0]) {
                const user = await findUser(ctx.positional[0]);
                if (!user) throw new Error(`User "${ctx.positional[0]}" tidak ditemukan`);
                conditions.push('(user_id = ? OR username = ?)');
                values.push(user.id, user.username);
            }

            const rows = await db.query(
                `SELECT id, user_id, username, ip_address, action, level, details, created_at
                 FROM rhs_activity_logs
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY id DESC LIMIT ${limit}`,
                values
            );

            out.emit({ logs: rows });
            out.title('Audit Aktivitas Login');
            out.table(rows.map((r) => ({
                waktu: formatDate(r.created_at),
                user: r.username || (r.user_id ? `#${r.user_id}` : '-'),
                aksi: r.action,
                level: r.level === 'error' ? ctx.out.bad(r.level) : r.level === 'warn' ? ctx.out.warnColor(r.level) : r.level,
                ip: r.ip_address || '-',
                detail: (r.details || '').slice(0, 60)
            })), ['waktu', 'user', 'aksi', 'level', 'ip', 'detail']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:stuck',
        description: 'Deteksi sesi nyangkut (idle > 1 jam, tidak ada aktivitas)',
        usage: 'rhsls session:stuck [--limit 50] [--fix] [--yes]',
        examples: ['rhsls session:stuck', 'rhsls session:stuck --fix --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            const users = await db.query(
                `SELECT u.* FROM rhs_users u
                 WHERE u.session_id IS NOT NULL
                 ORDER BY u.last_activity ASC LIMIT 1000`
            );
            const decorated = await decorateUsers(users);
            const stuck = decorated.filter((u) => u.isStuck);

            out.emit({ stuck });
            out.title('Sesi Nyangkut');
            if (!stuck.length) {
                out.success('Tidak ada sesi nyangkut.');
                return;
            }

            out.table(stuck.slice(0, Number(flags.limit) || 50).map((u) => ({
                id: u.id,
                username: u.username,
                role: u.role,
                'idle': formatIdle(u.idleSeconds),
                'last login': formatDate(u.last_login)
            })), ['id', 'username', 'role', 'idle', 'last login']);

            if (!flags.fix) {
                out.dim('Tambahkan --fix --yes untuk mereset sesi-sesi ini.');
                return;
            }
            await ctx.confirmAction(`Akan mereset ${stuck.length} sesi nyangkut.`);
            const result = await resetSessions(stuck, { reason: 'rhsls session:stuck --fix' });
            out.emit(result);
            out.success('Sesi nyampung direset.');
            out.summary(result.done, result.skipped);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:purge-cache',
        description: 'Bersihkan cache Redis sesi (online & jawaban sementara)',
        usage: 'rhsls session:purge-cache [--scope all|online|temp] [--yes]',
        examples: ['rhsls session:purge-cache --scope online --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            const scope = flags.scope || 'all';

            const patterns = [];
            if (scope === 'all' || scope === 'online') patterns.push('online:*', 'last_activity:*');
            if (scope === 'all' || scope === 'temp') patterns.push('temp:ans:*');

            const keys = [];
            for (const pattern of patterns) {
                keys.push(...await redis.scanKeys(pattern));
            }

            if (!keys.length) {
                out.success('Tidak ada cache sesi di Redis.');
                out.emit({ removed: 0 });
                return;
            }

            out.info(`${keys.length} key Redis akan dihapus (pola: ${patterns.join(', ')}).`);
            if (flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang dihapus.');
                out.emit({ dryRun: true, wouldRemove: keys.length });
                return;
            }

            await ctx.confirmAction('Cache sesi akan dihapus. User mungkin perlu login ulang.');
            const removed = await redis.del(keys);
            if (scope === 'all') await redis.publish('force_logout', { userId: 'all', reason: 'rhsls session:clear-cache --all' });
            await db.logActivity({ username: 'cli', action: 'SESSION_PURGE_CACHE', level: 'warn', details: `${removed} key dihapus (${scope})` });
            out.emit({ removed });
            out.success(`${removed} key Redis dihapus.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'session:watch',
        description: 'Pantau aktivitas login secara real-time (Ctrl+C untuk berhenti)',
        usage: 'rhsls session:watch [--interval 2]',
        examples: ['rhsls session:watch'],
        async run(ctx) {
            const { out } = ctx;
            const interval = Math.max(1, Number(ctx.flags.interval) || 2) * 1000;

            const last = await db.queryOne('SELECT MAX(id) AS m FROM rhs_activity_logs');
            let lastId = Number(last.m || 0);

            out.title('Pantau Aktivitas (Ctrl+C untuk berhenti)');
            out.dim(`Memulai dari id ${lastId}…`);

            const tick = async () => {
                try {
                    const rows = await db.query(
                        `SELECT id, username, action, level, details, ip_address, created_at
                         FROM rhs_activity_logs WHERE id > ? ORDER BY id ASC LIMIT 40`,
                        [lastId]
                    );
                    rows.forEach((r) => {
                        lastId = r.id;
                        const time = new Date(r.created_at).toLocaleTimeString('id-ID');
                        const color = r.level === 'error' ? 'bad' : r.level === 'warn' ? 'warnColor' : 'dim';
                        out.line(`  ${time}  ${out[color](`${r.action}`.padEnd(24))} ${r.username || '-'} ${out.dim(r.ip_address || '')}`);
                    });
                } catch (e) {
                    out.error(`Gagal memantau: ${e.message}`);
                }
            };

            const timer = setInterval(tick, interval);
            const stop = () => {
                clearInterval(timer);
                out.line();
                out.info('Pemantauan dihentikan.');
                ctx.stop();
            };
            process.on('SIGINT', stop);

            await tick();
            ctx.hold = true; // jangan tutup koneksidb
        }
    }
];

module.exports = { commands, findUser, requireUser, decorateUsers, resetSessions, IDLE_LIMIT };