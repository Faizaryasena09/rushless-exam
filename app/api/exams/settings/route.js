import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

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
  
      // Convert TINYINT(1) from DB to boolean
      const examData = {
        ...results[0],
        shuffle_questions: Boolean(results[0].shuffle_questions),
        shuffle_answers: Boolean(results[0].shuffle_answers),
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
      const { examId, startTime, endTime, shuffleQuestions, shuffleAnswers, timerMode, durationMinutes } = await request.json();
      if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
      }

      // If no start or end time is provided, force the mode to async
      const finalTimerMode = (!startTime || !endTime) ? 'async' : timerMode;
  
      // Update exam shuffle and timer settings on the main exams table
      const shufflePromise = query({
        query: `
          UPDATE rhs_exams 
          SET 
            shuffle_questions = ?, 
            shuffle_answers = ?,
            timer_mode = ?,
            duration_minutes = ?
          WHERE id = ?
        `,
        values: [shuffleQuestions, shuffleAnswers, finalTimerMode, durationMinutes, examId],
      });

      // Update exam time settings
      const settingsPromise = query({
        query: `
          INSERT INTO rhs_exam_settings (exam_id, start_time, end_time)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time)
        `,
        values: [examId, startTime, endTime],
      });

      // Run both queries
      await Promise.all([shufflePromise, settingsPromise]);
  
      return NextResponse.json({ message: 'Settings saved successfully' });
    } catch (error) {
      return NextResponse.json({ message: 'Failed to save settings', error: error.message }, { status: 500 });
    }
  }
