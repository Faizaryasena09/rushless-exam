import { query } from './db';
import redis, { isRedisReady } from './redis';
import { eventBus } from './event-bus';

// Ensure table exists (runs once per cold start)
let tableReady = false;
async function ensureTable() {
    if (tableReady) return;
    try {
        await query({
            query: `CREATE TABLE IF NOT EXISTS rhs_activity_logs (
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
        });
        tableReady = true;
    } catch (err) {
        console.error('[Logger] Failed to ensure table:', err.message);
    }
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
function formatMySQLDate(date = new Date()) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

const ACTIVITY_LOG_QUEUE = 'logs:buffer:activity';
const EXAM_LOG_QUEUE     = 'logs:buffer:exam';

/**
 * General Activity Log (Buffered)
 */
export async function logActivity({ userId = null, username = null, ip = null, action, level = 'info', details = null }) {
    const logEntry = {
        userId,
        username,
        ip,
        action,
        level,
        details: details && typeof details === 'object' ? JSON.stringify(details) : details,
        timestamp: formatMySQLDate()
    };

    if (isRedisReady()) {
        try {
            await redis.lpush(ACTIVITY_LOG_QUEUE, JSON.stringify(logEntry));
            return;
        } catch (err) {
            console.error('[Logger] Redis push failed:', err.message);
        }
    }

    query({
        query: 'INSERT INTO rhs_activity_logs (user_id, username, ip_address, action, level, details) VALUES (?, ?, ?, ?, ?, ?)',
        values: [userId, username, ip, action, level, logEntry.details]
    }).catch(err => console.error('[Logger] MySQL fallback failed:', err.message));
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
            eventBus.emit('log_added', { 
                ...logEntry, 
                id: `temp-${Date.now()}-${Math.random()}` 
            });

            return;
        } catch (err) {
            console.error('[Logger] Exam Redis push failed:', err.message);
        }
    }

    query({
        query: 'INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, ?, ?)',
        values: [attemptId, actionType, description]
    }).catch(err => console.error('[Logger] Exam MySQL fallback failed:', err.message));
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

        const values = [];
        const placeholders = batch.map(log => {
            values.push(log.userId, log.username, log.ip, log.action, log.level, log.details, log.timestamp);
            return '(?, ?, ?, ?, ?, ?, ?)';
        }).join(', ');

        await query({
            query: `INSERT INTO rhs_activity_logs (user_id, username, ip_address, action, level, details, created_at) VALUES ${placeholders}`,
            values
        });
        console.log(`[Logger] Flushed ${batch.length} activity logs.`);
    } catch (err) { console.error('[Logger] Activity flush error:', err.message); }
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
    } catch (err) { console.error('[Logger] Exam flush error:', err.message); }
}

// Background Sync Timer (Sync every 15 seconds)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        flushActivityLogs().catch(() => {});
        flushExamLogs().catch(() => {});
    }, 15000);
}

/**
 * Helper: Log from a request context
 */
export function logFromRequest(request, session, action, level = 'info', details = null) {
    const ip = getClientIP(request);
    const userId = session?.user?.id || null;
    const username = session?.user?.username || null;
    logActivity({ userId, username, ip, action, level, details });
}
