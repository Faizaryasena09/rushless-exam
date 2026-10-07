import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, getPoolStats } from '@/app/lib/db';
import redis, { isRedisReady } from '@/app/lib/redis';
import { getFallbackStats, getFallbackFileInfo } from '@/app/lib/log-fallback';
import { logSystemError, logFromRequest } from '@/app/lib/logger';
import { DEFAULT_TIMEZONE } from '@/app/lib/timezone';

// Batas toleransi selisih jam Node <-> MySQL, dalam detik.
// 60 detik masih aman (selisih.common = millisecond + latency modestly).
const CLOCK_SKEW_WARN_SECONDS = 60;

/**
 * Bandingkan jam server Node dengan jam database (NOW()).
 *
 * Penting: seluruh logika timer ujian memakai NOW()/UNIX_TIMESTAMP() dari
 * MySQL, sedangkan display memakai jam Node. Kalau keduanya berbeda jauh,
 * hasil ujian bisa terlihat tidak konsisten dengan yang ditampilkan.
 *
 * Read-only, tidak memblokir apa pun - hanya melaporkan.
 */
async function checkClockSkew() {
    try {
        const startedAt = Date.now();
        const rows = await query({
            query: 'SELECT UNIX_TIMESTAMP() AS db_ts, NOW() AS db_now'
        });
        const roundTripMs = Date.now() - startedAt;

        const dbTs = Number(rows?.[0]?.db_ts);
        if (!Number.isFinite(dbTs)) {
            return { ok: false, error: 'Tidak bisa membaca waktu database' };
        }

        // Samakan titik waktu: tengah-tengah round trip.
        const nodeAtSend = Math.floor(startedAt / 1000) + Math.floor(roundTripMs / 2000);
        const skewSeconds = nodeAtSend - dbTs;

        const absSkew = Math.abs(skewSeconds);
        return {
            ok: absSkew <= CLOCK_SKEW_WARN_SECONDS,
            skewSeconds,
            roundTripMs,
            dbTimestamp: rows[0].db_now,
            nodeTimezone: DEFAULT_TIMEZONE,
            threshold: CLOCK_SKEW_WARN_SECONDS,
        };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Health check infrastruktur: MySQL, Redis, dan lapisan fallback log.
 * Admin only. Dipakai untuk menampilkan banner peringatan di activity logs.
 */
export async function GET(request) {
    let session = null;
    const health = {
        mysql: { ok: false, latencyMs: null, error: null, pool: null },
        redis: { ok: false, latencyMs: null, error: null },
        logFallback: { ok: true, pending: 0, fileWritten: 0, flushedFromBuffer: 0, dropped: 0, lastError: null, lastErrorAt: null, infraEvents: [], fallbackFile: null },
        clockSkew: null,
        checkedAt: new Date().toISOString()
    };

    try {
        const cookieStore = await cookies();
        session = await getIronSession(cookieStore, sessionOptions);
        if (!session.user || session.user.roleName !== 'admin') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        // MySQL
        const started = Date.now();
        try {
            await query({ query: 'SELECT 1 AS ok' });
            health.mysql.ok = true;
            health.mysql.latencyMs = Date.now() - started;
        } catch (err) {
            health.mysql.error = { message: err.message, code: err.code || null, errno: err.errno || null };
        }
        try {
            health.mysql.pool = getPoolStats();
        } catch { /* ignore */ }

        // Redis
        const rStarted = Date.now();
        try {
            if (isRedisReady()) {
                await redis.ping();
                health.redis.ok = true;
                health.redis.latencyMs = Date.now() - rStarted;
            } else {
                health.redis.error = { message: 'Redis belum siap (mode fallback MySQL)' };
            }
        } catch (err) {
            health.redis.error = { message: err.message };
        }

        // Fallback log
        health.logFallback = { ...getFallbackStats(), file: getFallbackFileInfo() };
        health.logFallback.ok = health.logFallback.pending === 0 && !health.logFallback.lastError;
        // Log ujian juga punya antrean fallback sendiri
        health.logFallback.pendingExam = health.logFallback.pendingExam || 0;
        health.logFallback.pendingActivity = health.logFallback.pendingActivity || 0;

        // Selisih jam server vs database (read-only, tidak memblokir)
        if (health.mysql.ok) {
            health.clockSkew = await checkClockSkew();

            // Catat ke activity log kalau meleset, supaya ada jejaknya.
            if (health.clockSkew?.ok === false && health.clockSkew.skewSeconds) {
                logFromRequest(request, session, 'SYSTEM_CLOCK_SKEW', 'warn', {
                    skewSeconds: health.clockSkew.skewSeconds,
                    nodeTimezone: health.clockSkew.nodeTimezone,
                    dbTimestamp: health.clockSkew.dbTimestamp,
                    details: `Jam server meleset ${health.clockSkew.skewSeconds} detik dari database`,
                });
            }
        }

        return NextResponse.json(health);
    } catch (error) {
        await logSystemError(error, {
            action: 'SYSTEM_HEALTH_CHECK_FAILED',
            request,
            session,
            context: { endpoint: '/api/system-health' }
        });
        return NextResponse.json({ message: 'Failed to check health' }, { status: 500 });
    }
}