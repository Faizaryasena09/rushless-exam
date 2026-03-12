import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

async function checkAdmin(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  return session.user && session.user.roleName === 'admin';
}

export async function GET(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    let subjects;
    if (session.user.roleName === 'admin') {
        subjects = await query({ query: 'SELECT * FROM rhs_subjects ORDER BY name ASC' });
    } else if (session.user.roleName === 'teacher') {
        subjects = await query({
            query: `
                SELECT s.* 
                FROM rhs_subjects s 
                INNER JOIN rhs_teacher_subjects ts ON s.id = ts.subject_id 
                WHERE ts.teacher_id = ?
                ORDER BY s.name ASC
            `,
            values: [session.user.id]
        });
    } else {
        // Students should be able to see subjects if needed for UI filtering/mapping.
        // For now, let's query all subjects for students or just restrict.
        subjects = await query({ query: 'SELECT * FROM rhs_subjects ORDER BY name ASC' });
    }

    return NextResponse.json(subjects);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve subjects', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'Subject name is required' }, { status: 400 });
    }
    const result = await query({
      query: 'INSERT INTO rhs_subjects (name) VALUES (?)',
      values: [name.trim()],
    });
    return NextResponse.json({ id: result.insertId, name: name.trim() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to create subject', error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name } = await request.json();
    if (!id || !name || name.trim() === '') {
      return NextResponse.json({ message: 'ID and subject name are required' }, { status: 400 });
    }
    await query({
      query: 'UPDATE rhs_subjects SET name = ? WHERE id = ?',
      values: [name.trim(), id],
    });
    return NextResponse.json({ id, name: name.trim() });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update subject', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'ID is required' }, { status: 400 });
  }

  try {
    await query({
      query: 'DELETE FROM rhs_subjects WHERE id = ?',
      values: [id],
    });
    return NextResponse.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete subject', error: error.message }, { status: 500 });
  }
}
