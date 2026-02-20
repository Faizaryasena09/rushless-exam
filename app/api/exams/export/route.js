import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import * as XLSX from 'xlsx';

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
    const classIdFilter = searchParams.get('class_id'); // 'all' or specific ID
    const attemptMode = searchParams.get('attempt_mode') || 'all'; // 'all', 'best', 'latest'

    if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    try {
        // 1. Get Exam Details
        const examDetails = await query({
            query: 'SELECT exam_name FROM rhs_exams WHERE id = ?',
            values: [examId]
        });

        if (examDetails.length === 0) {
            return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
        }
        const examName = examDetails[0].exam_name;

        // 2. Get All Questions (Ordered) for Headers
        const questions = await query({
            query: 'SELECT id, question_text FROM rhs_exam_questions WHERE exam_id = ? ORDER BY id ASC', // Assuming ID order for now, or add `question_order` if exists
            values: [examId]
        });

        // 3. Build Base Query for Attempts
        let attemptsQuery = `
            SELECT 
                a.id as attemptId, 
                a.user_id as studentId, 
                a.score, 
                a.start_time, 
                a.end_time,
                a.status,
                u.username as studentName,
                c.class_name as className
            FROM rhs_exam_attempts a
            JOIN rhs_users u ON a.user_id = u.id
            LEFT JOIN rhs_classes c ON u.class_id = c.id
            WHERE a.exam_id = ? AND a.status = 'completed'
        `;

        const queryValues = [examId];

        if (classIdFilter && classIdFilter !== 'all') {
            attemptsQuery += ` AND c.class_name = ?`; // Using class_name for filter as passing name from frontend usually
            queryValues.push(classIdFilter);
        }

        attemptsQuery += ` ORDER BY a.user_id, a.start_time ASC`;

        const allAttempts = await query({
            query: attemptsQuery,
            values: queryValues
        });

        // 4. Get Answers for these attempts
        // We fetching ALL answers for this exam to map them in memory (more efficient than N+1 queries)
        const answers = await query({
            query: `
                SELECT attempt_id, question_id, is_correct, selected_option 
                FROM rhs_student_answer 
                WHERE exam_id = ?
            `,
            values: [examId]
        });

        // Map answers by AttemptID -> QuestionID -> Data
        const answersMap = {};
        answers.forEach(ans => {
            if (!answersMap[ans.attempt_id]) answersMap[ans.attempt_id] = {};
            answersMap[ans.attempt_id][ans.question_id] = ans;
        });

        // 5. Process Attempts based on Mode
        let processedAttempts = [];

        if (attemptMode === 'all') {
            // Add attempt numbers
            const studentAttemptCounters = {};
            processedAttempts = allAttempts.map(att => {
                if (!studentAttemptCounters[att.studentId]) studentAttemptCounters[att.studentId] = 0;
                studentAttemptCounters[att.studentId]++;
                return { ...att, attemptNumber: studentAttemptCounters[att.studentId] };
            });
        } else {
            // Group by student
            const studentsMap = {};
            allAttempts.forEach(att => {
                if (!studentsMap[att.studentId]) studentsMap[att.studentId] = [];
                studentsMap[att.studentId].push(att);
            });

            Object.values(studentsMap).forEach(studentAttempts => {
                let selectedAttempt = null;

                // Apply numbering first to all to keep real attempt number
                studentAttempts.forEach((att, idx) => att.attemptNumber = idx + 1);

                if (attemptMode === 'best') {
                    // Sort by Score DESC
                    studentAttempts.sort((a, b) => b.score - a.score);
                    selectedAttempt = studentAttempts[0];
                } else if (attemptMode === 'latest') {
                    // Sort by StartTime DESC (already ASC from DB, so take last)
                    selectedAttempt = studentAttempts[studentAttempts.length - 1];
                }

                if (selectedAttempt) processedAttempts.push(selectedAttempt);
            });
        }

        // 6. Format Data for Excel
        const totalQuestions = questions.length;
        const pointsPerQuestion = totalQuestions > 0 ? 100 / totalQuestions : 0;

        const excelData = processedAttempts.map(attempt => {
            const row = {
                'Student Name': attempt.studentName || attempt.studentUsername, // Fallback to username if name is empty
                'Student Username': attempt.studentUsername,
                'Class': attempt.className || 'No Class',
                'Attempt': attempt.attemptNumber,
                'State': attempt.status,
                'Started on': attempt.start_time ? new Date(attempt.start_time).toLocaleString() : '-',
                'Completed': attempt.end_time ? new Date(attempt.end_time).toLocaleString() : '-',
                'Total Score': typeof attempt.score === 'number' ? Number(attempt.score.toFixed(2)) : 0
            };

            // Add Question Columns
            questions.forEach((q, index) => {
                const ans = answersMap[attempt.attemptId]?.[q.id];
                // Scoring: Correct = pointsPerQuestion, Incorrect/Empty = 0.
                const score = ans?.is_correct ? pointsPerQuestion : 0;
                row[`Q${index + 1}`] = Number(score.toFixed(2));
            });

            return row;
        });

        // 7. Generate Excel File
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

        const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        // 8. Return Response
        return new NextResponse(buf, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${examName}_Results.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        });

    } catch (error) {
        console.error('Export failed:', error);
        return NextResponse.json({ message: 'Export failed', error: error.message }, { status: 500 });
    }
}
