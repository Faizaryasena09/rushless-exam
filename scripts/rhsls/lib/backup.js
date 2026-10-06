'use strict';

/**
 * Paket backup aplikasi.
 *
 * Isi paket (.zip):
 *   manifest.json          versi app, waktu, host, jumlah baris, checksum tiap file
 *   db/schema.sql          CREATE TABLE semua tabel
 *   db/data-<table>.sql    INSERT per tabel (batched)
 *   files/uploads/**       foto, logo, gambar soal, dokumen  (opsional)
 *   keys/private.pem       kunci privat license               (opsional, default ikut)
 *   config/.env(.local)    kredensial database                 (opsional, default ikut)
 *   files/license_status.json
 *
 * Format ZIP memakai adm-zip (sudah jadi dependency project).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const AdmZip = require('adm-zip');

const db = require('./db');

const CRITICAL_TABLES = [
    'rhs_users', 'rhs_classes', 'rhs_subjects', 'rhs_teacher_classes', 'rhs_teacher_subjects',
    'rhs_exams', 'rhs_exam_settings', 'rhs_exam_questions', 'rhs_exam_classes',
    'rhs_exam_attempts', 'rhs_student_answer', 'rhs_temporary_answer',
    'rhs_temporary_answer_archive', 'rhs_answer_restore_backup',
    'rhs_web_settings', 'rhs_activity_logs', 'rhs_exam_logs', 'rhs_launch_tokens',
];

/** Tabel yang tidak perlu dibackup (log yang sangat besar / churn tinggi) */
const SKIP_TABLES = new Set([
    'rhs_exam_logs', 'rhs_activity_logs',
]);

function sha256Buffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function listFilesRecursive(dir, base = dir, acc = []) {
    if (!fs.existsSync(dir)) return acc;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) listFilesRecursive(full, base, acc);
        else acc.push(full);
    });
    return acc;
}

function dirSize(dir) {
    return listFilesRecursive(dir).reduce((sum, f) => sum + fs.statSync(f).size, 0);
}

function countFiles(dir) {
    return listFilesRecursive(dir).length;
}

/** Pilih tabel yang akan dibackup */
async function resolveTables(requested) {
    const all = await db.listTables();
    const existing = all.map((t) => t.name);

    if (requested) {
        const list = String(requested).split(',').map((s) => s.trim()).filter(Boolean);
        const found = list.filter((t) => existing.includes(t));
        const missing = list.filter((t) => !existing.includes(t));
        return { tables: found, missing, all: existing };
    }

    const tables = existing.filter((t) => !SKIP_TABLES.has(t));
    return { tables, missing: [], all: existing };
}

