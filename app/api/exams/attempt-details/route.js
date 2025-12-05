import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

export async function GET(request) {
    const session = await getSession();
    // Allow student to view their own results, but API should check ownership.
    // For now, only admin/teacher can view any result.
    if (!session.user || session.user.roleName === 'student') {
        // This check needs to be more granular if students are to see their own results.
        // For now, keeping it simple.
        // A better check would be: if role is student, they must be the owner of the attempt.
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
        return NextResponse.json({ message: 'Attempt ID is required' }, { status: 400 });
    }

    try {
        // Query 1: Get Attempt Info to find exam_id and user_id
        const attemptInfo = await query({
            query: `SELECT exam_id, user_id FROM rhs_exam_attempts WHERE id = ?`,
            values: [attemptId]
        });

        if (attemptInfo.length === 0) {
            return NextResponse.json({ message: 'Attempt not found' }, { status: 404 });
        }
        const { exam_id, user_id } = attemptInfo[0];
        
        // Add ownership check for students here in the future if needed
        // if (session.user.roleName === 'student' && session.user.id !== user_id) {
        //     return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
        // }

        // Query 2: Get all questions for the exam
        const allQuestions = await query({
            query: 'SELECT id, question_text, correct_option FROM rhs_exam_questions WHERE exam_id = ? ORDER BY id ASC',
            values: [exam_id]
        });

        // Query 3: Get the student's answers for this specific attempt
        const studentAnswers = await query({
            query: `
                SELECT question_id, selected_option, is_correct
                FROM rhs_student_answer
                WHERE attempt_id = ?
            `,
            values: [attemptId]
        });

        const answersMap = studentAnswers.reduce((acc, ans) => {
            acc[ans.question_id] = {
                selectedOption: ans.selected_option,
                isCorrect: Boolean(ans.is_correct)
            };
            return acc;
        }, {});

        // Combine data to create the analysis
        const analysis = allQuestions.map(question => {
            const studentAnswer = answersMap[question.id];
            return {
                questionId: question.id,
                questionText: question.question_text,
                correctAnswer: question.correct_option,
                studentAnswer: studentAnswer ? studentAnswer.selectedOption : null,
                isCorrect: studentAnswer ? studentAnswer.isCorrect : false
            };
        });

        return NextResponse.json(analysis);

    } catch (error) {
        console.error('Failed to get attempt details:', error);
        return NextResponse.json({ message: 'Failed to retrieve attempt details', error: error.message }, { status: 500 });
    }
}
