'use strict';

/**
 * Perintah manajemen user.
 * Password selalu di-hash dengan bcrypt (algo yang sama dengan aplikasi).
 */

const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const redis = require('../lib/redis');
const { findUser, requireUser, resetSessions, decorateUsers } = require('./session');

const ROLES = ['admin', 'teacher', 'student'];

/** Ambil password dengan urutan prioritas: --password, env, stdin, prompt, --generate */
async function resolvePassword(ctx, { required = true, generateLength = 12 } = {}) {
    const { flags, out } = ctx;

    if (flags.generate) return generatePassword(generateLength);
    if (flags.password) {
        if (flags.password.length < 4) throw new Error('Password terlalu pendek (minimal 4 karakter).');
        return flags.password;
    }
    if (process.env.RHSLS_NEW_PASSWORD) return process.env.RHSLS_NEW_PASSWORD;

    if (process.stdin.isTTY && !ctx.flags.json) {
        const entered = await out.askPassword('Password');
        if (entered) return entered;
    }
    if (!required) return null;
    throw new Error('Password belum diberikan. Gunakan --password, --generate, atau env RHSLS_NEW_PASSWORD.');
}

function generatePassword(length = 12) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#%+=';
    let result = '';
    for (let i = 0; i < length; i += 1) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const diff = Date.now() - d.getTime();
    if (diff >= 0 && diff < 86400000) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
            else if (ch === '"') inQuotes = false;
            else current += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === ',') { cells.push(current); current = ''; }
        else current += ch;
    }
    cells.push(current);
    return cells.map((c) => c.trim());
}

