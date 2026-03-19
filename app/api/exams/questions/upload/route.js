import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import fs from 'fs/promises';
import path from 'path';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import { recalculateExamScores, distributeExamPoints } from '@/app/lib/exams';
import redis, { isRedisReady } from '@/app/lib/redis';

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
        const placeholders = parsedQuestions.map(() => '(?,?,?,?,?,?,?,?)').join(',');
        const sql = `INSERT INTO rhs_exam_questions (exam_id, question_text, options, correct_option, question_type, points, scoring_strategy, scoring_metadata) VALUES ${placeholders}`;

        // 2. Flatten array for values mapping
        const values = parsedQuestions.flatMap(q =>
            [
                examId, 
                q.question_text, 
                JSON.stringify(q.options), 
                q.correct_option || '', 
                q.question_type || 'multiple_choice',
                q.points || 1.0,
                q.scoring_strategy || 'standard',
                q.scoring_metadata ? JSON.stringify(q.scoring_metadata) : null
            ]
        );

        await query({ query: sql, values: values });

        // Recalculate all scores for this exam after import
        const examSettings = await query({
            query: 'SELECT auto_distribute FROM rhs_exams WHERE id = ?',
            values: [examId],
        });

        if (examSettings.length > 0 && examSettings[0].auto_distribute) {
            await distributeExamPoints(examId);
        }

        await recalculateExamScores(examId);
        
        // Invalidate Redis Cache IMMEDIATELY after update
        if (isRedisReady()) {
          await Promise.all([
            redis.del(`exam:data:${examId}`),
            redis.del(`exam:settings-full:${examId}`),
            redis.keys('exams:list:*').then(keys => keys.length > 0 ? redis.del(keys) : null)
          ]).catch(() => {});
        }

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
                correct_options: []
            };
            currentOptionKey = null;
            return;
        }

        const optionMatch = line.match(optRegex);
        const cleanLine = line.replace(/<[^>]+>/g, '').trim().toLowerCase();
        const tfMatch = cleanLine.match(/^(\*?)\s*(benar|salah)\s*(\*?)$/i);

        if (optionMatch && currentQuestion) {
            const isStarredPrefix = optionMatch[1].includes('*');
            const key = optionMatch[2].toUpperCase();
            let optionText = optionMatch[3].trim();
            let isCorrect = isStarredPrefix;

            // To check suffix or prefix asterisks accurately, we strip HTML
            const cleanOptionText = optionText.replace(/<[^>]+>/g, '').trim();

            if (!isCorrect && cleanOptionText.endsWith('*')) {
                isCorrect = true;
                optionText = optionText.replace(/\*(\s*<[^>]+>\s*)*$/, '').trim();
            } else if (!isCorrect && cleanOptionText.startsWith('*')) {
                isCorrect = true;
                optionText = optionText.replace(/^(?:\s*<[^>]+>\s*)*\*/, '').trim();
            }

            currentOptionKey = key;
            currentQuestion.options[key] = optionText;

            if (isCorrect) {
                currentQuestion.correct_options.push(key);
            }
            return;
        } else if (tfMatch && currentQuestion) {
            // Handle True/False option without prefix (e.g., "*Benar" or "Salah")
            const isCorrect = tfMatch[1] === '*' || tfMatch[3] === '*';
            const tfText = tfMatch[2].charAt(0).toUpperCase() + tfMatch[2].slice(1).toLowerCase();
            
            // Assign sequential keys A, B...
            const existingKeys = Object.keys(currentQuestion.options);
            const key = String.fromCharCode(65 + existingKeys.length);
            
            currentOptionKey = key;
            currentQuestion.options[key] = tfText;

            if (isCorrect) {
                currentQuestion.correct_options.push(key);
            }
            return;
        }

        // Handle multi-line question text or options
        if (currentQuestion) {
            if (currentOptionKey && currentQuestion.options[currentOptionKey] !== undefined) {
                let continuationText = line;
                const cleanContinuation = continuationText.replace(/<[^>]+>/g, '').trim();

                if (cleanContinuation.endsWith('*')) {
                    if (!currentQuestion.correct_options.includes(currentOptionKey)) {
                        currentQuestion.correct_options.push(currentOptionKey);
                    }
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

    // Default processing for missing correct options and types
    questions.forEach(q => {
        // Detect Markers in question text
        // Point Marker: [BOBOT: 5] or [POINT: 5]
        const pointMatch = q.question_text.match(/\[(?:BOBOT|POINT):\s*([\d.]+)\]/i);
        if (pointMatch) {
            q.points = parseFloat(pointMatch[1]);
            q.question_text = q.question_text.replace(pointMatch[0], '').trim();
        } else {
            q.points = 1.0;
        }

        // Strategy Markers
        if (q.question_text.match(/\[PGK_STRICT\]/i)) {
            q.scoring_strategy = 'pgk_strict';
            q.question_text = q.question_text.replace(/\[PGK_STRICT\]/gi, '').trim();
        } else if (q.question_text.match(/\[PGK_PARTIAL\]/i)) {
            q.scoring_strategy = 'pgk_partial';
            q.question_text = q.question_text.replace(/\[PGK_PARTIAL\]/gi, '').trim();
        } else if (q.question_text.match(/\[PGK_ANY\]/i)) {
            q.scoring_strategy = 'pgk_any';
            q.question_text = q.question_text.replace(/\[PGK_ANY\]/gi, '').trim();
        } else if (q.question_text.match(/\[PGK_ADDITIVE\]/i)) {
            q.scoring_strategy = 'pgk_additive';
            q.question_text = q.question_text.replace(/\[PGK_ADDITIVE\]/gi, '').trim();
        }

        // Keywords Marker
        const kwMatch = q.question_text.match(/\[KEYWORDS:\s*([^\]]+)\]/i);
        const kwAnyMatch = q.question_text.match(/\[ESSAY_ANY:\s*([^\]]+)\]/i);
        const kwStrictMatch = q.question_text.match(/\[ESSAY_STRICT:\s*([^\]]+)\]/i);
        
        if (kwMatch) {
            q.scoring_metadata = { keywords: kwMatch[1].split(',').map(k => k.trim()).filter(k => k) };
            q.scoring_strategy = 'essay_keywords';
            q.question_text = q.question_text.replace(kwMatch[0], '').trim();
        } else if (kwAnyMatch) {
            q.scoring_metadata = { keywords: kwAnyMatch[1].split(',').map(k => k.trim()).filter(k => k) };
            q.scoring_strategy = 'essay_any_keyword';
            q.question_text = q.question_text.replace(kwAnyMatch[0], '').trim();
        } else if (kwStrictMatch) {
            q.scoring_metadata = { keywords: kwStrictMatch[1].split(',').map(k => k.trim()).filter(k => k) };
            q.scoring_strategy = 'essay_strict_keywords';
            q.question_text = q.question_text.replace(kwStrictMatch[0], '').trim();
        }

        // Detect Essay
        if (q.question_text.toLowerCase().includes('[essay]')) {
            q.question_type = 'essay';
            q.question_text = q.question_text.replace(/\[essay\]/gi, '').trim();
            q.options = {};
            q.correct_option = '';
            if (!q.scoring_strategy) q.scoring_strategy = 'essay_manual';
        } else {
            const keys = Object.keys(q.options);
            const correctKeys = q.correct_options || [];

            // Detect Multiple Choice Complex
            if (correctKeys.length > 1) {
                q.question_type = 'multiple_choice_complex';
                q.correct_option = correctKeys.sort().join(',');
                if (!q.scoring_strategy) q.scoring_strategy = 'pgk_partial'; // Default to partial for PGK
            } 
            // Detect True/False
            else if (keys.length === 2 && 
                     keys.every(k => q.options[k].toLowerCase() === 'benar' || q.options[k].toLowerCase() === 'salah')) {
                q.question_type = 'true_false';
                q.correct_option = correctKeys[0] || 'A';
                q.scoring_strategy = 'standard';
            }
            // Standard Multiple Choice
            else {
                q.question_type = 'multiple_choice';
                q.correct_option = correctKeys[0] || keys[0] || 'A';
                q.scoring_strategy = 'standard';
            }
        }
        delete q.correct_options; // Cleanup temp field
    });

    return questions;
}