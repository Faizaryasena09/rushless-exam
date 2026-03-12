import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';

export async function PUT(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { categoryId, isHidden } = await request.json();

    if (!categoryId || isHidden === undefined) {
      return NextResponse.json({ message: 'Category ID and visibility status are required' }, { status: 400 });
    }

    let updateQuery = `UPDATE rhs_exam_categories SET is_hidden = ? WHERE id = ?`;
    let queryValues = [isHidden, categoryId];

    if (session.user.roleName === 'teacher') {
        updateQuery += ` AND created_by = ?`;
        queryValues.push(session.user.id);
    }

    const result = await query({ query: updateQuery, values: queryValues });

    if (result.affectedRows === 0) {
        return NextResponse.json({ message: 'Category not found or unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ message: 'Category visibility updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating category visibility:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