const commands = [
    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:list',
        aliases: ['users'],
        description: 'Daftar user',
        usage: 'rhsls user:list [--role student] [--class "Kelas 1"] [--search a] [--locked] [--never-login] [--limit 100]',
        examples: ['rhsls user:list --role teacher', 'rhsls user:list --locked --json'],
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
            if (flags['never-login']) conditions.push('u.last_login IS NULL');

            const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
            const limit = Math.min(2000, Number(flags.limit) || 100);

            const users = await db.query(
                `SELECT u.id, u.username, u.name, u.role, u.is_locked, u.locked_until,
                        u.last_login, u.last_activity, u.failed_login_attempts, c.class_name
                 FROM rhs_users u
                 LEFT JOIN rhs_classes c ON u.class_id = c.id
                 ${where}
                 ORDER BY u.role, u.username
                 LIMIT ${limit}`,
                values
            );

            ctx.out.emit({ users, count: users.length });
            ctx.out.title('Daftar User');
            ctx.out.table(users.map((u) => ({
                id: u.id,
                username: u.username,
                nama: u.name,
                role: u.role,
                kelas: u.class_name || '-',
                kunci: u.is_locked ? ctx.out.bad('ya') : (u.locked_until ? ctx.out.warnColor('bf') : '-'),
                'last login': formatDate(u.last_login)
            })), ['id', 'username', 'nama', 'role', 'kelas', 'kunci', 'last login']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:show',
        description: 'Detail lengkap satu user',
        usage: 'rhsls user:show <id|username>',
        examples: ['rhsls user:show aqq'],
        async run(ctx) {
            const user = await requireUser(ctx.positional[0]);
            const [decorated] = await decorateUsers([user]);

            const attemptRows = await db.query(
                `SELECT COUNT(*) AS total,
                        SUM(status = 'completed') AS selesai,
                        AVG(score) AS rata_nilai, MAX(score) AS nilai_tertinggi,
                        MAX(id) AS last_attempt
                 FROM rhs_exam_attempts WHERE user_id = ?`,
                [user.id]
            );
            const attempts = (attemptRows && attemptRows[0]) || {};

            ctx.out.title(`User: ${user.name || user.username}`);
            ctx.out.keyValues([
                ['ID', user.id],
                ['Username', user.username],
                ['Nama', user.name],
                ['Role', user.role],
                ['Kelas', user.class_name || '-'],
                ['Dibuat', formatDate(user.createdAt)],
                ['Last login', formatDate(user.last_login)],
                ['Last activity', formatDate(user.last_activity)],
                ['Terkunci admin', user.is_locked ? ctx.out.bad('ya') : 'tidak'],
                ['Brute-force lock', user.locked_until ? ctx.out.bad(`ya (sampai ${formatDate(user.locked_until)})`) : 'tidak'],
                ['Percobaan gagal', user.failed_login_attempts || 0],
                ['Total percobaan ujian', Number(attempts.total || 0)],
                ['Rata-rata nilai', attempts.rata_nilai !== null ? Number(attempts.rata_nilai).toFixed(2) : '-'],
                ['Nilai tertinggi', attempts.nilai_tertinggi ?? '-']
            ]);
            ctx.out.emit({ user, stats: attempts, session: decorated });
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:create',
        description: 'Buat user baru',
        usage: 'rhsls user:create --username <name> [--name "Nama Lengkap"] --role student [--class-id 1] [--generate]',
        examples: [
            'rhsls user:create --username siti --name "Siti Aminah" --role student --class-id 1 --generate',
            'rhsls user:create --username guru01 --role teacher --password "RahasiaKuat"'
        ],
        async run(ctx) {
            const { flags, out } = ctx;
            const username = flags.username || ctx.positional[0];
            if (!username) throw new Error('--username wajib diisi');

            const role = flags.role || 'student';
            if (!ROLES.includes(role)) throw new Error(`--role harus salah satu dari: ${ROLES.join(', ')}`);

            const existing = await db.queryOne('SELECT id FROM rhs_users WHERE username = ?', [username]);
            if (existing) throw new Error(`Username "${username}" sudah dipakai.`);

            const password = await resolvePassword(ctx);
            const hash = await bcrypt.hash(password, 10);

            let classId = null;
            if (flags['class-id']) {
                classId = Number(flags['class-id']);
                const cls = await db.queryOne('SELECT id, class_name FROM rhs_classes WHERE id = ?', [classId]);
                if (!cls) throw new Error(`Kelas dengan id ${classId} tidak ditemukan`);
            } else if (flags.class) {
                const cls = await db.queryOne('SELECT id FROM rhs_classes WHERE class_name = ?', [flags.class]);
                if (!cls) throw new Error(`Kelas "${flags.class}" tidak ditemukan`);
                classId = cls.id;
            }

            const result = await db.execute(
                'INSERT INTO rhs_users (username, password, name, role, class_id) VALUES (?, ?, ?, ?, ?)',
                [username, hash, flags.name || username, role, classId]
            );

            await db.logActivity({
                username: 'cli', action: 'USER_CREATE_CLI', level: 'warn',
                details: `Membuat user ${username} (${role})`
            });

            out.emit({ id: result.insertId, username, role, password: flags.generate ? password : undefined });
            out.success(`User "${username}" dibuat dengan role ${role}.`);
            if (flags.generate) {
                out.line();
                out.warn('Simpan password berikut NOW (tidak ditampilkan lagi):');
                out.line(`   ${out.bold(out.ok(password))}`);
                out.line();
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:update',
        description: 'Ubah data user (nama, username, kelas, role)',
        usage: 'rhsls user:update <id|username> [--name "X"] [--username Y] [--class-id N] [--role R]',
        examples: ['rhsls user:update aqq --name "Ahmad Q"]'],
        async run(ctx) {
            const { flags, out } = ctx;
            const user = await requireUser(ctx.positional[0]);
            const sets = [];
            const values = [];

            if (flags.name) { sets.push('name = ?'); values.push(flags.name); }
            if (flags.username) {
                const clash = await db.queryOne('SELECT id FROM rhs_users WHERE username = ? AND id <> ?', [flags.username, user.id]);
                if (clash) throw new Error(`Username "${flags.username}" sudah dipakai.`);
                sets.push('username = ?'); values.push(flags.username);
            }
            if (flags['class-id']) {
                const cls = await db.queryOne('SELECT id FROM rhs_classes WHERE id = ?', [Number(flags['class-id'])]);
                if (!cls) throw new Error(`Kelas id ${flags['class-id']} tidak ditemukan`);
                sets.push('class_id = ?'); values.push(cls.id);
            }
            if (flags.role) {
                if (!ROLES.includes(flags.role)) throw new Error(`--role harus: ${ROLES.join(', ')}`);
                sets.push('role = ?'); values.push(flags.role);
            }

            if (!sets.length) throw new Error('Tidak ada perubahan. Gunakan --name/--username/--class-id/--role.');

            if (ctx.flags['dry-run']) {
                out.warn('DRY RUN — tidak ada perubahan.');
                out.emit({ dryRun: true, fields: sets.length });
                return;
            }

            values.push(user.id);
            await db.execute(`UPDATE rhs_users SET ${sets.join(', ')} WHERE id = ?`, values);
            await db.logActivity({ userId: user.id, username: user.username, action: 'USER_UPDATE_CLI', level: 'warn', details: sets.join(', ') });

            out.emit({ updated: user.id });
            out.success(`Data user @${user.username} diperbarui (${sets.join(', ')}).`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:delete',
        description: 'Hapus user (jawaban ikut terhapus via FK)',
        usage: 'rhsls user:delete <id|username> [--keep-answers] [--yes]',
        examples: ['rhsls user:delete zztest_abc --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            const user = await requireUser(ctx.positional[0]);

            if (user.role === 'admin') {
                const adminCount = await db.queryOne("SELECT COUNT(*) AS c FROM rhs_users WHERE role = 'admin'");
                if (Number(adminCount.c) <= 1) {
                    throw new Error('Ini admin terakhir — tidak boleh dihapus. Gunakan user:update --role untuk menurunkan role.');
                }
            }

            const attempts = await db.queryOne('SELECT COUNT(*) AS c FROM rhs_exam_attempts WHERE user_id = ?', [user.id]);
            await ctx.confirmAction(
                `Akan menghapus @${user.username} (${user.name || '-'}) beserta ${attempts.c} percobaan ujian${flags['keep-answers'] ? '' : ' dan semua jawabannya'}.`
            );

            if (flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang dihapus.');
                out.emit({ dryRun: true });
                return;
            }

            await db.execute('DELETE FROM rhs_users WHERE id = ?', [user.id]);
            await redis.del([`session:${user.id}`, `online:${user.id}`, `last_activity:${user.id}`]);
            await db.logActivity({ userId: user.id, username: user.username, action: 'USER_DELETE_CLI', level: 'error', details: 'User dihapus via CLI' });

            out.emit({ deleted: user.id, username: user.username });
            out.success(`User @${user.username} dihapus.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:reset-password',
        aliases: ['reset-password'],
        description: 'Ganti password user',
        usage: 'rhsls user:reset-password <id|username> [--generate | --password "X" | --password-stdin]',
        examples: ['rhsls user:reset-password admin --generate'],
        async run(ctx) {
            const { out } = ctx;
            const user = await requireUser(ctx.positional[0]);
            const password = await resolvePassword(ctx);
            const hash = await bcrypt.hash(password, 10);

            await db.execute('UPDATE rhs_users SET password = ? WHERE id = ?', [hash, user.id]);
            // paksa login ulang demi keamanan
            await resetSessions([user], { reason: 'password_changed' });

            await db.logActivity({
                userId: user.id, username: user.username, action: 'USER_PASSWORD_RESET_CLI',
                level: 'warn', details: 'Password diubah via CLI'
            });

            out.emit({ user: user.username, reset: true });
            out.success(`Password @${user.username} diganti, sesi lamanya direset.`);
            if (ctx.flags.generate) {
                out.line();
                out.warn('Password baru (simpan sekarang):');
                out.line(`   ${out.bold(out.ok(password))}`);
                out.line();
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:verify-password',
        description: 'Cek apakah password user benar (untuk bantu siswa)',
        usage: 'rhsls user:verify-password <id|username> --password "X"',
        async run(ctx) {
            const user = await requireUser(ctx.positional[0]);
            const password = await resolvePassword(ctx, { required: false });
            if (!password) throw new Error('Berikan --password untuk diverifikasi.');

            const valid = await bcrypt.compare(password, user.password);
            ctx.out.emit({ username: user.username, valid });
            ctx.out.title('Verifikasi Password');
            ctx.out.keyValues([
                ['User', `@${user.username}`],
                ['Password benar', valid ? ctx.out.ok('YA') : ctx.out.bad('TIDAK')]
            ]);
            if (!valid) out.info('Coba user:reset-password bila siswa lupa password.');
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:lock',
        description: 'Kunci akun (tidak bisa login)',
        usage: 'rhsls user:lock <id|username> [--yes]',
        async run(ctx) {
            const { flags, out } = ctx;
            const user = await requireUser(ctx.positional[0]);

            if (user.role === 'admin') {
                const count = await db.queryOne("SELECT COUNT(*) AS c FROM rhs_users WHERE role = 'admin' AND is_locked = 0 AND id <> ?", [user.id]);
                if (Number(count.c) === 0) throw new Error('Tidak boleh mengunci admin terakhir.');
            }

            if (!flags['dry-run']) {
                await db.execute('UPDATE rhs_users SET is_locked = 1 WHERE id = ?', [user.id]);
                if (redis.isReady()) await redis.del([`session:${user.id}`, `online:${user.id}`]);
                await db.logActivity({ userId: user.id, username: user.username, action: 'USER_LOCK_CLI', level: 'warn', details: 'Akun dikunci via CLI' });
            }

            out.emit({ locked: user.username });
            out.success(`${flags['dry-run'] ? '[DRY RUN] ' : ''}Akun @${user.username} dikunci.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:unlock',
        description: 'Buka kunci akun + reset brute-force',
        usage: 'rhsls user:unlock <id|username>',
        examples: ['rhsls user:unlock aqq'],
        async run(ctx) {
            const { out } = ctx;
            const user = await requireUser(ctx.positional[0]);

            await db.execute(
                'UPDATE rhs_users SET is_locked = 0, locked_until = NULL, failed_login_attempts = 0 WHERE id = ?',
                [user.id]
            );
            if (redis.isReady()) {
                await redis.del([
                    `user:locked:${user.id}`,
                    `user:lastlockcheck:${user.id}`,
                    `bf:lock:${String(user.username).toLowerCase()}`,
                    `bf:att:${String(user.username).toLowerCase()}`
                ]);
            }
            await db.logActivity({
                userId: user.id, username: user.username, action: 'USER_UNLOCK_CLI',
                level: 'info', details: 'Akun dibuka + counter gagal direset'
            });

            out.emit({ unlocked: user.username });
            out.success(`Akun @${user.username} dibuka. Kunci admin & brute-force sudah dibersihkan.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:unlock-all',
        aliases: ['unlock-all'],
        description: 'Buka kunci semua akun + reset seluruh brute-force',
        usage: 'rhsls user:unlock-all [--yes]',
        examples: ['rhsls user:unlock-all --yes'],
        async run(ctx) {
            const { out } = ctx;
            const locked = await db.queryOne(
                `SELECT COUNT(*) AS c FROM rhs_users
                 WHERE is_locked = 1 OR locked_until IS NOT NULL OR failed_login_attempts > 0`
            );
            if (Number(locked.c) === 0) {
                out.success('Tidak ada akun terkunci.');
                out.emit({ unlocked: 0 });
                return;
            }

            out.info(`${locked.c} akun terkunci / punya percobaan gagal.`);
            if (ctx.flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang diubah.');
                out.emit({ dryRun: true, wouldUnlock: Number(locked.c) });
                return;
            }
            await ctx.confirmAction(`Akan membuka ${locked.c} akun dan mereset semua penghitung gagal.`);

            const result = await db.execute(
                'UPDATE rhs_users SET is_locked = 0, locked_until = NULL, failed_login_attempts = 0'
            );
            let redisCleared = 0;
            if (redis.isReady()) {
                const keys = [
                    ...await redis.scanKeys('user:locked:*'),
                    ...await redis.scanKeys('user:lastlockcheck:*'),
                    ...await redis.scanKeys('bf:lock:*'),
                    ...await redis.scanKeys('bf:att:*')
                ];
                redisCleared = await redis.del(keys);
            }

            await db.logActivity({
                username: 'cli', action: 'USER_UNLOCK_ALL_CLI', level: 'warn',
                details: `${result.affectedRows} akun dibuka, ${redisCleared} key Redis dihapus`
            });

            out.emit({ unlocked: result.affectedRows, redisCleared });
            out.success(`${result.affectedRows} akun dibuka, ${redisCleared} key cache dihapus.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:reset-attempts',
        description: 'Reset penghitung percobaan login gagal',
        usage: 'rhsls user:reset-attempts <id|username> | --all',
        examples: ['rhsls user:reset-attempts --all'],
        async run(ctx) {
            const { flags, out } = ctx;
            if (flags.all) {
                const result = await db.execute(
                    'UPDATE rhs_users SET failed_login_attempts = 0, locked_until = NULL WHERE failed_login_attempts > 0 OR locked_until IS NOT NULL'
                );
                if (redis.isReady()) {
                    await redis.del([...await redis.scanKeys('bf:att:*'), ...await redis.scanKeys('bf:lock:*')]);
                }
                out.emit({ reset: result.affectedRows });
                out.success(`${result.affectedRows} akun direset.`);
                return;
            }
            const user = await requireUser(ctx.positional[0]);
            await db.execute('UPDATE rhs_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
            if (redis.isReady()) {
                await redis.del([
                    `bf:att:${String(user.username).toLowerCase()}`,
                    `bf:lock:${String(user.username).toLowerCase()}`
                ]);
            }
            out.emit({ reset: 1 });
            out.success(`Penghitung gagal untuk @${user.username} direset.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:promote',
        description: 'Naikkan role user (siswa -> guru -> admin)',
        usage: 'rhsls user:promote <id|username> [--to admin]',
        examples: ['rhsls user:promote aqq --to teacher'],
        async run(ctx) {
            const { flags, out } = ctx;
            const user = await requireUser(ctx.positional[0]);

            const next = flags.to || { student: 'teacher', teacher: 'admin' }[user.role];
            if (!next || !ROLES.includes(next)) throw new Error('Sebut --to dengan role yang valid (admin/teacher/student).');
            if (next === user.role) {
                out.warn(`@${user.username} sudah role ${next}.`);
                return;
            }

            if (ctx.flags['dry-run']) {
                out.warn(`DRY RUN: @${user.username} ${user.role} -> ${next}`);
                out.emit({ dryRun: true, from: user.role, to: next });
                return;
            }

            await db.execute('UPDATE rhs_users SET role = ? WHERE id = ?', [next, user.id]);
            await db.logActivity({
                userId: user.id, username: user.username, action: 'USER_ROLE_CHANGE_CLI',
                level: 'warn', details: `${user.role} -> ${next}`
            });

            out.emit({ from: user.role, to: next });
            out.success(`@${user.username}: ${user.role} → ${out.ok(next)}`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:demote',
        description: 'Turunkan role user (admin -> guru -> siswa)',
        usage: 'rhsls user:demote <id|username> [--to teacher]',
        examples: ['rhsls user:demote aqq --to student'],
        async run(ctx) {
            ctx.flags.to = ctx.flags.to || { admin: 'teacher', teacher: 'student' }[
                (await requireUser(ctx.positional[0])).role
            ];
            const cmd = commands.find((c) => c.name === 'user:promote');
            return cmd.run(ctx);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:move-class',
        description: 'Pindahkan user dari satu kelas ke kelas lain',
        usage: 'rhsls user:move-class --from "Kelas 1" --to "Kelas 2" [--role student] [--dry-run] [--yes]',
        examples: ['rhsls user:move-class --from "Kelas 1" --to "Kelas 2" --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            if (!flags.from || !flags.to) throw new Error('--from dan --to wajib diisi (nama kelas).');

            const from = await db.queryOne('SELECT id, class_name FROM rhs_classes WHERE class_name = ?', [flags.from]);
            const to = await db.queryOne('SELECT id, class_name FROM rhs_classes WHERE class_name = ?', [flags.to]);
            if (!from) throw new Error(`Kelas "${flags.from}" tidak ditemukan`);
            if (!to) throw new Error(`Kelas "${flags.to}" tidak ditemukan`);

            const values = [from.id];
            let where = 'class_id = ?';
            if (flags.role) { where += ' AND role = ?'; values.push(flags.role); }

            const users = await db.query(`SELECT id, username FROM rhs_users WHERE ${where}`, values);
            out.emit({ moving: users.length, to: to.class_name });
            out.title('Pindahkan Kelas');
            out.info(`${users.length} user dari "${from.class_name}" → "${to.class_name}"`);
            out.table(users.slice(0, 20).map((u) => ({ id: u.id, username: u.username })), ['id', 'username']);

            if (!users.length) return;
            if (flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang diubah.');
                return;
            }
            await ctx.confirmAction(`Akan memindahkan ${users.length} user ke kelas "${to.class_name}".`);

            const ids = users.map((u) => u.id);
            const p = await db.getPool();
            const [result] = await p.query('UPDATE rhs_users SET class_id = ? WHERE id IN (?)', [to.id, ids]);
            await db.logActivity({ username: 'cli', action: 'USER_MOVE_CLASS_CLI', level: 'warn', details: `${result.affectedRows} user: ${from.class_name} -> ${to.class_name}` });

            out.success(`${result.affectedRows} user dipindahkan.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:export',
        description: 'Ekspor user ke CSV',
        usage: 'rhsls user:export [--out users.csv] [--role student] [--class "Kelas 1"] [--include-hash]',
        examples: ['rhsls user:export --out siswa.csv --role student'],
        async run(ctx) {
            const fs = require('fs');
            const path = require('path');
            const { flags, out } = ctx;

            const conditions = [];
            const values = [];
            if (flags.role) { conditions.push('u.role = ?'); values.push(flags.role); }
            if (flags.class) { conditions.push('c.class_name = ?'); values.push(flags.class); }
            const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

            const users = await db.query(
                `SELECT u.id, u.username, u.name, u.role, c.class_name,
                        u.is_locked, u.last_login, u.createdAt
                 FROM rhs_users u LEFT JOIN rhs_classes c ON u.class_id = c.id
                 ${where} ORDER BY u.role, u.username`,
                values
            );

            const header = ['id', 'username', 'name', 'role', 'class_name', 'is_locked', 'last_login', 'created_at'];
            const lines = [header.join(',')];
            users.forEach((u) => {
                lines.push([
                    u.id, csvEscape(u.username), csvEscape(u.name), csvEscape(u.role),
                    csvEscape(u.class_name), u.is_locked ? 1 : 0,
                    csvEscape(u.last_login), csvEscape(u.createdAt)
                ].join(','));
            });

            const target = path.resolve(flags.out || `rhsls-users-${new Date().toISOString().slice(0, 10)}.csv`);
            fs.writeFileSync(target, '\uFEFF' + lines.join('\n'), 'utf8');

            out.emit({ file: target, count: users.length });
            out.success(`${users.length} user diekspor ke ${target}`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:import',
        description: 'Impor user dari CSV (username,name,role,class_name,password)',
        usage: 'rhsls user:import --file users.csv [--dry-run] [--update] [--yes]',
        examples: ['rhsls user:import --file siswa.csv --dry-run'],
        async run(ctx) {
            const fs = require('fs');
            const path = require('path');
            const { flags, out } = ctx;

            if (!flags.file) throw new Error('--file wajib diisi.');
            const file = path.resolve(flags.file);
            if (!fs.existsSync(file)) throw new Error(`File tidak ditemukan: ${file}`);

            const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
            const rows = raw.split(/\r?\n/).filter((l) => l.trim());
            if (rows.length < 2) throw new Error('CSV kosong atau hanya berisi header.');

            const header = parseCsvLine(rows[0]).map((h) => h.toLowerCase());
            const idx = {
                username: header.indexOf('username'),
                name: header.indexOf('name'),
                role: header.indexOf('role'),
                class: header.findIndex((h) => h === 'class_name' || h === 'class'),
                password: header.indexOf('password')
            };
            if (idx.username === -1) throw new Error('Kolom "username" wajib ada di CSV.');

            const plans = [];
            const errors = [];

            for (let i = 1; i < rows.length; i += 1) {
                const cells = parseCsvLine(rows[i]);
                const username = cells[idx.username];
                if (!username) continue;
                const role = (cells[idx.role] || 'student').toLowerCase();
                const name = cells[idx.name] || username;
                const className = idx.class !== -1 ? cells[idx.class] : null;
                const password = idx.password !== -1 ? cells[idx.password] : null;

                if (!ROLES.includes(role)) {
                    errors.push(`Baris ${i + 1}: role "${role}" tidak valid`);
                    continue;
                }
                if (password && password.length < 4) {
                    errors.push(`Baris ${i + 1}: password terlalu pendek untuk @${username}`);
                    continue;
                }
                plans.push({ username, name, role, className, password, row: i + 1 });
            }

            out.title('Rencana Import User');
            out.info(`${plans.length} baris akan diproses, ${errors.length} bermasalah.`);

            const classCache = {};
            const resolveClassId = async (className) => {
                if (!className) return null;
                if (classCache[className] !== undefined) return classCache[className];
                const row = await db.queryOne('SELECT id FROM rhs_classes WHERE class_name = ?', [className]);
                const id = row ? row.id : null;
                classCache[className] = id;
                return id;
            };

            const created = [];
            const updated = [];
            const skipped = [];

            const pending = [];
            for (const plan of plans) {
                const existing = await db.queryOne('SELECT id FROM rhs_users WHERE username = ?', [plan.username]);
                const classId = await resolveClassId(plan.className);

                if (plan.className && !classId) {
                    skipped.push(`${plan.username} (kelas "${plan.className}" tidak ada)`);
                    continue;
                }
                if (existing && !flags.update) {
                    skipped.push(`${plan.username} (sudah ada, pakai --update untuk menimpa)`);
                    continue;
                }
                pending.push({ plan, existing, classId });
                (existing ? updated : created).push(plan.username);
            }

            out.emit({ dryRun: !!flags['dry-run'], created, updated, skipped, errors });
            if (errors.length) {
                out.section('Baris bermasalah');
                errors.slice(0, 20).forEach((e) => out.warn(e));
            }
            if (skipped.length) {
                out.section('Dilewati');
                skipped.slice(0, 20).forEach((s) => out.dim(`- ${s}`));
                if (skipped.length > 20) out.dim(`… dan ${skipped.length - 20} lainnya`);
            }

            if (flags['dry-run']) {
                out.warn('DRY RUN — tidak ada user yang dibuat/diubah.');
                out.summary(created.length + updated.length, skipped.length, `${created.length} baru, ${updated.length} diperbarui`);
                return;
            }

            if (!pending.length) {
                out.warn('Tidak ada baris yang perlu diproses.');
                out.summary(0, skipped.length, 'tidak ada perubahan');
                return;
            }

            await ctx.confirmAction(`Akan membuat ${created.length} user baru & memperbarui ${updated.length} user.`);

            for (const { plan, existing, classId } of pending) {
                if (existing) {
                    const sets = ['name = ?', 'role = ?'];
                    const values = [plan.name, plan.role];
                    if (classId !== null) { sets.push('class_id = ?'); values.push(classId); }
                    if (plan.password) {
                        sets.push('password = ?');
                        values.push(await bcrypt.hash(plan.password, 10));
                    }
                    values.push(existing.id);
                    await db.execute(`UPDATE rhs_users SET ${sets.join(', ')} WHERE id = ?`, values);
                } else {
                    const plain = plan.password || generatePassword(12);
                    await db.execute(
                        'INSERT INTO rhs_users (username, password, name, role, class_id) VALUES (?, ?, ?, ?, ?)',
                        [plan.username, await bcrypt.hash(plain, 10), plan.name, plan.role, classId]
                    );
                    if (!plan.password) out.dim(`- ${plan.username} → password: ${plain}`);
                }
            }

            await db.logActivity({ username: 'cli', action: 'USER_IMPORT_CLI', level: 'warn', details: `${created.length} dibuat, ${updated.length} diperbarui` });
            out.success('Import selesai.');
            out.summary(created.length + updated.length, skipped.length, `${created.length} baru, ${updated.length} diperbarui`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:stats',
        description: 'Statistik user per role & kelas',
        usage: 'rhsls user:stats [--json]',
        async run(ctx) {
            const { out } = ctx;
            const byRole = await db.query('SELECT role, COUNT(*) AS c FROM rhs_users GROUP BY role ORDER BY role');
            const byClass = await db.query(
                `SELECT COALESCE(c.class_name, '(tanpa kelas)') AS kelas, COUNT(u.id) AS c
                 FROM rhs_users u LEFT JOIN rhs_classes c ON u.class_id = c.id
                 GROUP BY COALESCE(c.class_name, '(tanpa kelas)')
                 ORDER BY c DESC`
            );
            const issues = await db.queryOne(
                `SELECT
                    SUM(u.last_login IS NULL) AS belum_login,
                    SUM(u.is_locked = 1) AS terkunci,
                    SUM(u.class_id IS NULL AND u.role = 'student') AS siswa_tanpa_kelas
                 FROM rhs_users u`
            );

            ctx.out.emit({ byRole, byClass, issues });
            ctx.out.title('Statistik User');
            out.section('Per role');
            out.table(byRole.map((r) => ({ role: r.role, jumlah: Number(r.c) })), ['role', 'jumlah']);
            out.section('Per kelas');
            out.table(byClass.map((r) => ({ kelas: r.kelas, jumlah: Number(r.c) })), ['kelas', 'jumlah']);
            out.section('Catatan');
            out.keyValues([
                ['Belum pernah login', Number(issues.belum_login || 0)],
                ['Terkunci', Number(issues.terkunci || 0)],
                ['Siswa tanpa kelas', Number(issues.siswa_tanpa_kelas || 0)]
            ]);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'user:cleanup',
        description: 'Hapus user yatim (tanpa kelas & belum pernah login)',
        usage: 'rhsls user:cleanup [--older-than 30] [--dry-run] [--yes]',
        examples: ['rhsls user:cleanup --dry-run'],
        async run(ctx) {
            const { flags, out } = ctx;
            const days = Number(flags['older-than'] || 30);
            const users = await db.query(
                `SELECT id, username, name, role, createdAt FROM rhs_users
                 WHERE class_id IS NULL AND last_login IS NULL
                   AND createdAt < DATE_SUB(NOW(), INTERVAL ${Math.floor(days)} DAY)
                   AND role <> 'admin'`
            );

            out.emit({ candidates: users });
            if (!users.length) {
                out.success('Tidak ada user yatim.');
                return;
            }

            out.title('Kandidat User Yatim');
            out.table(users.map((u) => ({ id: u.id, username: u.username, role: u.role, dibuat: u.createdAt })), ['id', 'username', 'role', 'dibuat']);

            if (flags['dry-run']) {
                out.warn(`DRY RUN — ${users.length} user akan dihapus.`);
                return;
            }
            await ctx.confirmAction(`Akan menghapus ${users.length} user yatim secara permanen.`);

            const ids = users.map((u) => u.id);
            const p = await db.getPool();
            const [result] = await p.query('DELETE FROM rhs_users WHERE id IN (?)', [ids]);
            await db.logActivity({ username: 'cli', action: 'USER_CLEANUP_CLI', level: 'error', details: `${result.affectedRows} user yatim dihapus` });

            out.success(`${result.affectedRows} user yatim dihapus.`);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'admin:reset',
        aliases: ['admin-reset'],
        description: 'Pintu darurat: pastikan ada admin & reset passwordnya',
        usage: 'rhsls admin:reset [--username admin] [--generate] [--password "X"] [--yes]',
        examples: ['rhsls admin:reset --generate'],
        async run(ctx) {
            const { flags, out } = ctx;
            const username = flags.username || 'admin';

            let admin = await db.queryOne("SELECT * FROM rhs_users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
            const created = !admin;

            if (!admin) {
                const password = await resolvePassword(ctx);
                const hash = await bcrypt.hash(password, 10);
                const result = await db.execute(
                    'INSERT INTO rhs_users (username, password, name, role) VALUES (?, ?, ?, ?)',
                    [username, hash, 'Administrator', 'admin']
                );
                admin = { id: result.insertId, username };
                out.success(`Admin "${username}" dibuat.`);
            } else if (flags.password || flags.generate || process.env.RHSLS_NEW_PASSWORD) {
                const password = await resolvePassword(ctx);
                await db.execute('UPDATE rhs_users SET password = ?, is_locked = 0, locked_until = NULL, failed_login_attempts = 0 WHERE id = ?',
                    [await bcrypt.hash(password, 10), admin.id]);
                await resetSessions([admin], { reason: 'admin_reset' });
                out.success(`Password admin @${admin.username} direset.`);
                if (flags.generate) {
                    out.line();
                    out.warn('Password baru (simpan sekarang):');
                    out.line(`   ${out.bold(out.ok(password))}`);
                    out.line();
                }
            } else {
                out.info(`Admin tersedia: @${admin.username}. Tambahkan --generate untuk reset password.`);
            }

            // pastikan semua admin lain tidak terkunci
            await db.execute("UPDATE rhs_users SET is_locked = 0, locked_until = NULL WHERE role = 'admin'");
            if (redis.isReady()) await redis.del([...await redis.scanKeys('bf:lock:*')]);

            await db.logActivity({ username: 'cli', action: 'ADMIN_RESET_CLI', level: 'error', details: created ? 'Admin dibuat' : 'Password admin direset' });

            out.emit({ admin: admin.username, created });
            out.success('Semua akun admin sekarang tidak terkunci.');
        }
    }
];

module.exports = { commands, generatePassword };