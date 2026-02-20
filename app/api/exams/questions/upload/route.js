
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import mammoth from 'mammoth';
import { query } from '@/app/lib/db';
import { sessionOptions } from '@/app/lib/session';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
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
    return NextResponse.json({ message: 'Unsupported file type. Please upload .docx' }, { status: 400 });
}
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