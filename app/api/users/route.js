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

export async function GET(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const search = searchParams.get('search');

    let baseQuery = `
      SELECT u.id, u.username, u.role, u.class_id, c.class_name
      FROM rhs_users u
      LEFT JOIN rhs_classes c ON u.class_id = c.id
    `;
    const whereClauses = [];
    const values = [];

    if (classId) {
      whereClauses.push('u.class_id = ?');
      values.push(classId);
    }

    if (search) {
      whereClauses.push('u.username LIKE ?');
      values.push(`%${search}%`);
    }

    if (whereClauses.length > 0) {
      baseQuery += ' WHERE ' + whereClauses.join(' AND ');
    }

    const users = await query({
      query: baseQuery,
      values,
    });

    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve users', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username, password, role, class_id } = await request.json();
    if (!username || !password || !role) {
      return NextResponse.json({ message: 'Username, password, and role are required' }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query({
      query: 'INSERT INTO rhs_users (username, password, role, class_id) VALUES (?, ?, ?, ?)',
      values: [username, hashedPassword, role, class_id],
    });
    return NextResponse.json({ id: result.insertId, username, role, class_id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to create user', error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, username, password, role, class_id } = await request.json();
    if (!id || !username || !role) {
      return NextResponse.json({ message: 'ID, username, and role are required' }, { status: 400 });
    }

    let q = 'UPDATE rhs_users SET username = ?, role = ?, class_id = ?';
    const values = [username, role, class_id];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      q += ', password = ?';
      values.push(hashedPassword);
    }

    q += ' WHERE id = ?';
    values.push(id);

    await query({ query: q, values });
    return NextResponse.json({ id, username, role, class_id });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update user', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }
    await query({
      query: 'DELETE FROM rhs_users WHERE id = ?',
      values: [id],
    });
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete user', error: error.message }, { status: 500 });
  }
}