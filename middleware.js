import { NextResponse } from 'next/server';

/**
 * Middleware for license enforcement and routing logic.
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
    // We fetch our internal status check API. 
    // In production, we'd use a more performant way like a global variable or cache.
    try {
        const origin = req.nextUrl.origin;
        const res = await fetch(`${origin}/api/license/status`, {
            headers: { 'x-internal-check': 'true' } // Could use a secret here
        });
        
        if (res.ok) {
            const { valid } = await res.json();
            
            if (!valid) {
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
        }
    } catch (error) {
        console.error('Middleware license check failed:', error);
        // Fallback: If status check fails, assume locked for safety? 
        // Or let it through? Usually better to lock.
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
