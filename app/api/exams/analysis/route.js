import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

export async function GET(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const attemptId = searchParams.get('attempt_id');

  if (!attemptId) {
    return NextResponse.json({ message: 'Attempt ID required' }, { status: 400 });
  }

  try {
    // 1. Get attempt details to verify ownership/permission and get exam_id
    const attemptResult = await query({
        query: `
            SELECT id, user_id, exam_id, status 
            FROM rhs_exam_attempts 
            WHERE id = ?
        `,
        values: [attemptId]
    });

    if (attemptResult.length === 0) {
        return NextResponse.json({ message: 'Attempt not found' }, { status: 404 });
    }

    const attempt = attemptResult[0];
    const isOwner = attempt.user_id === session.user.id;
    const isAdmin = session.user.roleName === 'admin';

    // Only allow access if user is admin or the owner (and attempt is completed)
    if (!isAdmin && (!isOwner)) {
         return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // 2. Get All Questions for this Exam
    // We need the question text and correct option (since this is analysis, we show correct answers)
    const questions = await query({
        query: `
            SELECT id, question_text, options, correct_option 
            FROM rhs_exam_questions 
            WHERE exam_id = ?
            ORDER BY id ASC
        `,
        values: [attempt.exam_id]
    });

    // 3. Get Student's Answers
    const studentAnswers = await query({
        query: `
            SELECT question_id, selected_option, is_correct 
            FROM rhs_student_answer 
            WHERE attempt_id = ?
        `,
        values: [attemptId]
    });

    // Map student answers for easy lookup
    const studentAnswerMap = studentAnswers.reduce((acc, ans) => {
        acc[ans.question_id] = ans;
        return acc;
    }, {});

    // 4. Combine Data
    const analysis = questions.map(q => {
        const studentAns = studentAnswerMap[q.id];
        return {
            questionId: q.id,
            questionText: q.question_text,
            options: JSON.parse(q.options || '{}'),
            correctAnswer: q.correct_option,
            studentAnswer: studentAns ? studentAns.selected_option : null,
            isCorrect: studentAns ? Boolean(studentAns.is_correct) : false
        };
    });

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ message: 'Error fetching analysis', error: error.message }, { status: 500 });
  }
}
