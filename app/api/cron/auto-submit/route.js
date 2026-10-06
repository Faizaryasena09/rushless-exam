import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { autoSubmitExpiredAttempts } from '@/app/lib/auto-submit';
import { getAutoSubmitSchedulerStatus } from '@/app/lib/auto-submit-scheduler';

export const dynamic = 'force-dynamic';

/**
 * Endpoint trigger auto-submit.
 *
 * - Bisa dipanggil admin dari halaman mana saja (dashboard).
 * - Bisa dipanggil cron eksternal dengan header x-cron-key
 *   (nilainya set di env AUTOSUBMIT_CRON_KEY).
 *
 * Catatan: Next.js sudah menjalankan scanner otomatis setiap 30 detik
 * (app/lib/auto-submit-scheduler.js), jadi endpoint ini hanya cadangan
 * bila aplikasi dijalankan tanpa interval background (mis. multi-instance
 * dengan inaktivasi timer).
 */
export async function GET(request) {
    const cronKey = request.headers.get('x-cron-key');
    const expectedKey = process.env.AUTOSUBMIT_CRON_KEY;

    let authorized = !!(expectedKey && cronKey && cronKey === expectedKey);

    if (!authorized) {
        try {
            const cookieStore = await cookies();
            const session = await getIronSession(cookieStore, sessionOptions);
            authorized = !!session.user && ['admin'].includes(session.user.roleName);
        } catch (e) {
            authorized = false;
        }
    }

    if (!authorized) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const count = await autoSubmitExpiredAttempts();
        return NextResponse.json({
            ok: true,
            submitted: count,
            scheduler: getAutoSubmitSchedulerStatus(),
            checkedAt: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({ message: 'Auto-submit failed', error: error.message }, { status: 500 });
    }
}