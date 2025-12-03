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

    // --- Check and add 'timer_mode' column ---
    const hasTimerMode = await columnExists(tableName, 'timer_mode');
    if (!hasTimerMode) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN timer_mode ENUM('sync', 'async') NOT NULL DEFAULT 'sync';`,
        values: [],
      });
      messages.push(`Column 'timer_mode' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'timer_mode' already exists in '${tableName}'.`);
    }

    // --- Check and add 'duration_minutes' column ---
    const hasDurationMinutes = await columnExists(tableName, 'duration_minutes');
    if (!hasDurationMinutes) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN duration_minutes INT DEFAULT 60;`,
        values: [],
      });
      messages.push(`Column 'duration_minutes' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'duration_minutes' already exists in '${tableName}'.`);
    }

    // --- Check and add 'min_time_minutes' column ---
    const hasMinTimeMinutes = await columnExists(tableName, 'min_time_minutes');
    if (!hasMinTimeMinutes) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN min_time_minutes INT DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'min_time_minutes' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'min_time_minutes' already exists in '${tableName}'.`);
    }
    
    // --- Create 'rhs_exam_attempts' table if it doesn't exist ---
    const attemptsTableName = 'rhs_exam_attempts';
    await query({
        query: `
            CREATE TABLE IF NOT EXISTS ${attemptsTableName} (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                exam_id INT NOT NULL,
                start_time DATETIME NOT NULL,
                status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
                INDEX (user_id, exam_id)
            );
        `,
        values: []
    });
    messages.push(`Table '${attemptsTableName}' checked/created successfully.`);

    // --- Check and add 'doubtful_questions' column to attempts table ---
    const hasDoubtful = await columnExists(attemptsTableName, 'doubtful_questions');
    if (!hasDoubtful) {
      await query({
        query: `ALTER TABLE ${attemptsTableName} ADD COLUMN doubtful_questions JSON;`,
        values: [],
      });
      messages.push(`Column 'doubtful_questions' created successfully in '${attemptsTableName}'.`);
    } else {
      messages.push(`Column 'doubtful_questions' already exists in '${attemptsTableName}'.`);
    }

    // --- Check and add 'last_question_index' column to attempts table ---
    const hasLastIndex = await columnExists(attemptsTableName, 'last_question_index');
    if (!hasLastIndex) {
      await query({
        query: `ALTER TABLE ${attemptsTableName} ADD COLUMN last_question_index INT NOT NULL DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'last_question_index' created successfully in '${attemptsTableName}'.`);
    } else {
      messages.push(`Column 'last_question_index' already exists in '${attemptsTableName}'.`);
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