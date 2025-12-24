import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction } from '@/app/lib/db';

async function getSession(request) {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
  }
  
  // GET handler to fetch exam settings
  export async function GET(request) {
    const session = await getSession(request);
    // No admin check here to allow students to get exam details
  
    if (!session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId') || searchParams.get('exam_id');
  
    if (!examId) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }
  
    try {
      const results = await query({
        query: `
          SELECT 
            e.id as exam_id, 
            e.exam_name, 
            e.description,
            e.shuffle_questions,
            e.shuffle_answers,
            e.timer_mode,
            e.duration_minutes,
            e.min_time_minutes,
            e.max_attempts,
            s.start_time, 
            s.end_time 
          FROM rhs_exams e
          LEFT JOIN rhs_exam_settings s ON e.id = s.exam_id
          WHERE e.id = ?
        `,
        values: [examId],
      });
  
      if (results.length === 0) {
        return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
      }

      // Fetch allowed classes
      const classResults = await query({
          query: `SELECT class_id FROM rhs_exam_classes WHERE exam_id = ?`,
          values: [examId]
      });
      const allowedClasses = classResults.map(r => r.class_id);
  
      // Convert TINYINT(1) from DB to boolean
      const examData = {
        ...results[0],
        shuffle_questions: Boolean(results[0].shuffle_questions),
        shuffle_answers: Boolean(results[0].shuffle_answers),
        allowed_classes: allowedClasses
      };

      return NextResponse.json(examData);
    } catch (error) {
      return NextResponse.json({ message: 'Failed to retrieve exam settings', error: error.message }, { status: 500 });
    }
  }
  
  // POST handler to create or update exam settings (Admin Only)
  export async function POST(request) {
    const session = await getSession(request);
    
    if (!session.user || session.user.roleName !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  
    try {
      const { 
          examId, startTime, endTime, 
          shuffleQuestions, shuffleAnswers, 
          timerMode, durationMinutes, minTimeMinutes, maxAttempts,
          allowedClasses 
      } = await request.json();

      if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
      }

      // If no start or end time is provided, force the mode to async
      const finalTimerMode = (!startTime || !endTime) ? 'async' : timerMode;
  
      await transaction(async (txQuery) => {
          // 1. Update main exam details
          await txQuery({
            query: `
              UPDATE rhs_exams 
              SET 
                shuffle_questions = ?, 
                shuffle_answers = ?,
                timer_mode = ?,
                duration_minutes = ?,
                min_time_minutes = ?,
                max_attempts = ?
              WHERE id = ?
            `,
            values: [shuffleQuestions, shuffleAnswers, finalTimerMode, durationMinutes, minTimeMinutes, maxAttempts, examId],
          });
    
          // 2. Update exam time settings
          await txQuery({
            query: `
              INSERT INTO rhs_exam_settings (exam_id, start_time, end_time)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time)
            `,
            values: [examId, startTime, endTime],
          });

          // 3. Update Allowed Classes
          // First, clear existing
          await txQuery({
              query: `DELETE FROM rhs_exam_classes WHERE exam_id = ?`,
              values: [examId]
          });

          // Then, insert new ones if any
          if (allowedClasses && Array.isArray(allowedClasses) && allowedClasses.length > 0) {
              const values = allowedClasses.map(classId => [examId, classId]);
              
              const placeholders = allowedClasses.map(() => '(?, ?)').join(', ');
              const flatValues = [];
              allowedClasses.forEach(cId => {
                  flatValues.push(examId, cId);
              });

              await txQuery({
                  query: `INSERT INTO rhs_exam_classes (exam_id, class_id) VALUES ${placeholders}`,
                  values: flatValues
              });
          }
      });
  
      return NextResponse.json({ message: 'Settings saved successfully' });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ message: 'Failed to save settings', error: error.message }, { status: 500 });
    }
  }
