import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, BorderStyle, ImageRun, Table, TableRow, TableCell
} from 'docx';
import path from 'path';
import iconv from 'iconv-lite';
import fs from 'fs/promises';
import { getExamSettings, getExamQuestions } from '@/app/lib/exams';
import { isRedisReady } from '@/app/lib/redis';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// Helper to convert HTML table to docx Table object
function parseHtmlTableToDocx(tableHtml) {
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
    
    const rows = [];
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const rowContent = rowMatch[1];
        const cells = [];
        let cellMatch;
        
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            const cellText = stripHtml(cellMatch[2]);
            cells.push(
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: cellText,
                                    size: 20, // slightly smaller font for tables
                                    font: 'Arial'
                                })
                            ]
                        })
                    ]
                })
            );
        }
        
        if (cells.length > 0) {
            rows.push(
                new TableRow({
                    children: cells
                })
            );
        }
    }
    
    if (rows.length > 0) {
        return new Table({
            rows: rows
        });
    }
    return null;
}

// Helper to parse bold, italic, and underline tags into runs
function parseInlineRuns(html) {
    if (!html) return [];
    const inlineRegex = /<(strong|b|em|i|u)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    const runs = [];
    let lastIndex = 0;
    let match;
    
    while ((match = inlineRegex.exec(html)) !== null) {
        const textBefore = html.substring(lastIndex, match.index);
        if (textBefore) {
            runs.push({ text: decodeEntities(textBefore) });
        }
        
        const tag = match[1].toLowerCase();
        const content = match[2];
        
        const subRuns = parseInlineRuns(content);
        if (subRuns.length === 0) {
            const run = { text: decodeEntities(content) };
            if (tag === 'strong' || tag === 'b') run.bold = true;
            if (tag === 'em' || tag === 'i') run.italic = true;
            if (tag === 'u') run.underline = true;
            runs.push(run);
        } else {
            subRuns.forEach(r => {
                if (tag === 'strong' || tag === 'b') r.bold = true;
                if (tag === 'em' || tag === 'i') r.italic = true;
                if (tag === 'u') r.underline = true;
                runs.push(r);
            });
        }
        
        lastIndex = inlineRegex.lastIndex;
    }
    
    const remainingText = html.substring(lastIndex);
    if (remainingText) {
        runs.push({ text: decodeEntities(remainingText) });
    }
    
    return runs;
}

