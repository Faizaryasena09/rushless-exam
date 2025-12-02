import { NextResponse } from 'next/server';
import { query, setupDatabase } from '@/app/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    // 1. Ensure database and table exist
    await setupDatabase();

    // 2. Check if the admin user already exists
    const users = await query({
      query: 'SELECT * FROM users WHERE username = ?',
      values: ['admin'],
    });

    // 3. If not, create the admin user
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password', 10);
      await query({
        query: 'INSERT INTO users (username, password) VALUES (?, ?)',
        values: ['admin', hashedPassword],
      });
      return NextResponse.json({ message: 'Database, table, and admin user are all set up!' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Setup was already complete. Admin user exists.' }, { status: 200 });
    }

  } catch (error) {
    return NextResponse.json({ error: `Setup failed: ${error.message}` }, { status: 500 });
  }
}
