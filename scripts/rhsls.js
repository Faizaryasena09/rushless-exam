#!/usr/bin/env node
'use strict';

/**
 * ============================================================
 *  rhsls — Rushless Exam CLI
 *  Alat operasional: sesi, user, backup & restore aplikasi.
 *
 *  Pakai:  rhsls              (ringkasan cepat)
 *         rhsls help          (daftar perintah)
 *         rhsls help session  (bantuan per kelompok)
 * ============================================================
 */

const path = require('path');
const fs = require('fs');

const { loadEnv, resolveUploadsDir, resolveBackupDir } = require('./rhsls/lib/env');
const { createOutput } = require('./rhsls/lib/output');
const { parseArgs, suggest } = require('./rhsls/lib/args');
const db = require('./rhsls/lib/db');
const redis = require('./rhsls/lib/redis');

const VERSION = '1.0.0';
const CWD = process.cwd();

// muat environment lebih dulu (db/redis membaca process.env saat import)
loadEnv(CWD);

// kumpulkan perintah
const COMMANDS = [];
[
    require('./rhsls/commands/system'),
    require('./rhsls/commands/session'),
    require('./rhsls/commands/user'),
    require('./rhsls/commands/dbcmd'),
    require('./rhsls/commands/backup'),
].forEach((mod) => COMMANDS.push(...mod.commands));

// pastikan perintah default (dashboard) ada sebagai "rhsls" tanpa argumen
const DASHBOARD = COMMANDS.find((c) => c.name === 'dashboard');

// utilitas pencarian perintah
function findCommand(name) {
    if (!name) return null;
    const lower = String(name).toLowerCase();
    return COMMANDS.find((c) => c.name === lower) ||
        COMMANDS.find((c) => (c.aliases || []).some((a) => a === lower)) ||
        null;
}

function allNames() {
    return COMMANDS.flatMap((c) => [c.name, ...(c.aliases || [])]);
}

function namespaceOf(name) {
    return name.split(':')[0];
}

function printHelp(out, filter) {
    const groups = {};
    COMMANDS.forEach((cmd) => {
        const ns = namespaceOf(cmd.name);
        if (filter && ns !== filter) return;
        if (!groups[ns]) groups[ns] = [];
        groups[ns].push(cmd);
    });

    if (!Object.keys(groups).length) {
        out.error(`Kelompok tidak dikenal: ${filter}`);
        return;
    }

    out.title(filter ? `Perintah kelompok: ${filter}` : 'rhsls — Rushless Exam CLI');

    Object.keys(groups).sort().forEach((ns) => {
        out.section(ns.toUpperCase());
        groups[ns].forEach((cmd) => {
            const label = cmd.name.length >= 24
                ? cmd.name
                : cmd.name + ' '.repeat(24 - cmd.name.length);
            out.line(`  ${out.hi(label)} ${out.dim(cmd.description)}`);
            if (cmd.usage) out.line(`  ${' '.repeat(24)} ${out.dim(cmd.usage)}`);
        });
        out.line();
    });

    out.line(out.bold('Opsi umum:'));
    out.line(`  --json                Output dalam format JSON (untuk otomasi)`);
    out.line(`  --dry-run             Simulasikan tanpa mengubah apa pun`);
    out.line(`  --yes / -y            Lewati konfirmasi untuk perintah destruktif`);
    out.line(`  --no-color            Matikan warna`);
    out.line(`  --limit <n>           Batas jumlah baris yang ditampilkan`);
    out.line(`  --db-name <nama>      Jalankan perintah pada database lain (mis. saat restore)`);
    out.line(`  --force-db-name       Izinkan restore walau nama DB backup tidak cocok`);
    out.line(`  --help / -h           Bantuan`);
    out.line();
    out.line(out.bold('Contoh:'));
    out.line(`  ${out.dim('rhsls session:reset --user aqq --yes')}`);
    out.line(`  ${out.dim('rhsls user:unlock-all')}`);
    out.line(`  ${out.dim('rhsls backup:create')}`);
    out.line();
    out.line(out.dim(`v${VERSION} — dokumentasi lengkap: RHSLS.md`));
    out.line();
}

function printCommandHelp(out, cmd) {
    out.title(`rhsls ${cmd.name}`);
    if (cmd.aliases && cmd.aliases.length) out.dim(`Alias: ${cmd.aliases.join(', ')}`);
    out.line();
    out.line(`  ${cmd.description}`);
    out.line();
    if (cmd.usage) {
        out.line(out.bold('  Pemakaian'));
        out.line(`    ${cmd.usage}`);
        out.line();
    }
    if (cmd.examples && cmd.examples.length) {
        out.line(out.bold('  Contoh'));
        cmd.examples.forEach((ex) => out.line(`    ${out.hi(ex)}`));
        out.line();
    }
}