// Helper to separate text, images, tables, and alignments from HTML with styles
function parseContent(html) {
    if (!html) return [];
    
    const tagRegex = /<(p|h[1-6]|li)\b([^>]*?)>([\s\S]*?)<\/\1>|<img\s+[^>]*src\s*=\s*(["'])(.*?)\4[^>]*>|<table[\s\S]*?<\/table>/gi;
    
    const blocks = [];
    let lastIndex = 0;
    let match;
    
    while ((match = tagRegex.exec(html)) !== null) {
        const textBefore = html.substring(lastIndex, match.index);
        if (textBefore) {
            const stripped = stripHtml(textBefore);
            if (stripped) {
                blocks.push({ type: 'paragraph', value: stripped, alignment: 'left' });
            }
        }
        
        if (match[1]) {
            const tag = match[1].toLowerCase();
            const attrs = match[2] || '';
            const content = match[3] || '';
            
            let alignment = 'left';
            const alignMatch = attrs.match(/text-align:\s*(center|right|left|justify|both)/i);
            if (alignMatch) {
                alignment = alignMatch[1].toLowerCase() === 'both' ? 'justify' : alignMatch[1].toLowerCase();
            }
            
            let leftIndent = 0;
            let hangingIndent = 0;
            let spaceAfter = 0;
            
            const mlMatch = attrs.match(/(?:margin-left|padding-left):\s*(-?\d+)px/i);
            if (mlMatch) {
                leftIndent = parseInt(mlMatch[1]);
            }
            const tiMatch = attrs.match(/text-indent:\s*(-?\d+)px/i);
            if (tiMatch) {
                const tiVal = parseInt(tiMatch[1]);
                if (tiVal < 0) {
                    hangingIndent = Math.abs(tiVal);
                }
            }
            const mbMatch = attrs.match(/margin-bottom:\s*(-?\d+)px/i);
            if (mbMatch) {
                spaceAfter = parseInt(mbMatch[1]);
            }
            
            const imgRegex = /<img\s+[^>]*src\s*=\s*(["'])(.*?)\1[^>]*>/gi;
            let subLastIndex = 0;
            let imgMatch;
            const subBlocks = [];
            
            while ((imgMatch = imgRegex.exec(content)) !== null) {
                const textBeforeImg = content.substring(subLastIndex, imgMatch.index);
                if (textBeforeImg) {
                    const cleanInlineHtml = textBeforeImg.replace(/<(?!strong|b|em|i|u|span|font)\/?[^>]*>/gi, '');
                    subBlocks.push({ type: 'text', runs: parseInlineRuns(cleanInlineHtml) });
                }
                subBlocks.push({ type: 'image', value: imgMatch[2] });
                subLastIndex = imgRegex.lastIndex;
            }
            
            const remainingContent = content.substring(subLastIndex);
            if (remainingContent) {
                const cleanInlineHtml = remainingContent.replace(/<(?!strong|b|em|i|u|span|font)\/?[^>]*>/gi, '');
                subBlocks.push({ type: 'text', runs: parseInlineRuns(cleanInlineHtml) });
            }
            
            blocks.push({
                type: 'paragraph',
                tag: tag,
                alignment: alignment,
                leftIndent: leftIndent,
                hangingIndent: hangingIndent,
                spaceAfter: spaceAfter,
                subBlocks: subBlocks
            });
        } else if (match[5]) {
            const imgSrc = match[5];
            blocks.push({ type: 'image', value: imgSrc });
        } else if (match[0].startsWith('<table')) {
            blocks.push({ type: 'table', value: match[0] });
        }
        
        lastIndex = tagRegex.lastIndex;
    }
    
    const remainingText = html.substring(lastIndex);
    if (remainingText) {
        const stripped = stripHtml(remainingText);
        if (stripped) {
            blocks.push({ type: 'paragraph', value: stripped, alignment: 'left' });
        }
    }
    
    return blocks;
}

// Helper to clean up encoding issues using iconv-lite
function sanitizeText(text) {
    if (!text) return '';
    try {
        // Simple heuristic: if we see 'Ã' followed by common artifacts, 
        // it might be a double-encoded UTF-8 or Windows-1252 mismatch.
        if (text.includes('Ã') || text.includes('â')) {
            // Encode as win1252 and decode back to utf8
            const buf = iconv.encode(text, 'win1252');
            return iconv.decode(buf, 'utf-8');
        }
        // Otherwise ensuring it's valid UTF-8
        return iconv.decode(iconv.encode(text, 'utf8'), 'utf8');
    } catch (e) {
        return text;
    }
}

// Improved entity decoder for unique characters
function decodeEntities(text) {
    if (!text) return '';
    const namedEntities = {
        'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ',
        'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε',
        'zeta': 'ζ', 'eta': 'η', 'theta': 'θ', 'iota': 'ι', 'kappa': 'κ',
        'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'omicron': 'ο',
        'pi': 'π', 'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'upsilon': 'υ',
        'phi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
        'Alpha': 'Α', 'Beta': 'Β', 'Gamma': 'Γ', 'Delta': 'Δ', 'Epsilon': 'Ε',
        'Zeta': 'Ζ', 'Eta': 'Η', 'Theta': 'Θ', 'Iota': 'Ι', 'Kappa': 'Κ',
        'Lambda': 'Λ', 'Mu': 'Μ', 'Nu': 'Ν', 'Xi': 'Ξ', 'Omicron': 'Ο',
        'Pi': 'Π', 'Rho': 'Ρ', 'Sigma': 'Σ', 'Tau': 'Τ', 'Upsilon': 'Υ',
        'Phi': 'Φ', 'Chi': 'Χ', 'Psi': 'Ψ', 'Omega': 'Ω',
        'radic': '√', 'infin': '∞', 'asymp': '≈', 'ne': '≠', 'le': '≤', 'ge': '≥',
        'plusmn': '±', 'times': '×', 'divide': '÷', 'sup2': '²', 'sup3': '³',
        'deg': '°', 'bull': '•', 'hellip': '…', 'trade': '™', 'copy': '©', 'reg': '®',
        'euro': '€', 'pound': '£', 'yen': '¥', 'sum': '∑', 'int': '∫', 'prod': '∏'
    };

    return text.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity) => {
        if (entity.startsWith('#')) {
            const code = entity.startsWith('#x') 
                ? parseInt(entity.slice(2), 16) 
                : parseInt(entity.slice(1), 10);
            return isNaN(code) ? match : String.fromCharCode(code);
        }
        return namedEntities[entity] || match;
    });
}

// Strip HTML tags and decode common entities
function stripHtml(html) {
    if (!html) return '';

    // First pass sanitization
    let cleanHtml = sanitizeText(html);

    let text = cleanHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '');

    // Robust entity decoding
    text = decodeEntities(text);

    return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function getImageData(src) {
    try {
        if (!src) return null;
        console.log(`[Export] Processing image: ${src.substring(0, 50)}${src.length > 50 ? '...' : ''}`);

        // 1. Handle Base64 Data
        if (src.startsWith('data:image')) {
            console.log(`[Export] Detected Base64 image`);
            const base64Data = src.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        }

        // 2. Handle Local Files (anything starting with / or including /uploads/ / /api/media/)
        let localPath = null;
        if (src.includes('/api/media/')) {
            const index = src.indexOf('/api/media/');
            localPath = '/uploads/' + src.substring(index + 11);
            console.log(`[Export] Mapped API media URL to: ${localPath}`);
        } else if (src.startsWith('/') && !src.startsWith('//')) {
            localPath = src;
        } else if (src.includes('/uploads/')) {
            const index = src.indexOf('/uploads/');
            localPath = src.substring(index);
        }

        if (localPath) {
            // Strip query parameters (?v=1...)
            if (localPath.includes('?')) {
                localPath = localPath.split('?')[0];
            }

            // Remove leading slash for path.join and decode characters like %20 or —
            const relativePath = decodeURIComponent(localPath.startsWith('/') ? localPath.slice(1) : localPath);
            
            // Cross-platform safe path joining: split by / or \ and spread into path.join
            const pathParts = relativePath.split(/[/\\]/);
            const filePath = path.join(process.cwd(), 'public', ...pathParts);
            
            console.log(`[Export] Resolving local file: ${filePath}`);
            try {
                // Check if file exists first to avoid exception noise in logs
                const buffer = await fs.readFile(filePath);
                console.log(`[Export] OK: Read local file (${buffer.length} bytes)`);
                return buffer;
            } catch (fsErr) {
                console.warn(`[Export] Local read failed for ${filePath}, attempting fallback if URL`);
            }
        }

        // 3. Fallback for external URLs (attempt fetch)
        if (src.startsWith('http')) {
            console.log(`[Export] Attempting fetch: ${src}`);
            const res = await fetch(src);
            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                console.log(`[Export] OK: Fetched URL (${buffer.length} bytes)`);
                return buffer;
            }
            console.error(`[Export] Fetch failed: ${res.status}`);
        }

        console.error(`[Export] Unresolved image: ${src}`);
        return null;
    } catch (error) {
        console.error(`[Export] getImageData Error:`, error);
        return null;
    }
}

// Helper to determine image dimensions from buffer
function getImageDimensions(buffer) {
    try {
        // PNG detection
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            return { width, height };
        }
        // JPEG detection
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            let offset = 2;
            while (offset < buffer.length) {
                const marker = buffer.readUInt16BE(offset);
                offset += 2;
                if ((marker & 0xFF00) !== 0xFF00) break; // Not a marker
                
                const length = buffer.readUInt16BE(offset);
                if (marker === 0xFFC0 || marker === 0xFFC1 || marker === 0xFFC2) {
                    const height = buffer.readUInt16BE(offset + 3);
                    const width = buffer.readUInt16BE(offset + 5);
                    return { width, height };
                }
                offset += length;
            }
        }
    } catch (e) {
        console.error("Dimension detection failed", e);
    }
    return { width: 320, height: 200 }; // Default fallback
}

