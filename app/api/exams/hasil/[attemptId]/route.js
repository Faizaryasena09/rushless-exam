import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

export async function GET(request, { params }) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { attemptId } = await params;

  if (!attemptId) {
    return NextResponse.json({ message: 'Attempt ID is required' }, { status: 400 });
  }

  try {
    // 1. Verify the attempt belongs to this user and get the exam_id
    const attemptRows = await query({
      query: `SELECT exam_id, user_id, status, score FROM rhs_exam_attempts WHERE id = ?`,
      values: [attemptId]
    });

    if (attemptRows.length === 0) {
      return NextResponse.json({ message: 'Attempt not found' }, { status: 404 });
    }

    const attempt = attemptRows[0];

    // Restrict to student owner or admin/teacher
    if (session.user.roleName === 'student') {
        if (attempt.user_id !== session.user.id) {
             return NextResponse.json({ message: 'Unauthorized access to this attempt' }, { status: 403 });
        }
    }

    // 2. Fetch exam settings
    const settingsRows = await query({
        query: `SELECT show_result, show_analysis FROM rhs_exam_settings WHERE exam_id = ?`,
        values: [attempt.exam_id]
    });

    if (settingsRows.length === 0) {
        return NextResponse.json({ message: 'Exam settings not found' }, { status: 404 });
    }

    const { show_result, show_analysis } = settingsRows[0];

    // If student, they cannot see result at all if show_result is false
    if (session.user.roleName === 'student' && !show_result) {
        return NextResponse.json({ message: 'Hasil tidak tersedia untuk ujian ini.' }, { status: 403 });
    }

    // 3. Fetch Exam Details
    const examRows = await query({
        query: `SELECT exam_name, description FROM rhs_exams WHERE id = ?`,
        values: [attempt.exam_id]
    });
    const exam = examRows[0];

    let analysis = [];
    let showAnalysisData = false;
    let basicStats = {
        total: 0,
        correct: 0,
        unanswered: 0,
        wrong: 0
    };

    // Always fetch questions and answers to compute stats
    const questions = await query({
        query: `SELECT id as question_id, question_text, options, correct_option FROM rhs_exam_questions WHERE exam_id = ?`,
        values: [attempt.exam_id]
    });

    const studentAnswers = await query({
        query: `SELECT question_id, selected_option, is_correct FROM rhs_student_answer WHERE attempt_id = ?`,
        values: [attemptId]
    });

    const answersMap = studentAnswers.reduce((acc, row) => {
        acc[row.question_id] = {
            selected_option: row.selected_option,
            is_correct: row.is_correct
        };
        return acc;
    }, {});

    basicStats.total = questions.length;
    questions.forEach(q => {
        const studentAnswerRecord = answersMap[q.question_id] || null;
        if (studentAnswerRecord) {
             if (studentAnswerRecord.is_correct) {
                 basicStats.correct++;
             } else {
                 basicStats.wrong++;
             }
        } else {
             basicStats.unanswered++;
        }
    });

    // Only map detailed analysis if show_analysis is true (or if user is admin/teacher)
    if (show_analysis || session.user.roleName !== 'student') {
        showAnalysisData = true;

        analysis = questions.map(q => {
            let optionsParsed = [];
            
            if (q.options) {
                try {
                    let parsed = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                    // Sometimes it's double stringified when stored
                    if (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed);
                    }
                    if (Array.isArray(parsed)) {
                        optionsParsed = parsed;
                    } else if (typeof parsed === 'object' && parsed !== null) {
                        // Ensure we retain the 'A', 'B', 'C' key if it's an object mapping
                        optionsParsed = Object.keys(parsed).map(key => {
                             // If the value is a string, wrap it. Return the original object if it already has text/originalKey properties.
                             const val = parsed[key];
                             if (typeof val === 'string') {
                                 return { originalKey: key, text: val };
                             } else if (typeof val === 'object' && val !== null) {
                                 return { originalKey: key, ...val };
                             }
                             return val;
                        });
                    }
                } catch(e) {
                    console.error("Failed to parse options for question: ", q.question_id);
                }
            }

            const studentAnswerRecord = answersMap[q.question_id] || null;

            return {
                id: q.question_id,
                question_text: q.question_text,
                options: optionsParsed,
                correct_option: q.correct_option,
                student_option: studentAnswerRecord ? studentAnswerRecord.selected_option : null,
                is_correct: studentAnswerRecord ? !!studentAnswerRecord.is_correct : false
            };
        });
    }

    return NextResponse.json({ 
        exam_name: exam.exam_name, 
        score: attempt.score,
        status: attempt.status,
        show_analysis: showAnalysisData,
        stats: basicStats,
        analysis 
    }, { status: 200 });

  } catch (error) {
    console.error("Hasil Fetch Error:", error);
    return NextResponse.json({ message: 'Failed to fetch analysis', error: error.message }, { status: 500 });
  }
}
