'use strict';

/**
 * Koneksi database & helper query untuk rhsls.
 * Pakai mysql2 langsung (CLI tidak bisa import app/lib/*.js karena ESM).
 */

const mysql = require('mysql2/promise');

let pool = null;
let closed = false;

function config() {
    return {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 15000,
        charset: 'utf8mb4',
        dateStrings: true,
    };
}

function hasConfig() {
    const c = config();
    return !!(c.host && c.user && c.password && c.database);
}

async function getPool() {
    if (!hasConfig()) {
        const err = new Error(
            'Konfigurasi database tidak lengkap. Pastikan DB_HOST, DB_USER, DB_PASSWORD, DB_NAME tersedia (.env.local / .env / environment).'
        );
        err.code = 'RHSLS_NO_DB_CONFIG';
        throw err;
    }
    if (!pool) {
        pool = mysql.createPool(config());
    }
    return pool;
}

async function query(sql, values = []) {
    if (closed) throw new Error('Koneksi database sudah ditutup');
    const p = await getPool();
    const [rows] = await p.execute(sql, values);
    return rows;
}

async function queryOne(sql, values = []) {
    const rows = await query(sql, values);
    return rows && rows.length ? rows[0] : null;
}

async function execute(sql, values = []) {
    const p = await getPool();
    const [result] = await p.execute(sql, values);
    return result;
}

/** Jalankan beberapa query dalam satu transaksi */
async function transaction(fn) {
    const p = await getPool();
    const conn = await p.getConnection();
    try {
        await conn.beginTransaction();
        const txQuery = async (sql, values = []) => {
            const [rows] = await conn.execute(sql, values);
            return rows;
        };
        const result = await fn(txQuery);
        await conn.commit();
        return result;
    } catch (err) {
        try { await conn.rollback(); } catch (e) { /* ignore */ }
        throw err;
    } finally {
        conn.release();
    }
}

async function ping() {
    const started = Date.now();
    await query('SELECT 1 AS ok');
    return Date.now() - started;
}

/** Daftar tabel yang ada di database aktif */
async function listTables() {
    return query(
        `SELECT TABLE_NAME AS name, TABLE_ROWS AS approx_rows,
                (DATA_LENGTH + INDEX_LENGTH) AS size_bytes, ENGINE AS engine
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
         ORDER BY TABLE_NAME`
    );
}

async function tableExists(table) {
    const row = await queryOne(
        `SELECT COUNT(*) AS c FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
    );
    return !!row && Number(row.c) > 0;
}

/** Catat aktivitas CLI ke rhs_activity_logs (jika tabel tersedia) */
async function logActivity({ userId = null, username = null, action, level = 'info', details = null, ip = 'cli' }) {
    try {
        if (!(await tableExists('rhs_activity_logs'))) return;
        await execute(
            `INSERT INTO rhs_activity_logs (user_id, username, ip_address, action, level, details)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, username, ip, action, level, details]
        );
    } catch (e) {
        // logging tidak boleh menggagalkan operasi
    }
}

async function close() {
    if (pool) {
        try {
            await pool.end();
        } catch (e) {
            // abaikan: proses sedang keluar
        }
        pool = null;
    }
    closed = true;
}

/** Escape nilai untuk SQL dump */
function escapeValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;

    let str = String(value);
    str = str.replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\x00/g, '\\0')
        .replace(/\x1a/g, '\\Z');
    return `'${str}'`;
}

/** Escape identifier tabel/kolom */
function escapeId(name) {
    return '`' + String(name).replace(/`/g, '``') + '`';
}

module.exports = {
    getPool, query, queryOne, execute, transaction, ping,
    listTables, tableExists, logActivity, close,
    escapeValue, escapeId, hasConfig, config,
};