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
    // Parser for "1. Question ... A. Option" format
    // Preserves <img> tags so embedded images from DOCX are kept
    // Detects * as correct answer marker

    // Step 1: Replace <img> tags with unique placeholders BEFORE stripping HTML
    const imgMap = {};
    let imgCounter = 0;
    let processedHtml = html.replace(/<img[^>]*>/gi, (match) => {
        const placeholder = `__IMG_${imgCounter}__`;
        imgMap[placeholder] = match;
        imgCounter++;
        return placeholder;
    });

    // Step 2: Split into lines by paragraph/br/div/li closing tags
    const lines = processedHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l);

    // Step 3: Restore <img> placeholders back to real tags
    const restoredLines = lines.map(line => {
        let restored = line;
        for (const [placeholder, imgTag] of Object.entries(imgMap)) {
            restored = restored.replace(placeholder, imgTag);
        }
        return restored;
    });

    const questions = [];
    let currentQuestion = null;

    restoredLines.forEach(line => {
        // Match "1. Question Text" (number followed by dot and space)
        const questionMatch = line.match(/^(\d+)[.)]\s+(.+)/s);
        if (questionMatch) {
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            currentQuestion = {
                question_text: questionMatch[2].replace(/\s*\*\s*$/, '').trim(),
                options: {},
                correct_option: 'A' // Default
            };
            return;
        }

        // Match "A. Option Text", "A) Option Text", or "*A. Option Text" (correct answer)
        // through Z (case-insensitive). * before the letter marks correct answer.
        const optionMatch = line.match(/^(\*?)([A-Za-z])[.)]\s+(.+)/s);
        if (optionMatch && currentQuestion) {
            const isCorrect = optionMatch[1] === '*';
            const key = optionMatch[2].toUpperCase();
            let optionText = optionMatch[3].replace(/\*/g, '').trim();

            if (isCorrect) {
                currentQuestion.correct_option = key;
            }

            currentQuestion.options[key] = optionText;
            return;
        }

        // Standalone * on its own line — mark previous option as correct
        if (/^\*+$/.test(line) && currentQuestion) {
            const optionKeys = Object.keys(currentQuestion.options);
            if (optionKeys.length > 0) {
                currentQuestion.correct_option = optionKeys[optionKeys.length - 1];
            }
            return; // Don't append * to anything
        }

        // Line is just an image placeholder or continuation
        if (currentQuestion && line.trim()) {
            // Only append if line contains actual content (image or text)
            const hasImage = /<img[^>]*>/i.test(line);
            if (hasImage) {
                // Append image to question text
                const optionKeys = Object.keys(currentQuestion.options);
                if (optionKeys.length > 0) {
                    const lastKey = optionKeys[optionKeys.length - 1];
                    currentQuestion.options[lastKey] += ' ' + line;
                } else {
                    currentQuestion.question_text += ' ' + line;
                }
            }
            // Ignore non-image continuation lines to prevent garbage appending
        }
    });

    if (currentQuestion) {
        questions.push(currentQuestion);
    }

    return questions;
}