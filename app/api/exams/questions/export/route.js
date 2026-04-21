import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, BorderStyle, ImageRun
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

// Helper to separate text and images from HTML
function parseContent(html) {
    if (!html) return [];

    // More robust regex to capture <img> tags and their src regardless of quotes or positions
    const imgRegex = /<img\s+[^>]*src\s*=\s*(["'])(.*?)\1[^>]*>/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
        // Text before image
        const textBefore = html.substring(lastIndex, match.index);
        if (textBefore) {
            const stripped = stripHtml(textBefore);
            if (stripped) parts.push({ type: 'text', value: stripped });
        }

        // Image data - match[2] is the content of src
        const imgSrc = match[2];
        parts.push({ type: 'image', value: imgSrc });
        lastIndex = imgRegex.lastIndex;
    }

    // Remaining text
    const remainingText = html.substring(lastIndex);
    if (remainingText) {
        const stripped = stripHtml(remainingText);
        if (stripped) parts.push({ type: 'text', value: stripped });
    }

    return parts;
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
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const index = i;

                let opts = {};
                try {
                    opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || {});
                } catch { opts = {}; }

                // Re-key options with A, B, C, ... (if not matching)
                const reKeyedOptions = {};
                if (q.question_type !== 'matching') {
                    const optionValues = Object.values(opts);
                    const letterKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                    optionValues.forEach((val, i) => {
                        if (letterKeys[i]) {
                            // For options, we also support HTML/Images
                            const optValue = (val && typeof val === 'object' && val.hasOwnProperty('text')) ? val.text : val;
                            reKeyedOptions[letterKeys[i]] = optValue;
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
                        questionPrefix += '[ESSAY] ';
                    }
                    
                    if (q.scoring_strategy && q.scoring_strategy !== 'standard' && q.scoring_strategy !== 'essay_manual') {
                        const strategyTag = q.scoring_strategy.toUpperCase();
                        if (strategyTag.startsWith('PGK_')) {
                            questionPrefix += `[${strategyTag}] `;
                        } else if (strategyTag.startsWith('ESSAY_')) {
                            // Handle keywords for essay strategies
                            let metadata = {};
                            try {
                                metadata = typeof q.scoring_metadata === 'string' ? JSON.parse(q.scoring_metadata) : (q.scoring_metadata || {});
                            } catch { metadata = {}; }
                            
                            if (metadata.keywords && metadata.keywords.length > 0) {
                                const kwString = Array.isArray(metadata.keywords) ? metadata.keywords.join(', ') : String(metadata.keywords);
                                if (strategyTag === 'ESSAY_KEYWORDS') questionPrefix += `[KEYWORDS: ${kwString}] `;
                                else questionPrefix += `[${strategyTag}: ${kwString}] `;
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

                const processParts = async (parts, baseChildren, indent = false, isCorrect = false) => {
                    let children = [...baseChildren];
                    for (const part of parts) {
                        if (part.type === 'text') {
                            children.push(new TextRun({
                                text: part.value,
                                size: indent ? 22 : 24,
                                font: 'Arial',
                            }));
                        } else if (part.type === 'image') {
                            const buffer = await getImageData(part.value);
                            if (buffer) {
                                const dims = getImageDimensions(buffer);
                                const maxWidth = 450;
                                const scale = dims.width > maxWidth ? maxWidth / dims.width : 1;
                                
                                // Flush text before image
                                if (children.length > 0) {
                                    paragraphsToPush.push(new Paragraph({
                                        children: children,
                                        spacing: { before: children === baseChildren ? 240 : 80, after: 80 },
                                        indent: indent ? { left: 720 } : { left: 720, hanging: 720 }
                                    }));
                                    children = [];
                                }

                                paragraphsToPush.push(new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: buffer,
                                            type: getImageType(part.value, buffer),
                                            transformation: {
                                                width: dims.width * scale,
                                                height: dims.height * scale,
                                            },
                                        }),
                                    ],
                                    spacing: { after: 120 },
                                    indent: indent ? { left: 720 } : { left: 720 }
                                }));
                            }
                        }
                    }
                    if (children.length > 0) {
                        // Add checkmark if correct and text part

                        const isFirstParaOfQuestion = children.length > 0 && children[0].text && children[0].text.includes(`${index + 1}. `);

                        paragraphsToPush.push(new Paragraph({
                            children,
                            spacing: {
                                before: isFirstParaOfQuestion ? 400 : (indent ? 40 : 80),
                                after: indent ? 40 : 120
                            },
                            indent: indent ? { left: 720 } : { left: 720, hanging: 720 }
                        }));
                    }
                };

                // Process Question
                await processParts(qParts, baseQChildren);

                // Process Options / Pairs
                if (q.question_type === 'matching') {
                    const pairs = opts.pairs || [];
                    for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
                        const pair = pairs[pIdx];
                        
                        // Premise (Left)
                        const pParts = parseContent(pair.p);
                        const basePChildren = [
                            new TextRun({
                                text: `[${pIdx + 1}] Premis : `,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                            })
                        ];
                        await processParts(pParts, basePChildren, true);

                        // Response (Right)
                        const rParts = parseContent(pair.r);
                        const baseRChildren = [
                            new TextRun({
                                text: `Pasangan : `,
                                bold: true,
                                color: '4B5563', // Slate-600
                                size: 22,
                                font: 'Arial',
                            })
                        ];
                        await processParts(rParts, baseRChildren, true);
                        
                        // Visual Divider
                        paragraphsToPush.push(new Paragraph({
                            border: { bottom: { color: 'E2E8F0', space: 1, style: BorderStyle.DOTTED, size: 6 } },
                            spacing: { after: 120 },
                            indent: { left: 720 }
                        }));
                    }
                } else {
                    for (const [key, value] of Object.entries(reKeyedOptions)) {
                        const isCorrect = key === q.correct_option;
                        const isRushlessCorrect = isCorrect && format === 'rushless';
                        const optParts = parseContent(String(value));
                        const baseOptChildren = [
                            new TextRun({
                                text: `${isRushlessCorrect ? '*' : ''}${key}. `,
                                size: 22,
                                font: 'Arial',
                            })
                        ];
                        await processParts(optParts, baseOptChildren, true, isCorrect);
                    }
                }
                
                // Add "Answer : [Key]" if mode is questions_and_answers AND NOT rushless
                if (mode === 'questions_and_answers' && format !== 'rushless') {
                    paragraphsToPush.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: `Answer : ${q.correct_option}`,
                                bold: true,
                                size: 22,
                                font: 'Arial',
                            })
                        ],
                        spacing: { before: 100, after: 200 },
                        indent: { left: 720 }
                    }));
                }

                docChildren.push(...paragraphsToPush);
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
