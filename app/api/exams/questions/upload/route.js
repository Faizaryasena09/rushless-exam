import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import fs from 'fs/promises';
import path from 'path';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';

// Helper for ASYNC string replace
async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

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

        let htmlFn = '';

        try {
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();

            // Find the main HTML file
            const htmlEntry = zipEntries.find(entry => entry.entryName.match(/\.(htm|html)$/i));

            if (!htmlEntry) {
                return NextResponse.json({ message: 'No .htm or .html file found inside the zip. Please ensure the zip contains the exported HTML file.' }, { status: 400 });
            }

            // Read HTML content and decode it using iconv-lite
            // MS Word exports often use Windows-1252 encoding. We can attempt to decode using win1252.
            const rawBuffer = htmlEntry.getData();
            let htmlContent = iconv.decode(rawBuffer, 'win1252');

            // Fallback safety: If HTML specifies utf-8 but we decoded it as win1252, we can re-decode if we find charset=utf-8 in the string
            if (htmlContent.match(/charset=["']?utf-8/i)) {
                htmlContent = rawBuffer.toString('utf8');
            }

            // Create upload directory if it doesn't exist
            // Using process.cwd() for robust path handling
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', `exam-${examId}`);
            await fs.mkdir(uploadDir, { recursive: true });

            // Replace image sources: write file asynchronously and generate URL
            htmlContent = await replaceAsync(htmlContent, /<img[^>]*src=["']([^"']+)["'][^>]*>/gi, async (match, src) => {
                let searchSrc = decodeURIComponent(src);

                let imgEntry = zipEntries.find(e => e.entryName === searchSrc) ||
                    zipEntries.find(e => e.entryName.endsWith(searchSrc.split('/').pop() || searchSrc.split('\\').pop()));

                if (imgEntry) {
                    const imgBuffer = imgEntry.getData();

                    // Generate unique filename to avoid overwrites (e.g., from multiple imports)
                    const originalExt = path.extname(searchSrc) || '.png';
                    const uniqueFilename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${originalExt}`;
                    const filePath = path.join(uploadDir, uniqueFilename);

                    // Write the buffer to the filesystem
                    await fs.writeFile(filePath, imgBuffer);

                    // Reconstruct a dynamic media URL path (bypasses Next.js static build cache)
                    const nextPublicUrl = `/api/media/exam-${examId}/${uniqueFilename}`;
                    return match.replace(src, nextPublicUrl);
                }

                return match;
            });

            htmlFn = htmlContent;

        } catch (zipError) {
            console.error('Zip processing error:', zipError);
            return NextResponse.json({ message: 'Failed to process zip file. ' + zipError.message }, { status: 400 });
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
    // Step 1: Replace <img> tags with unique placeholders BEFORE stripping HTML
    const imgMap = {};
    let imgCounter = 0;
    let processedHtml = html.replace(/<img[^>]*>/gi, (match) => {
        const placeholder = `__IMG_${imgCounter}__`;
        imgMap[placeholder] = match;
        imgCounter++;
        return placeholder;
    });

    // Step 2: Strip specific block tags to create newlines, but KEEP styling and table tags
    const lines = processedHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        // Remove style blocks and script blocks entirely (including their content)
        .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
        // Clean up spans, fonts, and other noisy inline wrappers that Word exports 
        // We replace the opening and closing tags but keep the text inside.
        .replace(/<\/?(?:span|font)[^>]*>/gi, '')
        // Strip out structural document tags and block containers we already newline'd.
        // Doing this safely so we don't accidentally match half a tag
        .replace(/<\/?(?:html|head|body|title|meta|link|p|div|ul|ol|li|h[1-6])[^>]*>/gi, '')
        // Convert table semantics to newlines or keep them if they are useful for layout
        // We will keep table tags, but we need to ensure they don't break our line logic
        .split('\n')
        .map(l => l.trim())
        .filter(l => l);

    // Step 3: Restore <img> placeholders back to real tags
    const restoredLines = lines.map(line => {
        let restored = line;
        for (const [placeholder, imgTag] of Object.entries(imgMap)) {
            restored = restored.replace(new RegExp(placeholder, 'g'), imgTag);
        }
        return restored;
    });

    const questions = [];
    let currentQuestion = null;
    let currentOptionKey = null;

    // Robust Regex: allows any HTML tags before, between, or after the Number/Letter and the dot/parenthesis
    // We remove &nbsp; from this spacing matcher so it is not accidentally consumed if it's part of the text.
    const htmlTagSpacing = '(?:\\s*<[^>]+>\\s*|\\s+)*';

    // Question: ^(tags) (Number) (tags) [.)] (tags) (text)
    const qRegexStr = '^' + htmlTagSpacing + '(\\d+)' + htmlTagSpacing + '[.)]' + htmlTagSpacing + '(.*)';
    const qRegex = new RegExp(qRegexStr, 's');

    // Option: ^(tags) (*)? (tags) (Letter) (tags) [.)] (tags) (text)
    const optRegexStr = '^' + htmlTagSpacing + '(\\**)' + htmlTagSpacing + '([A-Za-z])' + htmlTagSpacing + '[.)]' + htmlTagSpacing + '(.*)';
    const optRegex = new RegExp(optRegexStr, 's');

    restoredLines.forEach(line => {
        const questionMatch = line.match(qRegex);

        if (questionMatch) {
            if (currentQuestion) {
                // Save previous question
                questions.push({ ...currentQuestion });
            }
            currentQuestion = {
                question_text: questionMatch[2].trim(),
                options: {},
                correct_option: null
            };
            currentOptionKey = null;
            return;
        }

        const optionMatch = line.match(optRegex);

        if (optionMatch && currentQuestion) {
            const isStarredPrefix = optionMatch[1].includes('*');
            const key = optionMatch[2].toUpperCase();
            let optionText = optionMatch[3].trim();
            let isCorrect = isStarredPrefix;

            // To check suffix or prefix asterisks accurately, we strip HTML
            const cleanText = optionText.replace(/<[^>]+>/g, '').trim();

            // Check if the option text ends with an asterisk
            if (!isCorrect && cleanText.endsWith('*')) {
                isCorrect = true;
                // Remove the asterisk at the end, ignoring HTML tags
                optionText = optionText.replace(/\*(\s*<[^>]+>\s*)*$/, '').trim();
            }
            // Check if the option text starts with an asterisk (fallback for weird spaces)
            else if (!isCorrect && cleanText.startsWith('*')) {
                isCorrect = true;
                optionText = optionText.replace(/^(?:\s*<[^>]+>\s*)*\*/, '').trim();
            }

            currentOptionKey = key;
            currentQuestion.options[key] = optionText;

            if (isCorrect) {
                currentQuestion.correct_option = key;
            }
            return;
        }

        // Handle multi-line question text or options
        if (currentQuestion) {
            if (currentOptionKey && currentQuestion.options[currentOptionKey] !== undefined) {
                let continuationText = line;
                const cleanContinuation = continuationText.replace(/<[^>]+>/g, '').trim();

                if (cleanContinuation.endsWith('*')) {
                    currentQuestion.correct_option = currentOptionKey;
                    continuationText = continuationText.replace(/\*(\s*<[^>]+>\s*)*$/, '').trim();
                }

                if (continuationText) {
                    currentQuestion.options[currentOptionKey] += ' <br> ' + continuationText;
                }
            } else {
                // Continuing the question text
                currentQuestion.question_text += (currentQuestion.question_text ? ' <br> ' : '') + line;
            }
        }
    });

    // Push the last question if exists
    if (currentQuestion) {
        questions.push({ ...currentQuestion });
    }

    // Default processing for missing correct options
    questions.forEach(q => {
        if (!q.correct_option) {
            // Default to 'A' if no option was marked correct
            q.correct_option = Object.keys(q.options)[0] || 'A';
        }
    });

    return questions;
}