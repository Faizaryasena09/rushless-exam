import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

export async function POST(request) {
  const session = await getSession();

  if (!session.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { attemptId, actionType, description } = await request.json();

    if (!attemptId || !actionType) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    await query({
      query: 'INSERT INTO rhs_exam_logs (attempt_id, action_type, description) VALUES (?, ?, ?)',
      values: [attemptId, actionType, description],
    });

    return NextResponse.json({ message: 'Log saved' });
  } catch (error) {
    console.error('Log Error:', error);
    return NextResponse.json({ message: 'Failed to save log', error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const session = await getSession();

  if (!session.user || (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const attemptId = searchParams.get('attempt_id');

  if (!attemptId) {
    return NextResponse.json({ message: 'Attempt ID required' }, { status: 400 });
  }

  try {
    const logs = await query({
      query: 'SELECT * FROM rhs_exam_logs WHERE attempt_id = ? ORDER BY created_at ASC',
      values: [attemptId],
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to fetch logs', error: error.message }, { status: 500 });
  }
}
