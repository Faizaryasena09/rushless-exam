import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { autoSubmitExpiredAttempts } from '@/app/lib/auto-submit';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

export async function GET(request) {
  const session = await getSession(request);

  if (!session.user || !['admin', 'teacher'].includes(session.user.roleName)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Auto-submit any expired attempts before fetching current state
    await autoSubmitExpiredAttempts();

    const isTeacher = session.user.roleName === 'teacher';

    // If teacher: fetch their assigned class IDs first
    let teacherClassIds = [];
    if (isTeacher) {
      const assignments = await query({
        query: 'SELECT class_id FROM rhs_teacher_classes WHERE teacher_id = ?',
        values: [session.user.id],
      });
      teacherClassIds = assignments.map(a => a.class_id);

      // Teacher has no assigned classes — return empty list
      if (teacherClassIds.length === 0) {
        return NextResponse.json({ students: [] });
      }
    }

    // Build WHERE clause based on role
    const classFilter = isTeacher
      ? `AND u.class_id IN (${teacherClassIds.map(() => '?').join(',')})`
      : '';

    const sql = `
        SELECT 
            u.id, u.username, u.name, u.role, u.is_locked, u.class_id,
            UNIX_TIMESTAMP(u.last_activity) as last_activity_ts,
            c.class_name,
            ea.id as attempt_id,
            ea.status as attempt_status,
            ea.time_extension,
            ea.is_violation_locked,
            ea.exam_id,
            UNIX_TIMESTAMP(ea.start_time) as attempt_start_ts,
            e.exam_name,
            e.timer_mode,
            e.duration_minutes,
            UNIX_TIMESTAMP(s.end_time) as exam_end_ts,
            UNIX_TIMESTAMP(NOW()) as now_ts
        FROM rhs_users u
        LEFT JOIN rhs_classes c ON u.class_id = c.id
        LEFT JOIN rhs_exam_attempts ea ON u.id = ea.user_id AND ea.status = 'in_progress'
        LEFT JOIN rhs_exams e ON ea.exam_id = e.id
        LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
        WHERE u.role = 'student' ${classFilter}
        ORDER BY 
            (ea.status = 'in_progress') DESC,
            u.last_activity DESC
    `;

    const students = await query({
      query: sql,
      values: isTeacher ? teacherClassIds : [],
    });

    const now = Math.floor(Date.now() / 1000);

    const processedStudents = students.map(s => {
      const inactiveSeconds = now - (s.last_activity_ts || 0);
      const isOnline = inactiveSeconds < 300;

      let seconds_left = null;

      if (s.attempt_id) {
        let endTs;
        if (s.timer_mode === 'async') {
          endTs = Number(s.attempt_start_ts) + (Number(s.duration_minutes) * 60) + (Number(s.time_extension || 0) * 60);
        } else {
          endTs = Number(s.exam_end_ts) + (Number(s.time_extension || 0) * 60);
        }
        seconds_left = Math.max(0, Math.floor(endTs - s.now_ts));
      }

      return {
        id: s.id,
        username: s.username,
        name: s.name,
        class_name: s.class_name,
        is_locked: !!s.is_locked,
        is_violation_locked: !!s.is_violation_locked,
        is_online: isOnline,
        last_activity_seconds_ago: inactiveSeconds,
        current_exam: s.exam_name || null,
        attempt_id: s.attempt_id || null,
        seconds_left,
      };
    });

    return NextResponse.json({ students: processedStudents });

  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}


