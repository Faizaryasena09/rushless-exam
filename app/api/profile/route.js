import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
import bcrypt from 'bcryptjs';

async function getSession() {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    if (!session.user) return null;
    const isValid = await validateUserSession(session);
    if (!isValid) return null;
    return session;
}

// GET — Fetch current user's profile
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const users = await query({
            query: `SELECT u.id, u.username, u.name, u.role, u.class_id, c.class_name, u.createdAt
              FROM rhs_users u
              LEFT JOIN rhs_classes c ON u.class_id = c.id
              WHERE u.id = ?`,
            values: [session.user.id],
        });

        if (users.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const user = users[0];
        return NextResponse.json({
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            class_id: user.class_id,
            class_name: user.class_name,
            createdAt: user.createdAt,
        });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to fetch profile', error: error.message }, { status: 500 });
    }
}

// PUT — Update password or username
export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;
        const userId = session.user.id;

        // Fetch current user password hash
        const users = await query({
            query: 'SELECT password FROM rhs_users WHERE id = ?',
            values: [userId],
        });

        if (users.length === 0) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const currentPasswordHash = users[0].password;

        // --- Change Password ---
        if (action === 'change-password') {
            const { currentPassword, newPassword, confirmPassword } = body;

            if (!currentPassword || !newPassword || !confirmPassword) {
                return NextResponse.json({ message: 'Semua field harus diisi.' }, { status: 400 });
            }

            if (newPassword !== confirmPassword) {
                return NextResponse.json({ message: 'Konfirmasi password tidak cocok.' }, { status: 400 });
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, currentPasswordHash);
            if (!isPasswordValid) {
                return NextResponse.json({ message: 'Password saat ini salah.' }, { status: 403 });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await query({
                query: 'UPDATE rhs_users SET password = ? WHERE id = ?',
                values: [hashedPassword, userId],
            });

            return NextResponse.json({ message: 'Password berhasil diubah.' });
        }

        // --- Change Username ---
        if (action === 'change-username') {
            const { currentPassword, newUsername } = body;

            if (!currentPassword || !newUsername) {
                return NextResponse.json({ message: 'Semua field harus diisi.' }, { status: 400 });
            }

            if (newUsername.length < 3) {
                return NextResponse.json({ message: 'Username baru minimal 3 karakter.' }, { status: 400 });
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, currentPasswordHash);
            if (!isPasswordValid) {
                return NextResponse.json({ message: 'Password saat ini salah.' }, { status: 403 });
            }

            // Check if username is taken
            const existing = await query({
                query: 'SELECT id FROM rhs_users WHERE username = ? AND id != ?',
                values: [newUsername, userId],
            });

            if (existing.length > 0) {
                return NextResponse.json({ message: 'Username sudah digunakan.' }, { status: 409 });
            }

            await query({
                query: 'UPDATE rhs_users SET username = ? WHERE id = ?',
                values: [newUsername, userId],
            });

            // Update session
            session.user.username = newUsername;
            await session.save();

            return NextResponse.json({ message: 'Username berhasil diubah.', username: newUsername });
        }

        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to update profile', error: error.message }, { status: 500 });
    }
}
