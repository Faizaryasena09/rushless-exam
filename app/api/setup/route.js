import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query } from '@/app/lib/db';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// This function checks if a column exists in a table.
async function columnExists(tableName, columnName) {
  // Note: Both tableName and columnName are hardcoded constants from within this route, 
  // so it's safe to use them in a template literal. Do not use user-provided input here
  // without strict validation to prevent SQL injection.
  const result = await query({
    query: `SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`,
    values: [], // No parameters needed for this specific query
  });
  return result.length > 0;
}

// GET handler to perform database setup/migration
export async function GET(request) {
  const session = await getSession(request);

  // IMPORTANT: Protect this endpoint, only admins should run it.
  if (!session.user || session.user.roleName !== 'admin') {
    return NextResponse.json({ message: 'Unauthorized: Admin role required.' }, { status: 401 });
  }

  try {
    const tableName = 'rhs_exams';
    let messages = [];

    // --- Check and add 'shuffle_questions' column ---
    const hasShuffleQuestions = await columnExists(tableName, 'shuffle_questions');
    if (!hasShuffleQuestions) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'shuffle_questions' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'shuffle_questions' already exists in '${tableName}'.`);
    }

    // --- Check and add 'shuffle_answers' column ---
    const hasShuffleAnswers = await columnExists(tableName, 'shuffle_answers');
    if (!hasShuffleAnswers) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN shuffle_answers BOOLEAN NOT NULL DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'shuffle_answers' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'shuffle_answers' already exists in '${tableName}'.`);
    }

    return NextResponse.json({ 
        status: 'success',
        message: 'Database setup check completed.',
        details: messages 
    });

  } catch (error) {
    console.error('Database setup failed:', error);
    return NextResponse.json({ 
        status: 'error',
        message: 'An error occurred during database setup.', 
        error: error.message 
    }, { status: 500 });
  }
}