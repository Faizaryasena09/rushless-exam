
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { parsePdfContent } from '@/app/lib/pdf-parser';

// Admin check
async function checkAdmin(request) {
    const cookieStore = await cookies();
    const session = await getIronSession(cookieStore, sessionOptions);
    return session.user && session.user.roleName === 'admin';
}

// Helper to save buffer to disk
async function saveImage(buffer, contentType) {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'questions');
        await mkdir(uploadDir, { recursive: true });

        const ext = contentType.split('/')[1] || 'png';
        const filename = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = path.join(uploadDir, filename);

        await writeFile(filePath, buffer);
        return `/uploads/questions/${filename}`;
    } catch (error) {
        console.error("Error saving image:", error);
        throw error;
    }
}

// Tokenizer for simple HTML parsing
const tokenizeHtml = (html) => {
    const tokens = [];
    let lastIndex = 0;
    const tagRegex = /(<\/?[^>]+>)/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', content: html.substring(lastIndex, match.index) });
        }
        tokens.push({ type: 'tag', content: match[0] });
        lastIndex = tagRegex.lastIndex;
    }
    if (lastIndex < html.length) {
        tokens.push({ type: 'text', content: html.substring(lastIndex) });
    }
    return tokens;
};

const parseHtmlContent = (html) => {
    const questions = [];
    const tokens = tokenizeHtml(html);

    let currentQuestion = null;
    let listDepth = 0;

    let contentBuffer = '';
    let isParsingElement = false;

    const flushBuffer = () => {
        if (!contentBuffer.trim()) return;

        const text = contentBuffer;
        const plainText = text.replace(/<[^>]+>/g, '').trim();
        const questionPrefixMatch = plainText.match(/^(\d+)\.\s+(.*)/);
        const optionPrefixMatch = plainText.match(/^(\*?)([A-E])\.\s*(.*)/i);

        // Case A: Manual Question found
        if (questionPrefixMatch) {
            if (currentQuestion) questions.push(currentQuestion);

            // Clean content: Remove "1." or "1. " from start
            let cleanedText = text;
            // Robust regex: matches optional leading whitespace/tags, then digits, dot, optional whitespace
            cleanedText = cleanedText.replace(/^([\s\r\n]*<[^>]+>[\s\r\n]*)*\d+\.\s*/i, (match) => {
                const tags = match.match(/<[^>]+>/g);
                return tags ? tags.join('') : '';
            });

            currentQuestion = {
                question_text: cleanedText,
                options: {},
                correct_option: null,
            };
        }
        // Case B: Manual Option found
        else if (optionPrefixMatch && currentQuestion) {
            const isCorrect = optionPrefixMatch[1] === '*';
            const key = optionPrefixMatch[2].toUpperCase();

            // Clean content: Remove "*A." or "*A. " or "A."
            let cleanedOption = text;
            cleanedOption = cleanedOption.replace(/^([\s\r\n]*<[^>]+>[\s\r\n]*)*\*?\s*[A-E]\.\s*/i, (match) => {
                const tags = match.match(/<[^>]+>/g);
                return tags ? tags.join('') : '';
            });

            currentQuestion.options[key] = cleanedOption;
            if (isCorrect) currentQuestion.correct_option = key;
        }
        // Case C: Auto-List (Contextual)
        else if (isParsingElement === 'list-item') {
            if (listDepth === 1) {
                if (currentQuestion) questions.push(currentQuestion);
                currentQuestion = {
                    question_text: text,
                    options: {},
                    correct_option: null,
                };
            } else if (listDepth >= 2 && currentQuestion) {
                const existingKeys = Object.keys(currentQuestion.options);
                const nextKey = String.fromCharCode(65 + existingKeys.length); // A, B, C...
                let optionHtml = text;
                let isCorrect = false;
                if (plainText.startsWith('*')) {
                    isCorrect = true;
                    optionHtml = optionHtml.replace('*', '');
                }
                currentQuestion.options[nextKey] = optionHtml;
                if (isCorrect) currentQuestion.correct_option = nextKey;
            } else {
                if (!currentQuestion) {
                    currentQuestion = {
                        question_text: text,
                        options: {},
                        correct_option: null,
                    };
                }
            }
        }
        // Case D: Plain paragraph implies continuation
        else if (currentQuestion && !optionPrefixMatch) {
            // Append to Question Text if no options yet.
            if (Object.keys(currentQuestion.options).length === 0) {
                currentQuestion.question_text += `<br/>${text}`;
            }
        }

        contentBuffer = '';
    };

    for (const token of tokens) {
        if (token.type === 'tag') {
            const tag = token.content.toLowerCase();

            if (tag.startsWith('<ul') || tag.startsWith('<ol')) {
                listDepth++;
            } else if (tag.startsWith('</ul') || tag.startsWith('</ol')) {
                listDepth--;
            } else if (tag.startsWith('<li')) {
                flushBuffer();
                isParsingElement = 'list-item';
            } else if (tag.startsWith('</li')) {
                flushBuffer();
                isParsingElement = false;
            } else if (tag.startsWith('<p')) {
                flushBuffer();
                isParsingElement = 'paragraph';
            } else if (tag.startsWith('</p')) {
                flushBuffer();
                isParsingElement = false;
            } else {
                contentBuffer += token.content;
            }
        } else {
            contentBuffer += token.content;
        }
    }

    flushBuffer();

    if (currentQuestion) {
        questions.push(currentQuestion);
    }

    return questions.filter(q => q.question_text && Object.keys(q.options).length > 0);
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
        const fileType = file.type;

        console.log("Processing file type:", fileType);

        let htmlFn = '';

        if (fileType === "application/pdf") {
            htmlFn = await parsePdfContent(buffer, saveImage);
            console.log("PDF HTML Content Preview:", htmlFn.substring(0, 500));
        } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            const options = {
                convertImage: mammoth.images.imgElement(async (image) => {
                    const buffer = await image.read();
                    const contentType = image.contentType;
                    const publicUrl = await saveImage(buffer, contentType);
                    return { src: publicUrl };
                })
            };
            const { value } = await mammoth.convertToHtml({ buffer }, options);
            htmlFn = value;
        } else {
            return NextResponse.json({ message: 'Unsupported file type. Please upload .docx or .pdf' }, { status: 400 });
        }

        const parsedQuestions = parseHtmlContent(htmlFn);

        console.log("Final Parsed Questions Sample (first 1):", JSON.stringify(parsedQuestions.slice(0, 1), null, 2));

        if (parsedQuestions.length === 0) {
            return NextResponse.json({ message: 'No valid questions found. Ensure format matches: "1. Question" and "A. Option".' }, { status: 400 });
        }

        const placeholders = parsedQuestions.map(() => '(?,?,?,?)').join(',');
        const sql = `INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option) VALUES ${placeholders}`;

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