import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

// Function to execute single queries using the pool
export async function query({ query, values = [] }) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.execute(query, values);
    return results;
  } catch (error) {
    // Re-throw the error to be caught by the calling function
    throw new Error(error.message);
  } finally {
    if (connection) connection.release();
  }
}

// Function to execute a transaction with automatic deadlock retry
export async function transaction(callback, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const transactionQuery = async ({ query, values = [] }) => {
        const [results] = await connection.execute(query, values);
        return results;
      };

      const result = await callback(transactionQuery);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();

      // Check for Deadlock (ER_LOCK_DEADLOCK: 1213)
      const isDeadlock =
        error.message.includes("Deadlock") ||
        error.code === "ER_LOCK_DEADLOCK" ||
        error.errno === 1213;

      if (isDeadlock && i < retries - 1) {
        // Random backoff to desynchronize retrying threads
        const delay = Math.floor(Math.random() * 500) + i * 500;
        console.warn(
          `[DB] Deadlock detected. Retrying transaction (Attempt ${i + 2}/${retries}) in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(error.message);
    } finally {
      connection.release();
    }
  }
}

// Special function for the one-time setup
export async function setupDatabase() {
  let serverConnection;
  try {
    // 1. Connect to the server
    serverConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    // 2. Create the database if it doesn't exist
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``,
    );
    console.log(`Database ${dbConfig.database} created or already exists.`);

    // Close server connection
    await serverConnection.end();

    // 3. Use the pool for setting up tables
    const connection = await pool.getConnection();

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_classes (
              id INT AUTO_INCREMENT PRIMARY KEY,
              class_name VARCHAR(255) NOT NULL UNIQUE
            )
        `);
    console.log('Table "rhs_classes" created or already exists.');

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              role ENUM('admin', 'teacher', 'student') NOT NULL,
              class_id INT,
              session_id VARCHAR(255),
              last_activity DATETIME,
              is_locked BOOLEAN NOT NULL DEFAULT FALSE,
              is_online_realtime BOOLEAN DEFAULT 0,
              createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (class_id) REFERENCES rhs_classes(id) ON DELETE SET NULL
            )
        `);
    console.log('Table "rhs_users" created or already exists.');

    // Check if any user exists, if not create default admin
    const [users] = await connection.query(
      "SELECT COUNT(*) as count FROM rhs_users",
    );
    if (users[0].count === 0) {
      // Password is 'admin' hashed with bcrypt
      const hashedPassword = "$2b$10$Bip8Jha67dJS2knb5Hd6T.DZI97ugPxUtGwC7qgMpbTFtd4OmHk0e";

      await connection.query(
        `
          INSERT INTO rhs_users (username, password, role) 
          VALUES ('admin', ?, 'admin')
      `,
        [hashedPassword],
      );
      console.log("Default admin user created: admin / admin");
    }

    // Create the 'rhs_exams' table
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exams (
              id INT AUTO_INCREMENT PRIMARY KEY,
              exam_name VARCHAR(255) NOT NULL,
              description TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    console.log('Table "rhs_exams" created or already exists.');

    // Create the 'rhs_exam_settings' table
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exam_settings (
              id INT AUTO_INCREMENT PRIMARY KEY,
              exam_id INT NOT NULL UNIQUE,
              start_time DATETIME,
              end_time DATETIME,
              duration INT,
              max_attempts INT DEFAULT 1,
              require_safe_browser BOOLEAN DEFAULT FALSE,
              require_seb BOOLEAN DEFAULT FALSE,
              seb_config_key VARCHAR(255),
              show_instructions BOOLEAN DEFAULT FALSE,
              instruction_type ENUM('template', 'custom') DEFAULT 'template',
              custom_instructions TEXT,
              show_result BOOLEAN DEFAULT FALSE,
              show_analysis BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
            )
        `);
    console.log('Table "rhs_exam_settings" created or already exists.');

    // Migration: Ensure 'require_safe_browser' exists (for existing tables)
    try {
      await connection.query(`
            ALTER TABLE rhs_exam_settings
            ADD COLUMN require_safe_browser BOOLEAN DEFAULT FALSE;
        `);
      console.log("Column 'require_safe_browser' added to rhs_exam_settings");
    } catch (err) {
      // Ignore error if column already exists (Error 1060: Duplicate column name)
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    try {
      await connection.query(`
            ALTER TABLE rhs_exam_settings
            ADD COLUMN require_seb BOOLEAN DEFAULT FALSE,
            ADD COLUMN seb_config_key VARCHAR(255);
        `);
      console.log(
        "Columns 'require_seb' and 'seb_config_key' added to rhs_exam_settings",
      );
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    // Migration: Instruction flags and Results flags
    try {
      await connection.query(`
            ALTER TABLE rhs_exam_settings
            ADD COLUMN show_instructions BOOLEAN DEFAULT FALSE,
            ADD COLUMN instruction_type ENUM('template', 'custom') DEFAULT 'template',
            ADD COLUMN custom_instructions TEXT,
            ADD COLUMN show_result BOOLEAN DEFAULT FALSE,
            ADD COLUMN show_analysis BOOLEAN DEFAULT FALSE;
        `);
      console.log(
        "Columns instructions and results added to rhs_exam_settings",
      );
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    // Create the 'rhs_exam_questions' table
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exam_questions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              exam_id INT NOT NULL,
              question_text TEXT NOT NULL,
              options JSON,
              correct_option VARCHAR(1) NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
            )
        `);
    console.log('Table "rhs_exam_questions" created or already exists.');

    // Migration: Ensure 'sort_order' column exists for question reordering
    try {
      await connection.query(`
            ALTER TABLE rhs_exam_questions
            ADD COLUMN sort_order INT DEFAULT 0;
        `);
      console.log("Column 'sort_order' added to rhs_exam_questions");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") {
        console.log("Note: " + err.message);
      }
    }

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exam_attempts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                exam_id INT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
                INDEX (user_id, exam_id),
                FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
                FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
            );
        `);
    console.log('Table "rhs_exam_attempts" created or already exists.');

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_student_answer (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              attempt_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option VARCHAR(255) NOT NULL,
              is_correct BOOLEAN NOT NULL,
              submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE,
              FOREIGN KEY (question_id) REFERENCES rhs_exam_questions(id) ON DELETE CASCADE,
              FOREIGN KEY (attempt_id) REFERENCES rhs_exam_attempts(id) ON DELETE CASCADE
            )
        `);
    console.log('Table "rhs_student_answer" created or already exists.');

    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_temporary_answer (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE,
              FOREIGN KEY (question_id) REFERENCES rhs_exam_questions(id) ON DELETE CASCADE,
              UNIQUE KEY unique_answer (user_id, exam_id, question_id)
            )
        `);
    console.log('Table "rhs_temporary_answer" created or already exists.');

    // Create the 'rhs_launch_tokens' table for ExamSafer handoff
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_launch_tokens (
                token VARCHAR(255) PRIMARY KEY,
                user_id INT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE
            )
        `);
    console.log('Table "rhs_launch_tokens" created or already exists.');

    // Create the 'rhs_activity_logs' table for activity logging
    await connection.query(`
            CREATE TABLE IF NOT EXISTS rhs_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                username VARCHAR(255),
                ip_address VARCHAR(45),
                action VARCHAR(100) NOT NULL,
                level ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_level (level),
                INDEX idx_user_id (user_id),
                INDEX idx_action (action)
            )
        `);
    console.log('Table "rhs_activity_logs" created or already exists.');

    // Migration: Add brute force columns to rhs_users
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN failed_login_attempts INT DEFAULT 0`,
      );
      console.log("Column 'failed_login_attempts' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL`,
      );
      console.log("Column 'locked_until' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN refresh_requested_at TIMESTAMP NULL DEFAULT NULL`,
      );
      console.log("Column 'refresh_requested_at' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    try {
      await connection.query(
        `ALTER TABLE rhs_users ADD COLUMN is_online_realtime BOOLEAN DEFAULT 0`,
      );
      console.log("Column 'is_online_realtime' added to rhs_users");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Add require_all_answered to rhs_exam_settings
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN require_all_answered TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log("Column 'require_all_answered' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    // Migration: Add Token feature columns to rhs_exam_settings
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN require_token TINYINT(1) NOT NULL DEFAULT 0`,
      );
      console.log("Column 'require_token' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN token_type ENUM('static', 'auto') NOT NULL DEFAULT 'static'`,
      );
      console.log("Column 'token_type' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }
    try {
      await connection.query(
        `ALTER TABLE rhs_exam_settings ADD COLUMN current_token VARCHAR(10) NULL DEFAULT NULL`,
      );
      console.log("Column 'current_token' added to rhs_exam_settings");
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") console.log("Note: " + err.message);
    }

    connection.release();
    return { success: true };
  } catch (error) {
    console.error("Database setup failed:", error.message);
    if (serverConnection) await serverConnection.end();
    throw new Error(`Database setup failed: ${error.message}`);
  }
}

// Function to reset the entire database
export async function resetDatabase() {
  let serverConnection;
  try {
    // 1. Connect to the server
    serverConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    // 2. Drop the database if it exists
    await serverConnection.query(
      `DROP DATABASE IF EXISTS \`${dbConfig.database}\``,
    );
    console.log(`Database ${dbConfig.database} dropped.`);

    // 3. Recreate the database
    await serverConnection.query(
      `CREATE DATABASE \`${dbConfig.database}\``,
    );
    console.log(`Database ${dbConfig.database} recreated.`);

    // Close server connection
    await serverConnection.end();

    // 4. Run the setup to create tables and default admin
    await setupDatabase();
    
    return { success: true };
  } catch (error) {
    console.error("Database reset failed:", error.message);
    if (serverConnection) await serverConnection.end();
    throw new Error(`Database reset failed: ${error.message}`);
  }
}
