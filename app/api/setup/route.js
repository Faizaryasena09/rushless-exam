import { NextResponse } from 'next/server';
import { query, setupDatabase } from '@/app/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    // 1. Ensure database and table exist
    await setupDatabase();

    // 2. Check if the default class already exists
    let classes = await query({
      query: 'SELECT * FROM rhs_classes WHERE class_name = ?',
      values: ['Default Class'],
    });

    // 3. If not, create the default class
    if (classes.length === 0) {
      await query({
        query: 'INSERT INTO rhs_classes (class_name) VALUES (?)',
        values: ['Default Class'],
      });
      classes = await query({
        query: 'SELECT * FROM rhs_classes WHERE class_name = ?',
        values: ['Default Class'],
      });
    }

    const defaultClassId = classes[0].id;

    // 4. Check if the admin user already exists
    const users = await query({
      query: 'SELECT * FROM users WHERE username = ?',
      values: ['admin'],
    });

    // 5. If not, create the admin user
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password', 10);
      await query({
        query: 'INSERT INTO users (username, password, role, class_id) VALUES (?, ?, ?, ?)',
        values: ['admin', hashedPassword, 'admin', defaultClassId],
      });
      return NextResponse.json({ message: 'Database, table, and admin user are all set up!' }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Setup was already complete. Admin user exists.' }, { status: 200 });
    }

  } catch (error) {
    return NextResponse.json({ error: `Setup failed: ${error.message}` }, { status: 500 });
  }
}
