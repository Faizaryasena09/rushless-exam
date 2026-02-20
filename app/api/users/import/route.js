import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import bcrypt from 'bcryptjs';

async function checkAdmin(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    return session.user && session.user.roleName === 'admin';
}

export async function POST(request) {
    if (!await checkAdmin(request)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await request.json(); // Expecting array of { username, password, role, class_name }

        if (!Array.isArray(users) || users.length === 0) {
            return NextResponse.json({ message: 'Invalid data format. Expected an array of users.' }, { status: 400 });
        }

        // 1. Fetch all classes to map class_name (lowercase) to class_id
        const classes = await query({ query: 'SELECT id, class_name FROM rhs_classes' });
        const classMap = new Map();
        classes.forEach(c => classMap.set(c.class_name.toLowerCase().trim(), c.id));

        let successCount = 0;
        let failedCount = 0;
        let errors = [];

        // 2. Process each user
        for (const [index, user] of users.entries()) {
            const { username, name, password, role, class_name } = user;
            const rowNum = index + 2; // Assuming header is row 1

            if (!username || !password || !role) {
                errors.push(`Row ${rowNum}: Missing username, password, or role.`);
                failedCount++;
                continue;
            }

            let class_id = null;
            if (class_name) {
                const normalizedClassName = class_name.toString().toLowerCase().trim();
                if (classMap.has(normalizedClassName)) {
                    class_id = classMap.get(normalizedClassName);
                } else {
                    errors.push(`Row ${rowNum}: Class "${class_name}" not found.`);
                    failedCount++;
                    continue;
                }
            }

            try {
                const hashedPassword = await bcrypt.hash(String(password), 10);
                await query({
                    query: 'INSERT INTO rhs_users (username, name, password, role, class_id) VALUES (?, ?, ?, ?, ?)',
                    values: [username, name || null, hashedPassword, role, class_id]
                });
                successCount++;
            } catch (err) {
                failedCount++;
                if (err.code === 'ER_DUP_ENTRY') {
                    errors.push(`Row ${rowNum}: Username "${username}" already exists.`);
                } else {
                    errors.push(`Row ${rowNum}: Database error for "${username}" - ${err.message}`);
                }
            }
        }

        return NextResponse.json({
            message: `Import processed. Success: ${successCount}, Failed: ${failedCount}`,
            successCount,
            failedCount,
            errors
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ message: 'Failed to import users', error: error.message }, { status: 500 });
    }
}
