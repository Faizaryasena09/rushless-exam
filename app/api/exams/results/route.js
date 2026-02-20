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

        // Query 2: Get all questions for the exam to get total count
        const allQuestions = await query({
            query: 'SELECT id FROM rhs_exam_questions WHERE exam_id = ?',
            values: [examId]
        });
        const totalQuestions = allQuestions.length;

        // Query 3: Get answer counts per attempt
        const answerCountsByAttempt = await query({
            query: `
                SELECT 
                    attempt_id,
                    COUNT(id) as answeredCount,
                    SUM(is_correct = 1) as correctCount
                FROM rhs_student_answer
                WHERE exam_id = ?
                GROUP BY attempt_id
            `,
            values: [examId]
        });
        const countsMap = answerCountsByAttempt.reduce((acc, row) => {
            acc[row.attempt_id] = {
                correctCount: Number(row.correctCount) || 0,
                answeredCount: Number(row.answeredCount) || 0,
                incorrectCount: (Number(row.answeredCount) || 0) - (Number(row.correctCount) || 0),
                notAnsweredCount: totalQuestions - (Number(row.answeredCount) || 0)
            };
            return acc;
        }, {});

        // Query 4: Get all completed attempts for this exam, with user info, ordered by best score first
        const allAttempts = await query({
            query: `
                SELECT 
                    a.id as attemptId, 
                    a.user_id as studentId, 
                    a.score, 
                    a.start_time, 
                    a.end_time,
                    u.username,
                    u.name,
                    c.class_name as className
                FROM rhs_exam_attempts a
                JOIN rhs_users u ON a.user_id = u.id
                LEFT JOIN rhs_classes c ON u.class_id = c.id
                WHERE a.exam_id = ? AND a.status = 'completed'
                ORDER BY a.user_id, a.score DESC
            `,
            values: [examId]
        });

        // Process attempts to get best score and all attempts per student
        const resultsByStudent = allAttempts.reduce((acc, attempt) => {
            const attemptCounts = countsMap[attempt.attemptId] || { correctCount: 0, incorrectCount: 0, notAnsweredCount: totalQuestions };
            const attemptWithCounts = {
                attemptId: attempt.attemptId,
                score: attempt.score,
                startTime: attempt.start_time,
                endTime: attempt.end_time,
                ...attemptCounts
            };

            if (!acc[attempt.studentId]) {
                // First time seeing this student, this is their best attempt due to ORDER BY
                acc[attempt.studentId] = {
                    studentId: attempt.studentId,
                    studentName: attempt.name || attempt.username,
                    username: attempt.username,
                    className: attempt.className || 'No Class',
                    status: 'Completed',
                    bestScore: attempt.score,
                    // We also include counts for the best attempt at the top level for the main table display
                    correctCount: attemptCounts.correctCount,
                    incorrectCount: attemptCounts.incorrectCount,
                    notAnsweredCount: attemptCounts.notAnsweredCount,
                    attempts: [attemptWithCounts]
                };
            } else {
                // Student already in map, just add the attempt
                acc[attempt.studentId].attempts.push(attemptWithCounts);
            }
            return acc;
        }, {});

        // Query 5: Get all students to include those who haven't taken the exam
        const allStudents = await query({
            query: `
                SELECT u.id, u.username, u.name, c.class_name 
                FROM rhs_users u 
                LEFT JOIN rhs_classes c ON u.class_id = c.id 
                WHERE u.role = 'student' 
                ORDER BY c.class_name, u.name, u.username ASC
            `,
        });

        allStudents.forEach(student => {
            if (!resultsByStudent[student.id]) {
                resultsByStudent[student.id] = {
                    studentId: student.id,
                    studentName: student.name || student.username,
                    username: student.username,
                    className: student.class_name || 'No Class',
                    status: 'Not Taken',
                    bestScore: 0,
                    correctCount: 0,
                    incorrectCount: 0,
                    notAnsweredCount: totalQuestions,
                    attempts: []
                };
            }
        });

        const detailedResults = Object.values(resultsByStudent);

        const responsePayload = {
            examName: examDetails[0].exam_name,
            totalQuestions: totalQuestions,
            results: detailedResults,
        };

        return NextResponse.json(responsePayload);

    } catch (error) {
        console.error('Failed to get exam results:', error);
        return NextResponse.json({ message: 'Failed to retrieve exam results', error: error.message }, { status: 500 });
    }
}

