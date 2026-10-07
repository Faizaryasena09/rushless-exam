/**
 * Fallback logging lapis ketiga.
 *
 * Skenario yang ditangani:
 *  - Redis mati            -> tulis MySQL langsung (lihat logger.js)
 *  - Redis + MySQL mati -> log disimpan ke file JSONL + antrean memori,
 *                         lalu otomatis di-flush ulang saat DB pulih
 *
 * Modul ini SENGAJA tidak meng-import apa pun (tidak ada siklus import)
 * supaya bisa dipakai dari db.js, redis.js, dan logger.js sekaligus.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const FALLBACK_DIR = path.join(process.cwd(), 'logs', 'system');
const MAX_PENDING = 500;            // batas antrean memori
const MAX_INFRA_PER_WINDOW = 20;    // batas penulisan error infra per jendela waktu
const INFRA_WINDOW_MS = 60 * 1000;
const RETRY_LIMIT = 10;             // maksimal percobaan flush per entri
const REPLAY_FILE_DAYS = 2;         // berapa hari file fallback di-replay saat startup

const pending = [];
const infraEvents = [];
const infraWindow = { count: 0, resetAt: Date.now() + INFRA_WINDOW_MS };

const stats = {
    fileWritten: 0,     // entri yang berhasil ditulis ke file fallback
    flushedFromBuffer: 0, // entri yang tersimpan kembali ke MySQL setelah DB pulih
    dropped: 0,         // entri yang hilang (buffer penuh / retry habis)
    lastErrorAt: null,
    lastError: null
};

function ensureDir() {
    if (!fs.existsSync(FALLBACK_DIR)) {
        fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
}

function fileFor(date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return path.join(FALLBACK_DIR, `activity-fallback-${day}.log`);
}

/**
 * Tulis satu entri log ke file JSONL. Tidak pernah melempar error.
 */
function writeToFile(entry, tag = 'activity') {
    try {
        ensureDir();
        const record = { tag, savedAt: new Date().toISOString(), ...entry };
        fs.appendFileSync(fileFor(), JSON.stringify(record) + '\n', 'utf8');
        stats.fileWritten += 1;
        return true;
    } catch (err) {
        stats.lastError = err.message;
        stats.lastErrorAt = new Date().toISOString();
        return false;
    }
}

/**
 * Simpan entri log activity yang gagal dikirim ke MySQL/Redis.
 */
export function queueFallbackActivity(entry) {
    pushPending({ table: 'activity', ...entry });
}

/**
 * Simpan entri log ujian yang gagal dikirim ke MySQL/Redis.
 */
export function queueFallbackExam(entry) {
    pushPending({ table: 'exam', ...entry });
}

function pushPending(entry) {
    const record = { fallbackId: randomUUID(), ...entry };
    pending.push({ ...record, attempts: 0, queuedAt: Date.now() });

    if (pending.length > MAX_PENDING) {
        const dropped = pending.shift();
        stats.dropped += 1;
        writeToFile(dropped, 'dropped');
        return;
    }

    writeToFile(record, entry.table);
}

/**
 * Catat error infrastruktur (DB/Redis/file) langsung ke file.
 * Dibatasi agar tidak membanjiri file saat server benar-benar tumbang.
 */
export function recordInfraError(source, error, extra = {}) {
    const now = Date.now();
    if (now > infraWindow.resetAt) {
        infraWindow.count = 0;
        infraWindow.resetAt = now + INFRA_WINDOW_MS;
    }
    if (infraWindow.count >= MAX_INFRA_PER_WINDOW) {
        stats.dropped += 1;
        return;
    }
    infraWindow.count += 1;

    const errObj = error instanceof Error ? error : new Error(String(error?.message || error || 'unknown'));
    const entry = {
        source,
        errorName: errObj.name || 'Error',
        message: errObj.message,
        code: error?.code ?? null,
        errno: error?.errno ?? null,
        at: new Date().toISOString(),
        ...extra
    };

    infraEvents.push(entry);
    if (infraEvents.length > 50) infraEvents.shift();

    writeToFile(entry, 'infra');
    stats.lastError = errObj.message;
    stats.lastErrorAt = entry.at;

    console.error(`[Infra][${source}] ${errObj.message}${error?.code ? ` (${error.code})` : ''}`);
}

