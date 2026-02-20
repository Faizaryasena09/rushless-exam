import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';

// Upload Question API
export async function POST(request) {
    try {
        const session = await getIronSession(await cookies(), sessionOptions);
        if (!session.user || session.user.roleName === 'student') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const examId = formData.get('examId');

        if (!file || !examId) {
            return NextResponse.json({ message: 'File and Exam ID are required' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileType = file.type;

        let htmlFn = '';

        // Check for DOCX
        if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const options = {
                convertImage: mammoth.images.imgElement(async (image) => {
                    const buffer = await image.read();
                    const contentType = image.contentType;
                    // Embed images as Base64 for simplicity
                    return { src: "data:" + contentType + ";base64," + buffer.toString('base64') };
                })
            };
            const { value } = await mammoth.convertToHtml({ buffer }, options);
            htmlFn = value;
        } else {
            return NextResponse.json({ message: 'Unsupported file type. Please upload .docx' }, { status: 400 });
        }

        const parsedQuestions = parseHtmlContent(htmlFn);

        if (parsedQuestions.length === 0) {
            return NextResponse.json({ message: 'No valid questions found. Ensure format matches: "1. Question" and "A. Option".' }, { status: 400 });
        }

        // --- Database Insertion ---
        // 1. Prepare placeholders for bulk insert
        const placeholders = parsedQuestions.map(() => '(?,?,?,?)').join(',');
        const sql = `INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option) VALUES ${placeholders}`;

        // 2. Flatten array for values mapping
        const values = parsedQuestions.flatMap(q =>
            [examId, q.question_text, JSON.stringify(q.options), q.correct_option || 'A']
        );

        await query({ query: sql, values: values });

        return NextResponse.json({ message: `Successfully imported ${parsedQuestions.length} questions.` });

    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ message: 'Failed to import questions.', error: error.message }, { status: 500 });
    }
}

function parseHtmlContent(html) {
    // Basic parser for "1. Question ... A. Option" format
    // Removes HTML tags to parse text content

    // Simple regex stripping (imperfect but functional for simple lists)
    const plainText = html
        .replace(/<\/p>/g, '\n') // Paragraph breaks to newlines
        .replace(/<[^>]+>/g, '') // Remove other tags
        .replace(/&nbsp;/g, ' '); // Decode non-breaking spaces

    const lines = plainText.split('\n').map(l => l.trim()).filter(l => l);

    const questions = [];
    let currentQuestion = null;

    lines.forEach(line => {
        // Match "1. Question Text"
        const questionMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (questionMatch) {
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question_text: questionMatch[2],
                options: {},
                correct_option: 'A' // Default
            };
            return;
        }

        // Match "A. Option Text" or "a. Option Text"
        const optionMatch = line.match(/^([A-Da-d])\.\s+(.+)/);
        if (optionMatch && currentQuestion) {
            const key = optionMatch[1].toUpperCase();
            currentQuestion.options[key] = optionMatch[2];
        }
    });

    if (currentQuestion) {
        questions.push(currentQuestion);
    }

    return questions;
}