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
    
    // --- Check and add 'doubtful_questions' column to attempts table ---
    const attemptsTableName = 'rhs_exam_attempts';
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

    // --- Check and add 'max_attempts' column to exams table ---
    const hasMaxAttempts = await columnExists(tableName, 'max_attempts');
    if (!hasMaxAttempts) {
        await query({
            query: `ALTER TABLE ${tableName} ADD COLUMN max_attempts INT DEFAULT 1;`,
            values: [],
        });
        messages.push(`Column 'max_attempts' created successfully in '${tableName}'.`);
    } else {
        messages.push(`Column 'max_attempts' already exists in '${tableName}'.`);
    }

    // --- Check and add 'end_time' column to attempts table ---
    const hasEndTime = await columnExists(attemptsTableName, 'end_time');
    if (!hasEndTime) {
        await query({
            query: `ALTER TABLE ${attemptsTableName} ADD COLUMN end_time DATETIME;`,
            values: [],
        });
        messages.push(`Column 'end_time' created successfully in '${attemptsTableName}'.`);
    } else {
        messages.push(`Column 'end_time' already exists in '${attemptsTableName}'.`);
    }

    // --- Check and add 'score' column to attempts table ---
    const hasScore = await columnExists(attemptsTableName, 'score');
    if (!hasScore) {
        await query({
            query: `ALTER TABLE ${attemptsTableName} ADD COLUMN score FLOAT;`,
            values: [],
        });
        messages.push(`Column 'score' created successfully in '${attemptsTableName}'.`);
    } else {
        messages.push(`Column 'score' already exists in '${attemptsTableName}'.`);
    }

    // --- Check and add 'attempt_id' column to student_answer table ---
    const studentAnswerTableName = 'rhs_student_answer';
    const hasAttemptIdInAnswers = await columnExists(studentAnswerTableName, 'attempt_id');
    if (!hasAttemptIdInAnswers) {
        await query({
            query: `ALTER TABLE ${studentAnswerTableName} ADD COLUMN attempt_id INT AFTER exam_id;`,
            values: [],
        });
        messages.push(`Column 'attempt_id' created successfully in '${studentAnswerTableName}'.`);
    } else {
        messages.push(`Column 'attempt_id' already exists in '${studentAnswerTableName}'.`);
    }

    // --- Check and add 'session_id' column to users table ---
    const usersTableName = 'rhs_users';
    const hasSessionId = await columnExists(usersTableName, 'session_id');
    if (!hasSessionId) {
        await query({
            query: `ALTER TABLE ${usersTableName} ADD COLUMN session_id VARCHAR(255);`,
            values: [],
        });
        messages.push(`Column 'session_id' created successfully in '${usersTableName}'.`);
    } else {
        messages.push(`Column 'session_id' already exists in '${usersTableName}'.`);
    }

    // --- Check and add 'last_activity' column to users table ---
    const hasLastActivity = await columnExists(usersTableName, 'last_activity');
    if (!hasLastActivity) {
        await query({
            query: `ALTER TABLE ${usersTableName} ADD COLUMN last_activity DATETIME;`,
            values: [],
        });
        messages.push(`Column 'last_activity' created successfully in '${usersTableName}'.`);
    } else {
        messages.push(`Column 'last_activity' already exists in '${usersTableName}'.`);
    }

    // --- Check and create 'rhs_exam_classes' table (Junction table) ---
    const examClassesTableName = 'rhs_exam_classes';
    // We can't easily check for table existence with columnExists, so we use CREATE TABLE IF NOT EXISTS
    await query({
        query: `
            CREATE TABLE IF NOT EXISTS rhs_exam_classes (
                exam_id INT NOT NULL,
                class_id INT NOT NULL,
                PRIMARY KEY (exam_id, class_id),
                FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE,
                FOREIGN KEY (class_id) REFERENCES rhs_classes(id) ON DELETE CASCADE
            )
        `,
        values: [],
    });
    messages.push(`Table '${examClassesTableName}' created or already exists.`);

    // --- Check and create 'rhs_teacher_classes' table (Junction table for Teachers) ---
    const teacherClassesTableName = 'rhs_teacher_classes';
    await query({
        query: `
            CREATE TABLE IF NOT EXISTS rhs_teacher_classes (
                teacher_id INT NOT NULL,
                class_id INT NOT NULL,
                PRIMARY KEY (teacher_id, class_id),
                FOREIGN KEY (teacher_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
                FOREIGN KEY (class_id) REFERENCES rhs_classes(id) ON DELETE CASCADE
            )
        `,
        values: [],
    });
    messages.push(`Table '${teacherClassesTableName}' created or already exists.`);

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