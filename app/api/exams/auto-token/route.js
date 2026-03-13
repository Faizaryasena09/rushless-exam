import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { generateAutoToken } from '@/app/lib/token';

async function getSession() {
    const cookieStore = await cookies();
    return await getIronSession(cookieStore, sessionOptions);
}

export async function GET(request) {
    const session = await getSession();

    if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
        return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    const token = generateAutoToken(examId);

    return NextResponse.json({ auto_token: token });
}