/** Buat dump satu tabel (schema + data) */
async function dumpTable(table, { includeData = true, batchSize = 300 } = {}) {
    const schemaRows = await db.query(`SHOW CREATE TABLE \`${table}\``);
    if (!schemaRows.length) return null;
    const createSql = schemaRows[0]['Create Table'];

    let dataSql = '';
    let rowCount = 0;

    if (includeData) {
        const p = await db.getPool();
        const conn = await p.getConnection();
        try {
            const escaped = '`' + table.replace(/`/g, '``') + '`';
            const [rows] = await conn.query(`SELECT * FROM ${escaped}`);
            rowCount = rows.length;

            if (rows.length) {
                const lines = [];
                const columns = Object.keys(rows[0]);
                const colList = columns.map((c) => '`' + c.replace(/`/g, '``') + '`').join(', ');
                for (let i = 0; i < rows.length; i += batchSize) {
                    const chunk = rows.slice(i, i + batchSize);
                    const values = chunk.map((row) => {
                        const cells = columns.map((col) => db.escapeValue(row[col]));
                        return `(${cells.join(',')})`;
                    }).join(',\n  ');
                    lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES\n  ${values};`);
                }
                dataSql = lines.join('\n');
            }
        } finally {
            conn.release();
        }
    }

    return { table, createSql, dataSql, rowCount };
}

/**
 * Buat satu paket backup.
 */
async function createBackup(options = {}) {
    const {
        cwd = process.cwd(),
        uploadsDir,
        out,
        includeUploads = true,
        includeSecrets = true,
        tables: requestedTables,
        skipLogs = true,
        onProgress = () => {}
    } = options;

    const started = Date.now();
    const backupDir = options.backupDir || path.join(cwd, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const target = path.resolve(out || path.join(backupDir, `rhsls-backup-${stamp}.zip`));

    const zip = new AdmZip();
    const manifest = {
        tool: 'rhsls',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        host: os.hostname(),
        platform: `${os.platform()} ${os.arch()}`,
        appVersion: readPackageVersion(cwd),
        node: process.version,
        options: { includeUploads, includeSecrets },
        database: {
            host: process.env.DB_HOST,
            name: process.env.DB_NAME,
            user: process.env.DB_USER,
        },
        uploadsDir,
        tables: [],
        files: [],
        counts: {},
    };

    // ── 1. Database ──
    const resolved = await resolveTables(requestedTables);
    if (resolved.missing.length) {
        manifest.warnings = [`Tabel tidak ditemukan: ${resolved.missing.join(', ')}`];
    }

    let schemaParts = [
        '-- rhsls backup - schema',
        `-- dibuat: ${manifest.createdAt}`,
        'SET FOREIGN_KEY_CHECKS = 0;',
        'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";',
        '',
    ];

    onProgress({ phase: 'db', total: resolved.tables.length, current: 0 });

    for (let i = 0; i < resolved.tables.length; i += 1) {
        const table = resolved.tables[i];
         
        const dump = await dumpTable(table, { includeData: true });
        onProgress({ phase: 'db', total: resolved.tables.length, current: i + 1, table });

        if (!dump) continue;
        schemaParts.push(`-- ------------------------------------------------------------------`);
        schemaParts.push(`-- Tabel: ${table} (${dump.rowCount} baris)`);
        schemaParts.push(`-- ------------------------------------------------------------------`);
        schemaParts.push(`DROP TABLE IF EXISTS \`${table}\`;`);
        schemaParts.push(`${dump.createSql};\n`);

        const dataFileName = `db/data-${table}.sql`;
        zip.addFile(dataFileName, Buffer.from(
            `-- Data tabel ${table} (${dump.rowCount} baris)\n${dump.dataSql}\n`,
            'utf8'
        ));
        manifest.files.push({ path: dataFileName, bytes: dump.dataSql.length });

        manifest.tables.push({ name: table, rows: dump.rowCount });
        manifest.counts[table] = dump.rowCount;
    }

    schemaParts.push('SET FOREIGN_KEY_CHECKS = 1;');
    zip.addFile('db/schema.sql', Buffer.from(schemaParts.join('\n'), 'utf8'));

    // ── 2. File uploads (foto, logo, gambar soal, dokumen) ──
    if (includeUploads && uploadsDir && fs.existsSync(uploadsDir)) {
        const files = listFilesRecursive(uploadsDir);
        onProgress({ phase: 'uploads', total: files.length, current: 0 });

        let bytes = 0;
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const rel = path.relative(uploadsDir, file).split(path.sep).join('/');
             
            const buffer = fs.readFileSync(file);
            zip.addFile(`files/uploads/${rel}`, buffer);
            bytes += buffer.length;
            manifest.files.push({ path: `files/uploads/${rel}`, bytes: buffer.length });
            onProgress({ phase: 'uploads', total: files.length, current: i + 1 });
        }
        manifest.uploads = { path: uploadsDir, count: files.length, bytes };
    }

    // ── 3. Kunci privat license ──
    manifest.keysIncluded = false;
    manifest.envIncluded = false;
    if (includeSecrets) {
        const keysDir = path.join(cwd, 'keys');
        if (fs.existsSync(keysDir)) {
            listFilesRecursive(keysDir).forEach((file) => {
                const rel = path.relative(cwd, file).split(path.sep).join('/');
                const buffer = fs.readFileSync(file);
                zip.addFile(rel, buffer);
                manifest.files.push({ path: rel, bytes: buffer.length, secret: true });
            });
            manifest.keysIncluded = true;
        }

        ['.env.local', '.env'].forEach((name) => {
            const file = path.join(cwd, name);
            if (fs.existsSync(file)) {
                const buffer = fs.readFileSync(file);
                zip.addFile(`config/${name}`, buffer);
                manifest.files.push({ path: `config/${name}`, bytes: buffer.length, secret: true });
                manifest.envIncluded = true;
            }
        });
    }

    // ── 4. Status license runtime ──
    const licenseFile = path.join(cwd, 'license_status.json');
    if (fs.existsSync(licenseFile)) {
        const buffer = fs.readFileSync(licenseFile);
        zip.addFile('files/license_status.json', buffer);
        manifest.files.push({ path: 'files/license_status.json', bytes: buffer.length });
    }

    // ── 5. Manifest + checksum ──
    manifest.durationMs = Date.now() - started;
    manifest.totalBytes = manifest.files.reduce((sum, f) => sum + (f.bytes || 0), 0);
    manifest.sha256 = {}; // diisi setelah zip selesai (checksum isi paket)

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
    zip.writeZip(target);

    // checksum file paket (untuk verifikasi integritas saat dipindah)
    const pkgHash = sha256Buffer(fs.readFileSync(target));
    const hashFile = `${target}.sha256`;
    fs.writeFileSync(hashFile, `${pkgHash}  ${path.basename(target)}\n`, 'utf8');

    const size = fs.statSync(target).size;
    return {
        file: target,
        hashFile,
        size,
        sha256: pkgHash,
        manifest,
        durationMs: Date.now() - started,
    };
}

/** Verifikasi paket: checksum file + kelengkapan manifest */
function verifyBackup(file) {
    const target = path.resolve(file);
    if (!fs.existsSync(target)) throw new Error(`Backup tidak ditemukan: ${target}`);

    const result = { file: target, exists: true, hashOk: null, packageOk: true, manifest: null, issues: [] };

    // checksum eksternal
    const hashPath = `${target}.sha256`;
    if (fs.existsSync(hashPath)) {
        const expected = fs.readFileSync(hashPath, 'utf8').trim().split(/\s+/)[0];
        const actual = sha256Buffer(fs.readFileSync(target));
        result.hashOk = expected === actual;
        if (!result.hashOk) result.issues.push('Checksum paket tidak cocok (file mungkin korup / tidak lengkap)');
    } else {
        result.issues.push('File checksum (.sha256) tidak ditemukan');
    }

    try {
        const zip = new AdmZip(target);
        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) {
            result.packageOk = false;
            result.issues.push('manifest.json tidak ada di dalam paket');
            return result;
        }
        result.manifest = JSON.parse(zip.getEntry('manifest.json').getData().toString('utf8'));

        const entries = zip.getEntries();
        const names = new Set(entries.map((e) => e.entryName));
        if (!names.has('db/schema.sql')) {
            result.packageOk = false;
            result.issues.push('db/schema.sql tidak ada');
        }
        if (result.manifest.keysIncluded !== false && !names.has('keys/private.pem')) {
            result.issues.push('PERINGATAN: keys/private.pem tidak ada di paket');
        }

        const tables = (result.manifest.tables || []).length;
        const uploads = result.manifest.uploads ? result.manifest.uploads.count : 0;
        result.summary = {
            tables,
            rows: Object.values(result.manifest.counts || {}).reduce((a, b) => a + b, 0),
            uploadFiles: uploads,
            createdAt: result.manifest.createdAt,
            hasKeys: names.has('keys/private.pem'),
            hasEnv: [...names].some((n) => n.startsWith('config/.env')),
        };
    } catch (e) {
        result.packageOk = false;
        result.issues.push(`Paket tidak bisa dibaca: ${e.message}`);
    }

    return result;
}

/** Kembalikan isi paket (untuk melihat tanpa extract) */
function inspectBackup(file, limit = 200) {
    const target = path.resolve(file);
    const zip = new AdmZip(target);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const manifestEntry = zip.getEntry('manifest.json');
    const manifest = manifestEntry ? JSON.parse(manifestEntry.getData().toString('utf8')) : null;

    return {
        file: target,
        entries: entries.slice(0, limit).map((e) => ({
            name: e.entryName,
            size: e.header.size,
        })),
        totalEntries: entries.length,
        manifest,
    };
}

/**
 * Pulihkan paket.
 * - membuat backup pengaman lebih dulu (opsional, default ya)
 * - --db-only / --files-only untuk-selective
 */
async function restoreBackup(file, options = {}) {
    const {
        cwd = process.cwd(),
        uploadsDir,
        safetyBackup = true,
        dbOnly = false,
        filesOnly = false,
        allowDbMismatch = false,
        onProgress = () => {}
    } = options;

    const target = path.resolve(file);
    if (!fs.existsSync(target)) throw new Error(`Backup tidak ditemukan: ${target}`);

    const zip = new AdmZip(target);
    const manifestEntry = zip.getEntry('manifest.json');
    const manifest = manifestEntry ? JSON.parse(manifestEntry.getData().toString('utf8')) : null;

    // ── GUARD: jangan sampai restore ke database yang salah ──
    const targetDb = process.env.DB_NAME;
    const sourceDb = manifest && manifest.database ? manifest.database.name : null;
    if (!filesOnly && sourceDb && targetDb && sourceDb !== targetDb && !allowDbMismatch) {
        throw new Error(
            `Database tidak cocok!\n` +
            `  backup berasal dari : ${sourceDb}\n` +
            `  database sekarang  : ${targetDb}\n` +
            `  Jalankan ulang dengan --db-name ${sourceDb}, atau --force-db-name bila memang sengaja.`
        );
    }

    const result = {
        file: target,
        manifest,
        sourceDb,
        targetDb,
        safetyBackup: null,
        dbRestored: false,
        tablesRestored: [],
        filesRestored: 0,
    };

    // 1. Backup pengaman
    if (safetyBackup) {
        onProgress({ phase: 'safety', message: 'Membuat backup pengaman…' });
        const { createBackup } = require('./backup');
        result.safetyBackup = await createBackup({
            cwd,
            uploadsDir,
            includeUploads: false,
            includeSecrets: true,
            backupDir: options.backupDir,
            onProgress: () => {},
        });
    }

    // 2. Restore file
    if (!dbOnly && uploadsDir) {
        onProgress({ phase: 'files', total: 0, current: 0 });
        const entries = zip.getEntries().filter((e) => !e.isDirectory && e.entryName.startsWith('files/uploads/'));
        fs.mkdirSync(uploadsDir, { recursive: true });
        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            const rel = entry.entryName.replace('files/uploads/', '');
            const dest = path.join(uploadsDir, rel);
            if (!dest.startsWith(path.resolve(uploadsDir))) continue; // anti path traversal
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, entry.getData());
            result.filesRestored += 1;
            onProgress({ phase: 'files', total: entries.length, current: i + 1 });
        }

        // license_status.json
        const licenseEntry = zip.getEntry('files/license_status.json');
        if (licenseEntry) {
            fs.writeFileSync(path.join(cwd, 'license_status.json'), licenseEntry.getData());
        }
    }

    // 3. Restore database
    if (!filesOnly) {
        onProgress({ phase: 'db', message: 'Memulihkan database…' });
        const mysql = require('mysql2/promise');
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            multipleStatements: true,
            charset: 'utf8mb4',
        });

// Urutan restore data mengikuti dependensi foreign key.
    // Tabel yang tidak terdaftar di sini akan menyusul di akhir (urutan alfabetis).
    const DATA_ORDER = [
        'rhs_users', 'rhs_classes', 'rhs_subjects',
        'rhs_teacher_classes', 'rhs_teacher_subjects',
        'rhs_exam_categories', 'rhs_exams', 'rhs_exam_settings', 'rhs_exam_questions',
        'rhs_exam_classes', 'rhs_exam_attempts', 'rhs_student_answer',
        'rhs_temporary_answer', 'rhs_temporary_answer_archive',
        'rhs_answer_restore_backup', 'rhs_question_bank', 'rhs_question_bank_folders',
        'rhs_web_settings', 'rhs_activity_logs', 'rhs_exam_logs', 'rhs_launch_tokens',
    ];

    try {
        const schemaEntry = zip.getEntry('db/schema.sql');
        if (!schemaEntry) throw new Error('db/schema.sql tidak ada di paket');
        await conn.query(schemaEntry.getData().toString('utf8'));

        // Matikan pengecekan FK selama pemuatan data
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        const rank = (name) => {
            const idx = DATA_ORDER.indexOf(name);
            return idx === -1 ? DATA_ORDER.length : idx;
        };

        const dataEntries = zip.getEntries()
            .filter((e) => !e.isDirectory && e.entryName.startsWith('db/data-'))
            .map((e) => ({
                entry: e,
                table: e.entryName.replace('db/data-', '').replace('.sql', '')
            }))
            .sort((a, b) => {
                const ra = rank(a.table);
                const rb = rank(b.table);
                if (ra !== rb) return ra - rb;
                return a.table.localeCompare(b.table);
            });

        for (let i = 0; i < dataEntries.length; i += 1) {
            const { entry, table } = dataEntries[i];
             
            await conn.query(entry.getData().toString('utf8'));
            result.tablesRestored.push(table);
            onProgress({ phase: 'db', total: dataEntries.length, current: i + 1, table });
        }

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        result.dbRestored = true;
        } finally {
            await conn.end();
        }
    }

    return result;
}

