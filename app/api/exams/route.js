import { NextResponse } from 'next/server';
import { query } from '@/app/lib/db';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { validateUserSession } from '@/app/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import redis, { isRedisReady } from '@/app/lib/redis';
import { invalidateExamCache } from '@/app/lib/exams';

async function GET() {
  // Check for active session to protect the route
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized or Session Expired' }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const role = session.user.roleName;
    const classId = session.user.class_id;

    let exams;
    const listCacheKey = role === 'student' ? `exams:list:class:${classId}` : `exams:list:${role}:${userId}`;

    // 1. Attempt to fetch base list from Redis
    if (isRedisReady()) {
      const cached = await redis.get(listCacheKey).catch(() => null);
      if (cached) {
        exams = JSON.parse(cached);
      }
    }

    if (!exams) {
      let examsQuery = `
            SELECT e.*,
                e.is_hidden as exam_is_hidden,
                s.require_safe_browser,
                s.require_seb,
                s.seb_config_key,
                s.start_time,
                s.end_time,
                s.show_result,
                s.show_analysis,
                c.name as category_name,
                c.is_hidden as category_is_hidden,
                s_subj.name as subject_name
            FROM rhs_exams e
            LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
            LEFT JOIN rhs_exam_categories c ON e.category_id = c.id
            LEFT JOIN rhs_subjects s_subj ON e.subject_id = s_subj.id
        `;

      let queryValues = [];

      if (role === 'student') {
        examsQuery += `
                INNER JOIN rhs_exam_classes ec ON e.id = ec.exam_id
                WHERE ec.class_id = ? AND e.is_hidden = FALSE 
                AND (c.id IS NULL OR (c.is_hidden = FALSE AND c.is_admin_hidden = FALSE))
            `;
        queryValues.push(classId || -1);
      } else if (role === 'teacher') {
        examsQuery += `
                WHERE EXISTS (
                    SELECT 1 FROM rhs_exam_classes ec
                    INNER JOIN rhs_teacher_classes tc ON ec.class_id = tc.class_id
                    WHERE ec.exam_id = e.id AND tc.teacher_id = ?
                )
                AND (
                    e.subject_id IS NULL 
                    OR EXISTS (
                        SELECT 1 FROM rhs_teacher_subjects ts
                        WHERE ts.subject_id = e.subject_id AND ts.teacher_id = ?
                    )
                )
                AND (c.id IS NULL OR c.is_admin_hidden = FALSE)
            `;
        queryValues.push(userId, userId);
      }

      examsQuery += ` ORDER BY e.created_at DESC`;

      exams = await query({ query: examsQuery, values: queryValues });

      // Cache the base list (5 minutes TTL for lists)
      if (isRedisReady() && exams.length > 0) {
        await redis.set(listCacheKey, JSON.stringify(exams), 'EX', 300).catch(() => { });
      }
    }

    // 2. Add user-specific attempt info (always fresh)
    if (role === 'student') {
      const allUserAttempts = await query({
        query: `SELECT id as attempt_id, exam_id, status, score, UNIX_TIMESTAMP(start_time) as start_time_ts FROM rhs_exam_attempts WHERE user_id = ? ORDER BY start_time DESC`,
        values: [userId]
      });

      const now_ts = Math.floor(Date.now() / 1000);

      const attemptsInfo = allUserAttempts.reduce((acc, attempt) => {
        if (!acc[attempt.exam_id]) {
          acc[attempt.exam_id] = { count: 0, hasInProgress: false, latestAttemptId: attempt.attempt_id, latestScore: attempt.score };
        }
        acc[attempt.exam_id].count++;

        if (attempt.status === 'in_progress') {
          const examsDataMap = exams.reduce((m, ex) => { m[ex.id] = ex; return m; }, {});
          const exam = examsDataMap[attempt.exam_id];
          let isExpired = false;

          if (exam) {
            if (exam.timer_mode === 'async') {
              const durationSeconds = (exam.duration_minutes || 0) * 60;
              const endTime = attempt.start_time_ts + durationSeconds;
              if (now_ts > endTime) isExpired = true;
            } else if (exam.end_time) {
              const globalEndTime = Math.floor(new Date(exam.end_time).getTime() / 1000);
              if (now_ts > globalEndTime) isExpired = true;
            }
          }

          if (!isExpired) acc[attempt.exam_id].hasInProgress = true;
        }
        return acc;
      }, {});

      exams.forEach(exam => {
        const info = attemptsInfo[exam.id];
        exam.user_attempts = info ? info.count : 0;
        exam.has_in_progress = info ? info.hasInProgress : false;
        exam.latest_attempt_id = info ? info.latestAttemptId : null;
        exam.latest_score = info ? info.latestScore : null;
      });
    }

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
  // 1. Check for active session and admin role
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get data from the request body
  const { exam_name, description, require_safe_browser, require_seb, subject_id } = await request.json();

  if (!exam_name) {
    return NextResponse.json({ message: 'Exam name is required' }, { status: 400 });
  }

  try {
    const result = await query({
      query: 'INSERT INTO rhs_exams (exam_name, description, timer_mode, duration_minutes, subject_id, scoring_mode, auto_distribute) VALUES (?, ?, ?, ?, ?, ?, ?)',
      values: [exam_name, description, 'async', 60, subject_id || null, 'raw', 1],
    });

    if (result.affectedRows) {
      const newExamId = result.insertId;

      await query({
        query: 'INSERT INTO rhs_exam_settings (exam_id, require_safe_browser, require_seb) VALUES (?, ?, ?)',
        values: [newExamId, require_safe_browser || false, require_seb || false]
      });

      // Wildcard delete for exam lists
      await invalidateExamCache(null);

      return NextResponse.json({ message: 'Exam created successfully', examId: newExamId }, { status: 201 });
    } else {
      throw new Error('Failed to insert exam into database');
    }
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