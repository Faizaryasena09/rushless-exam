import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET: Fetch all teachers and their assigned subjects
export async function GET(request) {
  const session = await getSession();

  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all users with role 'teacher'
    const teachers = await query({
      query: `SELECT id, username, name, role FROM rhs_users WHERE role = 'teacher'`,
      values: []
    });

    // 2. Fetch all assignments
    const assignments = await query({
      query: `SELECT teacher_id, subject_id FROM rhs_teacher_subjects`,
      values: []
    });

    // 3. Map assignments to teachers
    const teachersWithSubjects = teachers.map(teacher => {
      const teacherSubjects = assignments
        .filter(a => a.teacher_id === teacher.id)
        .map(a => a.subject_id);
      return {
        ...teacher,
        assigned_subjects: teacherSubjects
      };
    });

    return NextResponse.json({ teachers: teachersWithSubjects });

  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

// POST: Update subjects for a specific teacher
export async function POST(request) {
  const session = await getSession();

  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { teacherId, subjectIds } = await request.json(); // subjectIds is array of ints

    if (!teacherId || !Array.isArray(subjectIds)) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    }

    await transaction(async (txQuery) => {
      // 1. Delete existing
      await txQuery({
        query: 'DELETE FROM rhs_teacher_subjects WHERE teacher_id = ?',
        values: [teacherId]
      });

      // 2. Insert new
      if (subjectIds.length > 0) {
        const placeholders = subjectIds.map(() => '(?, ?)').join(', ');
        const values = [];
        subjectIds.forEach(sId => {
          values.push(teacherId, sId);
        });

        await txQuery({
          query: `INSERT INTO rhs_teacher_subjects (teacher_id, subject_id) VALUES ${placeholders}`,
          values: values
        });
      }
    });

    return NextResponse.json({ message: 'Subject assignments updated successfully' });

  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}
