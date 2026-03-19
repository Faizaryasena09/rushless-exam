import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import redis, { isRedisReady } from '@/app/lib/redis';

export async function PUT(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { categoryId, isHidden, isAdminHidden } = await request.json();

    if (!categoryId) {
      return NextResponse.json({ message: 'Category ID is required' }, { status: 400 });
    }

    let updateFields = [];
    let queryValues = [];

    if (isHidden !== undefined) {
      updateFields.push("is_hidden = ?");
      queryValues.push(isHidden);
    }

    if (isAdminHidden !== undefined) {
      if (session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized: Only admins can hide from teachers.' }, { status: 403 });
      }
      updateFields.push("is_admin_hidden = ?");
      queryValues.push(isAdminHidden);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
    }

    queryValues.push(categoryId);

    let updateQuery = `UPDATE rhs_exam_categories SET ${updateFields.join(', ')} WHERE id = ?`;

    if (session.user.roleName === 'teacher') {
      updateQuery += ` AND created_by = ?`;
      queryValues.push(session.user.id);
    }

    const result = await query({ query: updateQuery, values: queryValues });

    if (result.affectedRows === 0) {
      return NextResponse.json({ message: 'Category not found or unauthorized' }, { status: 403 });
    }

    // Invalidate Redis Cache for exam lists
    if (isRedisReady()) {
      redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null).catch(() => { });
    }

    return NextResponse.json({ message: 'Category visibility updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating category visibility:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
