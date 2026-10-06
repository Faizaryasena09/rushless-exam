'use strict';

/**
 * Perintah backup & restore aplikasi.
 */

const fs = require('fs');
const path = require('path');

const backupLib = require('../lib/backup');
const { humanBytes, humanDuration } = require('../lib/output');

function resolveTarget(ctx, flags) {
    const backupDir = ctx.backupDir;
    // file bisa lewat flag (--file/--out) ATAU posisional: rhsls backup:verify <file>
    const file = flags.file
        || (flags.out && flags.out.endsWith('.zip') ? flags.out : null)
        || (ctx.positional && ctx.positional[0] ? ctx.positional[0] : null);

    // Bila file disebutkan, HARUS ketemu — jangan diam-diam fallback ke backup lain
    if (file) {
        const direct = path.resolve(file);
        if (fs.existsSync(direct)) return direct;

        const inBackupDir = path.join(backupDir, path.basename(file));
        if (fs.existsSync(inBackupDir)) return inBackupDir;

        throw new Error(
            `Backup tidak ditemukan: ${file}\n` +
            `  Dicoba: ${direct}\n` +
            `  Dicoba: ${inBackupDir}\n` +
            `  Lihat daftar: rhsls backup:list`
        );
    }

    // Tanpa file -> pakai backup terbaru
    const latest = backupLib.listBackups(backupDir)[0];
    if (latest) return latest.path;

    throw new Error(`Tidak ada backup di ${backupDir}. Buat dulu dengan: rhsls backup:create`);
}

