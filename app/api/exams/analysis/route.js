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
            SELECT id, user_id, exam_id, status, score
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
    const isTeacher = session.user.roleName === 'teacher';

    // Only allow access if user is admin, teacher, or the owner (student)
    if (!isAdmin && !isTeacher && !isOwner) {
         return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const examResult = await query({
        query: `SELECT scoring_mode FROM rhs_exams WHERE id = ?`,
        values: [attempt.exam_id]
    });
    const scoringMode = examResult[0]?.scoring_mode || 'percentage';

    // 2. Get All Questions for this Exam
    // We need the question text and correct option (since this is analysis, we show correct answers)
    const questions = await query({
        query: `
            SELECT id, question_text, options, correct_option, question_type, points, scoring_strategy 
            FROM rhs_exam_questions 
            WHERE exam_id = ?
            ORDER BY id ASC
        `,
        values: [attempt.exam_id]
    });

    // 3. Get Student's Answers
    const studentAnswers = await query({
        query: `
            SELECT question_id, selected_option, is_correct, score_earned 
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
            questionType: q.question_type,
            options: JSON.parse(q.options || '{}'),
            correctAnswer: q.correct_option,
            studentAnswer: studentAns ? studentAns.selected_option : null,
            isCorrect: studentAns ? Boolean(studentAns.is_correct) : false,
            points: q.points || 1.0,
            scoreEarned: studentAns ? studentAns.score_earned : 0.0,
            scoringStrategy: q.scoring_strategy
        };
    });

    return NextResponse.json({
        score: attempt.score,
        scoringMode: scoringMode,
        analysis: analysis
    });

  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ message: 'Error fetching analysis', error: error.message }, { status: 500 });
  }
}
