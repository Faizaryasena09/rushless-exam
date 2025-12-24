import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// GET: Fetch all teachers and their assigned classes
export async function GET(request) {
  const session = await getSession(request);

  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all users with role 'teacher'
    const teachers = await query({
      query: `SELECT id, username, role FROM rhs_users WHERE role = 'teacher'`,
      values: []
    });

    // 2. Fetch all assignments
    const assignments = await query({
      query: `SELECT teacher_id, class_id FROM rhs_teacher_classes`,
      values: []
    });

    // 3. Map assignments to teachers
    const teachersWithClasses = teachers.map(teacher => {
        const teacherClasses = assignments
            .filter(a => a.teacher_id === teacher.id)
            .map(a => a.class_id);
        return {
            ...teacher,
            assigned_classes: teacherClasses
        };
    });

    return NextResponse.json({ teachers: teachersWithClasses });

  } catch (error) {
    return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
  }
}

// POST: Update classes for a specific teacher
export async function POST(request) {
    const session = await getSession(request);
  
    if (!session.user || session.user.roleName !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    try {
      const { teacherId, classIds } = await request.json(); // classIds is array of ints
  
      if (!teacherId || !Array.isArray(classIds)) {
        return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
      }
  
      await transaction(async (txQuery) => {
          // 1. Delete existing
          await txQuery({
              query: 'DELETE FROM rhs_teacher_classes WHERE teacher_id = ?',
              values: [teacherId]
          });
  
          // 2. Insert new
          if (classIds.length > 0) {
              const placeholders = classIds.map(() => '(?, ?)').join(', ');
              const values = [];
              classIds.forEach(cId => {
                  values.push(teacherId, cId);
              });
  
              await txQuery({
                  query: `INSERT INTO rhs_teacher_classes (teacher_id, class_id) VALUES ${placeholders}`,
                  values: values
              });
          }
      });
  
      return NextResponse.json({ message: 'Assignments updated successfully' });
  
    } catch (error) {
      return NextResponse.json({ message: 'Database error', error: error.message }, { status: 500 });
    }
  }