const ACTIVITY_INSERT = `INSERT IGNORE INTO rhs_activity_logs
    (user_id, username, ip_address, action, level, details, request_id, method, path, status_code, user_agent, error_name, stack_trace, duration_ms, fallback_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const EXAM_INSERT = `INSERT IGNORE INTO rhs_exam_logs
    (attempt_id, action_type, description, fallback_id, created_at)
    VALUES (?, ?, ?, ?, ?)`;

function buildInsert(entry) {
    if (entry.table === 'exam') {
        return {
            query: EXAM_INSERT,
            values: [entry.attemptId, entry.actionType, entry.description, entry.fallbackId, entry.timestamp]
        };
    }
    return {
        query: ACTIVITY_INSERT,
        values: [
            entry.userId, entry.username, entry.ip, entry.action, entry.level, entry.details,
            entry.requestId, entry.method, entry.path, entry.statusCode, entry.userAgent,
            entry.errorName, entry.stackTrace, entry.durationMs, entry.fallbackId, entry.timestamp
        ]
    };
}

/**
 * Coba kirim ulang antrean fallback ke MySQL.
 * Dipanggil berkala oleh logger.js. Return jumlah entri yang berhasil.
 */
export async function flushFallbackActivity(queryFn) {
    if (!queryFn || pending.length === 0) return 0;

    let flushed = 0;
    while (pending.length > 0) {
        const entry = pending[0];
        entry.attempts += 1;

        try {
            const { query: sql, values } = buildInsert(entry);
            await queryFn({ query: sql, values });
            pending.shift();
            flushed += 1;
            stats.flushedFromBuffer += 1;
        } catch (err) {
            // DB masih tidak tersedia -> jangan dipaksa coba lagi.
            if (entry.attempts >= RETRY_LIMIT) {
                pending.shift();
                stats.dropped += 1;
                writeToFile(entry, 'dropped');
            }
            if (isOverload(err)) recordInfraError('db-flush-backlog', err);
            break;
        }
    }

    return flushed;
}

/**
 * Replay file fallback ke MySQL. Dipanggil sekali saat server start supaya
 * log yang tertinggal di file (mis. server mati total) tetap masuk database.
 * Aman: memakai fallback_id unik + INSERT IGNORE, jadi tidak ada duplikat.
 */
export async function replayFallbackFromDisk(queryFn) {
    if (!queryFn) return { replayed: 0, skipped: 0 };

    let replayed = 0;
    let skipped = 0;

    try {
        ensureDir();
        for (let dayOffset = 0; dayOffset < REPLAY_FILE_DAYS; dayOffset++) {
            const file = fileFor(new Date(Date.now() - dayOffset * 86400000));
            if (!fs.existsSync(file)) continue;

            const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
            for (const line of lines) {
                const record = safeParse(line);
                if (!record || !record.fallbackId) { skipped += 1; continue; }
                if (record.tag !== 'activity' && record.tag !== 'exam') continue; // infra/dropped tidak masuk tabel log

                const { query: sql, values } = buildInsert({ table: record.tag, ...record });
                try {
                    await queryFn({ query: sql, values });
                    replayed += 1;
                } catch (err) {
                    if (isOverload(err)) {
                        recordInfraError('db-fallback-replay', err);
                        return { replayed, skipped };
                    }
                    skipped += 1; // mis. kolom/tabel belum siap
                }
            }
        }
    } catch (err) {
        recordInfraError('fallback-replay', err);
    }

    stats.flushedFromBuffer += replayed;
    return { replayed, skipped };
}

function isOverload(err) {
    return !!err && (
        err.errno === 1040 || // Too many connections
        err.code === 'ER_CON_COUNT_ERROR' ||
        err.code === 'ER_TOO_MANY_USER_CONNECTIONS' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'PROTOCOL_CONNECTION_LOST'
    );
}

/** Statistik fallback untuk UI/diagnostics. */
export function getFallbackStats() {
    const pendingActivity = pending.filter((e) => e.table !== 'exam').length;
    const pendingExam = pending.length - pendingActivity;
    return {
        pending: pending.length,
        pendingActivity,
        pendingExam,
        ...stats,
        infraEvents: infraEvents.slice(-10).reverse(),
        fallbackDir: FALLBACK_DIR,
        fallbackFile: fileFor()
    };
}

/** Baca jumlah baris terakhir pada file fallback (untuk UI). */
export function getFallbackFileInfo() {
    try {
        const file = fileFor();
        if (!fs.existsSync(file)) return { exists: false, lines: 0, file };
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        const last = lines.length ? safeParse(lines[lines.length - 1]) : null;
        return { exists: true, lines: lines.length, file, last: last ? last.savedAt : null };
    } catch (err) {
        return { exists: false, lines: 0, file: fileFor(), error: err.message };
    }
}

function safeParse(str) {
    try { return JSON.parse(str); } catch { return null; }
}