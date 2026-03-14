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
    let categoriesQuery = `SELECT id, name, created_by, created_at, is_hidden, sort_order FROM rhs_exam_categories`;
    let queryValues = [];

    // Order by sort_order
    categoriesQuery += ` ORDER BY sort_order ASC, created_at ASC`;

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

    // Get the max sort_order to append this category at the end
    const maxSortResult = await query({ query: `SELECT MAX(sort_order) as maxSort FROM rhs_exam_categories` });
    const nextSort = (maxSortResult[0].maxSort || 0) + 1;

    const result = await query({
      query: `INSERT INTO rhs_exam_categories (name, created_by, sort_order) VALUES (?, ?, ?)`,
      values: [name.trim(), session.user.id, nextSort]
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

export async function PATCH(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderedIds } = await request.json(); // Array of category IDs in the new desired order
    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json({ message: 'Invalid data: orderedIds array required' }, { status: 400 });
    }

    const { transaction } = require('@/app/lib/db');

    if (session.user.roleName === 'admin') {
        // Admin: Simple bulk update of sort_order for all provided categories
        await transaction(async (tQuery) => {
            for (let i = 0; i < orderedIds.length; i++) {
                await tQuery({
                    query: `UPDATE rhs_exam_categories SET sort_order = ? WHERE id = ?`,
                    values: [i + 1, orderedIds[i]]
                });
            }
        });
    } else {
        // Teacher: Can only reorder their own categories relative to each other
        // 1. Get all categories owned by this teacher
        const myCategories = await query({
            query: `SELECT id, sort_order FROM rhs_exam_categories WHERE created_by = ? ORDER BY sort_order ASC`,
            values: [session.user.id]
        });

        const myIds = myCategories.map(c => c.id);
        const mySortOrders = myCategories.map(c => c.sort_order).sort((a, b) => a - b);

        // 2. Validate that orderedIds only contains categories owned by the teacher
        const unauthorized = orderedIds.find(id => !myIds.includes(Number(id)));
        if (unauthorized) {
            return NextResponse.json({ message: 'Unauthorized: You can only reorder your own categories.' }, { status: 403 });
        }

        // 3. Update their sort_orders using the pool of sort_orders they already occupy
        await transaction(async (tQuery) => {
            for (let i = 0; i < orderedIds.length; i++) {
                await tQuery({
                    query: `UPDATE rhs_exam_categories SET sort_order = ? WHERE id = ? AND created_by = ?`,
                    values: [mySortOrders[i], orderedIds[i], session.user.id]
                });
            }
        });
    }

    return NextResponse.json({ message: 'Reordered successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error reordering categories:', error);
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
