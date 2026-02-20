import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, BorderStyle
} from 'docx';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// Strip HTML tags and decode common entities
function stripHtml(html) {
    if (!html) return '';
    let text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');
    // Collapse multiple newlines to single and trim
    return text.replace(/\n{3,}/g, '\n\n').trim();
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

            questions.forEach((q, index) => {
                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${index + 1}. ${q.correct_option}`,
                                size: 24,
                                font: 'Arial',
                            }),
                        ],
                        spacing: { after: 80 },
                    })
                );
            });
        } else {
            // --- Questions (with or without answers) ---
            questions.forEach((q, index) => {
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
                        const optText = (val && typeof val === 'object' && val.hasOwnProperty('text')) ? val.text : val;
                        reKeyedOptions[letterKeys[i]] = optText;
                    }
                });

                // Question number + text
                const qText = stripHtml(q.question_text);
                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${index + 1}. `,
                                bold: true,
                                size: 24,
                                font: 'Arial',
                            }),
                            new TextRun({
                                text: qText,
                                size: 24,
                                font: 'Arial',
                            }),
                        ],
                        spacing: { before: 200, after: 100 },
                    })
                );

                // Options
                Object.entries(reKeyedOptions).forEach(([key, value]) => {
                    const optText = stripHtml(String(value));
                    const isCorrect = key === q.correct_option;

                    const children = [];
                    children.push(
                        new TextRun({
                            text: `     ${key}. ${optText}`,
                            size: 22,
                            font: 'Arial',
                            bold: mode === 'questions_and_answers' && isCorrect,
                        })
                    );

                    if (mode === 'questions_and_answers' && isCorrect) {
                        children.push(
                            new TextRun({
                                text: ' ✓',
                                bold: true,
                                size: 22,
                                font: 'Arial',
                                color: '2E7D32',
                            })
                        );
                    }

                    docChildren.push(
                        new Paragraph({
                            children,
                            spacing: { after: 40 },
                        })
                    );
                });
            });
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
