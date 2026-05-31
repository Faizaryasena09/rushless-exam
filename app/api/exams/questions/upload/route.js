import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import AdmZip from 'adm-zip';
import iconv from 'iconv-lite';
import mammoth from 'mammoth';
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
        let documentListFormats = [];

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', `exam-${examId}`);
        await fs.mkdir(uploadDir, { recursive: true });
        console.log('[UPLOAD] 3. Upload dir ready:', uploadDir);

        const isDocx = file.name.toLowerCase().endsWith('.docx');

        if (isDocx) {
            try {
                // Parse word/document.xml and word/numbering.xml to extract exact list formats
                try {
                    const zip = new AdmZip(buffer);
                    const docXml = zip.readAsText('word/document.xml');
                    let numberingXml = '';
                    try {
                        numberingXml = zip.readAsText('word/numbering.xml');
                    } catch (e) {
                        console.log('[UPLOAD] No word/numbering.xml found in DOCX');
                    }

                    if (numberingXml) {
                        // Map abstractNumId -> ilvl -> numFmt
                        const abstractNumFormats = {};
                        const abstractNumBlocks = numberingXml.match(/<w:abstractNum[^>]*>[\s\S]*?<\/w:abstractNum>/g) || [];
                        
                        abstractNumBlocks.forEach(block => {
                            const absIdMatch = block.match(/w:abstractNumId="(\d+)"/);
                            if (absIdMatch) {
                                const absId = absIdMatch[1];
                                abstractNumFormats[absId] = {};
                                const lvlBlocks = block.match(/<w:lvl[^>]*>[\s\S]*?<\/w:lvl>/g) || [];
                                lvlBlocks.forEach(lvlBlock => {
                                    const ilvlMatch = lvlBlock.match(/w:ilvl="(\d+)"/);
                                    const numFmtMatch = lvlBlock.match(/<w:numFmt w:val="([^"]+)"/);
                                    if (ilvlMatch && numFmtMatch) {
                                        abstractNumFormats[absId][ilvlMatch[1]] = numFmtMatch[1];
                                    }
                                });
                            }
                        });

                        // Map numId -> ilvl -> numFmt
                        const numIdFormats = {};
                        const numBlocks = numberingXml.match(/<w:num[^>]*>[\s\S]*?<\/w:num>/g) || [];
                        numBlocks.forEach(numBlock => {
                            const numIdMatch = numBlock.match(/w:numId="(\d+)"/);
                            const absMatch = numBlock.match(/<w:abstractNumId w:val="(\d+)"/);
                            if (numIdMatch && absMatch) {
                                const numId = numIdMatch[1];
                                const absIdRef = absMatch[1];
                                numIdFormats[numId] = abstractNumFormats[absIdRef] || {};
                            }
                        });

                        // Parse document.xml to extract all list paragraphs and their format/text for text-matching alignment
                        const numCounts = {};
                        const paragraphMatches = docXml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g) || [];
                        paragraphMatches.forEach(p => {
                            const numPrMatch = p.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
                            if (numPrMatch) {
                                const numIdMatch = numPrMatch[1].match(/<w:numId w:val="(\d+)"/);
                                const ilvlMatch = numPrMatch[1].match(/<w:ilvl w:val="(\d+)"/);
                                const numId = numIdMatch ? numIdMatch[1] : null;
                                const ilvl = ilvlMatch ? ilvlMatch[1] : '0';
                                const numFmt = (numIdFormats[numId] && numIdFormats[numId][ilvl]) || 'decimal';
                                
                                const key = `${numId}-${ilvl}`;
                                if (!numCounts[key]) {
                                    numCounts[key] = 0;
                                }
                                numCounts[key]++;
                                const listIndex = numCounts[key];
                                
                                const textMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
                                const text = textMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
                                
                                documentListFormats.push({ text: text.trim(), format: numFmt, index: listIndex });
                            }
                        });
                        
                        console.log('[UPLOAD] ✅ Extracted docx list paragraphs:', documentListFormats.length);
                    }
                } catch (zipError) {
                    console.error('[UPLOAD] ⚠️ Failed to extract list formatting from ZIP:', zipError);
                }

                console.log('[UPLOAD] 4. Converting DOCX to HTML via Mammoth...');
                const options = {
                    styleMap: [
                        "u => u",
                        "strike => del"
                    ],
                    transformDocument: mammoth.transforms.paragraph((element) => {
                        if (element.alignment) {
                            return {
                                ...element,
                                children: [
                                    {
                                        type: "run",
                                        children: [
                                            {
                                                type: "text",
                                                value: `[[ALIGN:${element.alignment}]]`
                                            }
                                        ]
                                    },
                                    ...element.children
                                ]
                            };
                        }
                        return element;
                    }),
                    convertImage: mammoth.images.imgElement(async (image) => {
                        const imgBuffer = await image.readAsBuffer();
                        const extension = image.contentType.split('/')[1] || 'png';
                        const uniqueFilename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
                        const filePath = path.join(uploadDir, uniqueFilename);
                        
                        await fs.writeFile(filePath, imgBuffer);
                        console.log('[UPLOAD]    ✅ Saved DOCX image:', uniqueFilename, '| size:', imgBuffer.length, 'bytes');

                        const nextPublicUrl = `/api/media/exam-${examId}/${uniqueFilename}`;
                        return { src: nextPublicUrl };
                    })
                };
                const result = await mammoth.convertToHtml({ buffer }, options);
                let convertedHtml = result.value;
                
                // Replace alignment markers with inline styling
                convertedHtml = convertedHtml.replace(/<(p|h[1-6]|li)([^>]*)>\s*\[\[ALIGN:(center|right|left|justify|both)\]\]/gi, (match, tag, attrs, align) => {
                    const cssAlign = align.toLowerCase() === 'both' ? 'justify' : align.toLowerCase();
                    let newAttrs = attrs;
                    if (attrs.includes('style=')) {
                        newAttrs = attrs.replace(/style=(["'])(.*?)\1/gi, `style=$1$2; text-align: ${cssAlign};$1`);
                    } else {
                        newAttrs = attrs + ` style="text-align: ${cssAlign};"`;
                    }
                    return `<${tag}${newAttrs}>`;
                });
                
                htmlFn = convertedHtml;
                console.log('[UPLOAD] ✅ Mammoth conversion complete. HTML length:', htmlFn.length);
                if (result.messages && result.messages.length > 0) {
                    console.log('[UPLOAD] ⚠️ Mammoth warnings/messages:\n', result.messages.map(m => `  [${m.type}] ${m.message}`).join('\n'));
                }
            } catch (docxError) {
                console.error('[UPLOAD] ❌ DOCX processing error:', docxError);
                return NextResponse.json({ message: 'Failed to process DOCX file. ' + docxError.message }, { status: 400 });
            }
        } else {
            try {
                console.log('[UPLOAD] 4. Extracting ZIP...');
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
                console.log('[UPLOAD] 5. Decoding HTML content...');
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

                // Replace image sources: write file asynchronously and generate URL
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
        }

        console.log('[UPLOAD] 7. Parsing HTML into questions...');
        const t0 = performance.now();
        const parsedQuestions = parseHtmlContent(htmlFn, documentListFormats);
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

function getRomanNumeral(num) {
    const lookup = { m: 1000, cm: 900, d: 500, cd: 400, c: 100, xc: 90, l: 50, xl: 40, x: 10, ix: 9, v: 5, iv: 4, i: 1 };
    let roman = '';
    for (let i in lookup) {
        while (num >= lookup[i]) {
            roman += i;
            num -= lookup[i];
        }
    }
    return roman;
}

function getFormatForHtmlLi(liText, xmlListItems, searchState) {
    if (!xmlListItems || xmlListItems.length === 0) {
        return null;
    }
    
    if (searchState.currentIndex >= xmlListItems.length) {
        return xmlListItems[xmlListItems.length - 1];
    }

    const cleanLi = liText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    if (cleanLi === '') {
        return xmlListItems[searchState.currentIndex];
    }
    
    for (let i = searchState.currentIndex; i < xmlListItems.length; i++) {
        const cleanXml = xmlListItems[i].text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        
        const isExact = (cleanXml !== '' && cleanLi === cleanXml);
        const isSub = (cleanXml.length >= 4 && cleanLi.length >= 4) && (cleanLi.includes(cleanXml) || cleanXml.includes(cleanLi));

        if (isExact || isSub) {
            searchState.currentIndex = i + 1;
            
            // Consume subsequent XML items merged into this single HTML li
            let nextIdx = i + 1;
            let currentCombined = cleanXml;
            while (nextIdx < xmlListItems.length) {
                const nextXml = xmlListItems[nextIdx].text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                if (nextXml !== '' && cleanLi.includes(currentCombined + nextXml)) {
                    currentCombined += nextXml;
                    searchState.currentIndex = nextIdx + 1;
                    nextIdx++;
                } else {
                    break;
                }
            }
            
            return xmlListItems[i];
        }
    }
    
    return xmlListItems[searchState.currentIndex];
}

function restoreListMarkers(html, documentListFormats) {
    let output = '';
    let pos = 0;
    
    const tokenRegex = /(<\/?[a-z0-9]+[^>]*>|\[Multiple Choice\]|\[Pilihan Ganda\]|\[OPT\]|\[MATCHING\]|\[Menjodohkan\]|\[ESSAY\]|\[Esai\]|\[Uraian\]|\b(?:ans|jawaban|kunci|key)\s*:)/gi;
    
    let currentQuestionType = 'multiple_choice';
    let isOptSection = false;
    let matchingListCount = 0;
    
    const listStack = [];
    const searchState = { currentIndex: 0 };
    
    let lastMatch;
    let lastIndex = 0;
    
    while ((lastMatch = tokenRegex.exec(html)) !== null) {
        const textBefore = html.substring(lastIndex, lastMatch.index);
        output += textBefore;
        
        const token = lastMatch[0];
        const tokenLower = token.toLowerCase();
        
        if (tokenLower.includes('[multiple choice]') || tokenLower.includes('[pilihan ganda]')) {
            currentQuestionType = 'multiple_choice';
            isOptSection = false;
            output += token;
        } else if (tokenLower.includes('[matching]') || tokenLower.includes('[menjodohkan]')) {
            currentQuestionType = 'matching';
            matchingListCount = 0;
            output += token;
        } else if (tokenLower.includes('[essay]') || tokenLower.includes('[esai]') || tokenLower.includes('[uraian]')) {
            currentQuestionType = 'essay';
            output += token;
        } else if (tokenLower.includes('[opt]')) {
            isOptSection = true;
            output += token;
        } else if (tokenLower.match(/\b(?:ans|jawaban|kunci|key)\s*:/)) {
            isOptSection = false;
            output += token;
        } else if (tokenLower.startsWith('<ol') || tokenLower.startsWith('<ul')) {
            const isOl = tokenLower.startsWith('<ol');
            listStack.push({
                isOl,
                index: 0
            });
            output += token;
        } else if (tokenLower.startsWith('</ol') || tokenLower.startsWith('</ul')) {
            const popped = listStack.pop();
            if (popped && currentQuestionType === 'matching' && listStack.length === 0) {
                matchingListCount++;
            }
            output += token;
        } else if (tokenLower.startsWith('<li')) {
            const currentList = listStack[listStack.length - 1];
            if (currentList) {
                currentList.index++;
                const index = currentList.index;
                
                let prefix = '';
                
                // Extract clean text content of the list item to run text-matching alignment
                const itemStart = lastMatch.index + token.length;
                let nextStopIndex = html.length;
                const nextLi = html.indexOf('<li', itemStart);
                const nextLiClose = html.indexOf('</li>', itemStart);
                const nextOl = html.indexOf('<ol', itemStart);
                const nextOlClose = html.indexOf('</ol>', itemStart);
                const nextUl = html.indexOf('<ul', itemStart);
                const nextUlClose = html.indexOf('</ul>', itemStart);
                
                const indices = [nextLi, nextLiClose, nextOl, nextOlClose, nextUl, nextUlClose].filter(idx => idx !== -1);
                if (indices.length > 0) {
                    nextStopIndex = Math.min(...indices);
                }
                
                const liTextRaw = html.substring(itemStart, nextStopIndex);
                const liText = liTextRaw.replace(/<[^>]+>/g, '').trim();
                
                let xmlFormat = null;
                if (documentListFormats && documentListFormats.length > 0) {
                    xmlFormat = getFormatForHtmlLi(liText, documentListFormats, searchState);
                }
                
                if (currentQuestionType === 'multiple_choice' && isOptSection) {
                    // Multiple choice options ALWAYS get uppercase letters A, B, C...
                    prefix = String.fromCharCode(64 + index) + '. ';
                                } else if (xmlFormat) {
                    // Apply exact numbering format matched from Word XML
                    const fmt = xmlFormat.format;
                    const idx = xmlFormat.index || index;
                    if (fmt === 'decimal') {
                        prefix = idx + '. ';
                    } else if (fmt === 'lowerLetter') {
                        prefix = String.fromCharCode(96 + idx) + '. ';
                    } else if (fmt === 'upperLetter') {
                        prefix = String.fromCharCode(64 + idx) + '. ';
                    } else if (fmt === 'lowerRoman') {
                        prefix = getRomanNumeral(idx) + '. ';
                    } else if (fmt === 'upperRoman') {
                        prefix = getRomanNumeral(idx).toUpperCase() + '. ';
                    } else if (fmt === 'bullet') {
                        prefix = '• ';
                    } else {
                        prefix = idx + '. ';
                    }
                } else {
                    // Fallback to structural deduction
                    if (currentQuestionType === 'multiple_choice') {
                        if (currentList.isOl) {
                            prefix = index + '. ';
                        } else {
                            prefix = '• ';
                        }
                    } else if (currentQuestionType === 'matching') {
                        if (matchingListCount === 0) {
                            prefix = index + '. ';
                        } else {
                            prefix = String.fromCharCode(64 + index) + '. ';
                        }
                    } else {
                        if (currentList.isOl) {
                            prefix = index + '. ';
                        } else {
                            prefix = '• ';
                        }
                    }
                }
                
                output += token + prefix;
            } else {
                output += token;
            }
        } else {
            output += token;
        }
        
        lastIndex = tokenRegex.lastIndex;
    }
    
    output += html.substring(lastIndex);
    return output;
}

function parseHtmlContent(rawHtml, documentListFormats) {
    const decodedRaw = String(rawHtml || '').replace(/&nbsp;/gi, ' ').replace(/&#160;/gi, ' ');
    const html = restoreListMarkers(decodedRaw, documentListFormats);
    // Normalize literal newlines in HTML source to prevent unwanted line breaks from hard wraps
    const normalizedHtml = html.replace(/[\r\n]+/g, ' ');

    const styleTableHtml = (tableHtml) => {
        return tableHtml
            .replace(/<table([^>]*)>/gi, (match, attrs) => {
                if (attrs.includes('style=')) {
                    return match.replace(/style=(["'])(.*?)\1/gi, 'style=$1$2; border-collapse: collapse; width: 100%; margin: 12px 0;$1');
                }
                return `<table${attrs} style="border-collapse: collapse; width: 100%; margin: 12px 0;">`;
            })
            .replace(/<th([^>]*)>/gi, (match, attrs) => {
                if (attrs.includes('style=')) {
                    return match.replace(/style=(["'])(.*?)\1/gi, 'style=$1$2; border: 1px solid #cbd5e1; padding: 8px; background-color: #f8fafc; font-weight: 600;$1');
                }
                return `<th${attrs} style="border: 1px solid #cbd5e1; padding: 8px; background-color: #f8fafc; font-weight: 600;">`;
            })
            .replace(/<td([^>]*)>/gi, (match, attrs) => {
                if (attrs.includes('style=')) {
                    return match.replace(/style=(["'])(.*?)\1/gi, 'style=$1$2; border: 1px solid #cbd5e1; padding: 8px;$1');
                }
                return `<td${attrs} style="border: 1px solid #cbd5e1; padding: 8px;">`;
            });
    };

    const joinLinesHtml = (linesArray) => {
        let output = '';
        linesArray.forEach((line, index) => {
            if (index === 0) {
                output = line;
            } else {
                const prevEndsWithBlock = /<\/(p|div|h[1-6]|table|tr|ul|ol|li)>\s*$/i.test(output);
                const currStartsWithBlock = /^\s*<(p|div|h[1-6]|table|tr|ul|ol|li)\b/i.test(line);
                
                if (prevEndsWithBlock || currStartsWithBlock) {
                    output += ' ' + line;
                } else {
                    output += ' <br> ' + line;
                }
            }
        });
        return output;
    };

    const isStatement = (text) => {
        const clean = text.replace(/<[^>]+>/g, '').trim();
        // Matches (1), 1), [1], 1. at the start of the line
        return /^\s*(?:\(\d+\)|\d+\)|\[\d+\]|\d+\.)\s*/.test(clean);
    };

    const formatLine = (line) => {
        const trimmed = line.trim();
        if (/^\s*<(table|tr|td|ul|ol|li|div|h[1-6])\b/i.test(trimmed)) {
            return line;
        }
        
        if (isStatement(line)) {
            if (/^\s*<(p|li)\b/i.test(trimmed)) {
                if (trimmed.includes('style=')) {
                    return trimmed.replace(/style=(["'])(.*?)\1/gi, (match, quote, style) => {
                        return `style=${quote}${style}; margin-bottom: 4px; margin-left: 20px; padding-left: 24px; text-indent: -24px;${quote}`;
                    });
                } else {
                    return trimmed.replace(/<(p|li)/i, `<$1 style="margin-bottom: 4px; margin-left: 20px; padding-left: 24px; text-indent: -24px;"`);
                }
            } else {
                return `<p style="margin-bottom: 4px; margin-left: 20px; padding-left: 24px; text-indent: -24px; text-align: justify;">${trimmed}</p>`;
            }
        } else {
            if (/^\s*<(p|li)\b/i.test(trimmed)) {
                if (trimmed.includes('style=')) {
                    return trimmed.replace(/style=(["'])(.*?)\1/gi, (match, quote, style) => {
                        return `style=${quote}${style}; margin-bottom: 12px;${quote}`;
                    });
                } else {
                    return trimmed.replace(/<(p|li)/i, `<$1 style="margin-bottom: 12px;"`);
                }
            } else {
                return `<p style="margin-bottom: 12px; text-align: justify;">${trimmed}</p>`;
            }
        }
    };

    // Step 0.3: Replace <table> blocks with unique placeholders BEFORE stripping HTML to preserve table structures
    const tableMap = {};
    let tableCounter = 0;
    let tableProcessedHtml = normalizedHtml.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        const placeholder = `__TABLE_${tableCounter}__`;
        tableMap[placeholder] = styleTableHtml(match);
        tableCounter++;
        return '\n' + placeholder + '\n';
    });

    // Step 0.4: Replace MathML <math> blocks with unique placeholders BEFORE stripping HTML to preserve equations
    const mathMap = {};
    let mathCounter = 0;
    let mathProcessedHtml = tableProcessedHtml.replace(/<math[\s\S]*?<\/math>/gi, (match) => {
        const placeholder = `__MATH_${mathCounter}__`;
        mathMap[placeholder] = match;
        mathCounter++;
        return placeholder;
    });

    // Step 0.5: Replace aligned tags with unique placeholders BEFORE stripping HTML to preserve alignments
    let alignCounter = 0;
    let processedHtml = mathProcessedHtml.replace(/<(p|h[1-6]|li)([^>]*)(?:style=(["'])[^'\"]*text-align:\s*(center|right|left|justify|both)[^'\"]*\3)([^>]*)>/gi, (match, tag, beforeStyle, quote, align, afterStyle) => {
        const cssAlign = align.toLowerCase() === 'both' ? 'justify' : align.toLowerCase();
        return `__ALIGN_START_${cssAlign.toUpperCase()}_${alignCounter++}__`;
    });

    // Step 1: Replace <img> tags with unique placeholders BEFORE stripping HTML
    const imgMap = {};
    let imgCounter = 0;
    processedHtml = processedHtml.replace(/<img[^>]*>/gi, (match) => {
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
        .replace(/<\/?(?:span|font)[^>]*>/gi, '')
        // Strip out structural document tags and block containers we already newline'd.
        .replace(/<\/?(?:html|head|body|title|meta|link|p|div|ul|ol|li|h[1-6])[^>]*>/gi, '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l);

    // Step 3: Restore placeholders back to real tags
    const restoredLines = lines.map(line => {
        let restored = line;
        
        // Restore table placeholders
        for (const [placeholder, tableTag] of Object.entries(tableMap)) {
            restored = restored.replace(new RegExp(placeholder, 'g'), tableTag);
        }
        
        // Restore math placeholders
        for (const [placeholder, mathTag] of Object.entries(mathMap)) {
            restored = restored.replace(new RegExp(placeholder, 'g'), mathTag);
        }
        
        // Restore img placeholders
        for (const [placeholder, imgTag] of Object.entries(imgMap)) {
            restored = restored.replace(new RegExp(placeholder, 'g'), imgTag);
        }
        
        // Restore alignment placeholders
        const alignMatch = restored.match(/__ALIGN_START_(CENTER|RIGHT|LEFT|JUSTIFY)_[0-9]+__/i);
        if (alignMatch) {
            const align = alignMatch[1].toLowerCase();
            restored = restored.replace(/__ALIGN_START_(CENTER|RIGHT|LEFT|JUSTIFY)_[0-9]+__/i, `<p style="text-align: ${align};">`) + '</p>';
        }
        return restored;
    });

    const questions = [];
    let currentQuestion = null;
    let currentSection = null;

    const extractContentAfterPrefix = (originalLine, prefixPattern) => {
        const stripped = originalLine.replace(/<[^>]+>/g, '');
        const m = stripped.match(prefixPattern);
        if (!m) return originalLine;

        const prefixEndClean = m.index + m[0].length;
        let cleanPos = 0;
        let origPos = 0;
        while (cleanPos < prefixEndClean && origPos < originalLine.length) {
            if (originalLine[origPos] === '<') {
                const tagEnd = originalLine.indexOf('>', origPos);
                origPos = tagEnd !== -1 ? tagEnd + 1 : origPos + 1;
            } else {
                cleanPos++;
                origPos++;
            }
        }
        while (origPos < originalLine.length && originalLine[origPos] === '<') {
            const tagEnd = originalLine.indexOf('>', origPos);
            origPos = tagEnd !== -1 ? tagEnd + 1 : origPos + 1;
        }
        return originalLine.substring(origPos);
    };

    const finalizeQuestion = (q) => {
        const formattedLines = q.question_text_lines.map(line => formatLine(line));
        let questionText = joinLinesHtml(formattedLines);
        questionText = questionText.replace(/^(\s*(?:<[^>]+>\s*)*)\d+\s*[.)]\s*/, '$1').trim();
        
        let points = 1.0;
        const pointMatch = questionText.match(/\[(?:BOBOT|POINT):\s*([\d.]+)\]/i);
        if (pointMatch) {
            points = parseFloat(pointMatch[1]);
            questionText = questionText.replace(pointMatch[0], '').trim();
        }

        let result = {
            question_type: q.question_type,
            question_text: questionText,
            points: points,
            options: {},
            correct_option: '',
            scoring_strategy: 'standard',
            scoring_metadata: null
        };

        if (q.question_type === 'multiple_choice') {
            const parsedOpts = {};
            let currentKey = null;
            
            q.opt_lines.forEach(line => {
                const cleanLine = line.replace(/<[^>]+>/g, '').trim();
                const optMatch = cleanLine.match(/^\s*([A-Za-z])\s*([.)\-:]\s+|\s+)(.*)/s);
                if (optMatch) {
                    currentKey = optMatch[1].toUpperCase();
                    const content = extractContentAfterPrefix(line, /^\s*[A-Za-z]\s*([.)\-:]\s*|\s+)/);
                    parsedOpts[currentKey] = content.trim();
                } else if (currentKey) {
                    const prevText = parsedOpts[currentKey];
                    const prevEndsWithBlock = /<\/(p|div|h[1-6]|table|tr|ul|ol|li)>\s*$/i.test(prevText);
                    const currStartsWithBlock = /^\s*<(p|div|h[1-6]|table|tr|ul|ol|li)\b/i.test(line);
                    if (prevEndsWithBlock || currStartsWithBlock) {
                        parsedOpts[currentKey] += ' ' + line;
                    } else {
                        parsedOpts[currentKey] += ' <br> ' + line;
                    }
                }
            });

            // Re-key sequentially to A, B, C...
            const sortedKeys = Object.keys(parsedOpts).sort();
            const reKeyedOptions = {};
            const keyMap = {};
            sortedKeys.forEach((oldKey, index) => {
                const newKey = String.fromCharCode(65 + index);
                reKeyedOptions[newKey] = parsedOpts[oldKey];
                keyMap[oldKey] = newKey;
            });

            result.options = reKeyedOptions;

            // Parse Ans key
            const correctKeys = [];
            const rawAnsKeys = q.ans_line ? q.ans_line.toUpperCase().split(',').map(s => s.trim()) : [];
            rawAnsKeys.forEach(k => {
                if (keyMap[k]) {
                    correctKeys.push(keyMap[k]);
                } else if (reKeyedOptions[k]) {
                    correctKeys.push(k);
                } else {
                    correctKeys.push(k);
                }
            });

            // Determine if it is multiple choice complex (PGK)
            if (correctKeys.length > 1) {
                result.question_type = 'multiple_choice_complex';
                result.correct_option = correctKeys.sort().join(',');
                result.scoring_strategy = 'pgk_partial'; // default

                const fullCheckString = questionText + ' ' + (q.ans_line || '');
                if (fullCheckString.match(/\[PGK_STRICT\]/i)) {
                    result.scoring_strategy = 'pgk_strict';
                } else if (fullCheckString.match(/\[PGK_ANY\]/i)) {
                    result.scoring_strategy = 'pgk_any';
                } else if (fullCheckString.match(/\[PGK_ADDITIVE\]/i)) {
                    result.scoring_strategy = 'pgk_additive';
                }
                
                result.question_text = result.question_text
                    .replace(/\[PGK_STRICT\]/gi, '')
                    .replace(/\[PGK_PARTIAL\]/gi, '')
                    .replace(/\[PGK_ANY\]/gi, '')
                    .replace(/\[PGK_ADDITIVE\]/gi, '')
                    .trim();
            } else {
                const keys = Object.keys(reKeyedOptions);
                if (keys.length === 2 && keys.every(k => {
                    const cleanVal = String(reKeyedOptions[k] || '').replace(/<[^>]+>/g, '').trim().toLowerCase();
                    return cleanVal === 'benar' || cleanVal === 'salah';
                })) {
                    result.question_type = 'true_false';
                } else {
                    result.question_type = 'multiple_choice';
                }
                result.correct_option = correctKeys[0] || keys[0] || 'A';
                result.scoring_strategy = 'standard';
            }
        } else if (q.question_type === 'essay') {
            result.options = {};
            result.correct_option = '';
            
            let strategy = 'essay_manual';
            let cleanAnsLine = q.ans_line || '';
            
            const fullCheckString = questionText + ' ' + cleanAnsLine;
            if (fullCheckString.match(/\[ESSAY_ANY\]/i)) {
                strategy = 'essay_any_keyword';
                cleanAnsLine = cleanAnsLine.replace(/\[ESSAY_ANY\]/gi, '').trim();
            } else if (fullCheckString.match(/\[ESSAY_STRICT\]/i)) {
                strategy = 'essay_strict_keywords';
                cleanAnsLine = cleanAnsLine.replace(/\[ESSAY_STRICT\]/gi, '').trim();
            } else if (fullCheckString.match(/\[ESSAY_MANUAL\]/i)) {
                strategy = 'essay_manual';
                cleanAnsLine = cleanAnsLine.replace(/\[ESSAY_MANUAL\]/gi, '').trim();
            } else if (cleanAnsLine.length > 0) {
                strategy = 'essay_keywords';
            }

            result.scoring_strategy = strategy;
            result.question_text = result.question_text
                .replace(/\[ESSAY_ANY\]/gi, '')
                .replace(/\[ESSAY_STRICT\]/gi, '')
                .replace(/\[ESSAY_MANUAL\]/gi, '')
                .trim();

            if (strategy !== 'essay_manual' && cleanAnsLine) {
                const keywords = cleanAnsLine.split(',').map(k => k.trim()).filter(k => k);
                result.scoring_metadata = { keywords };
            }
        } else if (q.question_type === 'matching') {
            const allLines = [
                ...q.question_text_lines,
                ...q.opt_lines,
                ...q.raw_lines
            ];

            const premises = {};
            const responses = {};
            const qTextParts = [];
            let foundFirstItem = false;

            allLines.forEach((line, idx) => {
                const cleanLine = line.replace(/<[^>]+>/g, '').trim();
                const premiseMatch = cleanLine.match(/^\s*(\d+)\s*([.)\-:]\s+|\s+)(.*)/s);
                const responseMatch = cleanLine.match(/^\s*([A-Za-z])\s*([.)\-:]\s+|\s+)(.*)/s);

                if (idx > 0 && premiseMatch) {
                    foundFirstItem = true;
                    const key = premiseMatch[1];
                    const val = extractContentAfterPrefix(line, /^\s*\d+\s*([.)\-:]\s*|\s+)/).trim() || premiseMatch[3].trim();
                    premises[key] = val;
                } else if (idx > 0 && responseMatch) {
                    foundFirstItem = true;
                    const key = responseMatch[1].toLowerCase();
                    const val = extractContentAfterPrefix(line, /^\s*[A-Za-z]\s*([.)\-:]\s*|\s+)/).trim() || responseMatch[3].trim();
                    responses[key] = val;
                } else if (!foundFirstItem) {
                    qTextParts.push(line);
                }
            });

            const formattedParts = qTextParts.map(line => formatLine(line));
            let finalQText = joinLinesHtml(formattedParts);
            finalQText = finalQText.replace(/^(\s*(?:<[^>]+>\s*)*)\d+\s*[.)]\s*/, '$1').trim();
            const finalPointMatch = finalQText.match(/\[(?:BOBOT|POINT):\s*([\d.]+)\]/i);
            if (finalPointMatch) {
                result.points = parseFloat(finalPointMatch[1]);
                finalQText = finalQText.replace(finalPointMatch[0], '').trim();
            }
            result.question_text = finalQText;

            const pairs = [];
            const ansParts = q.ans_line ? q.ans_line.split(',').map(s => s.trim()) : [];
            ansParts.forEach(part => {
                const match = part.match(/^\s*(\d+)\s*[-=]\s*([A-Za-z]+)/);
                if (match) {
                    const pKey = match[1];
                    const rKey = match[2].toLowerCase();
                    const pText = premises[pKey] || '';
                    const rText = responses[rKey] || '';
                    pairs.push({
                        id: pKey,
                        p: pText,
                        r: rText
                    });
                }
            });

            result.options = {
                pairs,
                responses: Object.values(responses)
            };
            result.correct_option = ansParts.join(',');
            result.scoring_strategy = 'standard';
        }

        return result;
    };

    let currentQuestionType = 'multiple_choice';

    restoredLines.forEach(line => {
        const cleanLine = line.replace(/<[^>]+>/g, '').trim();
        const typeMatch = cleanLine.match(/^\s*\[(Multiple Choice|Pilihan Ganda|ESSAY|Esai|Uraian|MATCHING|Menjodohkan)\]/i);
        
        if (typeMatch) {
            if (currentQuestion) {
                questions.push(finalizeQuestion(currentQuestion));
            }
            const rawType = typeMatch[1].toLowerCase();
            let type = 'multiple_choice';
            if (rawType === 'essay' || rawType === 'esai' || rawType === 'uraian') {
                type = 'essay';
            } else if (rawType === 'matching' || rawType === 'menjodohkan') {
                type = 'matching';
            }
            currentQuestionType = type;
            
            currentQuestion = {
                question_type: type,
                question_text_lines: [],
                raw_lines: [],
                opt_lines: [],
                ans_line: null
            };
            currentSection = 'question';
            return;
        }

        // Detect implicit new question starting after Ans line
        if (currentQuestion && currentQuestion.ans_line !== null) {
            questions.push(finalizeQuestion(currentQuestion));
            currentQuestion = {
                question_type: currentQuestionType,
                question_text_lines: [line],
                raw_lines: [],
                opt_lines: [],
                ans_line: null
            };
            currentSection = 'question';
            return;
        }

        const isTableLine = /<\/?(?:table|tr|td|th|tbody|thead|tfoot)\b/i.test(line);

        // Detect implicit new question starting with a number
        if (currentQuestion && currentQuestion.question_type !== 'matching') {
            const isNumbered = cleanLine.match(/^\s*\d+\s*[.)]/);
            const isPrevComplete = currentQuestion.opt_lines.length > 0 || currentQuestion.ans_line !== null;
            
            if (isNumbered && isPrevComplete && !isTableLine) {
                questions.push(finalizeQuestion(currentQuestion));
                currentQuestion = {
                    question_type: currentQuestionType,
                    question_text_lines: [line],
                    raw_lines: [],
                    opt_lines: [],
                    ans_line: null
                };
                currentSection = 'question';
                return;
            }
        }

        if (!currentQuestion) {
            const isNumbered = cleanLine.match(/^\s*\d+\s*[.)]/);
            if (isNumbered) {
                currentQuestion = {
                    question_type: 'multiple_choice',
                    question_text_lines: [line],
                    raw_lines: [],
                    opt_lines: [],
                    ans_line: null
                };
                currentSection = 'question';
            }
            return;
        }

        if (cleanLine.match(/^\s*\[OPT\]/i)) {
            currentSection = 'options';
            return;
        }

        // Auto-detect start of options section for multiple choice questions if encountering 'A' or 'a' prefix
        if (currentQuestion && 
            currentQuestion.question_type === 'multiple_choice' && 
            currentSection === 'question' &&
            !isTableLine) {
            const isOptionStart = cleanLine.match(/^\s*[aA]\s*[.)\-:]\s+/);
            if (isOptionStart) {
                currentSection = 'options';
            }
        }

        const ansMatch = cleanLine.match(/^\s*(?:ans|jawaban|kunci|key)\s*:\s*(.*)/i);
        if (ansMatch) {
            currentQuestion.ans_line = ansMatch[1].trim();
            currentSection = null;
            return;
        }

        if (currentSection === 'question') {
            currentQuestion.question_text_lines.push(line);
        } else if (currentSection === 'options') {
            currentQuestion.opt_lines.push(line);
        } else {
            currentQuestion.raw_lines.push(line);
        }
    });

    if (currentQuestion) {
        questions.push(finalizeQuestion(currentQuestion));
    }

    return questions;
}
