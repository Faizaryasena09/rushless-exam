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

// GET handler to fetch questions in a folder
export async function GET(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folder_id');

  if (!folderId) {
    return NextResponse.json({ message: 'Folder ID is required' }, { status: 400 });
  }

  try {
    const questions = await query({
      query: `SELECT * FROM rhs_question_bank WHERE folder_id = ? ORDER BY created_at DESC`,
      values: [folderId]
    });
    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching bank questions:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// POST handler to create a question in the bank
export async function POST(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { 
      folder_id, 
      question_text, 
      options, 
      correct_option, 
      question_type, 
      points, 
      scoring_strategy, 
      scoring_metadata 
    } = await request.json();

    if (!folder_id || !question_text) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const result = await query({
      query: `INSERT INTO rhs_question_bank (
        folder_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        folder_id,
        question_text,
        JSON.stringify(options || {}),
        correct_option || '',
        question_type || 'multiple_choice',
        points || 1.0,
        scoring_strategy || 'standard',
        scoring_metadata ? JSON.stringify(scoring_metadata) : null,
        session.user.id
      ]
    });

    return NextResponse.json({ id: result.insertId, message: 'Question added to bank' }, { status: 201 });
  } catch (error) {
    console.error('Error creating bank question:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT handler to update a bank question
export async function PUT(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { 
      id, 
      folder_id, 
      question_text, 
      options, 
      correct_option, 
      question_type, 
      points, 
      scoring_strategy, 
      scoring_metadata 
    } = await request.json();

    if (!id || !question_text) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Auth check: Teachers can only update their own questions
    if (session.user.roleName === 'teacher') {
      const q = await query({
        query: `SELECT created_by FROM rhs_question_bank WHERE id = ?`,
        values: [id]
      });
      if (!q.length || q[0].created_by !== session.user.id) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
      }
    }

    await query({
      query: `UPDATE rhs_question_bank SET 
        folder_id = ?, 
        question_text = ?, 
        options = ?, 
        correct_option = ?, 
        question_type = ?, 
        points = ?, 
        scoring_strategy = ?, 
        scoring_metadata = ? 
        WHERE id = ?`,
      values: [
        folder_id,
        question_text,
        JSON.stringify(options || {}),
        correct_option,
        question_type,
        points,
        scoring_strategy,
        scoring_metadata ? JSON.stringify(scoring_metadata) : null,
        id
      ]
    });

    return NextResponse.json({ message: 'Question updated successfully' });
  } catch (error) {
    console.error('Error updating bank question:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE handler to remove a bank question
export async function DELETE(request) {
  const session = await getSession(request);
  if (!session.user || !await validateUserSession(session) || session.user.roleName === 'student') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get('id');

  if (!idParam) {
    return NextResponse.json({ message: 'Question ID(s) required' }, { status: 400 });
  }

  const ids = idParam.split(',').map(id => id.trim()).filter(id => id !== '');

  if (ids.length === 0) {
    return NextResponse.json({ message: 'Invalid IDs' }, { status: 400 });
  }

  try {
    // Auth check: For teachers, verify ownership of all questions
    if (session.user.roleName === 'teacher') {
      const placeholders = ids.map(() => '?').join(',');
      const questions = await query({
        query: `SELECT id, created_by FROM rhs_question_bank WHERE id IN (${placeholders})`,
        values: ids
      });

      // Check if all requested IDs were found and belong to the user
      const ownedIds = questions.filter(q => q.created_by === session.user.id).map(q => q.id.toString());
      if (ownedIds.length !== ids.length) {
        return NextResponse.json({ message: 'Forbidden: You do not have permission to delete one or more of these questions' }, { status: 403 });
      }
    }

    const placeholders = ids.map(() => '?').join(',');
    await query({
      query: `DELETE FROM rhs_question_bank WHERE id IN (${placeholders})`,
      values: ids
    });

    return NextResponse.json({ message: `${ids.length} question(s) deleted successfully` });
  } catch (error) {
    console.error('Error deleting bank question:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