// Helper to determine image type for docx ImageRun
function getImageType(src, buffer) {
    // 1. Try Extension from src
    let ext = 'png';
    if (src.startsWith('data:image/')) {
        ext = src.split(';')[0].split('/')[1];
    } else {
        const urlWithoutParams = src.split('?')[0];
        const parts = urlWithoutParams.split('.');
        if (parts.length > 1) {
            ext = parts.pop().toLowerCase();
        }
    }

    // Standardize for docx
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    if (['png', 'gif', 'bmp', 'svg'].includes(ext)) return ext;
    
    // 2. Fallback to buffer sniffing
    if (buffer && buffer.length > 2) {
        if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'jpg';
        if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'gif';
    }
    
    return 'png';
}

export async function GET(request) {
    const session = await getSession();
    if (!session.user || session.user.roleName === 'student') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');
    const mode = searchParams.get('mode') || 'questions_and_answers';
    const format = searchParams.get('format') || 'standard';
    // mode: 'questions_and_answers' | 'questions_only' | 'answers_only'
    // format: 'standard' | 'rushless'

    if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    try {
        // 1. Get Exam Details (Standardized)
        const examData = await getExamSettings(examId);

        if (!examData) {
            return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
        }
        const examName = examData.exam_name;

        // 2. Get All Questions (Standardized)
        const questionData = await getExamQuestions(examId);
        const questions = questionData.questions;

        // 3. Build DOCX content
        const docChildren = [];

        // --- Header: "Soal [Exam Name]" ---
        docChildren.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: `Soal ${examName}`,
                        bold: true,
                        size: 32, // 16pt
                        font: 'Arial',
                    }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            })
        );

        // Divider line
        docChildren.push(
            new Paragraph({
                border: {
                    bottom: {
                        color: '999999',
                        space: 1,
                        style: BorderStyle.SINGLE,
                        size: 6,
                    },
                },
                spacing: { after: 300 },
            })
        );

        if (mode === 'answers_only') {
            // --- Answers Only: "Kunci Jawaban" header + answer list ---
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'Kunci Jawaban',
                            bold: true,
                            size: 28,
                            font: 'Arial',
                        }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                })
            );

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${i + 1}. ${q.correct_option}`,
                                size: 24,
                                font: 'Arial',
                            }),
                        ],
                        spacing: { after: 80 },
                    })
                );
            }
        } else {
            // --- Questions (with or without answers) ---
            const renderQuestion = async (q, index) => {
                let opts = {};
                try {
                    opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || {});
                } catch { opts = {}; }

                // Re-key options with A, B, C, ... (if not matching)
                const reKeyedOptions = {};
                if (q.question_type !== 'matching') {
                    const optionValues = Object.values(opts);
                    const letterKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    optionValues.forEach((val, idx) => {
                        if (letterKeys[idx]) {
                            const optValue = (val && typeof val === 'object' && val.hasOwnProperty('text')) ? val.text : val;
                            reKeyedOptions[letterKeys[idx]] = optValue;
                        }
                    });
                }

                // Question text with markers if in rushless format
                let questionPrefix = `${index + 1}. `;
                if (format === 'rushless') {
                    // Prepend points
                    questionPrefix += `[BOBOT: ${q.points}] `;
                    
                    // Prepend type/strategy markers
                    if (q.question_type === 'essay') {
                        const strategyTag = q.scoring_strategy ? q.scoring_strategy.toUpperCase() : 'ESSAY';
                        if (strategyTag === 'ESSAY_ANY_KEYWORD') questionPrefix += '[ESSAY_ANY] ';
                        else if (strategyTag === 'ESSAY_STRICT_KEYWORDS') questionPrefix += '[ESSAY_STRICT] ';
                        else if (strategyTag === 'ESSAY_MANUAL') questionPrefix += '[ESSAY_MANUAL] ';
                        else questionPrefix += '[ESSAY] ';
                    } else if (q.question_type === 'multiple_choice_complex' || q.question_type === 'multiple_choice') {
                        if (q.scoring_strategy && q.scoring_strategy !== 'standard') {
                            const strategyTag = q.scoring_strategy.toUpperCase();
                            if (strategyTag.startsWith('PGK_')) {
                                questionPrefix += `[${strategyTag}] `;
                            }
                        }
                    }
                }

                const qParts = parseContent(q.question_text);
                const baseQChildren = [
                    new TextRun({
                        text: questionPrefix,
                        bold: true,
                        size: 24,
                        font: 'Arial',
                    })
                ];

                const paragraphsToPush = [];

                const processBlocks = async (blocks, isOption = false, basePrefix = null) => {
                    for (const block of blocks) {
                        if (block.type === 'paragraph') {
                            const alignmentMap = {
                                'left': AlignmentType.LEFT,
                                'center': AlignmentType.CENTER,
                                'right': AlignmentType.RIGHT,
                                'justify': AlignmentType.JUSTIFY
                            };
                            const alignment = alignmentMap[block.alignment] || AlignmentType.LEFT;
                            
                            // Convert pixels to dxa (1px = 15 dxa)
                            const leftIndentDxa = (block.leftIndent || 0) * 15;
                            const hangingIndentDxa = (block.hangingIndent || 0) * 15;
                            const spaceAfterDxa = (block.spaceAfter || 0) * 15;
                            
                            let currentParagraphRuns = [];
                            if (basePrefix) {
                                currentParagraphRuns.push(...basePrefix);
                                basePrefix = null; // Consume prefix only once
                            }
                            
                            const flushParagraph = () => {
                                if (currentParagraphRuns.length > 0) {
                                    const indentOpt = {};
                                    if (leftIndentDxa > 0) indentOpt.left = leftIndentDxa;
                                    if (hangingIndentDxa > 0) {
                                        indentOpt.hanging = hangingIndentDxa;
                                        indentOpt.left = (indentOpt.left || 0) + hangingIndentDxa;
                                    }
                                    if (isOption && Object.keys(indentOpt).length === 0) {
                                        indentOpt.left = 720;
                                    }
                                    
                                    paragraphsToPush.push(new Paragraph({
                                        children: currentParagraphRuns.slice(),
                                        alignment: alignment,
                                        spacing: { 
                                            before: isOption ? 40 : 80, 
                                            after: spaceAfterDxa > 0 ? spaceAfterDxa : (isOption ? 40 : 120) 
                                        },
                                        indent: Object.keys(indentOpt).length > 0 ? indentOpt : undefined
                                    }));
                                    currentParagraphRuns = [];
                                }
                            };
                            
                            const subBlocksToProcess = block.subBlocks || [{ type: 'text', runs: [{ text: block.value }] }];
                            for (const sub of subBlocksToProcess) {
                                if (sub.type === 'text') {
                                    (sub.runs || []).forEach(runData => {
                                        currentParagraphRuns.push(new TextRun({
                                            text: runData.text || '',
                                            bold: runData.bold || false,
                                            italics: runData.italic || false,
                                            underline: runData.underline ? {} : undefined,
                                            size: isOption ? 22 : 24,
                                            font: 'Arial'
                                        }));
                                    });
                                } else if (sub.type === 'image') {
                                    flushParagraph();
                                    
                                    const buffer = await getImageData(sub.value);
                                    if (buffer) {
                                        const dims = getImageDimensions(buffer);
                                        const maxWidth = 450;
                                        const scale = dims.width > maxWidth ? maxWidth / dims.width : 1;
                                        
                                        paragraphsToPush.push(new Paragraph({
                                            children: [
                                                new ImageRun({
                                                    data: buffer,
                                                    type: getImageType(sub.value, buffer),
                                                    transformation: {
                                                        width: dims.width * scale,
                                                        height: dims.height * scale,
                                                    },
                                                }),
                                            ],
                                            alignment: alignment,
                                            spacing: { after: 120 },
                                            indent: isOption ? { left: 720 } : undefined
                                        }));
                                    }
                                }
                            }
                            
                            flushParagraph();
                        } else if (block.type === 'image') {
                            const buffer = await getImageData(block.value);
                            if (buffer) {
                                const dims = getImageDimensions(buffer);
                                const maxWidth = 450;
                                const scale = dims.width > maxWidth ? maxWidth / dims.width : 1;
                                
                                paragraphsToPush.push(new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: buffer,
                                            type: getImageType(block.value, buffer),
                                            transformation: {
                                                width: dims.width * scale,
                                                height: dims.height * scale,
                                            },
                                        }),
                                    ],
                                    spacing: { after: 120 },
                                    indent: isOption ? { left: 720 } : undefined
                                }));
                            }
                        } else if (block.type === 'table') {
                            const docxTable = parseHtmlTableToDocx(block.value);
                            if (docxTable) {
                                paragraphsToPush.push(docxTable);
                            }
                        }
                    }
                };

                // Process Question Blocks
                await processBlocks(qParts, false, baseQChildren);

                // Process Options / Pairs
                if (q.question_type === 'matching') {
                    const pairs = opts.pairs || [];
                    
                    // List all premises
                    for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
                        const pair = pairs[pIdx];
                        const pParts = parseContent(pair.p);
                        const basePChildren = [
                            new TextRun({
                                text: `${pIdx + 1}. `,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                            })
                        ];
                        await processBlocks(pParts, true, basePChildren);
                    }
                    
                    // List all responses (A, B, C...)
                    const responseKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    for (let rIdx = 0; rIdx < pairs.length; rIdx++) {
                        const pair = pairs[rIdx];
                        const rParts = parseContent(pair.r);
                        const baseRChildren = [
                            new TextRun({
                                text: `${responseKeys[rIdx] || 'A'}. `,
                                size: 22,
                                font: 'Arial',
                            })
                        ];
                        await processBlocks(rParts, true, baseRChildren);
                    }
                } else {
                    for (const [key, value] of Object.entries(reKeyedOptions)) {
                        const optParts = parseContent(String(value));
                        const baseOptChildren = [
                            new TextRun({
                                text: `${key}. `,
                                size: 22,
                                font: 'Arial',
                            })
                        ];
                        await processBlocks(optParts, true, baseOptChildren);
                    }
                }
                
                // Add Answer line
                if (mode === 'questions_and_answers' || format === 'rushless') {
                    let ansText = '';
                    if (q.question_type === 'matching') {
                        ansText = `Ans: ${q.correct_option}`;
                    } else if (q.question_type === 'essay') {
                        if (q.scoring_strategy !== 'essay_manual') {
                            let metadata = {};
                            try {
                                metadata = typeof q.scoring_metadata === 'string' ? JSON.parse(q.scoring_metadata) : (q.scoring_metadata || {});
                            } catch { metadata = {}; }
                            
                            if (metadata.keywords && metadata.keywords.length > 0) {
                                const kwString = Array.isArray(metadata.keywords) ? metadata.keywords.join(', ') : String(metadata.keywords);
                                ansText = `Ans: ${kwString}`;
                            }
                        }
                    } else {
                        ansText = `Ans: ${q.correct_option}`;
                    }

                    if (ansText) {
                        paragraphsToPush.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: ansText,
                                    bold: true,
                                    size: 22,
                                    font: 'Arial',
                                })
                            ],
                            spacing: { before: 100, after: 200 },
                            indent: { left: 720 }
                        }));
                    }
                }

                docChildren.push(...paragraphsToPush);
            };

            if (format === 'rushless') {
                // Group questions by type
                const mcQuestions = [];
                const matchingQuestions = [];
                const essayQuestions = [];

                questions.forEach((q, idx) => {
                    const item = { ...q, originalIndex: idx };
                    if (q.question_type === 'matching') {
                        matchingQuestions.push(item);
                    } else if (q.question_type === 'essay') {
                        essayQuestions.push(item);
                    } else {
                        mcQuestions.push(item);
                    }
                });

                // Write Pilihan Ganda group
                if (mcQuestions.length > 0) {
                    docChildren.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: '[Pilihan Ganda]',
                                    bold: true,
                                    size: 26,
                                    font: 'Arial',
                                }),
                            ],
                            spacing: { before: 200, after: 200 },
                        })
                    );
                    for (const q of mcQuestions) {
                        await renderQuestion(q, q.originalIndex);
                    }
                }

                // Write Menjodohkan group
                if (matchingQuestions.length > 0) {
                    docChildren.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: '[Menjodohkan]',
                                    bold: true,
                                    size: 26,
                                    font: 'Arial',
                                }),
                            ],
                            spacing: { before: 200, after: 200 },
                        })
                    );
                    for (const q of matchingQuestions) {
                        await renderQuestion(q, q.originalIndex);
                    }
                }

                // Write Esai group
                if (essayQuestions.length > 0) {
                    docChildren.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: '[Esai]',
                                    bold: true,
                                    size: 26,
                                    font: 'Arial',
                                }),
                            ],
                            spacing: { before: 200, after: 200 },
                        })
                    );
                    for (const q of essayQuestions) {
                        await renderQuestion(q, q.originalIndex);
                    }
                }
            } else {
                // Standard Format: print sequentially
                for (let i = 0; i < questions.length; i++) {
                    await renderQuestion(questions[i], i);
                }
            }
        }

        // 4. Create doc
        const doc = new Document({
            sections: [{
                properties: {},
                children: docChildren,
            }],
        });

        // 5. Generate buffer
        const buffer = await Packer.toBuffer(doc);

        // 6. Determine filename suffix
        let suffix = 'Soal_dan_Jawaban';
        if (mode === 'questions_only') suffix = 'Soal';
        if (mode === 'answers_only') suffix = 'Kunci_Jawaban';

        const filename = `${examName}_${suffix}.docx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
        });

    } catch (error) {
        console.error('Export questions failed:', error);
        return NextResponse.json({ message: 'Export failed', error: error.message }, { status: 500 });
    }
}
