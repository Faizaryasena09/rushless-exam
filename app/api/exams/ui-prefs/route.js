import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, ensureArchiveSchema } from '@/app/lib/db';
import { validateUserSession } from '@/app/lib/auth';

async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

/**
 * Preferensi UI per user, disimpan di DB (bukan localStorage).
 * Dipakai halaman daftar ujian untuk mengingat accordion kategori mana yang terbuka.
 *
 * GET  /api/exams/ui-prefs            -> { prefs: { key: value } }
 * GET  /api/exams/ui-prefs?key=...   -> { prefs: { [key]: value } }
 * POST /api/exams/ui-prefs  { key, value }
 * POST /api/exams/ui-prefs  { prefs: { key: value, ... } }
 */
export async function GET(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await ensureArchiveSchema();

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  try {
    const rows = key
      ? await query({ query: 'SELECT pref_key, pref_value FROM rhs_user_ui_prefs WHERE user_id = ? AND pref_key = ?', values: [session.user.id, key] })
      : await query({ query: 'SELECT pref_key, pref_value FROM rhs_user_ui_prefs WHERE user_id = ?', values: [session.user.id] });

    const prefs = rows.reduce((acc, row) => {
      acc[row.pref_key] = row.pref_value;
      return acc;
    }, {});

    return NextResponse.json({ prefs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ message: 'Gagal memuat preferensi', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getSession();

  if (!session.user || !await validateUserSession(session)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ message: 'Body tidak valid' }, { status: 400 });
  }

  const entries = body.prefs && typeof body.prefs === 'object'
    ? Object.entries(body.prefs)
    : (body.key ? [[body.key, body.value ?? null]] : []);

  if (entries.length === 0) {
    return NextResponse.json({ message: 'Tidak ada data untuk disimpan' }, { status: 400 });
  }

  await ensureArchiveSchema();

  try {
    for (const [key, value] of entries) {
      // Value null / string "null" berarti hapus preferensi
      if (value === null || value === undefined || value === 'null') {
        await query({ query: 'DELETE FROM rhs_user_ui_prefs WHERE user_id = ? AND pref_key = ?', values: [session.user.id, key] });
        continue;
      }

      await query({
        query: `INSERT INTO rhs_user_ui_prefs (user_id, pref_key, pref_value)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE pref_value = VALUES(pref_value)`,
        values: [session.user.id, key, typeof value === 'string' ? value : JSON.stringify(value)],
      });
    }

    return NextResponse.json({ message: 'Preferensi tersimpan' });
  } catch (error) {
    return NextResponse.json({ message: 'Gagal menyimpan preferensi', error: error.message }, { status: 500 });
  }
}