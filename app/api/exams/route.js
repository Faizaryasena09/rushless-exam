import { NextResponse } from 'next/server';
import { query, transaction } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import redis, { isRedisReady } from '@/app/lib/redis';
import { invalidateExamCache, getExamsList } from '@/app/lib/exams';

async function GET() {
  // Check for active session to protect the route
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized or Session Expired' }, { status: 401 });
  }

  try {
    const exams = await getExamsList(session.user);

    return NextResponse.json({ exams }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

async function POST(request) {
  // 1. Check for active session and role
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get data from the request body
  const { exam_name, description, require_safe_browser, require_seb, subject_id, allowed_classes } = await request.json();

  if (!exam_name) {
    return NextResponse.json({ message: 'Exam name is required' }, { status: 400 });
  }

  try {
    const newExamId = await transaction(async (txQuery) => {
      // 1. Insert into rhs_exams
      const result = await txQuery({
        query: 'INSERT INTO rhs_exams (exam_name, description, timer_mode, duration_minutes, subject_id, scoring_mode, auto_distribute) VALUES (?, ?, ?, ?, ?, ?, ?)',
        values: [exam_name, description, 'async', 60, subject_id || null, 'raw', 1],
      });

      const examId = result.insertId;

      // 2. Insert into rhs_exam_settings
      await txQuery({
        query: 'INSERT INTO rhs_exam_settings (exam_id, require_safe_browser, require_seb) VALUES (?, ?, ?)',
        values: [examId, require_safe_browser || false, require_seb || false]
      });

      // 3. Insert into rhs_exam_classes if provided
      if (Array.isArray(allowed_classes) && allowed_classes.length > 0) {
        const placeholders = allowed_classes.map(() => '(?, ?)').join(', ');
        const flatValues = [];
        allowed_classes.forEach(cId => flatValues.push(examId, cId));
        await txQuery({
          query: `INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES ${placeholders}`,
          values: flatValues,
        });
      }

      return examId;
    });

    // Invalidate caches
    await invalidateExamCache(null);

    return NextResponse.json({ message: 'Exam created successfully', examId: newExamId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

async function PUT(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id, exam_name, description, require_safe_browser, require_seb, subject_id } = await request.json();

  if (!id || !exam_name) {
    return NextResponse.json({ message: 'Exam ID and name are required' }, { status: 400 });
  }

  try {
    await query({
      query: 'UPDATE rhs_exams SET exam_name = ?, description = ?, subject_id = ? WHERE id = ?',
      values: [exam_name, description, subject_id || null, id],
    });

    if (require_safe_browser !== undefined) {
      const settings = await query({ query: 'SELECT id FROM rhs_exam_settings WHERE exam_id = ?', values: [id] });
      if (settings.length > 0) {
        await query({
          query: 'UPDATE rhs_exam_settings SET require_safe_browser = ?, require_seb = ? WHERE exam_id = ?',
          values: [require_safe_browser, require_seb, id]
        });
      } else {
        await query({
          query: 'INSERT INTO rhs_exam_settings (exam_id, require_safe_browser, require_seb) VALUES (?, ?, ?)',
          values: [id, require_safe_browser, require_seb]
        });
      }
    }

    // Invalidate caches
    await invalidateExamCache(id);

    return NextResponse.json({ message: 'Exam updated successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

async function DELETE(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    // 1. Find images to delete
    const questions = await query({
      query: 'SELECT question_text FROM rhs_exam_questions WHERE exam_id = ?',
      values: [id]
    });

    const imageRegex = /src="\/uploads\/questions\/([^"]+)"/g;
    const filesToDelete = new Set();
    questions.forEach(q => {
      let match;
      while ((match = imageRegex.exec(q.question_text)) !== null) filesToDelete.add(match[1]);
    });

    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'questions');
    await Promise.all(Array.from(filesToDelete).map(async (filename) => {
      try { await unlink(path.join(publicDir, filename)); } catch (err) { }
    }));

    // 2. Delete exam from DB
    await query({ query: 'DELETE FROM rhs_exams WHERE id = ?', values: [id] });

    // 3. Invalidate caches
    await invalidateExamCache(id);

    return NextResponse.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete exam', error: error.message }, { status: 500 });
  }
}

export { GET, POST, PUT, DELETE };