// main
async function main() {
    const argv = process.argv.slice(2);
    const { positional, flags } = parseArgs(argv);

    const out = createOutput({ json: !!flags.json, color: flags['no-color'] ? false : undefined });

    if (flags.version) {
        process.stdout.write(`rhsls v${VERSION}\n`);
        return 0;
    }

    // rhsls help [namespace]
    if (positional[0] === 'help' || flags.help) {
        const target = positional[0] === 'help' ? positional[1] : positional[0];
        if (target) {
            const cmd = findCommand(target);
            if (cmd) printCommandHelp(out, cmd);
            else printHelp(out, target);
        } else {
            printHelp(out, null);
        }
        return 0;
    }

    // rhsls (tanpa argumen) -> dashboard
    if (positional.length === 0) {
        if (flags.json) {
            await runCommand(DASHBOARD, [], flags, out);
            return 0;
        }
        printHelp(out, null);
        out.line(out.dim('Ringkasan cepat: jalankan ') + out.hi('rhsls dashboard'));
        return 0;
    }

    const requested = positional[0];
    let cmd = findCommand(requested);

    if (!cmd) {
        const guess = suggest(requested, allNames());
        if (guess) {
            out.error(`Perintah "${requested}" tidak dikenal.`);
            out.line();
            out.warn(`Maksudmu:  ${out.hi(`rhsls ${guess}`)}`);
            out.line(out.dim('  rhsls help          daftar semua perintah'));
            out.line();
        } else {
            out.error(`Perintah "${requested}" tidak dikenal.`);
            out.line(out.dim('  rhsls help          daftar semua perintah'));
            out.line();
        }
        return 1;
    }

    return await runCommand(cmd, positional.slice(1), flags, out);
}

async function runCommand(cmd, positional, flags, out) {
    // Override nama database untuk satu kali jalan ini
    // (berguna untuk restore ke database uji / database lain)
    if (flags['db-name']) {
        process.env.DB_NAME = String(flags['db-name']);
    }

    const dbConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    };

    const ctx = {
        cwd: CWD,
        cmd,
        positional,
        flags,
        out,
        db,
        redis,
        dbConfig,
        uploadsDir: resolveUploadsDir(CWD),
        backupDir: resolveBackupDir(CWD),
        exitCode: 0,

        /** konfirmasi untuk aksi destruktif */
        async confirmAction(message) {
            if (flags.yes || flags.y) return true;
            if (flags.json) {
                throw new Error(`Konfirmasi dibutuhkan (--yes): ${message}`);
            }
            if (!process.stdin.isTTY) {
                throw new Error(`butuh --yes untuk: ${message}`);
            }
            const answer = await out.confirm(`${message} Lanjutkan?`, false);
            if (!answer) {
                throw new Error('Dibatalkan oleh user.');
            }
            return true;
        },
    };

    // help per perintah
    if (flags.help) {
        printCommandHelp(out, cmd);
        return 0;
    }

    // redis dicek diam-diam (banyak perintah butuh)
    if (cmd.name.startsWith('session:') || cmd.name.startsWith('user:') || cmd.name === 'backup:purge-cache') {
        await redis.ping();
    }

    try {
        await cmd.run(ctx);
        return ctx.exitCode || 0;
    } catch (err) {
        out.closePrompt();
        const known = ['RHSLS_USER_NOT_FOUND', 'RHSLS_NEED_TARGET', 'RHSLS_NO_DB_CONFIG'];
        if (known.includes(err.code)) {
            out.error(err.message);
            if (err.code === 'RHSLS_NEED_TARGET') {
                out.line();
                out.line(out.dim('  Contoh:'));
                out.line(`    ${out.hi('rhsls session:reset --user aqq --yes')}`);
                out.line(`    ${out.hi('rhsls session:reset --stuck --yes')}`);
                out.line(`    ${out.hi('rhsls session:reset --all --yes')}`);
                out.line();
            }
            return 1;
        }
        if (err.message === 'Dibatalkan oleh user.') {
            out.line();
            out.warn('Dibatalkan. Tidak ada yang diubah.');
            return 1;
        }
        out.error(err.message);
        if (process.env.RHSLS_DEBUG) out.line(out.dim(err.stack || ''));
        return 1;
    } finally {
        out.closePrompt();
        if (!ctx.hold) {
            // beri kesempatan microtask yang tertunda selesai dulu
            await new Promise((resolve) => setImmediate(resolve));
            await Promise.allSettled([db.close(), redis.close()]);
        }
    }
}

main()
    .then((code) => { process.exitCode = code || 0; })
    .catch(async (err) => {
        process.stderr.write(`\x1b[31m✖\x1b[0m ${err.message}\n`);
        await Promise.allSettled([db.close(), redis.close()]);
        process.exitCode = 1;
    });