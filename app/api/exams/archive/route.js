import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, ensureArchiveSchema } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { invalidateExamCache } from '@/app/lib/exams';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

/**
 * Arsip / restore satu ujian.
 * Body: { id: number, archived: boolean }
 */
export async function PATCH(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.roleName !== 'admin' && session.user.roleName !== 'teacher') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  await ensureArchiveSchema();

  const { id, archived } = await request.json();

  if (!id) {
    return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
  }

  try {
    await query({
      query: 'UPDATE rhs_exams SET is_archived = ?, archived_at = ? WHERE id = ?',
      values: [archived ? 1 : 0, archived ? new Date() : null, id],
    });

    await invalidateExamCache(id);

    return NextResponse.json({
      message: archived ? 'Ujian berhasil diarsipkan.' : 'Ujian berhasil dipulihkan.',
      id,
      archived: !!archived,
    });
  } catch (error) {
    return NextResponse.json({ message: 'Gagal memproses arsip', error: error.message }, { status: 500 });
  }
}