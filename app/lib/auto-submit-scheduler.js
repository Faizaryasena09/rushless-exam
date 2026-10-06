import { autoSubmitExpiredAttempts } from './auto-submit';
import { purgeExpiredTempAnswers } from './temp-purge';
import redis, { isRedisReady } from './redis';

/**
 * Scheduler ringan untuk auto-submit.
 *
 *_auto-submit sebelumnya hanya berjalan ketika ada endpoint yang secara
 * berkala memanggil autoSubmitExpiredAttempts() (control panel / timer-stream).
 * Akibatnya attempt bisa menggantung "in_progress" padahal waktunya sudah habis
 * bila tidak ada admin yang membuka panel dan siswa sedang offline.
 *
 * Modul ini menjalankan scan setiap 30 detik selama proses Node hidup.
 * Import modul ini dari route yang UMUM DIEKSEKUSI (SSE stream) supaya
 * interval tetap aktif sepanjang server berjalan.
 */

const SCAN_INTERVAL_MS = Number(process.env.AUTOSUBMIT_INTERVAL_MS) || 30_000;
const SCAN_TIMEOUT_MS = Number(process.env.AUTOSUBMIT_TIMEOUT_MS) || 15_000;
const PURGE_INTERVAL_MS = Number(process.env.ARCHIVE_PURGE_INTERVAL_MS) || 24 * 60 * 60 * 1000;
const PURGE_GATE_KEY = 'scheduler:last_archive_purge';

let lastPurgeAt = 0;

/**
 * Bersihkan arsip jawaban — maksimal sekali per 24 jam.
 * Gate memakai Redis bila tersedia (bertahan lintas restart),
 * fallback ke timestamp modul.
 */
async function maybePurgeArchive() {
    const now = Date.now();

    if (isRedisReady()) {
        // SET NX → hanya proses pertama yang lolos
        const claimed = await redis.set(PURGE_GATE_KEY, String(now), 'PX', PURGE_INTERVAL_MS, 'NX').catch(() => null);
        if (claimed !== 'OK') return null;
    } else {
        if (now - lastPurgeAt < PURGE_INTERVAL_MS) return null;
        lastPurgeAt = now;
    }

    const result = await purgeExpiredTempAnswers();
    console.log(`[Scheduler] Arsip jawaban dibersihkan: ${result.deleted} baris (retensi ${result.retentionDays} hari)`);
    return result;
}

function startScheduler() {
    const state = globalThis.__rushlessAutoSubmitScheduler || {
        timer: null,
        running: false,
        lastRun: 0,
        lastCount: 0,
        lastError: null
    };
    globalThis.__rushlessAutoSubmitScheduler = state;

    if (state.timer) return state;

    const tick = async () => {
        if (state.running) return;
        state.running = true;
        try {
            // 1. Auto-submit attempt yang sudah kehabisan waktu
            const count = await Promise.race([
                autoSubmitExpiredAttempts(),
                new Promise((resolve) => setTimeout(() => resolve(-1), SCAN_TIMEOUT_MS))
            ]);
            state.lastRun = Date.now();
            state.lastCount = typeof count === 'number' ? count : 0;
            state.lastError = count === -1 ? 'timeout' : null;
            if (state.lastCount > 0) {
                console.log(`[AutoSubmitScheduler] ${state.lastCount} attempt auto-submitted.`);
            }

            // 2. Bersihkan arsip jawaban (maks 1x per 24 jam)
            const purge = await maybePurgeArchive().catch(() => null);
            if (purge) state.lastPurge = { at: Date.now(), deleted: purge.deleted };
        } catch (err) {
            state.lastError = err.message;
            console.error('[AutoSubmitScheduler] Error:', err.message);
        } finally {
            state.running = false;
        }
    };

    // Jalankan sekali setelah 10 detik, lalu periodik
    setTimeout(tick, 10_000).unref?.();
    state.timer = setInterval(tick, SCAN_INTERVAL_MS);
    state.timer.unref?.();

    console.log(`[AutoSubmitScheduler] Aktif, interval ${SCAN_INTERVAL_MS / 1000}s`);
    return state;
}

export function getAutoSubmitSchedulerStatus() {
    const state = globalThis.__rushlessAutoSubmitScheduler || {};
    return {
        active: !!state.timer,
        lastRun: state.lastRun || 0,
        lastCount: state.lastCount || 0,
        lastError: state.lastError || null,
        intervalMs: SCAN_INTERVAL_MS,
        lastPurge: state.lastPurge || null,
        purgeIntervalMs: PURGE_INTERVAL_MS
    };
}

export const autoSubmitScheduler = startScheduler();