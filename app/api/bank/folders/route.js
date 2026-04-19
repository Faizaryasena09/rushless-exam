import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET handler to fetch folders
export async function GET(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Teachers see their own folders + Admin folders
    // Admins see all folders
    let foldersQuery = `SELECT * FROM rhs_question_bank_folders`;
    let values = [];

    if (session.user.roleName === 'teacher') {
      foldersQuery += ` WHERE created_by = ? OR created_by IN (SELECT id FROM rhs_users WHERE role = 'admin')`;
      values.push(session.user.id);
    }
    
    foldersQuery += ` ORDER BY sort_order ASC, name ASC`;

    const folders = await query({ query: foldersQuery, values });
    return NextResponse.json(folders);
  } catch (error) {
    console.error('Error fetching bank folders:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST handler to create a folder
export async function POST(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, parent_id } = await request.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'Folder name is required' }, { status: 400 });
    }

    const result = await query({
      query: `INSERT INTO rhs_question_bank_folders (name, parent_id, created_by) VALUES (?, ?, ?)`,
      values: [name.trim(), parent_id || null, session.user.id]
    });

    return NextResponse.json({ id: result.insertId, name: name.trim(), parent_id: parent_id || null }, { status: 201 });
  } catch (error) {
    console.error('Error creating bank folder:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT handler to update a folder
export async function PUT(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, name, parent_id } = await request.json();
    if (!id || !name || name.trim() === '') {
      return NextResponse.json({ message: 'Invalid data' }, { status: 400 });
    }

    // Auth check: Teachers can only update their own folders
    if (session.user.roleName === 'teacher') {
      const folder = await query({
        query: `SELECT created_by FROM rhs_question_bank_folders WHERE id = ?`,
        values: [id]
      });
      if (!folder.length || folder[0].created_by !== session.user.id) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
      }
    }

    await query({
      query: `UPDATE rhs_question_bank_folders SET name = ?, parent_id = ? WHERE id = ?`,
      values: [name.trim(), parent_id || null, id]
    });

    return NextResponse.json({ message: 'Folder updated successfully' });
  } catch (error) {
    console.error('Error updating bank folder:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE handler to remove a folder
export async function DELETE(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Folder ID is required' }, { status: 400 });
  }

  try {
    // Auth check: Teachers can only delete their own folders
    if (session.user.roleName === 'teacher') {
      const folder = await query({
        query: `SELECT created_by FROM rhs_question_bank_folders WHERE id = ?`,
        values: [id]
      });
      if (!folder.length || folder[0].created_by !== session.user.id) {
        return NextResponse.json({ message: 'Forbidden: You can only delete your own folders' }, { status: 403 });
      }
    }

    await query({
      query: `DELETE FROM rhs_question_bank_folders WHERE id = ?`,
      values: [id]
    });

    return NextResponse.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting bank folder:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
