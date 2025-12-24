import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

export async function GET(request) {
  const session = await getSession(request);

  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all students with their active session info and current exam status
    // Joined with classes for display
    const sql = `
        SELECT 
            u.id, u.username, u.role, u.is_locked, u.class_id,
            UNIX_TIMESTAMP(u.last_activity) as last_activity_ts,
            c.class_name,
            ea.id as attempt_id,
            ea.status as attempt_status,
            e.exam_name
        FROM rhs_users u
        LEFT JOIN rhs_classes c ON u.class_id = c.id
        LEFT JOIN rhs_exam_attempts ea ON u.id = ea.user_id AND ea.status = 'in_progress'
        LEFT JOIN rhs_exams e ON ea.exam_id = e.id
        WHERE u.role = 'student'
        ORDER BY 
            (ea.status = 'in_progress') DESC, -- Active exams first
            u.last_activity DESC              -- Then recently active
    `;

    const students = await query({ query: sql });

    const now = Math.floor(Date.now() / 1000);

    const processedStudents = students.map(s => {
        const inactiveSeconds = now - (s.last_activity_ts || 0);
        const isOnline = inactiveSeconds < 300; // Online if active in last 5 mins

        return {
            id: s.id,
            username: s.username,
            class_name: s.class_name,
            is_locked: !!s.is_locked,
            is_online: isOnline,
            last_activity_seconds_ago: inactiveSeconds,
            current_exam: s.exam_name || null,
            attempt_id: s.attempt_id || null
        };
    });

    return NextResponse.json({ students: processedStudents });

  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}
