import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';

export async function GET(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    let categoriesQuery = `SELECT id, name, created_by, created_at, is_hidden FROM rhs_exam_categories`;
    let queryValues = [];

    // All roles (admin and teacher) can view all categories to use them.
    categoriesQuery += ` ORDER BY created_at ASC`;

    const categories = await query({ query: categoriesQuery, values: queryValues });

    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'Category name is required' }, { status: 400 });
    }

    const result = await query({
      query: `INSERT INTO rhs_exam_categories (name, created_by) VALUES (?, ?)`,
      values: [name.trim(), session.user.id]
    });

    return NextResponse.json({ id: result.insertId, name: name.trim() }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name } = await request.json();
    if (!id || !name || name.trim() === '') {
      return NextResponse.json({ message: 'Invalid data' }, { status: 400 });
    }

    // Admins can update any, teachers only their own
    let updateQuery = `UPDATE rhs_exam_categories SET name = ? WHERE id = ?`;
    let queryValues = [name.trim(), id];

    if (session.user.roleName === 'teacher') {
        updateQuery += ` AND created_by = ?`;
        queryValues.push(session.user.id);
    }

    const result = await query({ query: updateQuery, values: queryValues });

    if (result.affectedRows === 0) {
        return NextResponse.json({ message: 'Category not found or unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ message: 'Category updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Category ID is required' }, { status: 400 });
  }

  try {
    let deleteQuery = `DELETE FROM rhs_exam_categories WHERE id = ?`;
    let queryValues = [id];

    if (session.user.roleName === 'teacher') {
        deleteQuery += ` AND created_by = ?`;
        queryValues.push(session.user.id);
    }

    const result = await query({ query: deleteQuery, values: queryValues });

    if (result.affectedRows === 0) {
        return NextResponse.json({ message: 'Category not found or unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ message: 'Category deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
