'use strict';

/**
 * Perintah diagnostik: dashboard ringkasan, doctor, activity log.
 */

const fs = require('fs');
const path = require('path');
const db = require('../lib/db');
const redis = require('../lib/redis');
const backupLib = require('../lib/backup');
const { humanBytes, humanDuration } = require('../lib/output');

function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function collectSystemInfo(ctx) {
    const info = { checks: [], warnings: [] };

    // Database
    let dbLatency = null;
    try {
        dbLatency = await db.ping();
        info.checks.push({ name: 'Database', ok: true, detail: `${ctx.dbConfig.database} @ ${ctx.dbConfig.host} (${dbLatency}ms)` });
    } catch (e) {
        info.checks.push({ name: 'Database', ok: false, detail: e.message });
        return info;
    }

    // Redis
    const redisPing = await redis.ping();
    if (redisPing.ok) {
        info.checks.push({ name: 'Redis', ok: true, detail: `siap (${redisPing.latencyMs}ms)` });
    } else {
        info.checks.push({ name: 'Redis', ok: false, detail: 'tidak aktif — aplikasi berjalan mode fallback MySQL' });
        info.warnings.push('Redis mati: sesi online & cache jawaban pakai fallback MySQL (kurang akurat).');
    }

    // Skema penting
    const schemaChecks = [
        { table: 'rhs_student_answer', column: 'selected_option', expect: 'text', label: 'student_answer.selected_option = TEXT' },
        { table: 'rhs_temporary_answer', column: 'selected_option', expect: 'text', label: 'temporary_answer.selected_option = TEXT' },
    ];

    for (const check of schemaChecks) {
         
        const row = await db.queryOne(
            `SELECT DATA_TYPE AS t FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [check.table, check.column]
        );
        const ok = row && row.t === check.expect;
        info.checks.push({ name: 'Skema', ok, detail: `${check.label}${ok ? '' : ` (sekarang ${row ? row.t : 'tidak ada'})`}` });
        if (!ok) info.warnings.push(`Migrasi belum jalan: ${check.label}. Jalankan rhsls db:migrate.`);
    }

    const uk = await db.queryOne(
        `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rhs_student_answer'
         AND INDEX_NAME = 'unique_attempt_question'`
    );
    const ukOk = Number(uk.c) > 0;
    info.checks.push({ name: 'Skema', ok: ukOk, detail: `unique_attempt_question ${ukOk ? 'ada' : 'TIDAK ADA'}` });
    if (!ukOk) info.warnings.push('Unique key jawaban belum ada — jawaban bisa terduplikasi. Jalankan rhsls db:migrate.');

    for (const table of ['rhs_temporary_answer_archive', 'rhs_answer_restore_backup']) {
         
        const exists = await db.tableExists(table);
        info.checks.push({ name: 'Skema', ok: exists, detail: `tabel ${table} ${exists ? 'ada' : 'belum ada'}` });
    }

    // Tabel wajib
    const required = ['rhs_users', 'rhs_exams', 'rhs_exam_attempts', 'rhs_student_answer', 'rhs_activity_logs'];
    const missing = [];
    for (const t of required) {
         
        if (!(await db.tableExists(t))) missing.push(t);
    }
    if (missing.length) {
        info.checks.push({ name: 'Tabel', ok: false, detail: `hilang: ${missing.join(', ')}` });
        info.warnings.push('Jalankan Setup dari Dashboard atau rhsls db:migrate.');
    } else {
        info.checks.push({ name: 'Tabel', ok: true, detail: `${required.length} tabel utama lengkap` });
    }

    // Folder krusial
    const uploadsExists = fs.existsSync(ctx.uploadsDir);
    const uploadFiles = uploadsExists ? backupLib.countFiles(ctx.uploadsDir) : 0;
    const uploadSize = uploadsExists ? backupLib.dirSize(ctx.uploadsDir) : 0;
    info.checks.push({
        name: 'Folder upload',
        ok: uploadsExists,
        detail: uploadsExists ? `${uploadFiles} berkas, ${humanBytes(uploadSize)}` : `tidak ditemukan: ${ctx.uploadsDir}`
    });

    const keysExists = fs.existsSync(path.join(ctx.cwd, 'keys', 'private.pem'));
    info.checks.push({ name: 'Kunci license', ok: keysExists, detail: keysExists ? 'private.pem ada' : 'private.pem TIDAK ADA (license tidak bisa diterbitkan)' });
    if (!keysExists) info.warnings.push('keys/private.pem hilang — license baru tidak bisa dibuat.');

    // Backup terakhir
    const backups = backupLib.listBackups(ctx.backupDir);
    if (backups.length) {
        const last = backups[0];
        const ageDays = (Date.now() - new Date(last.createdAt).getTime()) / 86400000;
        info.checks.push({
            name: 'Backup terakhir',
            ok: ageDays <= 2,
            detail: `${last.file} (${humanDuration(ageDays * 86400)} lalu, ${humanBytes(last.size)})`
        });
        if (ageDays > 2) info.warnings.push(`Backup terakhir sudah ${Math.floor(ageDays)} hari lalu. Jalankan rhsls backup:create.`);
    } else {
        info.checks.push({ name: 'Backup terakhir', ok: false, detail: 'belum pernah backup' });
        info.warnings.push('Belum ada backup sama sekali. Jalankan rhsls backup:create.');
    }

    // Scheduler auto-submit
    if (redis.isReady()) {
        const gate = await redis.get('scheduler:last_archive_purge');
        const archiveOk = await db.tableExists('rhs_temporary_answer_archive');
        info.checks.push({
            name: 'Scheduler',
            ok: true,
            detail: `auto-submit aktif (30s) • purge arsip ${gate ? 'terakhir ' + humanDuration((Date.now() - Number(gate)) / 1000) + ' lalu' : 'belum pernah'}${archiveOk ? '' : ' (tabel arsip belum ada)'}`
        });
    }

    return info;
}

const commands = [
    // ─────────────────────────────────────────────────────────────
    {
        name: 'dashboard',
        description: 'Ringkasan cepat sistem (perintah bawaan)',
        usage: 'rhsls',
        async run(ctx) {
            const [totals, attempts, backupList] = await Promise.all([
                db.queryOne(`SELECT COUNT(*) AS total,
                                    SUM(session_id IS NOT NULL) AS with_session,
                                    SUM(is_locked = 1 OR locked_until IS NOT NULL) AS locked
                             FROM rhs_users`),
                db.queryOne(`SELECT COUNT(*) AS c FROM rhs_exam_attempts WHERE status = 'in_progress'`),
                Promise.resolve(backupLib.listBackups(ctx.backupDir))
            ]);

            const onlineIds = await db.query('SELECT id FROM rhs_users WHERE is_online_realtime = 1 LIMIT 2000');
            const onlineMap = await redis.existsMany(onlineIds.map((r) => `online:${r.id}`));
            const onlineCount = Object.keys(onlineMap).length > 0
                ? Object.values(onlineMap).filter(Boolean).length
                : Number(totals.with_session || 0);

            const uploadsSize = fs.existsSync(ctx.uploadsDir) ? backupLib.dirSize(ctx.uploadsDir) : 0;
            const uploadsCount = fs.existsSync(ctx.uploadsDir) ? backupLib.countFiles(ctx.uploadsDir) : 0;

            const data = {
                user: {
                    total: Number(totals.total || 0),
                    sesiAktif: Number(totals.with_session || 0),
                    online: onlineCount,
                    terkunci: Number(totals.locked || 0)
                },
                ujian: { sedangBerjalan: Number(attempts.c || 0) },
                file: { uploads: uploadsCount, ukuran: uploadsSize },
                backupTerakhir: backupList[0] ? backupList[0].file : null
            };

            ctx.out.emit(data);

            ctx.out.title('Rushless Exam — Ringkasan Sistem');
            ctx.out.keyValues([
                ['Total user', data.user.total],
                ['Sesi aktif', data.user.sesiAktif],
                ['Online sekarang', data.user.online],
                ['User terkunci', data.user.terkunci],
                ['Ujian sedang berjalan', data.ujian.sedangBerjalan],
                ['File upload', `${data.file.uploads} berkas (${humanBytes(data.file.ukuran)})`],
                ['Backup terakhir', data.backupTerakhir
                    ? `${data.backupTerakhir} (${humanDuration((Date.now() - new Date(backupList[0].createdAt).getTime()) / 1000)} lalu)`
                    : ctx.out.bad('belum ada')]
            ]);

            ctx.out.line(`  ${ctx.out.dim('Coba:')} ${ctx.out.hi('rhsls doctor')} ${ctx.out.dim('|')} ` +
                `${ctx.out.hi('rhsls help session')} ${ctx.out.dim('|')} ${ctx.out.hi('rhsls backup:create')}`);
            ctx.out.line();
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'doctor',
        aliases: ['check'],
        description: 'Diagnosis menyeluruh: env, DB, Redis, skema, file, backup',
        usage: 'rhsls doctor [--json]',
        async run(ctx) {
            const info = await collectSystemInfo(ctx);
            const failed = info.checks.filter((c) => !c.ok);

            ctx.out.emit({ ...info, failed: failed.length });

            ctx.out.title('Diagnosis Sistem');
            ctx.out.table(info.checks.map((c) => ({
                nama: c.name,
                status: c.ok ? ctx.out.ok('OK') : ctx.out.bad('PERHATIAN'),
                detail: c.detail
            })), ['nama', 'status', 'detail']);

            if (info.warnings.length) {
                ctx.out.section('Tindakan yang Disarankan');
                info.warnings.forEach((w, i) => ctx.out.line(`  ${i + 1}. ${w}`));
                ctx.out.line();
            }

            if (failed.length) {
                ctx.out.warn(`${failed.length} pemeriksaan perlu perhatian.`);
                ctx.exitCode = 1;
            } else {
                ctx.out.success('Semua pemeriksaan lolos.');
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'activity:tail',
        aliases: ['logs'],
        description: 'Tampilkan activity log terbaru',
        usage: 'rhsls activity:tail [--limit 40] [--level warn,error] [--user aqq] [--search kata]',
        examples: ['rhsls activity:tail --level error --limit 20'],
        async run(ctx) {
            const { flags, out } = ctx;
            const limit = Math.min(1000, Number(flags.limit) || 40);
            const conditions = [];
            const values = [];

            if (flags.level) {
                const levels = String(flags.level).split(',').map((l) => l.trim());
                conditions.push(`level IN (${levels.map(() => '?').join(',')})`);
                values.push(...levels);
            }
            if (flags.user) {
                conditions.push('(username LIKE ? OR CAST(user_id AS CHAR) = ?)');
                values.push(`%${flags.user}%`, flags.user);
            }
            if (flags.search) {
                conditions.push('(action LIKE ? OR details LIKE ?)');
                values.push(`%${flags.search}%`, `%${flags.search}%`);
            }

            const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
            const rows = await db.query(
                `SELECT id, user_id, username, ip_address, action, level, details, created_at
                 FROM rhs_activity_logs ${where}
                 ORDER BY id DESC LIMIT ${limit}`,
                values
            );

            out.emit({ logs: rows });
            out.title('Activity Log');
            out.table(rows.map((r) => ({
                waktu: formatDate(r.created_at),
                user: r.username || (r.user_id ? `#${r.user_id}` : '-'),
                aksi: r.action,
                level: r.level === 'error' ? out.bad(r.level) : r.level === 'warn' ? out.warnColor(r.level) : r.level,
                ip: r.ip_address || '-',
                detail: (r.details || '').slice(0, 70)
            })), ['waktu', 'user', 'aksi', 'level', 'ip', 'detail']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'settings:list',
        description: 'Daftar pengaturan aplikasi (rhs_web_settings)',
        usage: 'rhsls settings:list [--json]',
        async run(ctx) {
            const rows = await db.query('SELECT setting_key, setting_value FROM rhs_web_settings ORDER BY setting_key');
            ctx.out.emit({ settings: rows });
            ctx.out.title('Pengaturan Aplikasi');
            ctx.out.table(rows.map((r) => ({
                key: r.setting_key,
                value: String(r.setting_value || '').slice(0, 60)
            })), ['key', 'value']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'settings:get',
        description: 'Baca satu nilai pengaturan',
        usage: 'rhsls settings:get <key>',
        examples: ['rhsls settings:get app_emergency_password'],
        async run(ctx) {
            const key = ctx.positional[0];
            if (!key) throw new Error('Sebut key, contoh: rhsls settings:get app_emergency_password');
            const row = await db.queryOne('SELECT setting_value FROM rhs_web_settings WHERE setting_key = ?', [key]);
            if (!row) {
                ctx.out.emit({ key, found: false });
                throw new Error(`Pengaturan "${key}" tidak ada.`);
            }
            ctx.out.emit({ key, value: row.setting_value });
            ctx.out.title(key);
            ctx.out.line(`  ${row.setting_value}`);
            ctx.out.line();
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'settings:set',
        description: 'Ubah nilai pengaturan aplikasi',
        usage: 'rhsls settings:set <key> <value> [--yes]',
        examples: ['rhsls settings:set app_emergency_password "rahasia123" --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            const key = ctx.positional[0];
            const value = ctx.positional.slice(1).join(' ');
            if (!key || !value) throw new Error('Sebut key dan value, contoh: rhsls settings:set app_emergency_password "rahasia123"');

            const current = await db.queryOne('SELECT setting_value FROM rhs_web_settings WHERE setting_key = ?', [key]);

            if (flags['dry-run']) {
                out.warn(`DRY RUN: ${key} = "${current ? current.setting_value : '(kosong)'}" -> "${value}"`);
                out.emit({ dryRun: true, key, from: current ? current.setting_value : null, to: value });
                return;
            }

            await ctx.confirmAction(
                `${key}: "${current ? current.setting_value : '(kosong)'}" -> "${value}"`
            );

            if (current) {
                await db.execute('UPDATE rhs_web_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
            } else {
                await db.execute('INSERT INTO rhs_web_settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
            }
            if (redis.isReady()) {
                await redis.del([`web-settings:${key}`, 'web-settings:all']);
            }
            await db.logActivity({ username: 'cli', action: 'SETTING_SET_CLI', level: 'warn', details: `${key} diubah` });

            out.emit({ key, value });
            out.success(`${key} diubah. Restart aplikasi bila tidak langsung berlaku.`);
        }
    }
];

module.exports = { commands, collectSystemInfo };