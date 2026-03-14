
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions } from '@/app/lib/session';
import { query, setupDatabase } from '@/app/lib/db';

async function getSession(request) {
  const cookieStore = await cookies();
  return await getIronSession(cookieStore, sessionOptions);
}

// This function checks if a column exists in a table.
async function columnExists(tableName, columnName) {
  const result = await query({
    query: `SHOW COLUMNS FROM \`${tableName}\` LIKE '${columnName}'`,
    values: [],
  });
  return result.length > 0;
}

// GET handler to perform database setup/migration
export async function GET(request) {
  const session = await getSession(request);

  // Check if database is empty or users table doesn't exist
  let isEmptyDatabase = false;
  try {
    const users = await query({ query: 'SELECT COUNT(*) as count FROM rhs_users' });
    if (users[0].count === 0) {
      isEmptyDatabase = true;
    }
  } catch (err) {
    isEmptyDatabase = true; // Table doesn't exist or DB connection err (treated as empty/needs setup)
  }

  // Allow if admin OR if database is empty (first time setup)
  const isAdmin = session.user && session.user.roleName === 'admin';

  if (!isAdmin && !isEmptyDatabase) {
    return NextResponse.json({ message: 'Unauthorized: Admin role required.' }, { status: 401 });
  }

  // If it's a first time setup (empty DB), run the initial table creation first
  if (isEmptyDatabase) {
    try {
      await setupDatabase();
    } catch (e) {
      console.error("Initial setup failed:", e);
      return NextResponse.json({
        message: 'Initial database setup failed.',
        error: e.message
      }, { status: 500 });
    }
  }

  try {
    const tableName = 'rhs_exams';
    let messages = [];

    // --- Check and create 'rhs_subjects' table ---
    const subjectsTableName = 'rhs_subjects';
    await query({
      query: `
            CREATE TABLE IF NOT EXISTS ${subjectsTableName} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `,
      values: [],
    });
    messages.push(`Table '${subjectsTableName}' created or already exists.`);

    // --- Check and create 'rhs_teacher_subjects' table (Junction table) ---
    const teacherSubjectsTableName = 'rhs_teacher_subjects';
    await query({
      query: `
            CREATE TABLE IF NOT EXISTS ${teacherSubjectsTableName} (
                teacher_id INT NOT NULL,
                subject_id INT NOT NULL,
                PRIMARY KEY (teacher_id, subject_id),
                FOREIGN KEY (teacher_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES ${subjectsTableName}(id) ON DELETE CASCADE
            )
        `,
      values: [],
    });
    messages.push(`Table '${teacherSubjectsTableName}' created or already exists.`);

    // --- Check and create 'rhs_exam_categories' table ---
    const examCategoriesTableName = 'rhs_exam_categories';
    await query({
      query: `
            CREATE TABLE IF NOT EXISTS ${examCategoriesTableName} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_by INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES rhs_users(id) ON DELETE CASCADE
            )
        `,
      values: [],
    });
    messages.push(`Table '${examCategoriesTableName}' created or already exists.`);

    // --- Check and create 'rhs_exam_logs' table ---
    const logsTableName = 'rhs_exam_logs';
    await query({
      query: `
            CREATE TABLE IF NOT EXISTS rhs_exam_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                attempt_id INT NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (attempt_id) REFERENCES rhs_exam_attempts(id) ON DELETE CASCADE
            )
        `,
      values: [],
    });
    messages.push(`Table '${logsTableName}' created or already exists.`);

    // --- Check and create 'rhs_exam_classes' table (Junction table) ---
    const examClassesTableName = 'rhs_exam_classes';
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

    // --- Check and add 'require_safe_browser' column to exam_settings table ---
    const settingsTableName = 'rhs_exam_settings';
    const hasRequireSafeBrowser = await columnExists(settingsTableName, 'require_safe_browser');
    if (!hasRequireSafeBrowser) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN require_safe_browser BOOLEAN DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'require_safe_browser' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'require_safe_browser' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'require_seb' column to exam_settings table ---
    const hasRequireSeb = await columnExists(settingsTableName, 'require_seb');
    if (!hasRequireSeb) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN require_seb BOOLEAN DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'require_seb' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'require_seb' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'seb_config_key' column to exam_settings table ---
    const hasSebConfigKey = await columnExists(settingsTableName, 'seb_config_key');
    if (!hasSebConfigKey) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN seb_config_key VARCHAR(255);`,
        values: [],
      });
      messages.push(`Column 'seb_config_key' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'seb_config_key' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'is_hidden' column to exams table ---
    const hasIsHiddenExam = await columnExists(tableName, 'is_hidden');
    if (!hasIsHiddenExam) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'is_hidden' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'is_hidden' already exists in '${tableName}'.`);
    }

    // --- Check and add 'is_hidden' column to exam_categories table ---
    const categoriesTableName = 'rhs_exam_categories';
    const hasIsHiddenCategory = await columnExists(categoriesTableName, 'is_hidden');
    if (!hasIsHiddenCategory) {
      await query({
        query: `ALTER TABLE ${categoriesTableName} ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'is_hidden' created successfully in '${categoriesTableName}'.`);
    } else {
      messages.push(`Column 'is_hidden' already exists in '${categoriesTableName}'.`);
    }

    // --- Check and add 'sort_order' column to exam_categories table ---
    const hasCategorySortOrder = await columnExists(categoriesTableName, 'sort_order');
    if (!hasCategorySortOrder) {
      await query({
        query: `ALTER TABLE ${categoriesTableName} ADD COLUMN sort_order INT DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'sort_order' created successfully in '${categoriesTableName}'.`);
      // Initialize sort_order with id for existing categories
      await query({
        query: `UPDATE ${categoriesTableName} SET sort_order = id WHERE sort_order = 0;`,
        values: [],
      });
      messages.push(`Initialized 'sort_order' for existing categories.`);
    } else {
      messages.push(`Column 'sort_order' already exists in '${categoriesTableName}'.`);
    }

    // --- Check and add 'is_admin_hidden' column to exam_categories table ---
    const hasIsAdminHidden = await columnExists(categoriesTableName, 'is_admin_hidden');
    if (!hasIsAdminHidden) {
      await query({
        query: `ALTER TABLE ${categoriesTableName} ADD COLUMN is_admin_hidden BOOLEAN DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'is_admin_hidden' created successfully in '${categoriesTableName}'.`);
    } else {
      messages.push(`Column 'is_admin_hidden' already exists in '${categoriesTableName}'.`);
    }

    // --- Check and add 'show_instructions' column to exam_settings table ---
    const hasShowInstructions = await columnExists(settingsTableName, 'show_instructions');
    if (!hasShowInstructions) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN show_instructions BOOLEAN DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'show_instructions' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'show_instructions' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'instruction_type' column to exam_settings table ---
    const hasInstructionType = await columnExists(settingsTableName, 'instruction_type');
    if (!hasInstructionType) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN instruction_type ENUM('template', 'custom') DEFAULT 'template';`,
        values: [],
      });
      messages.push(`Column 'instruction_type' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'instruction_type' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'custom_instructions' column to exam_settings table ---
    const hasCustomInstructions = await columnExists(settingsTableName, 'custom_instructions');
    if (!hasCustomInstructions) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN custom_instructions TEXT;`,
        values: [],
      });
      messages.push(`Column 'custom_instructions' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'custom_instructions' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'show_result' column to exam_settings table ---
    const hasShowResult = await columnExists(settingsTableName, 'show_result');
    if (!hasShowResult) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN show_result BOOLEAN DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'show_result' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'show_result' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'show_analysis' column to exam_settings table ---
    const hasShowAnalysis = await columnExists(settingsTableName, 'show_analysis');
    if (!hasShowAnalysis) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN show_analysis BOOLEAN DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'show_analysis' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'show_analysis' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'require_all_answered' column to exam_settings table ---
    const hasRequireAllAnswered = await columnExists(settingsTableName, 'require_all_answered');
    if (!hasRequireAllAnswered) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN require_all_answered TINYINT(1) NOT NULL DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'require_all_answered' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'require_all_answered' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'require_token' column to exam_settings table ---
    const hasRequireToken = await columnExists(settingsTableName, 'require_token');
    if (!hasRequireToken) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN require_token TINYINT(1) NOT NULL DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'require_token' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'require_token' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'token_type' column to exam_settings table ---
    const hasTokenType = await columnExists(settingsTableName, 'token_type');
    if (!hasTokenType) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN token_type ENUM('static', 'auto') NOT NULL DEFAULT 'static';`,
        values: [],
      });
      messages.push(`Column 'token_type' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'token_type' already exists in '${settingsTableName}'.`);
    }

    // --- Check and add 'current_token' column to exam_settings table ---
    const hasCurrentToken = await columnExists(settingsTableName, 'current_token');
    if (!hasCurrentToken) {
      await query({
        query: `ALTER TABLE ${settingsTableName} ADD COLUMN current_token VARCHAR(10) NULL DEFAULT NULL;`,
        values: [],
      });
      messages.push(`Column 'current_token' created successfully in '${settingsTableName}'.`);
    } else {
      messages.push(`Column 'current_token' already exists in '${settingsTableName}'.`);
    }


    // --- Check and add 'sort_order' column to exam_questions table ---
    const questionsTableName = 'rhs_exam_questions';
    const hasSortOrder = await columnExists(questionsTableName, 'sort_order');
    if (!hasSortOrder) {
      await query({
        query: `ALTER TABLE ${questionsTableName} ADD COLUMN sort_order INT DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'sort_order' created successfully in '${questionsTableName}'.`);
    } else {
      messages.push(`Column 'sort_order' already exists in '${questionsTableName}'.`);
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

    // --- Check and add 'is_locked' column to users table ---
    const hasIsLocked = await columnExists(usersTableName, 'is_locked');
    if (!hasIsLocked) {
      await query({
        query: `ALTER TABLE ${usersTableName} ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;`,
        values: [],
      });
      messages.push(`Column 'is_locked' created successfully in '${usersTableName}'.`);
    } else {
      messages.push(`Column 'is_locked' already exists in '${usersTableName}'.`);
    }

    // --- Check and add 'name' column to users table ---
    const hasName = await columnExists(usersTableName, 'name');
    if (!hasName) {
      await query({
        query: `ALTER TABLE ${usersTableName} ADD COLUMN name VARCHAR(255);`,
        values: [],
      });
      messages.push(`Column 'name' created successfully in '${usersTableName}'.`);
    } else {
      messages.push(`Column 'name' already exists in '${usersTableName}'.`);
    }

    // --- Check and add 'time_extension' column to exam attempts table ---
    const hasTimeExtension = await columnExists(attemptsTableName, 'time_extension');
    if (!hasTimeExtension) {
      await query({
        query: `ALTER TABLE ${attemptsTableName} ADD COLUMN time_extension INT NOT NULL DEFAULT 0;`,
        values: [],
      });
      messages.push(`Column 'time_extension' created successfully in '${attemptsTableName}'.`);
    } else {
      messages.push(`Column 'time_extension' already exists in '${attemptsTableName}'.`);
    }



    // --- Check and add 'category_id' column to exams table ---
    const hasCategoryId = await columnExists(tableName, 'category_id');
    if (!hasCategoryId) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN category_id INT DEFAULT NULL;`,
        values: [],
      });
      await query({
        query: `ALTER TABLE ${tableName} ADD CONSTRAINT fk_exam_category FOREIGN KEY (category_id) REFERENCES ${examCategoriesTableName}(id) ON DELETE SET NULL;`,
        values: [],
      });
      messages.push(`Column 'category_id' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'category_id' already exists in '${tableName}'.`);
    }

    // --- Check and add 'subject_id' column to exams table ---
    const hasSubjectId = await columnExists(tableName, 'subject_id');
    if (!hasSubjectId) {
      await query({
        query: `ALTER TABLE ${tableName} ADD COLUMN subject_id INT DEFAULT NULL;`,
        values: [],
      });
      await query({
        query: `ALTER TABLE ${tableName} ADD CONSTRAINT fk_exam_subject FOREIGN KEY (subject_id) REFERENCES rhs_subjects(id) ON DELETE SET NULL;`,
        values: [],
      });
      messages.push(`Column 'subject_id' created successfully in '${tableName}'.`);
    } else {
      messages.push(`Column 'subject_id' already exists in '${tableName}'.`);
    }

    // --- Check and create 'rhs_web_settings' table ---
    const webSettingsTableName = 'rhs_web_settings';
    await query({
      query: `
            CREATE TABLE IF NOT EXISTS ${webSettingsTableName} (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `,
      values: [],
    });
    messages.push(`Table '${webSettingsTableName}' created or already exists.`);

    // Check if the settings table is empty, if so, populate defaults
    const [settingsCount] = await query({
      query: `SELECT COUNT(*) as count FROM ${webSettingsTableName}`,
      values: []
    });

    if (settingsCount.count === 0) {
       await query({
           query: `INSERT INTO ${webSettingsTableName} (setting_key, setting_value) VALUES 
                   ('site_name', 'Rushless Exam'),
                   ('site_logo', '/favicon.ico')`,
           values: []
       });
       messages.push(`Default site settings initialized.`);
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