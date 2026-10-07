import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, transaction, ensureArchiveSchema } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';
import { invalidateExamCache } from '@/app/lib/exams';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

/**
 * Arsip / restore satu kategori (accordion) sekaligus semua ujian di dalamnya.
 * Body: { id: number|'uncategorized', archived: boolean }
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

  if (id === undefined || id === null) {
    return NextResponse.json({ message: 'Kategori ID is required' }, { status: 400 });
  }

  const isUncategorized = id === 'uncategorized' || id === null;
  const archivedAt = archived ? new Date() : null;

  try {
    await transaction(async (txQuery) => {
      // 1. Arsipkan / pulihkan seluruh ujian dalam kategori ini
      const exams = await txQuery({
        query: 'SELECT id FROM rhs_exams WHERE category_id <=> ?',
        values: [isUncategorized ? null : id],
      });

      if (exams.length > 0) {
        await txQuery({
          query: 'UPDATE rhs_exams SET is_archived = ?, archived_at = ? WHERE category_id <=> ?',
          values: [archived ? 1 : 0, archivedAt, isUncategorized ? null : id],
        });
      }

      // 2. Tandai kategori itself (kategori "Tanpa Nama" tidak punya baris di DB)
      if (!isUncategorized) {
        await txQuery({
          query: 'UPDATE rhs_exam_categories SET is_archived = ? WHERE id = ?',
          values: [archived ? 1 : 0, id],
        });
      }
    });

    // 3. Bersihkan cache list ujian agar perubahan langsung tampil
    await invalidateExamCache(null);

    return NextResponse.json({
      message: archived ? 'Kategori berhasil diarsipkan.' : 'Kategori berhasil dipulihkan.',
      id,
      archived: !!archived,
    });
  } catch (error) {
    return NextResponse.json({ message: 'Gagal memproses arsip', error: error.message }, { status: 500 });
  }
}