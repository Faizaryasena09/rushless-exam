import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';
import {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    BorderStyle, ImageRun
} from 'docx';
import path from 'path';
import iconv from 'iconv-lite';
import fs from 'fs/promises';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

// --- Helpers (Consistent with exam export) ---

function parseContent(html) {
    if (!html) return [];
    const imgRegex = /<img\s+[^>]*src\s*=\s*(["'])(.*?)\1[^>]*>/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
        const textBefore = html.substring(lastIndex, match.index);
        if (textBefore) {
            const stripped = stripHtml(textBefore);
            if (stripped) parts.push({ type: 'text', value: stripped });
        }
        const imgSrc = match[2];
        parts.push({ type: 'image', value: imgSrc });
        lastIndex = imgRegex.lastIndex;
    }

    const remainingText = html.substring(lastIndex);
    if (remainingText) {
        const stripped = stripHtml(remainingText);
        if (stripped) parts.push({ type: 'text', value: stripped });
    }
    return parts;
}

function sanitizeText(text) {
    if (!text) return '';
    try {
        if (text.includes('Ã') || text.includes('â')) {
            const buf = iconv.encode(text, 'win1252');
            return iconv.decode(buf, 'utf-8');
        }
        return iconv.decode(iconv.encode(text, 'utf8'), 'utf8');
    } catch (e) {
        return text;
    }
}

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

function stripHtml(html) {
    if (!html) return '';
    let cleanHtml = sanitizeText(html);
    let text = cleanHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '');
    text = decodeEntities(text);
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

async function getImageData(src) {
    try {
        if (!src) return null;
        if (src.startsWith('data:image')) {
            const base64Data = src.split(',')[1];
            return Buffer.from(base64Data, 'base64');
        }

        let localPath = null;
        if (src.includes('/api/media/')) {
            const index = src.indexOf('/api/media/');
            localPath = '/uploads/' + src.substring(index + 11);
        } else if (src.startsWith('/') && !src.startsWith('//')) {
            localPath = src;
        } else if (src.includes('/uploads/')) {
            const index = src.indexOf('/uploads/');
            localPath = src.substring(index);
        }

        if (localPath) {
            if (localPath.includes('?')) localPath = localPath.split('?')[0];
            const relativePath = decodeURIComponent(localPath.startsWith('/') ? localPath.slice(1) : localPath);
            const pathParts = relativePath.split(/[/\\]/);
            const filePath = path.join(process.cwd(), 'public', ...pathParts);
            
            try {
                const buffer = await fs.readFile(filePath);
                return buffer;
            } catch (fsErr) {
                if (!src.startsWith('http')) return null;
            }
        }

        if (src.startsWith('http')) {
            const res = await fetch(src);
            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

function getImageDimensions(buffer) {
    try {
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            return { width, height };
        }
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            let offset = 2;
            while (offset < buffer.length) {
                const marker = buffer.readUInt16BE(offset);
                offset += 2;
                if ((marker & 0xFF00) !== 0xFF00) break;
                const length = buffer.readUInt16BE(offset);
                if (marker === 0xFFC0 || marker === 0xFFC1 || marker === 0xFFC2) {
                    const height = buffer.readUInt16BE(offset + 3);
                    const width = buffer.readUInt16BE(offset + 5);
                    return { width, height };
                }
                offset += length;
            }
        }
    } catch (e) {}
    return { width: 320, height: 200 };
}

function getImageType(src, buffer) {
    let ext = 'png';
    if (src.startsWith('data:image/')) {
        ext = src.split(';')[0].split('/')[1];
    } else {
        const urlWithoutParams = src.split('?')[0];
        const parts = urlWithoutParams.split('.');
        if (parts.length > 1) ext = parts.pop().toLowerCase();
    }
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    if (['png', 'gif', 'bmp', 'svg'].includes(ext)) return ext;
    if (buffer && buffer.length > 2) {
        if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'png';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'jpg';
        if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'gif';
    }
    return 'png';
}

// --- Recursive Folder Helper ---
async function getAllChildFolderIds(folderId) {
    let ids = [parseInt(folderId)];
    const children = await query({
        query: `SELECT id FROM rhs_question_bank_folders WHERE parent_id = ?`,
        values: [folderId]
    });
    
    for (const child of children) {
        const descendantIds = await getAllChildFolderIds(child.id);
        ids = [...ids, ...descendantIds];
    }
    return ids;
}

// --- Main GET Handler ---
export async function GET(request) {
    const session = await getSession();
    if (!session.user || session.user.roleName === 'student') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'questions_and_answers';
    const format = searchParams.get('format') || 'standard';
    const scope = searchParams.get('scope') || 'selected'; // 'selected' | 'folder' | 'all'
    const folderId = searchParams.get('folder_id');
    const questionIdsParam = searchParams.get('question_ids');

    let questions = [];
    let exportTitle = 'Bank Soal';

    try {
        let sql = `SELECT * FROM rhs_question_bank`;
        let values = [];
        let conditions = [];

        // Auth: Teachers only see their own questions OR admin-created questions
        if (session.user.roleName === 'teacher') {
            conditions.push(`(created_by = ? OR created_by IN (SELECT id FROM rhs_users WHERE role = 'admin'))`);
            values.push(session.user.id);
        }

        if (scope === 'selected' && questionIdsParam) {
            const ids = questionIdsParam.split(',').map(id => id.trim()).filter(id => id);
            if (ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                conditions.push(`id IN (${placeholders})`);
                values.push(...ids);
                exportTitle = 'Selected Questions';
            }
        } else if (scope === 'folder' && folderId) {
            const folderIds = await getAllChildFolderIds(folderId);
            const placeholders = folderIds.map(() => '?').join(',');
            conditions.push(`folder_id IN (${placeholders})`);
            values.push(...folderIds);

            const folderInfo = await query({
                query: `SELECT name FROM rhs_question_bank_folders WHERE id = ?`,
                values: [folderId]
            });
            if (folderInfo.length > 0) exportTitle = `Folder ${folderInfo[0].name}`;
        } else {
            exportTitle = 'Seluruh Bank Soal';
        }

        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }
        sql += ` ORDER BY created_at DESC`;

        questions = await query({ query: sql, values });

        if (questions.length === 0) {
            return NextResponse.json({ message: 'Tidak ada soal untuk diekspor.' }, { status: 404 });
        }

        // --- Build DOCX content (Repurposed logic) ---
        const docChildren = [];
        docChildren.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: exportTitle,
                        bold: true,
                        size: 32,
                        font: 'Arial',
                    }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
            })
        );

        docChildren.push(
            new Paragraph({
                border: {
                    bottom: { color: '999999', space: 1, style: BorderStyle.SINGLE, size: 6 },
                },
                spacing: { after: 300 },
            })
        );

        if (mode === 'answers_only') {
            docChildren.push(
                new Paragraph({
                    children: [new TextRun({ text: 'Kunci Jawaban', bold: true, size: 28, font: 'Arial' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 },
                })
            );

            for (let i = 0; i < questions.length; i++) {
                docChildren.push(
                    new Paragraph({
                        children: [new TextRun({ text: `${i + 1}. ${questions[i].correct_option}`, size: 24, font: 'Arial' })],
                        spacing: { after: 80 },
                    })
                );
            }
        } else {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const index = i;

                let opts = {};
                try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || {}); } catch { opts = {}; }

                const optionValues = Object.values(opts);
                const letterKeys = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const reKeyedOptions = {};
                optionValues.forEach((val, i) => {
                    if (letterKeys[i]) {
                        const optValue = (val && typeof val === 'object' && val.hasOwnProperty('text')) ? val.text : val;
                        reKeyedOptions[letterKeys[i]] = optValue;
                    }
                });

                let questionPrefix = `${index + 1}. `;
                if (format === 'rushless') {
                    questionPrefix += `[BOBOT: ${q.points}] `;
                    if (q.question_type === 'essay') questionPrefix += '[ESSAY] ';
                    if (q.scoring_strategy && q.scoring_strategy !== 'standard' && q.scoring_strategy !== 'essay_manual') {
                        const strategyTag = q.scoring_strategy.toUpperCase();
                        if (strategyTag.startsWith('PGK_')) {
                            questionPrefix += `[${strategyTag}] `;
                        } else if (strategyTag.startsWith('ESSAY_')) {
                            let metadata = {};
                            try { metadata = typeof q.scoring_metadata === 'string' ? JSON.parse(q.scoring_metadata) : (q.scoring_metadata || {}); } catch { metadata = {}; }
                            if (metadata.keywords && metadata.keywords.length > 0) {
                                const kwString = Array.isArray(metadata.keywords) ? metadata.keywords.join(', ') : String(metadata.keywords);
                                if (strategyTag === 'ESSAY_KEYWORDS') questionPrefix += `[KEYWORDS: ${kwString}] `;
                                else questionPrefix += `[${strategyTag}: ${kwString}] `;
                            }
                        }
                    }
                }

                const qParts = parseContent(q.question_text);
                const paragraphsToPush = [];
                const processParts = async (parts, baseChildren, indent = false) => {
                    let children = [...baseChildren];
                    for (const part of parts) {
                        if (part.type === 'text') {
                            children.push(new TextRun({ text: part.value, size: indent ? 22 : 24, font: 'Arial' }));
                        } else if (part.type === 'image') {
                            const buffer = await getImageData(part.value);
                            if (buffer) {
                                const dims = getImageDimensions(buffer);
                                const scale = dims.width > 450 ? 450 / dims.width : 1;
                                if (children.length > 0) {
                                    paragraphsToPush.push(new Paragraph({
                                        children: children,
                                        spacing: { before: children === baseChildren ? 240 : 80, after: 80 },
                                        indent: indent ? { left: 720 } : { left: 720, hanging: 720 }
                                    }));
                                    children = [];
                                }
                                paragraphsToPush.push(new Paragraph({
                                    children: [new ImageRun({ data: buffer, type: getImageType(part.value, buffer), transformation: { width: dims.width * scale, height: dims.height * scale } })],
                                    spacing: { after: 120 },
                                    indent: indent ? { left: 720 } : { left: 720 }
                                }));
                            }
                        }
                    }
                    if (children.length > 0) {
                        const isFirstPara = children.length > 0 && children[0].text && children[0].text.includes(`${index + 1}. `);
                        paragraphsToPush.push(new Paragraph({
                            children,
                            spacing: { before: isFirstPara ? 400 : (indent ? 40 : 80), after: indent ? 40 : 120 },
                            indent: indent ? { left: 720 } : { left: 720, hanging: 720 }
                        }));
                    }
                };

                await processParts(qParts, [new TextRun({ text: questionPrefix, bold: true, size: 24, font: 'Arial' })]);

                for (const [key, value] of Object.entries(reKeyedOptions)) {
                    const isCorrect = key === q.correct_option;
                    const isRushlessCorrect = isCorrect && format === 'rushless';
                    const optParts = parseContent(String(value));
                    await processParts(optParts, [new TextRun({ text: `${isRushlessCorrect ? '*' : ''}${key}. `, size: 22, font: 'Arial' })], true);
                }

                if (mode === 'questions_and_answers' && format !== 'rushless') {
                    paragraphsToPush.push(new Paragraph({
                        children: [new TextRun({ text: `Answer : ${q.correct_option}`, bold: true, size: 22, font: 'Arial' })],
                        spacing: { before: 100, after: 200 },
                        indent: { left: 720 }
                    }));
                }
                docChildren.push(...paragraphsToPush);
            }
        }

        const doc = new Document({ sections: [{ children: docChildren }] });
        const buffer = await Packer.toBuffer(doc);
        const filename = `${exportTitle.replace(/\s+/g, '_')}_Export.docx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
        });

    } catch (error) {
        console.error('Bank export failed:', error);
        return NextResponse.json({ message: 'Export failed' }, { status: 500 });
    }
}
