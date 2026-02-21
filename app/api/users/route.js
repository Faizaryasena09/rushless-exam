import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import bcrypt from 'bcryptjs';
import { logFromRequest, getClientIP } from '@/app/lib/logger';

async function getAdminSession(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  if (!session.user || session.user.roleName !== 'admin') return null;
  return session;
}

export async function GET(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const search = searchParams.get('search');

    let baseQuery = `
      SELECT u.id, u.username, u.name, u.role, u.class_id, c.class_name
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
      whereClauses.push('(u.username LIKE ? OR u.name LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
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
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username, name, password, role, class_id } = await request.json();
    if (!username || !password || !role) {
      return NextResponse.json({ message: 'Username, password, and role are required' }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query({
      query: 'INSERT INTO rhs_users (username, name, password, role, class_id) VALUES (?, ?, ?, ?, ?)',
      values: [username, name || null, hashedPassword, role, class_id],
    });

    logFromRequest(request, session, 'USER_CREATE', 'info', { targetUser: username, role });

    return NextResponse.json({ id: result.insertId, username, name, role, class_id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to create user', error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, username, name, password, role, class_id, is_locked } = await request.json();
    if (!id || !username || !role) {
      return NextResponse.json({ message: 'ID, username, and role are required' }, { status: 400 });
    }

    let q = 'UPDATE rhs_users SET username = ?, name = ?, role = ?, class_id = ?';
    const values = [username, name || null, role, class_id];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      q += ', password = ?';
      values.push(hashedPassword);
    }

    if (typeof is_locked === 'boolean') {
      q += ', is_locked = ?';
      values.push(is_locked);
    }

    q += ' WHERE id = ?';
    values.push(id);

    await query({ query: q, values });

    // Log specific actions
    if (typeof is_locked === 'boolean') {
      logFromRequest(request, session, is_locked ? 'USER_LOCK' : 'USER_UNLOCK', 'warn', { targetUser: username });
    } else {
      logFromRequest(request, session, 'USER_UPDATE', 'info', { targetUser: username, passwordChanged: !!password });
    }

    return NextResponse.json({ id, username, name, role, class_id });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update user', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }

    // Get username before deleting for the log
    const users = await query({ query: 'SELECT username FROM rhs_users WHERE id = ?', values: [id] });
    const targetUser = users.length > 0 ? users[0].username : `id:${id}`;

    await query({
      query: 'DELETE FROM rhs_users WHERE id = ?',
      values: [id],
    });

    logFromRequest(request, session, 'USER_DELETE', 'warn', { targetUser });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete user', error: error.message }, { status: 500 });
  }
}