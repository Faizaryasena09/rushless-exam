import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';

// Admin check
async function checkAdmin(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    return session.user && session.user.roleName === 'admin';
}

const parseDocxContent = (text) => {
    const questions = [];
    const lines = text.split('\n').filter(line => line.trim() !== '');

    let currentQuestion = null;

    for (const line of lines) {
        // Match a new question (e.g., "1. What is...?")
        const questionMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (questionMatch) {
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question_text: questionMatch[2].trim(),
                options: {},
                correct_option: null,
            };
            continue;
        }

        // Match an option (e.g., "A. Option A" or "*A. Option A")
        const optionMatch = line.match(/^(\*?)([A-E])\.\s+(.*)/);
        if (optionMatch && currentQuestion) {
            const isCorrect = optionMatch[1] === '*';
            const optionKey = optionMatch[2];
            const optionText = optionMatch[3].trim();

            currentQuestion.options[optionKey] = optionText;
            if (isCorrect) {
                currentQuestion.correct_option = optionKey;
            }
        }
    }

    if (currentQuestion) {
        questions.push(currentQuestion);
    }
    
    return questions.filter(q => q.question_text && q.correct_option && Object.keys(q.options).length > 0);
};

export async function POST(request) {
    if (!await checkAdmin(request)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const data = await request.formData();
        const file = data.get('file');
        const examId = data.get('examId');

        if (!examId || !file) {
            return NextResponse.json({ message: 'Exam ID and file are required.' }, { status: 400 });
        }
        
        const buffer = Buffer.from(await file.arrayBuffer());
        const { value: text } = await mammoth.extractRawText({ buffer });

        const parsedQuestions = parseDocxContent(text);

        if (parsedQuestions.length === 0) {
            return NextResponse.json({ message: 'No valid questions found in the document. Please check the formatting.' }, { status: 400 });
        }

        // Build a multi-row INSERT query for prepared statements
        const placeholders = parsedQuestions.map(() => '(?,?,?,?)').join(',');
        const sql = `INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option) VALUES ${placeholders}`;
        
        const values = parsedQuestions.flatMap(q => 
            [examId, q.question_text, JSON.stringify(q.options), q.correct_option]
        );

        await query({ query: sql, values: values });

        return NextResponse.json({ message: `Successfully imported ${parsedQuestions.length} questions.` });

    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ message: 'Failed to import questions.', error: error.message }, { status: 500 });
    }
}