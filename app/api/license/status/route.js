import { NextResponse } from 'next/server';
import { checkLicenseStatus } from '@/app/lib/license';

export const dynamic = 'force-dynamic';

/**
 * Internal endpoint for middleware to check license status without full auth.
 * We could add a secret header check here for security.
 */
export async function GET(req) {
    const { valid } = await checkLicenseStatus();
    return NextResponse.json({ valid });
}
