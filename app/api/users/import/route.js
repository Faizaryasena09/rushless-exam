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
        const createdClasses = [];

        /**
         * Memastikan kelas ada. Kalau belum, kelas dibuat otomatis lalu dipakai.
         * Pencocokan nama kelas bersifat case-insensitive (XII IPA 1 = xii ipa 1).
         * @returns {Promise<number|null>} class_id
         */
        const resolveClassId = async (rawName, rowNum) => {
            const original = rawName.toString().trim();
            if (!original) return null;
            const normalized = original.toLowerCase();

            if (classMap.has(normalized)) {
                return classMap.get(normalized);
            }

            try {
                const result = await query({
                    query: 'INSERT INTO rhs_classes (class_name) VALUES (?)',
                    values: [original]
                });
                classMap.set(normalized, result.insertId);
                createdClasses.push({ name: original, row: rowNum });
                return result.insertId;
            } catch (err) {
                // Race condition: kelas dibuat proses lain / beda kapitalisasi (UNIQUE di MySQL)
                // Cari ulang dengan pembanding case-insensitive.
                const refreshed = await query({
                    query: 'SELECT id, class_name FROM rhs_classes WHERE LOWER(class_name) = ?',
                    values: [normalized]
                });
                if (refreshed.length > 0) {
                    classMap.set(normalized, refreshed[0].id);
                    return refreshed[0].id;
                }
                console.error('Gagal membuat kelas:', original, err.message);
                return null;
            }
        };

        // 2. Process each user
        for (const [index, user] of users.entries()) {
            const { username, name, password, role, class_name } = user;
            const rowNum = index + 2; // Assuming header is row 1

            if (!username || !password || !role) {
                errors.push({ type: 'MISSING_DATA', row: rowNum });
                failedCount++;
                continue;
            }

            const normalizedRole = String(role).toLowerCase().trim();
            if (!['student', 'teacher', 'admin'].includes(normalizedRole)) {
                errors.push({ type: 'INVALID_ROLE', row: rowNum, value: role });
                failedCount++;
                continue;
            }

            // Siswa wajib punya kelas (kelas akan dibuat otomatis bila belum ada)
            if (normalizedRole === 'student' && !class_name) {
                errors.push({ type: 'MISSING_CLASS', row: rowNum, value: username });
                failedCount++;
                continue;
            }

            let class_id = null;
            if (class_name) {
                class_id = await resolveClassId(class_name, rowNum);
                if (!class_id) {
                    errors.push({ type: 'CLASS_CREATE_FAILED', row: rowNum, value: class_name });
                    failedCount++;
                    continue;
                }
            }

            try {
                const hashedPassword = await bcrypt.hash(String(password), 10);
                await query({
                    query: 'INSERT INTO rhs_users (username, name, password, role, class_id) VALUES (?, ?, ?, ?, ?)',
                    values: [username, name || null, hashedPassword, normalizedRole, class_id]
                });
                successCount++;
            } catch (err) {
                failedCount++;
                if (err.code === 'ER_DUP_ENTRY') {
                    errors.push({ type: 'DUPLICATE_USERNAME', row: rowNum, value: username });
                } else {
                    errors.push({ type: 'DB_ERROR', row: rowNum, value: username, msg: err.message });
                }
            }
        }

        return NextResponse.json({
            message: `Import processed. Success: ${successCount}, Failed: ${failedCount}`,
            successCount,
            failedCount,
            createdClasses,
            errors
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ message: 'Failed to import users', error: error.message }, { status: 500 });
    }
}
