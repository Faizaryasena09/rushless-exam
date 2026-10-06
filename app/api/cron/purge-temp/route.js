import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { purgeExpiredTempAnswers, TEMP_RETENTION_DAYS } from '@/app/lib/temp-purge';
import { getArchiveStats } from '@/app/lib/temp-archive';

export const dynamic = 'force-dynamic';

/**
 * Trigger pembersihan arsip jawaban (> 30 hari).
 *
 * - Sudah otomatis dijalankan scheduler setiap 24 jam
 *   (app/lib/auto-submit-scheduler.js), jadi endpoint ini hanya cadangan.
 * - Bisa dipanggil admin dari halaman Arsip Jawaban, atau cron eksternal
 *   dengan header x-cron-key (env TEMP_PURGE_CRON_KEY).
 *
 * Contoh cron (harian pukul 03:00):
 *   0 3 * * * curl -s -H "x-cron-key: RAHASIA" https://domain/api/cron/purge-temp
 */
export async function GET(request) {
    const purgeKey = request.headers.get('x-cron-key');
    const expectedKey = process.env.TEMP_PURGE_CRON_KEY;

    let authorized = !!(expectedKey && purgeKey && purgeKey === expectedKey);

    if (!authorized) {
        try {
            const cookieStore = await cookies();
            const session = await getIronSession(cookieStore, sessionOptions);
            authorized = !!session.user && session.user.roleName === 'admin';
        } catch (e) {
            authorized = false;
        }
    }

    if (!authorized) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await purgeExpiredTempAnswers();
        const stats = await getArchiveStats();

        return NextResponse.json({
            ok: !result.error,
            ...result,
            retentionDays: result.retentionDays || TEMP_RETENTION_DAYS,
            archiveTotal: stats.total,
            archiveOldest: stats.oldest,
            checkedAt: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ message: 'Purge failed', error: error.message }, { status: 500 });
    }
}