/** Daftar backup yang tersedia */
function listBackups(backupDir) {
    if (!fs.existsSync(backupDir)) return [];
    return fs.readdirSync(backupDir)
        .filter((f) => f.endsWith('.zip'))
        .map((f) => {
            const full = path.join(backupDir, f);
            const stat = fs.statSync(full);
            const hashPath = `${full}.sha256`;
            return {
                file: f,
                path: full,
                size: stat.size,
                createdAt: stat.mtime.toISOString(),
                hasHash: fs.existsSync(hashPath),
            };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Hapus backup lama, sisakan N terakhir */
function pruneBackups(backupDir, keep = 10) {
    const all = listBackups(backupDir);
    const toRemove = all.slice(keep);
    const removed = [];
    toRemove.forEach((b) => {
        fs.unlinkSync(b.path);
        if (fs.existsSync(b.hasHash ? `${b.path}.sha256` : '')) fs.unlinkSync(`${b.path}.sha256`);
        removed.push(b.file);
    });
    return { removed, kept: all.slice(0, keep) };
}

function readPackageVersion(cwd) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
        return pkg.version || null;
    } catch (e) {
        return null;
    }
}

module.exports = {
    createBackup, verifyBackup, inspectBackup, restoreBackup,
    listBackups, pruneBackups, dirSize, countFiles, listFilesRecursive,
    CRITICAL_TABLES, SKIP_TABLES,
};