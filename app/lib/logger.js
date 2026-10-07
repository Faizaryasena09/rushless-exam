import { query } from './db';
import { DEFAULT_TIMEZONE } from './timezone';
import redis, { isRedisReady } from './redis';
import { publish } from './redis-pubsub';
import { ensureActivityLogsSchema } from './activity-log-schema';
import { queueFallbackActivity, queueFallbackExam, flushFallbackActivity, replayFallbackFromDisk, recordInfraError } from './log-fallback';

// Ensure table + kolom baru tersedia (runs once per cold start)
async function ensureTable() {
    await ensureActivityLogsSchema();
}

/**
 * Normalize IP — strip IPv6-mapped IPv4 prefix and convert ::1 to 127.0.0.1
 */
function normalizeIP(ip) {
    if (!ip) return '127.0.0.1';
    ip = ip.trim();
    // Strip ::ffff: prefix (IPv6-mapped IPv4)
    if (ip.startsWith('::ffff:')) {
        ip = ip.slice(7);
    }
    // Convert IPv6 localhost to IPv4
    if (ip === '::1') {
        ip = '127.0.0.1';
    }
    return ip;
}

/**
 * Extract client IP address from request headers
 */
export function getClientIP(request) {
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP) return normalizeIP(cfIP);

    const trueClientIP = request.headers.get('true-client-ip');
    if (trueClientIP) return normalizeIP(trueClientIP);

    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return normalizeIP(forwarded.split(',')[0]);
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) return normalizeIP(realIP);

    return '127.0.0.1';
}

/**
 * Format Date to MySQL compatible YYYY-MM-DD HH:MM:SS
 */
export function formatMySQLDate(date = new Date()) {
    // sv-SE locale secara alami memformat jadi YYYY-MM-DD HH:MM:SS.
    // Zona waktu diambil dari satu sumber kebenaran (app/lib/timezone.js),
    // yang nilainya berasal dari env TZ / APP_TIMEZONE.
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: DEFAULT_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date).replace('T', ' ');
}

const ACTIVITY_LOG_QUEUE = 'logs:buffer:activity';
const EXAM_LOG_QUEUE     = 'logs:buffer:exam';

/**
 * General Activity Log (Buffered)
 */
