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
    if (!session.user || session.user.roleName === 'student') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');

    if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    try {
        // Query 1: Get Exam Details
        const examDetails = await query({
            query: 'SELECT exam_name FROM rhs_exams WHERE id = ?',
            values: [examId]
        });

        if (examDetails.length === 0) {
            return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
        }

        // Query 2: Get all questions for the exam
        const allQuestions = await query({
            query: 'SELECT id, question_text, correct_option FROM rhs_exam_questions WHERE exam_id = ? ORDER BY id ASC',
            values: [examId]
        });

        // Query 3: Get all student answers for this exam
        const allStudentAnswers = await query({
            query: `
                SELECT sa.user_id, u.username, sa.question_id, sa.selected_option, sa.is_correct
                FROM rhs_student_answer sa
                JOIN rhs_users u ON sa.user_id = u.id
                WHERE sa.exam_id = ?
            `,
            values: [examId]
        });

        // Group answers by student for efficient lookup
        const answersByStudent = allStudentAnswers.reduce((acc, ans) => {
            if (!acc[ans.user_id]) {
                acc[ans.user_id] = {
                    studentInfo: { id: ans.user_id, name: ans.username },
                    answers: {}
                };
            }
            acc[ans.user_id].answers[ans.question_id] = {
                selectedOption: ans.selected_option,
                isCorrect: Boolean(ans.is_correct)
            };
            return acc;
        }, {});

        // Build the final, detailed results structure
        const detailedResults = Object.values(answersByStudent).map(studentData => {
            let correctCount = 0;
            let incorrectCount = 0;
            
            const studentAnswersAnalysis = allQuestions.map(question => {
                const studentAnswer = studentData.answers[question.id];
                const isCorrect = studentAnswer ? studentAnswer.isCorrect : false;

                if (studentAnswer) { // Only count if the student provided an answer
                    if (isCorrect) {
                        correctCount++;
                    } else {
                        incorrectCount++;
                    }
                }

                return {
                    questionId: question.id,
                    questionText: question.question_text,
                    correctAnswer: question.correct_option,
                    studentAnswer: studentAnswer ? studentAnswer.selectedOption : null,
                    isCorrect: isCorrect
                };
            });
            
            const score = allQuestions.length > 0 ? Math.round((correctCount / allQuestions.length) * 100) : 0;

            return {
                studentId: studentData.studentInfo.id,
                studentName: studentData.studentInfo.name,
                correctCount: correctCount,
                incorrectCount: incorrectCount,
                score: score,
                answers: studentAnswersAnalysis
            };
        });

        const responsePayload = {
            examName: examDetails[0].exam_name,
            totalQuestions: allQuestions.length,
            results: detailedResults,
        };

        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error('Failed to get exam results:', error);
        return NextResponse.json({ message: 'Failed to retrieve exam results', error: error.message }, { status: 500 });
    }
}
