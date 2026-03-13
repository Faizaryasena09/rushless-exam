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
    const { examId, categoryId } = await request.json();
    
    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    // Optional categoryId (if null, defaults to "Tanpa Nama" category)
    const newCategoryId = categoryId ? parseInt(categoryId) : null;

    // Verify the exam exists
    const examCheck = await query({ query: `SELECT id FROM rhs_exams WHERE id = ?`, values: [examId] });

    if (examCheck.length === 0) {
         return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
    }

    // Move logic
    await query({
      query: `UPDATE rhs_exams SET category_id = ? WHERE id = ?`,
      values: [newCategoryId, examId]
    });

    return NextResponse.json({ message: 'Exam classification updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating exam category:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
