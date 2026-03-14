import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, BorderStyle, ImageRun
} from 'docx';
import fs from 'fs/promises';
import path from 'path';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// Helper to separate text and images from HTML
function parseContent(html) {
    if (!html) return [];
    
    // This regex captures <img> tags and their src
    const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/gi;
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

        // Image data
        parts.push({ type: 'image', value: match[1] });
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

// Strip HTML tags and decode common entities
function stripHtml(html) {
    if (!html) return '';
    let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function getImageData(src) {
    try {
        if (src.startsWith('data:image')) {
            const base64Data = src.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        } else if (src.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), 'public', src);
            return await fs.readFile(filePath);
        }
        return null;
    } catch (error) {
        console.error('Failed to get image data:', error);
        return null;
    }
}

export async function GET(request) {
    const session = await getSession();
    if (!session.user || session.user.roleName === 'student') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('exam_id');
    const mode = searchParams.get('mode') || 'questions_and_answers';
    // mode: 'questions_and_answers' | 'questions_only' | 'answers_only'

    if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    try {
        // 1. Get Exam Details
        const examDetails = await query({
            query: 'SELECT exam_name FROM rhs_exams WHERE id = ?',
            values: [examId]
        });

        if (examDetails.length === 0) {
            return NextResponse.json({ message: 'Exam not found' }, { status: 404 });
        }
        const examName = examDetails[0].exam_name;

        // 2. Get All Questions (ordered by sort_order, then by id)
        const questions = await query({
            query: 'SELECT id, question_text, options, correct_option FROM rhs_exam_questions WHERE exam_id = ? ORDER BY sort_order ASC, id ASC',
            values: [examId]
        });

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

                // Re-key options with A, B, C, ...
                const optionValues = Object.values(opts);
                const letterKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const reKeyedOptions = {};
                optionValues.forEach((val, i) => {
                    if (letterKeys[i]) {
                        // For options, we also support HTML/Images
                        const optValue = (val && typeof val === 'object' && val.hasOwnProperty('text')) ? val.text : val;
                        reKeyedOptions[letterKeys[i]] = optValue;
                    }
                });

                // Question text with images
                const qParts = parseContent(q.question_text);
                const baseQChildren = [
                    new TextRun({
                        text: `${index + 1}. `,
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
                                bold: isCorrect && mode === 'questions_and_answers',
                            }));
                        } else if (part.type === 'image') {
                            const buffer = await getImageData(part.value);
                            if (buffer) {
                                // Flush text before image
                                if (children.length > 0) {
                                    paragraphsToPush.push(new Paragraph({
                                        children: children,
                                        spacing: { before: children === baseChildren ? 200 : 0, after: 100 },
                                        indent: indent ? { left: 720 } : undefined
                                    }));
                                    children = [];
                                }
                                
                                paragraphsToPush.push(new Paragraph({
                                    children: [
                                        new ImageRun({
                                            data: buffer,
                                            transformation: {
                                                width: 320,
                                                height: 200,
                                            },
                                        }),
                                    ],
                                    spacing: { after: 100 },
                                    indent: indent ? { left: 720 } : undefined
                                }));
                            }
                        }
                    }
                    if (children.length > 0) {
                        // Add checkmark if correct and text part
                        if (isCorrect && mode === 'questions_and_answers') {
                            children.push(new TextRun({
                                text: ' ✓',
                                bold: true,
                                size: 22,
                                font: 'Arial',
                                color: '2E7D32',
                            }));
                        }

                        paragraphsToPush.push(new Paragraph({
                            children,
                            spacing: { before: (children.length > 0 && children[0].text && children[0].text.includes(`${index + 1}. `)) ? 200 : 0, after: 100 },
                            indent: indent ? { left: 720 } : undefined
                        }));
                    }
                };

                // Process Question
                await processParts(qParts, baseQChildren);

                // Process Options
                for (const [key, value] of Object.entries(reKeyedOptions)) {
                    const isCorrect = key === q.correct_option;
                    const optParts = parseContent(String(value));
                    const baseOptChildren = [
                        new TextRun({
                            text: `     ${key}. `,
                            size: 22,
                            font: 'Arial',
                            bold: isCorrect && mode === 'questions_and_answers',
                        })
                    ];
                    await processParts(optParts, baseOptChildren, true, isCorrect);
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
