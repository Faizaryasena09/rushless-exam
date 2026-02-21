import { query } from './db';

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
 * Supports: Cloudflare, nginx, and standard proxies
 */
export function getClientIP(request) {
    // Cloudflare-specific headers (highest priority when behind CF tunnel)
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP) return normalizeIP(cfIP);

    const trueClientIP = request.headers.get('true-client-ip');
    if (trueClientIP) return normalizeIP(trueClientIP);

    // Standard proxy headers
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return normalizeIP(forwarded.split(',')[0]);
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) return normalizeIP(realIP);

    return '127.0.0.1';
}

/**
 * Log an activity to the database (fire-and-forget)
 */
export function logActivity({ userId = null, username = null, ip = null, action, level = 'info', details = null }) {
    const detailsStr = details && typeof details === 'object' ? JSON.stringify(details) : details;

    // Fire-and-forget — don't await, don't block the response
    ensureTable().then(() => {
        query({
            query: 'INSERT INTO rhs_activity_logs (user_id, username, ip_address, action, level, details) VALUES (?, ?, ?, ?, ?, ?)',
            values: [userId, username, ip, action, level, detailsStr]
        }).catch(err => {
            console.error('[Logger] Failed to write activity log:', err.message);
        });
    });
}

/**
 * Helper: Log from a request context with session info
 */
export function logFromRequest(request, session, action, level = 'info', details = null) {
    const ip = getClientIP(request);
    const userId = session?.user?.id || null;
    const username = session?.user?.username || null;
    logActivity({ userId, username, ip, action, level, details });
}