const commands = [
    // ─────────────────────────────────────────────────────────────
    {
        name: 'backup:create',
        aliases: ['backup'],
        description: 'Buat paket backup (database + file upload + kunci + env)',
        usage: 'rhsls backup:create [--out FILE] [--tables "a,b"] [--no-uploads] [--no-secrets] [--no-logs]',
        examples: [
            'rhsls backup:create',
            'rhsls backup:create --out /var/backups/rhsls.zip --no-uploads',
            'rhsls backup:create --json'
        ],
        async run(ctx) {
            const { flags, out } = ctx;
            const includeUploads = !flags['no-uploads'];
            const includeSecrets = !flags['no-secrets'];
            const skipLogs = !flags['no-logs'];

            out.title('Backup Aplikasi');
            out.info(`Database : ${ctx.dbConfig.database} @ ${ctx.dbConfig.host}`);
            out.info(`Uploads  : ${includeUploads ? ctx.uploadsDir : '(dilewati)'}`);
            out.info(`Kunci+env: ${includeSecrets ? 'ikut' : '(dilewati)'}`);
            if (!includeSecrets) out.warn('Paket TANPA kredensial & kunci privat license.');
            out.line();

            const spinner = out.spinner('Mengumpulkan data…');
            const progressState = { phase: null };

            const onProgress = (p) => {
                if (p.phase !== progressState.phase) {
                    spinner.update(p.message || `Backup ${p.phase}…`);
                    progressState.phase = p.phase;
                }
                if (p.total) {
                    spinner.update(`Backup ${p.phase} ${p.current}/${p.total}${p.table ? ` (${p.table})` : ''}`);
                }
            };

            const result = await backupLib.createBackup({
                cwd: ctx.cwd,
                uploadsDir: includeUploads ? ctx.uploadsDir : null,
                out: flags.out,
                tables: flags.tables,
                includeUploads,
                includeSecrets,
                skipLogs,
                backupDir: ctx.backupDir,
                onProgress
            });
            spinner.stop();

            const m = result.manifest;
            out.emit({
                file: result.file,
                size: result.size,
                sha256: result.sha256,
                durationMs: result.durationMs,
                tables: m.tables.length,
                rows: Object.values(m.counts).reduce((a, b) => a + b, 0),
                uploads: m.uploads ? m.uploads.count : 0
            });

            out.success('Backup selesai.');
            out.keyValues([
                ['Berkas', result.file],
                ['Ukuran', humanBytes(result.size)],
                ['Tabel', m.tables.length],
                ['Total baris', Object.values(m.counts).reduce((a, b) => a + b, 0).toLocaleString('id-ID')],
                ['File upload', m.uploads ? `${m.uploads.count} berkas (${humanBytes(m.uploads.bytes)})` : '(tidak ada)'],
                ['Durasi', humanDuration(result.durationMs / 1000)],
                ['SHA256', result.sha256.slice(0, 24) + '…']
            ]);

            if (m.warnings && m.warnings.length) {
                out.section('Peringatan');
                m.warnings.forEach((w) => out.warn(w));
            }
            if (includeSecrets) {
                out.warn('Paket berisi kredensial DB & kunci privat license — simpan dengan aman!');
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'backup:list',
        aliases: ['backups'],
        description: 'Daftar backup yang tersedia',
        usage: 'rhsls backup:list [--json]',
        async run(ctx) {
            const all = backupLib.listBackups(ctx.backupDir);
            ctx.out.emit({ backups: all, dir: ctx.backupDir });

            ctx.out.title('Daftar Backup');
            ctx.out.dim(`Folder: ${ctx.backupDir}`);
            if (!all.length) {
                ctx.out.warn('Belum ada backup. Jalankan: rhsls backup:create');
                return;
            }
            ctx.out.table(all.map((b) => ({
                nama: b.file,
                ukuran: humanBytes(b.size),
                dibuat: new Date(b.createdAt).toLocaleString('id-ID'),
                checksum: b.hasHash ? 'ada' : 'tidak'
            })), ['nama', 'ukuran', 'dibuat', 'checksum']);
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'backup:verify',
        description: 'Verifikasi integritas paket backup',
        usage: 'rhsls backup:verify [file] [--json]',
        examples: ['rhsls backup:verify', 'rhsls backup:verify backups/rhsls-backup-2026-10-02.zip'],
        async run(ctx) {
            const target = resolveTarget(ctx, ctx.flags);
            const result = backupLib.verifyBackup(target);

            ctx.out.emit(result);
            ctx.out.title('Verifikasi Backup');
            ctx.out.keyValues([
                ['Berkas', result.file],
                ['Checksum paket', result.hashOk === null ? ctx.out.dim('tidak diperiksa') : (result.hashOk ? ctx.out.ok('cocok') : ctx.out.bad('TIDAK COCOK'))],
                ['Paket terbaca', result.packageOk ? ctx.out.ok('ya') : ctx.out.bad('tidak')],
                ['Tabel', result.summary ? result.summary.tables : '-'],
                ['Total baris', result.summary ? result.summary.rows.toLocaleString('id-ID') : '-'],
                ['File upload', result.summary ? result.summary.uploadFiles : '-'],
                ['Kunci privat ada', result.summary ? (result.summary.hasKeys ? ctx.out.ok('ya') : ctx.out.bad('tidak')) : '-'],
                ['Kredensial env ada', result.summary ? (result.summary.hasEnv ? ctx.out.ok('ya') : ctx.out.dim('tidak')) : '-'],
                ['Dibuat', result.summary ? new Date(result.summary.createdAt).toLocaleString('id-ID') : '-']
            ]);

            result.issues.forEach((issue) => ctx.out.warn(issue));

            if (!result.packageOk || result.hashOk === false) {
                throw new Error('Backup tidak valid — jangan dipakai untuk restore.');
            }
            ctx.out.success('Backup valid dan siap dipakai untuk restore.');
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'backup:open',
        description: 'Lihat isi paket backup tanpa extract',
        usage: 'rhsls backup:open [file] [--limit 100]',
        async run(ctx) {
            const target = resolveTarget(ctx, ctx.flags);
            const result = backupLib.inspectBackup(target, Number(ctx.flags.limit) || 200);

            ctx.out.emit(result);
            ctx.out.title(`Isi Paket: ${path.basename(target)}`);
            ctx.out.dim(`${result.totalEntries} entri`);
            ctx.out.table(result.entries.map((e) => ({
                nama: e.name,
                ukuran: humanBytes(e.size)
            })), ['nama', 'ukuran']);

            if (result.manifest) {
                ctx.out.section('Manifest');
                ctx.out.keyValues([
                    ['Tool', result.manifest.tool + ' v' + result.manifest.version],
                    ['Dibuat', new Date(result.manifest.createdAt).toLocaleString('id-ID')],
                    ['App', result.manifest.appVersion || '-'],
                    ['Host', result.manifest.host],
                    ['Database', `${result.manifest.database.name} @ ${result.manifest.database.host}`],
                    ['Uploads', result.manifest.uploads ? `${result.manifest.uploads.count} berkas` : '-']
                ]);
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'backup:restore',
        description: 'Pulihkan aplikasi dari paket backup (MENIMPA)',
        usage: 'rhsls backup:restore [file] [--db-only] [--files-only] [--skip-verify] [--force-db-name] [--yes]',
        examples: [
            'rhsls backup:restore --yes',
            'rhsls backup:restore backups/lama.zip --db-only --yes',
            'rhsls backup:restore backups/prod.zip --db-name rush --yes'
        ],
        async run(ctx) {
            const { flags, out } = ctx;
            const target = resolveTarget(ctx, flags);

            // verifikasi dulu (kecuali dilewati)
            if (!flags['skip-verify']) {
                const check = backupLib.verifyBackup(target);
                if (!check.packageOk || check.hashOk === false) {
                    check.issues.forEach((i) => out.warn(i));
                    throw new Error('Backup gagal verifikasi. Gunakan --skip-verify bila yakin.');
                }
                out.success('Verifikasi backup lolos.');
            }

            out.title('Peringatan Restore');
            out.warn('Restore akan MENIMPA data yang ada saat ini.');
            out.keyValues([
                ['Sumber', target],
                ['Database', `${ctx.dbConfig.database} @ ${ctx.dbConfig.host}`],
                ['Uploads', flags['files-only'] ? '(tidak disentuh)' : ctx.uploadsDir],
                ['Mode', flags['db-only'] ? 'HANYA DATABASE' : flags['files-only'] ? 'HANYA FILE' : 'DATABASE + FILE']
            ]);

            await ctx.confirmAction('Lanjutkan proses restore?');

            const spinner = out.spinner('Memulihkan…');
            const result = await backupLib.restoreBackup(target, {
                cwd: ctx.cwd,
                uploadsDir: ctx.uploadsDir,
                safetyBackup: !flags['no-safety-backup'],
                dbOnly: !!flags['db-only'],
                filesOnly: !!flags['files-only'],
                allowDbMismatch: !!flags['force-db-name'],
                backupDir: ctx.backupDir,
                onProgress: (p) => {
                    if (p.message) spinner.update(p.message);
                    else if (p.total) spinner.update(`Restore ${p.phase} ${p.current}/${p.total}`);
                }
            });
            spinner.stop();

            out.emit({
                file: target,
                safetyBackup: result.safetyBackup ? result.safetyBackup.file : null,
                tablesRestored: result.tablesRestored.length,
                filesRestored: result.filesRestored
            });

            out.success('Restore selesai.');
            out.keyValues([
                ['Backup pengaman', result.safetyBackup ? result.safetyBackup.file : '(tidak dibuat)'],
                ['Tabel dipulihkan', result.tablesRestored.length],
                ['File dipulihkan', result.filesRestored]
            ]);
            if (result.safetyBackup) {
                out.info(`Bila ada yang tidak sesuai, backup pengaman ada di: ${result.safetyBackup.file}`);
            }
            out.warn('Restart aplikasi bila terjadi masalah (pm2 restart rushless-exam).');
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'backup:prune',
        description: 'Hapus backup lama, sisakan N terbaru',
        usage: 'rhsls backup:prune [--keep 10] [--dry-run] [--yes]',
        examples: ['rhsls backup:prune --keep 5 --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            const keep = Math.max(1, Number(flags.keep) || 10);
            const all = backupLib.listBackups(ctx.backupDir);

            if (all.length <= keep) {
                out.success(`Hanya ${all.length} backup tersedia (maks ${keep}) — tidak ada yang dihapus.`);
                out.emit({ removed: 0 });
                return;
            }

            const toRemove = all.slice(keep);
            out.title('Hapus Backup Lama');
            out.table(toRemove.map((b) => ({
                nama: b.file,
                ukuran: humanBytes(b.size),
                dibuat: new Date(b.createdAt).toLocaleString('id-ID')
            })), ['nama', 'ukuran', 'dibuat']);
            out.info(`Total: ${humanBytes(toRemove.reduce((s, b) => s + b.size, 0))}`);

            if (flags['dry-run']) {
                out.warn(`DRY RUN — ${toRemove.length} backup akan dihapus.`);
                out.emit({ dryRun: true, wouldRemove: toRemove.length });
                return;
            }

            await ctx.confirmAction(`Akan menghapus ${toRemove.length} backup lama.`);
            const result = backupLib.pruneBackups(ctx.backupDir, keep);
            out.emit({ removed: result.removed.length });
            out.success(`${result.removed.length} backup dihapus, ${result.kept.length} disimpan.`);
        }
    }
];

module.exports = { commands };