/**
 * Next.js instrumentation — menangkap error global (unhandled) dari server,
 * route handler, dan render, lalu menyimpannya ke activity log (level error)
 * supaya terlihat di halaman /dashboard/activity-logs.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { ensureActivityLogsSchema } = await import('@/app/lib/activity-log-schema');
        ensureActivityLogsSchema().catch((err) => {
            console.error('[Instrumentation] Gagal menyiapkan skema activity log:', err.message);
        });
    }
}

export async function onRequestError(error, request, context) {
    try {
        const { logSystemError } = await import('@/app/lib/logger');
        const runtime = context?.runtime || 'unknown';
        const pathname = request?.path || (request?.page ? `/server-components/${request.page}` : null);
        const search = request?.searchParams || '';

        await logSystemError(error, {
            action: 'SYSTEM_REQUEST_ERROR',
            context: {
                runtime,
                pathname,
                search,
                routerKind: context?.routerKind || null,
                routeType: context?.routeType || null,
                renderSource: context?.renderSource || null,
                revalidateReason: context?.revalidateReason || null
            },
            statusCode: 500
        });
    } catch (logErr) {
        console.error('[Instrumentation] Gagal menulis request error log:', logErr?.message || logErr);
    }
}