export async function logActivity({
    userId = null,
    username = null,
    ip = null,
    action,
    level = 'info',
    details = null,
    requestId = null,
    method = null,
    path = null,
    statusCode = null,
    userAgent = null,
    errorName = null,
    stackTrace = null,
    durationMs = null
}) {
    const logEntry = {
        userId,
        username,
        ip,
        action,
        level,
        details: details && typeof details === 'object' ? JSON.stringify(details) : details,
        requestId,
        method,
        path,
        statusCode,
        userAgent,
        errorName,
        stackTrace,
        durationMs,
        timestamp: formatMySQLDate()
    };

    if (isRedisReady()) {
        try {
            await redis.lpush(ACTIVITY_LOG_QUEUE, JSON.stringify(logEntry));
            return;
        } catch (err) {
            recordInfraError('redis-activity-buffer', err, { note: 'Fallback ke MySQL' });
        }
    }

    await ensureTable();
    query({
        query: `INSERT INTO rhs_activity_logs
            (user_id, username, ip_address, action, level, details, request_id, method, path, status_code, user_agent, error_name, stack_trace, duration_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
            logEntry.userId, logEntry.username, logEntry.ip, logEntry.action, logEntry.level, logEntry.details,
            logEntry.requestId, logEntry.method, logEntry.path, logEntry.statusCode, logEntry.userAgent,
            logEntry.errorName, logEntry.stackTrace, logEntry.durationMs, logEntry.timestamp
        ]
    }).catch(err => {
        // MySQL tidak bisa menerima log (mati / max connections / pool penuh).
        // Simpan ke file JSONL + antrean memori agar tidak hilang, lalu
        // otomatis dikirim ulang ke DB saat koneksi pulih.
        recordInfraError('mysql-activity-insert', err, { note: 'Log disimpan ke fallback file' });
        queueFallbackActivity(logEntry);
    });
}

/**
 * Exam Specific Log (Buffered + Real-time Recent List)
 */
export async function logExamActivity({ attemptId, actionType, description }) {
    const logEntry = {
        attemptId,
        actionType,
        description,
        timestamp: formatMySQLDate()
    };

    if (isRedisReady()) {
        try {
            const multi = redis.multi();
            // 1. Push to global flush queue (for MySQL sync)
            multi.lpush(EXAM_LOG_QUEUE, JSON.stringify(logEntry));
            
            // 2. Push to per-attempt "recent" list (for instant admin view)
            const recentKey = `exam:logs:recent:${attemptId}`;
            multi.lpush(recentKey, JSON.stringify(logEntry));
            multi.ltrim(recentKey, 0, 49); // Keep only last 50 logs
            multi.expire(recentKey, 600);   // Live for 10 minutes
            
            await multi.exec();

            // 3. Emit event for SSE streams (Real-time No Polling)
            publish('log_added', { 
                ...logEntry, 
                id: `temp-${Date.now()}-${Math.random()}` 
            });

            return;
        } catch (err) {
            recordInfraError('redis-exam-buffer', err, { note: 'Fallback ke MySQL' });
        }
    }

    await ensureTable();
    query({
        query: 'INSERT INTO rhs_exam_logs (attempt_id, action_type, description, created_at) VALUES (?, ?, ?, ?)',
        values: [attemptId, actionType, description, logEntry.timestamp]
    }).catch(err => {
        // MySQL tidak bisa menerima log -> simpan ke file + antrean memori
        recordInfraError('mysql-exam-insert', err, { note: 'Log ujian disimpan ke fallback file' });
        queueFallbackExam(logEntry);
    });
}

/**
 * Flush Activity Logs to MySQL
 */
export async function flushActivityLogs() {
    if (!isRedisReady()) return;
    try {
        const batch = [];
        for (let i = 0; i < 100; i++) {
            const rawLog = await redis.rpop(ACTIVITY_LOG_QUEUE);
            if (!rawLog) break;
            batch.push(JSON.parse(rawLog));
        }
        if (batch.length === 0) return;

        await ensureTable();
        const values = [];
        const placeholders = batch.map(log => {
            values.push(
                log.userId, log.username, log.ip, log.action, log.level, log.details,
                log.requestId, log.method, log.path, log.statusCode, log.userAgent,
                log.errorName, log.stackTrace, log.durationMs, log.timestamp
            );
            return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        }).join(', ');

        await query({
            query: `INSERT INTO rhs_activity_logs
                (user_id, username, ip_address, action, level, details, request_id, method, path, status_code, user_agent, error_name, stack_trace, duration_ms, created_at)
                VALUES ${placeholders}`,
            values
        });
        console.log(`[Logger] Flushed ${batch.length} activity logs.`);
    } catch (err) { recordInfraError('redis-activity-flush', err); }
}

/**
 * Flush Exam Logs to MySQL
 */
export async function flushExamLogs() {
    if (!isRedisReady()) return;
    try {
        const batch = [];
        for (let i = 0; i < 100; i++) {
            const rawLog = await redis.rpop(EXAM_LOG_QUEUE);
            if (!rawLog) break;
            batch.push(JSON.parse(rawLog));
        }
        if (batch.length === 0) return;

        const values = [];
        const placeholders = batch.map(log => {
            values.push(log.attemptId, log.actionType, log.description, log.timestamp);
            return '(?, ?, ?, ?)';
        }).join(', ');

        await query({
            query: `INSERT INTO rhs_exam_logs (attempt_id, action_type, description, created_at) VALUES ${placeholders}`,
            values
        });
        console.log(`[Logger] Flushed ${batch.length} exam logs.`);
    } catch (err) { recordInfraError('redis-exam-flush', err); }
}

// Background Sync Timer (Sync every 15 seconds)
// Saat server start: kirim ulang log fallback yang tertinggal di file
// (mis. server mati total sebelum sempat flush ke database).
(async () => {
    try {
        await ensureTable();
        const result = await replayFallbackFromDisk(query);
        if (result.replayed > 0) {
            console.log('[Logger] Replay fallback log:', result.replayed, 'entri dipulihkan ke database.');
        }
    } catch (err) {
        recordInfraError('fallback-replay-startup', err);
    }
})();

if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        flushActivityLogs().catch(() => {});
        flushExamLogs().catch(() => {});
        // Antrean fallback: kirim ulang log yang gagal ditulis saat DB/Redis mati
        flushFallbackActivity(query).catch(() => {});
    }, 15000);
}

/**
 * Helper: Log from a request context
 * Otomatis mengisi IP, user, request id, HTTP method, path, dan user agent.
 */
export function logFromRequest(request, session, action, level = 'info', details = null, extra = {}) {
    const ip = getClientIP(request);
    const userId = session?.user?.id || null;
    const username = session?.user?.username || null;
    const requestId = request.headers?.get?.('x-request-id') || extra.requestId || null;

    logActivity({
        userId,
        username,
        ip,
        action,
        level,
        details,
        requestId,
        method: request.method || null,
        path: safePath(request),
        statusCode: extra.statusCode ?? null,
        userAgent: request.headers?.get?.('user-agent') || null,
        durationMs: extra.durationMs ?? null
    });
}

function safePath(request) {
    try {
        const url = new URL(request.url);
        return `${url.pathname}${url.search}`.slice(0, 255);
    } catch {
        return null;
    }
}

/**
 * Helper: Catat error sistem (level = error) lengkap dengan stack trace,
 * nama error, route, HTTP method, dan user agent.
 *
 * Nama aksi mengikuti konvensi: SYSTEM_ERROR_<AREA> atau SYSTEM_<EVENT>
 */
export async function logSystemError(error, {
    action = 'SYSTEM_ERROR',
    request = null,
    session = null,
    context = null,
    statusCode = null,
    durationMs = null,
    level = 'error'
} = {}) {
    try {
        const errObj = error instanceof Error ? error : new Error(String(error?.message || error || 'Unknown error'));
        const extraDetails = {
            message: errObj.message,
            context: context || undefined,
            runtime: process.version,
            at: formatMySQLDate()
        };

        logActivity({
            userId: session?.user?.id || null,
            username: session?.user?.username || null,
            ip: request ? getClientIP(request) : null,
            action,
            level,
            details: extraDetails,
            requestId: request?.headers?.get?.('x-request-id') || null,
            method: request?.method || null,
            path: request ? safePath(request) : null,
            statusCode,
            userAgent: request?.headers?.get?.('user-agent') || null,
            errorName: errObj.name || null,
            stackTrace: errObj.stack ? String(errObj.stack).slice(0, 60000) : null,
            durationMs
        });
    } catch (logErr) {
        // Never let logging break the caller.
        console.error('[Logger] Gagal mencatat system error:', logErr.message);
    }
}
