'use strict';

/**
 * Perintah database: status skema & migrasi DDL.
 *
 * db:migrate menjalankan migrasi yang sama dengan tombol "Setup" di Dashboard,
 * tanpa harus menyalakan UI. Aman diulang (idempotent).
 */

const db = require('../lib/db');
const { humanBytes } = require('../lib/output');

const MIGRATIONS = [
    {
        name: 'Widen selected_option ke TEXT (rhs_temporary_answer)',
        run: async () => db.execute(
            'ALTER TABLE rhs_temporary_answer MODIFY COLUMN selected_option TEXT NULL DEFAULT NULL'
        ),
    },
    {
        name: 'Widen selected_option ke TEXT (rhs_student_answer)',
        run: async () => db.execute(
            'ALTER TABLE rhs_student_answer MODIFY COLUMN selected_option TEXT NOT NULL'
        ),
    },
    {
        name: 'Pastikan kolom score_earned (rhs_student_answer)',
        run: async () => db.execute(
            'ALTER TABLE rhs_student_answer ADD COLUMN score_earned FLOAT NOT NULL DEFAULT 0'
        ),
    },
    {
        name: 'Bersihkan duplikat jawaban sebelum unique key',
        run: async () => db.execute(
            `DELETE a FROM rhs_student_answer a
             JOIN rhs_student_answer b
               ON a.attempt_id = b.attempt_id
              AND a.question_id = b.question_id
              AND a.id > b.id`
        ),
    },
    {
        name: 'Tambah UNIQUE (attempt_id, question_id)',
        run: async () => db.execute(
            'ALTER TABLE rhs_student_answer ADD UNIQUE KEY unique_attempt_question (attempt_id, question_id)'
        ),
    },
    {
        name: 'Tambah kolom last_login (rhs_users)',
        run: async () => db.execute(
            'ALTER TABLE rhs_users ADD COLUMN last_login DATETIME NULL DEFAULT NULL'
        ),
    },
    {
        name: 'Buat tabel arsip jawaban (rhs_temporary_answer_archive)',
        run: async () => db.execute(
            `CREATE TABLE IF NOT EXISTS rhs_temporary_answer_archive (
                id INT AUTO_INCREMENT PRIMARY KEY,
                attempt_id INT NOT NULL,
                user_id INT NOT NULL,
                exam_id INT NOT NULL,
                question_id INT NOT NULL,
                selected_option TEXT,
                answer_source VARCHAR(32) NOT NULL DEFAULT 'submit',
                username VARCHAR(255),
                student_name VARCHAR(255),
                exam_name VARCHAR(255),
                class_name VARCHAR(255),
                created_at DATETIME NULL DEFAULT NULL,
                archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_attempt_question (attempt_id, question_id),
                INDEX idx_archived_at (archived_at),
                INDEX idx_user (user_id),
                INDEX idx_exam (exam_id)
            )`
        ),
    },
    {
        name: 'Buat tabel backup pemulihan (rhs_answer_restore_backup)',
        run: async () => db.execute(
            `CREATE TABLE IF NOT EXISTS rhs_answer_restore_backup (
                id INT AUTO_INCREMENT PRIMARY KEY,
                attempt_id INT NOT NULL,
                user_id INT NOT NULL,
                exam_id INT NOT NULL,
                question_id INT NOT NULL,
                selected_option TEXT,
                is_correct BOOLEAN NOT NULL DEFAULT 0,
                score_earned FLOAT NOT NULL DEFAULT 0,
                restored_by VARCHAR(255),
                restore_mode VARCHAR(20),
                is_undone TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_attempt (attempt_id),
                INDEX idx_created (created_at)
            )`
        ),
    },
    {
        name: 'Buat tabel activity log (rhs_activity_logs)',
        run: async () => db.execute(
            `CREATE TABLE IF NOT EXISTS rhs_activity_logs (
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
        ),
    },
    {
        name: 'Perlebar correct_option (rhs_exam_questions)',
        run: async () => db.execute(
            'ALTER TABLE rhs_exam_questions MODIFY COLUMN correct_option VARCHAR(255) NOT NULL'
        ),
    },
];

const commands = [
    // ─────────────────────────────────────────────────────────────
    {
        name: 'db:status',
        description: 'Status koneksi & skema database',
        usage: 'rhsls db:status [--json]',
        async run(ctx) {
            const latency = await db.ping();
            const tables = await db.listTables();
            const totalRows = tables.reduce((sum, t) => sum + Number(t.approx_rows || 0), 0);
            const totalSize = tables.reduce((sum, t) => sum + Number(t.size_bytes || 0), 0);

            const version = await db.queryOne('SELECT VERSION() AS v, @@sql_mode AS sql_mode');
            const schema = await db.query(
                `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
                        CHARACTER_MAXIMUM_LENGTH AS length
                 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME IN ('rhs_student_answer','rhs_temporary_answer','rhs_exam_questions','rhs_users')
                   AND COLUMN_NAME IN ('selected_option','correct_option','last_login','score_earned')
                 ORDER BY TABLE_NAME, COLUMN_NAME`
            );
            const indexes = await db.query(
                `SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name
                 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND NON_UNIQUE = 0
                 ORDER BY TABLE_NAME, INDEX_NAME`
            );

            ctx.out.emit({
                latency,
                server: version,
                tables: tables.length,
                approxRows: totalRows,
                sizeBytes: totalSize,
                schema,
                indexes
            });

            ctx.out.title('Status Database');
            ctx.out.keyValues([
                ['Host', `${ctx.dbConfig.host}:${ctx.dbConfig.port}`],
                ['Database', ctx.dbConfig.database],
                ['User', ctx.dbConfig.user],
                ['Versi server', version.v],
                ['Latensi', `${latency} ms`],
                ['Jumlah tabel', tables.length],
                ['Perkiraan baris', totalRows.toLocaleString('id-ID')],
                ['Perkiraan ukuran', humanBytes(totalSize)]
            ]);

            ctx.out.section('Kolom kritis');
            ctx.out.table(schema.map((r) => ({
                tabel: r.table_name,
                kolom: r.column_name,
                tipe: r.data_type + (r.length ? `(${r.length})` : '')
            })), ['tabel', 'kolom', 'tipe']);

            ctx.out.section('Tabel terbesar');
            ctx.out.table(
                tables.slice().sort((a, b) => Number(b.size_bytes) - Number(a.size_bytes)).slice(0, 8)
                    .map((t) => ({
                        tabel: t.name,
                        baris: Number(t.approx_rows || 0).toLocaleString('id-ID'),
                        ukuran: humanBytes(t.size_bytes),
                        engine: t.engine
                    })),
                ['tabel', 'baris', 'ukuran', 'engine']
            );
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'db:migrate',
        aliases: ['migrate', 'setup'],
        description: 'Jalankan migrasi skema (idempotent, aman diulang)',
        usage: 'rhsls db:migrate [--dry-run] [--yes]',
        examples: ['rhsls db:migrate', 'rhsls db:migrate --dry-run'],
        async run(ctx) {
            const { out } = ctx;

            out.title('Migrasi Database');
            out.info('Semua migrasi bersifat idempotent — yang sudah ada akan dilewati.');
            out.line();

            if (ctx.flags['dry-run']) {
                out.section('Rencana migrasi');
                MIGRATIONS.forEach((m, i) => out.line(`  ${i + 1}. ${m.name}`));
                out.line();
                out.warn('DRY RUN — tidak ada perubahan.');
                out.emit({ dryRun: true, count: MIGRATIONS.length });
                return;
            }

            await ctx.confirmAction(`${MIGRATIONS.length} migrasi akan dijalankan.`);

            const applied = [];
            const skipped = [];

            for (const migration of MIGRATIONS) {
                try {
                     
                    await migration.run();
                    applied.push(migration.name);
                    out.success(migration.name);
                } catch (err) {
                    const code = err.code || '';
                    // "sudah ada" dianggap sukses
                    if (code === 'ER_DUP_FIELDNAME' || code === 'ER_DUP_KEYNAME' ||
                        code === 'ER_DUP_INDEXNAME' || code === 'ER_TABLE_EXISTS_ERROR' ||
                        /duplicate|already exists/i.test(err.message)) {
                        skipped.push(migration.name);
                        out.dim(`  ↳ ${migration.name} — sudah ada, dilewati`);
                    } else {
                        out.warn(`  ↳ ${migration.name} GAGAL: ${err.message}`);
                        skipped.push(`${migration.name} (gagal: ${err.message})`);
                    }
                }
            }

            await db.logActivity({
                username: 'cli', action: 'DB_MIGRATE_CLI', level: 'warn',
                details: `${applied.length} diterapkan, ${skipped.length} dilewati`
            });

            out.emit({ applied, skipped });
            out.summary(applied.length, skipped.length, 'migrasi');
            out.info('Restart aplikasi bila ada perubahan struktural: pm2 restart rushless-exam');
        }
    },

    // ─────────────────────────────────────────────────────────────
    {
        name: 'db:optimize',
        description: 'Optimasi tabel (membersihkan ruang setelah banyak DELETE)',
        usage: 'rhsls db:optimize [--table rhs_activity_logs] [--yes]',
        examples: ['rhsls db:optimize --table rhs_activity_logs --yes'],
        async run(ctx) {
            const { flags, out } = ctx;
            let tables;

            if (flags.table) {
                tables = [flags.table];
            } else {
                const before = await db.listTables();
                tables = before
                    .slice()
                    .sort((a, b) => Number(b.size_bytes) - Number(a.size_bytes))
                    .slice(0, 5)
                    .map((t) => t.name);
            }

            out.title('Optimasi Tabel');
            out.info(`Tabel: ${tables.join(', ')}`);
            out.warn('Operasi ini bisa mengunci tabel awhile depending on ukuran data.');

            if (flags['dry-run']) {
                out.warn('DRY RUN — tidak ada yang dijalankan.');
                out.emit({ dryRun: true, tables });
                return;
            }

            await ctx.confirmAction(`Akan menjalankan OPTIMIZE TABLE pada ${tables.length} tabel.`);

            const spinner = out.spinner('Mengoptimasi…');
            const results = [];
            for (const table of tables) {
                try {
                     
                    await db.execute(`OPTIMIZE TABLE \`${table.replace(/`/g, '``')}\``);
                    results.push({ table, ok: true });
                } catch (e) {
                    results.push({ table, ok: false, error: e.message });
                }
            }
            spinner.stop();

            out.emit({ results });
            out.table(results.map((r) => ({
                tabel: r.table,
                status: r.ok ? out.ok('OK') : out.bad(r.error)
            })), ['tabel', 'status']);
            out.line();
        }
    }
];

module.exports = { commands, MIGRATIONS };