import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function checkAdmin(request) {
  const cookieStore = await cookies();
  const session = await getIronSession(cookieStore, sessionOptions);
  return session.user && session.user.role === 'admin';
}

export async function GET() {
  try {
    const classes = await query({ query: 'SELECT * FROM rhs_classes' });
    return NextResponse.json(classes);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to retrieve classes', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { className } = await request.json();
    if (!className) {
      return NextResponse.json({ message: 'Class name is required' }, { status: 400 });
    }
    const result = await query({
      query: 'INSERT INTO rhs_classes (class_name) VALUES (?)',
      values: [className],
    });
    return NextResponse.json({ id: result.insertId, class_name: className }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to create class', error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, className } = await request.json();
    if (!id || !className) {
      return NextResponse.json({ message: 'ID and class name are required' }, { status: 400 });
    }
    await query({
      query: 'UPDATE rhs_classes SET class_name = ? WHERE id = ?',
      values: [className, id],
    });
    return NextResponse.json({ id, class_name: className });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to update class', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!await checkAdmin(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ message: 'ID is required' }, { status: 400 });
    }
    await query({
      query: 'DELETE FROM rhs_classes WHERE id = ?',
      values: [id],
    });
    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to delete class', error: error.message }, { status: 500 });
  }
}
