
import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request) {
    try {
        // Generate fresh hash for 'admin123'
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Upsert admin user
        // This handles both cases:
        // 1. User 'admin' doesn't exist -> Insert it
        // 2. User 'admin' exists -> Update password (fix incorrect password issues)
        await query({
            query: `
            INSERT INTO rhs_users (username, password, role) 
            VALUES ('admin', ?, 'admin') 
            ON DUPLICATE KEY UPDATE password = ?
        `,
            values: [hashedPassword, hashedPassword]
        });

        return NextResponse.json({
            message: 'Admin user successfully configured.',
            credentials: {
                username: 'admin',
                password: 'admin123'
            },
            info: 'Please delete this route file (app/api/setup-admin/route.js) after successful login for security.'
        });

    } catch (error) {
        console.error('Setup admin failed:', error);
        return NextResponse.json({
            message: 'Failed to setup admin user',
            error: error.message
        }, { status: 500 });
    }
}
