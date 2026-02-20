import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

// DELETE handler to remove ALL questions for an exam
export async function DELETE(request) {
    const session = await getIronSession(await cookies(), sessionOptions);
    if (!session.user || session.user.roleName !== 'admin') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { examId } = await request.json();
        if (!examId) {
            return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
        }

        const result = await query({
            query: 'DELETE FROM rhs_exam_questions WHERE exam_id = ?',
            values: [examId],
        });

        return NextResponse.json({ message: `Successfully deleted ${result.affectedRows} questions.` });
    } catch (error) {
        return NextResponse.json({ message: 'Failed to delete questions', error: error.message }, { status: 500 });
    }
}
