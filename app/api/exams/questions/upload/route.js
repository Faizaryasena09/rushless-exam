import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import fs from 'fs/promises';
import path from 'path';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import { recalculateExamScores, distributeExamPoints, invalidateExamCache } from '@/app/lib/exams';
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
        console.log('\n========== [UPLOAD] START ==========');
        console.log('[UPLOAD] 1. Checking session...');
        const session = await getIronSession(await cookies(), sessionOptions);
        if (!session.user || session.user.roleName === 'student') {
            console.log('[UPLOAD] ❌ Unauthorized - user:', session.user?.username || 'none', 'role:', session.user?.roleName || 'none');
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        console.log('[UPLOAD] ✅ Authorized - user:', session.user.username, 'role:', session.user.roleName);

        console.log('[UPLOAD] 2. Reading form data...');
        const formData = await request.formData();
        const file = formData.get('file');
        const examId = formData.get('examId');

        if (!file || !examId) {
            console.log('[UPLOAD] ❌ Missing input - file:', !!file, 'examId:', examId);
            return NextResponse.json({ message: 'File and Exam ID are required' }, { status: 400 });
        }
        console.log('[UPLOAD] ✅ File received:', file.name, 'size:', file.size, 'bytes | examId:', examId);

        const buffer = Buffer.from(await file.arrayBuffer());
        console.log('[UPLOAD] ✅ Buffer created, length:', buffer.length);

        let htmlFn = '';

        try {
            console.log('[UPLOAD] 3. Extracting ZIP...');
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();
            console.log('[UPLOAD] ✅ ZIP entries found:', zipEntries.length, '| Names:', zipEntries.map(e => e.entryName).join(', '));

            // Find the main HTML file
            const htmlEntry = zipEntries.find(entry => entry.entryName.match(/\.(htm|html)$/i));

            if (!htmlEntry) {
                console.log('[UPLOAD] ❌ No HTML file found in ZIP');
                return NextResponse.json({ message: 'No .htm or .html file found inside the zip. Please ensure the zip contains the exported HTML file.' }, { status: 400 });
            }
            console.log('[UPLOAD] ✅ Found HTML file:', htmlEntry.entryName);

            // Read HTML content and decode it using iconv-lite
            // MS Word exports often use Windows-1252 encoding. We can attempt to decode using win1252.
            console.log('[UPLOAD] 4. Decoding HTML content...');
            const rawBuffer = htmlEntry.getData();
            let htmlContent = iconv.decode(rawBuffer, 'win1252');

            // Fallback safety: If HTML specifies utf-8 but we decoded it as win1252, we can re-decode if we find charset=utf-8 in the string
            if (htmlContent.match(/charset=["']?utf-8/i)) {
                htmlContent = rawBuffer.toString('utf8');
                console.log('[UPLOAD] ✅ Re-decoded as UTF-8');
            } else {
                console.log('[UPLOAD] ✅ Decoded as Windows-1252');
            }
            console.log('[UPLOAD] HTML content length:', htmlContent.length, 'chars');

            // Create upload directory if it doesn't exist
            // Using process.cwd() for robust path handling
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', `exam-${examId}`);
            await fs.mkdir(uploadDir, { recursive: true });
            console.log('[UPLOAD] 5. Upload dir ready:', uploadDir);

            // Replace image sources: write file asynchronously and generate URL
            // Support both standard <img> and Word-specific <v:imagedata> tags, with optional quotes for src
            const imgRegex = /<(?:img|v:imagedata)[^>]*src=["']?([^"'\s>]+)["']?[^>]*>/gi;

            console.log('[UPLOAD] 6. Processing images in HTML...');
            let imgCount = 0;
            htmlContent = await replaceAsync(htmlContent, imgRegex, async (match, src) => {
                let searchSrc = decodeURIComponent(src);
                console.log('[UPLOAD]    → Found image reference:', searchSrc);

                // Find entry in ZIP - check for exact path or just the filename
                let imgEntry = zipEntries.find(e => e.entryName === searchSrc) ||
                    zipEntries.find(e => e.entryName.replace(/\\/g, '/') === searchSrc.replace(/\\/g, '/')) ||
                    zipEntries.find(e => e.entryName.toLowerCase().endsWith(searchSrc.split('/').pop().toLowerCase() || searchSrc.split('\\').pop().toLowerCase()));

                if (imgEntry) {
                    const imgBuffer = imgEntry.getData();

                    // Generate unique filename to avoid overwrites
                    const originalExt = path.extname(searchSrc) || '.png';
                    const uniqueFilename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${originalExt}`;
                    const filePath = path.join(uploadDir, uniqueFilename);

                    // Write the buffer to the filesystem
                    await fs.writeFile(filePath, imgBuffer);
                    imgCount++;
                    console.log('[UPLOAD]    ✅ Saved image:', uniqueFilename, '| size:', imgBuffer.length, 'bytes');

                    // Reconstruct a dynamic media URL path
                    const nextPublicUrl = `/api/media/exam-${examId}/${uniqueFilename}`;

                    // If it was a v:imagedata tag, convert it to a standard <img> tag for browser compatibility
                    if (match.toLowerCase().startsWith('<v:imagedata')) {
                        return `<img src="${nextPublicUrl}">`;
                    }

                    return match.replace(src, nextPublicUrl);
                }

                console.log('[UPLOAD]    ⚠️ Image not found in ZIP:', searchSrc);
                return match;
            });
            console.log('[UPLOAD] ✅ Total images processed:', imgCount);

            htmlFn = htmlContent;

        } catch (zipError) {
            console.error('[UPLOAD] ❌ Zip processing error:', zipError);
            return NextResponse.json({ message: 'Failed to process zip file. ' + zipError.message }, { status: 400 });
        }

        console.log('[UPLOAD] 7. Parsing HTML into questions...');
        const t0 = performance.now();
        const parsedQuestions = parseHtmlContent(htmlFn);
        const t1 = performance.now();
        console.log(`[UPLOAD] ✅ Parsed questions: ${parsedQuestions.length} (took ${(t1 - t0).toFixed(1)}ms)`);

        if (parsedQuestions.length === 0) {
            console.log('[UPLOAD] ❌ No valid questions found after parsing');
            return NextResponse.json({ message: 'No valid questions found. Ensure format matches: "1. Question" and "A. Option".' }, { status: 400 });
        }

        // Log detail setiap soal
        parsedQuestions.forEach((q, i) => {
            console.log(`[UPLOAD]    Soal ${i + 1}: type=${q.question_type} | options=${Object.keys(q.options).join(',')} | correct=${q.correct_option} | points=${q.points} | strategy=${q.scoring_strategy}`);
            console.log(`[UPLOAD]      Text: ${q.question_text.substring(0, 80)}${q.question_text.length > 80 ? '...' : ''}`);
        });

        // --- Database Insertion ---
        console.log('[UPLOAD] 8. Inserting into database...');
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
        console.log('[UPLOAD] ✅ Database insert complete |', parsedQuestions.length, 'rows');

        // Recalculate all scores for this exam after import
        console.log('[UPLOAD] 9. Post-processing scores...');
        const examSettings = await query({
            query: 'SELECT auto_distribute FROM rhs_exams WHERE id = ?',
            values: [examId],
        });

        if (examSettings.length > 0 && examSettings[0].auto_distribute) {
            console.log('[UPLOAD]    → Auto-distribute enabled, distributing points...');
            await distributeExamPoints(examId);
            console.log('[UPLOAD]    ✅ Points distributed');
        } else {
            console.log('[UPLOAD]    → Auto-distribute disabled, skipping');
        }

        console.log('[UPLOAD]    → Recalculating exam scores...');
        await recalculateExamScores(examId);
        console.log('[UPLOAD]    ✅ Scores recalculated');

        // Invalidate Redis Cache IMMEDIATELY after update
        console.log('[UPLOAD] 10. Invalidating cache...');
        await invalidateExamCache(examId);
        console.log('[UPLOAD] ✅ Cache invalidated');

        console.log('[UPLOAD] ========== DONE ✅ | Imported', parsedQuestions.length, 'questions ==========\n');
        return NextResponse.json({ message: `Successfully imported ${parsedQuestions.length} questions.` });

    } catch (error) {
        console.error('[UPLOAD] ❌ FATAL ERROR:', error);
        return NextResponse.json({ message: 'Failed to import questions.', error: error.message }, { status: 500 });
    }
}

function parseHtmlContent(html) {
    // Normalize literal newlines in HTML source to prevent unwanted line breaks from hard wraps
    const normalizedHtml = html.replace(/[\r\n]+/g, ' ');

    // Step 1: Replace <img> tags with unique placeholders BEFORE stripping HTML
    const imgMap = {};
    let imgCounter = 0;
    let processedHtml = normalizedHtml.replace(/<img[^>]*>/gi, (match) => {
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

    // OPTIMIZED: Match patterns on CLEAN text (HTML stripped) to avoid catastrophic backtracking.
    // The old htmlTagSpacing regex `(?:\s*<[^>]+>\s*|\s+)*` caused exponential backtracking
    // because \s* and \s+ alternatives overlap — on non-matching lines the engine tries
    // millions of combinations before giving up. Stripping HTML first makes this O(n).
    const qRegexClean = /^\s*(\d+)\s*[.)]\s*(.*)/s;
    const optRegexClean = /^\s*(\**)\s*([A-Za-z])\s*[.)]\s*(.*)/s;

    // Helper: given a prefix pattern matched on clean text, extract the content after
    // that prefix from the original HTML line (preserving images, tables, etc.)
    const extractContentAfterPrefix = (originalLine, prefixPattern) => {
        const stripped = originalLine.replace(/<[^>]+>/g, '');
        const m = stripped.match(prefixPattern);
        if (!m) return originalLine;

        // Calculate where the prefix ends in the clean string
        const prefixEndClean = m.index + m[0].length;
        // Map that position back to the original HTML string
        let cleanPos = 0;
        let origPos = 0;
        while (cleanPos < prefixEndClean && origPos < originalLine.length) {
            if (originalLine[origPos] === '<') {
                // Skip entire HTML tag in original
                const tagEnd = originalLine.indexOf('>', origPos);
                origPos = tagEnd !== -1 ? tagEnd + 1 : origPos + 1;
            } else {
                cleanPos++;
                origPos++;
            }
        }
        // Also skip any HTML tags immediately following the prefix
        while (origPos < originalLine.length && originalLine[origPos] === '<') {
            const tagEnd = originalLine.indexOf('>', origPos);
            origPos = tagEnd !== -1 ? tagEnd + 1 : origPos + 1;
        }
        return originalLine.substring(origPos);
    };

    restoredLines.forEach(line => {
        // Strip HTML tags once per line for fast pattern matching
        const cleanLine = line.replace(/<[^>]+>/g, '').trim();
        const questionMatch = cleanLine.match(qRegexClean);

        if (questionMatch) {
            if (currentQuestion) {
                // Save previous question
                questions.push({ ...currentQuestion });
            }
            // Extract question text from original line, preserving HTML (images, tables)
            const contentFromOriginal = extractContentAfterPrefix(line, /^\s*\d+\s*[.)]\s*/);
            currentQuestion = {
                question_text: contentFromOriginal.trim() || questionMatch[2].trim(),
                options: {},
                correct_options: []
            };
            currentOptionKey = null;
            return;
        }

        const optionMatch = cleanLine.match(optRegexClean);
        const cleanLineLower = cleanLine.toLowerCase();
        const tfMatch = cleanLineLower.match(/^(\*?)\s*(benar|salah)\s*(\*?)$/i);

        if (optionMatch && currentQuestion) {
            const isStarredPrefix = optionMatch[1].includes('*');
            const key = optionMatch[2].toUpperCase();
            // Extract option text from original line, preserving HTML
            let optionText = extractContentAfterPrefix(line, /^\s*\**\s*[A-Za-z]\s*[.)]\s*/).trim() || optionMatch[3].trim();
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

    // Smart cleaning helper
    const cleanContent = (text) => {
        if (!text) return '';
        return text
            .replace(/&nbsp;/gi, ' ') // Replace non-breaking space
            .replace(/[ \t]+/g, ' ')    // Collapse multiple horizontal spaces
            .replace(/(?:\s*<br\s*\/?>\s*){2,}/gi, ' <br> ') // Collapse multiple enters to exactly one
            .replace(/^\s*<br\s*\/?>|<br\s*\/?>\s*$/gi, '') // Trim leading/trailing <br>
            .trim();
    };

    // Default processing for missing correct options and types
    questions.forEach(q => {
        // Apply smart cleanup
        q.question_text = cleanContent(q.question_text);
        Object.keys(q.options).forEach(key => {
            q.options[key] = cleanContent(q.options[key]);
        });

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
