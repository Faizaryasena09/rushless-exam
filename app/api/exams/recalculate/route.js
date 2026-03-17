import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { recalculateExamScores } from '@/app/lib/exams';
import { validateUserSession } from '@/app/lib/auth';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
    const session = await getSession();

    if (!session.user || !['admin', 'teacher'].includes(session.user.roleName) || !await validateUserSession(session)) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { examId } = await request.json();

        if (!examId) {
            return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
        }

        await recalculateExamScores(examId);

        return NextResponse.json({ message: 'All scores have been recalculated successfully.' });
    } catch (error) {
        console.error('Recalculation API Error:', error);
        return NextResponse.json({ message: 'Failed to recalculate scores', error: error.message }, { status: 500 });
    }
}
