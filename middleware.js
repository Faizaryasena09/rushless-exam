import { NextResponse } from 'next/server';

/**
 * Middleware for license enforcement and routing logic.
 *
 * CATATAN PERFORMA: middleware berjalan di Edge Runtime, jadi tidak bisa
 * memakai mysql2. Karena itu status lisensi diambil lewat HTTP internal.
 * Hasilnya di-cache sebentar di memory edge supaya tidak satu request HTTP
 * (plus satu query DB) per request pengguna.
 */
const LICENSE_CACHE_TTL_MS = 15000;
const LICENSE_CACHE_KEY = '__rushlessLicenseCache';

function readLicenseCache() {
    try {
        const entry = globalThis[LICENSE_CACHE_KEY];
        if (!entry) return null;
        if (Date.now() >= entry.expiresAt) return null;
        return entry.value;
    } catch {
        return null;
    }
}

function writeLicenseCache(value) {
    try {
        globalThis[LICENSE_CACHE_KEY] = {
            value,
            expiresAt: Date.now() + LICENSE_CACHE_TTL_MS,
        };
    } catch {
        // Cache hanya bersifat optimal; kalau gagal, diabaikan saja.
    }
}

/**
 * Menjalankan seluruh aturan middleware.
 */
export async function middleware(req) {
    const { pathname } = req.nextUrl;

    // 1. Bypass static files and essential endpoints
    const isStatic = pathname.startsWith('/_next') || 
                    pathname.startsWith('/public') || 
                    pathname.includes('.') || 
                    pathname.startsWith('/api/web-settings') ||
                    pathname.startsWith('/Logo'); // Custom logo paths

    if (isStatic) return NextResponse.next();

    // 2. Bypass essential login and license paths
    const bypassPaths = [
        '/',
        '/api/login',
        '/api/user-session',
        '/api/license/status', 
        '/api/license',
        '/dashboard/license',
        '/support'
    ];

    if (bypassPaths.some(bp => pathname === bp || pathname.startsWith(bp))) {
        return NextResponse.next();
    }

    // 3. Check License Status
    // Cache hasilnya supaya tidak memanggil API internal (yang menyentuh DB)
    // untuk setiap request. Data lisensi jarang berubah, jadi TTL pendek cukup.
    let valid = readLicenseCache();
    if (valid === null) {
        try {
            const origin = req.nextUrl.origin;
            const res = await fetch(`${origin}/api/license/status`, {
                headers: { 'x-internal-check': 'true' } // Could use a secret here
            });

            if (res.ok) {
                const body = await res.json();
                valid = !!body.valid;
                writeLicenseCache(valid);
            } else {
                valid = null; // jangan cache respons gagal
            }
        } catch (error) {
            console.error('Middleware license check failed:', error);
            // Fallback: If status check fails, assume locked for safety? 
            // Or let it through? Usually better to lock.
            valid = null;
        }
    }

    if (valid === false) {
        // License is dead. Block everything else.
        // If it's a dashboard request, redirect to web-settings (Admin Tools).
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/api')) {
            const target = '/dashboard/web-settings';
            if (pathname !== target && !pathname.startsWith('/api/license')) {
                return NextResponse.redirect(new URL(target, req.url));
            }
        }

        // For other routes (like students taking exams), redirect to login.
        if (pathname !== '/') {
            return NextResponse.redirect(new URL('/', req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
