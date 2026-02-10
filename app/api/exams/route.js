import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

async function GET() {
  // Check for active session to protect the route
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized or Session Expired' }, { status: 401 });
  }

  try {
    let examsQuery = `
        SELECT 
          e.id, 
          e.exam_name, 
          e.description, 
          e.created_at,
          e.max_attempts,
          e.timer_mode,
          e.duration_minutes,
          s.start_time,
          s.end_time,
          s.require_safe_browser
        FROM rhs_exams e
        LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
    `;

    let queryValues = [];

    if (session.user.roleName === 'student') {
      // Students only see exams assigned to their class
      examsQuery += `
            INNER JOIN rhs_exam_classes ec ON e.id = ec.exam_id
            WHERE ec.class_id = ?
        `;
      // If student has no class_id, they see nothing (pass null or -1 which matches nothing)
      queryValues.push(session.user.class_id || -1);
    } else if (session.user.roleName === 'teacher') {
      // Teachers see exams assigned to ANY of their managed classes
      examsQuery += `
            INNER JOIN rhs_exam_classes ec ON e.id = ec.exam_id
            INNER JOIN rhs_teacher_classes tc ON ec.class_id = tc.class_id
            WHERE tc.teacher_id = ?
            GROUP BY e.id
        `;
      queryValues.push(session.user.id);
    }

    examsQuery += ` ORDER BY e.created_at DESC`;

    const exams = await query({ query: examsQuery, values: queryValues });

    // Create a map of exam settings for easy lookup
    const examsMap = exams.reduce((acc, exam) => {
      acc[exam.id] = exam;
      return acc;
    }, {});

    if (session.user.roleName === 'student') {
      const allUserAttempts = await query({
        query: `SELECT exam_id, status, UNIX_TIMESTAMP(start_time) as start_time_ts FROM rhs_exam_attempts WHERE user_id = ?`,
        values: [session.user.id]
      });

      const now_ts = Math.floor(Date.now() / 1000);

      const attemptsInfo = allUserAttempts.reduce((acc, attempt) => {
        if (!acc[attempt.exam_id]) {
          acc[attempt.exam_id] = { count: 0, hasInProgress: false };
        }
        acc[attempt.exam_id].count++;

        if (attempt.status === 'in_progress') {
          const exam = examsMap[attempt.exam_id];
          let isExpired = false;

          if (exam) {
            if (exam.timer_mode === 'async') {
              const durationSeconds = (exam.duration_minutes || 0) * 60;
              const endTime = attempt.start_time_ts + durationSeconds;
              if (now_ts > endTime) {
                isExpired = true;
              }
            } else {
              // Sync mode: check against global end time
              if (exam.end_time) {
                const globalEndTime = Math.floor(new Date(exam.end_time).getTime() / 1000);
                if (now_ts > globalEndTime) {
                  isExpired = true;
                }
              }
            }
          }

          if (!isExpired) {
            acc[attempt.exam_id].hasInProgress = true;
          }
        }
        return acc;
      }, {});

      exams.forEach(exam => {
        const info = attemptsInfo[exam.id];
        exam.user_attempts = info ? info.count : 0;
        exam.has_in_progress = info ? info.hasInProgress : false;
      });
    }

    return NextResponse.json({ exams }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

async function POST(request) {
  // 1. Check for active session and admin role
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get data from the request body
  const { exam_name, description, require_safe_browser } = await request.json();

  // 3. Validate input
  if (!exam_name) {
    return NextResponse.json({ message: 'Exam name is required' }, { status: 400 });
  }

  // 4. Insert into the database
  try {
    const result = await query({
      query: 'INSERT INTO rhs_exams (exam_name, description, timer_mode, duration_minutes) VALUES (?, ?, ?, ?)',
      values: [exam_name, description, 'async', 60],
    });

    if (result.affectedRows) {
      const newExamId = result.insertId;

      // Create default settings (with safe browser if requested)
      await query({
        query: 'INSERT INTO rhs_exam_settings (exam_id, require_safe_browser) VALUES (?, ?)',
        values: [newExamId, require_safe_browser || false]
      });

      // Auto-assign classes for teachers
      if (session.user.roleName === 'teacher') {
        const teacherClasses = await query({
          query: 'SELECT class_id FROM rhs_teacher_classes WHERE teacher_id = ?',
          values: [session.user.id]
        });

        if (teacherClasses.length > 0) {
          const placeholders = teacherClasses.map(() => '(?, ?)').join(', ');
          const values = [];
          teacherClasses.forEach(c => {
            values.push(newExamId, c.class_id);
          });

          await connection.query(`INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES ${placeholders}`, values);
        }
      }

      return NextResponse.json({ message: 'Exam created successfully', examId: newExamId }, { status: 201 });
    } else {
      throw new Error('Failed to insert exam into database');
    }
  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

async function PUT(request) {
  // 1. Check for active session and admin role
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get data from the request body
  const { id, exam_name, description, require_safe_browser } = await request.json();

  // 3. Validate input
  if (!id || !exam_name) {
    return NextResponse.json({ message: 'Exam ID and name are required' }, { status: 400 });
  }

  // 4. Update the database
  try {
    await query({
      query: 'UPDATE rhs_exams SET exam_name = ?, description = ? WHERE id = ?',
      values: [exam_name, description, id],
    });

    // Update settings (upsert logic to be safe, or just update)
    if (require_safe_browser !== undefined) {
      // Check if settings exist
      const settings = await query({ query: 'SELECT id FROM rhs_exam_settings WHERE exam_id = ?', values: [id] });
      if (settings.length > 0) {
        await query({
          query: 'UPDATE rhs_exam_settings SET require_safe_browser = ? WHERE exam_id = ?',
          values: [require_safe_browser, id]
        });
      } else {
        await query({
          query: 'INSERT INTO rhs_exam_settings (exam_id, require_safe_browser) VALUES (?, ?)',
          values: [id, require_safe_browser]
        });
      }
    }

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
      while ((match = imageRegex.exec(q.question_text)) !== null) {
        filesToDelete.add(match[1]);
      }
    });

    // 2. Delete files
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'questions');
    const deletePromises = Array.from(filesToDelete).map(async (filename) => {
      try {
        const filePath = path.join(publicDir, filename);
        await unlink(filePath);
      } catch (err) {
        console.warn(`Failed to delete file: ${filename}`, err.message);
      }
    });
    await Promise.all(deletePromises);

    // 3. Delete exam from DB
    await query({
      query: 'DELETE FROM rhs_exams WHERE id = ?',
      values: [id]
    });

    return NextResponse.json({ message: 'Exam deleted successfully' });

  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete exam', error: error.message }, { status: 500 });
  }
}

export { GET, POST, PUT, DELETE };