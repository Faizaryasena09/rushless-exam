import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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

// Function to execute a transaction
export async function transaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // The callback will receive a special query function that uses the transaction's connection
    const transactionQuery = async ({ query, values = [] }) => {
      const [results] = await connection.execute(query, values);
      return results;
    };

    const result = await callback(transactionQuery);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    // Re-throw the error to be handled by the calling function
    throw new Error(error.message);
  } finally {
    connection.release();
  }
}


// Special function for the one-time setup
export async function setupDatabase() {
  let serverConnection;
  try {
    // 1. Connect to the server
    serverConnection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '1234',
    });

    // 2. Create the database if it doesn't exist
    await serverConnection.query(`CREATE DATABASE IF NOT EXISTS RUSHLESSEXAM`);
    console.log('Database RUSHLESSEXAM created or already exists.');

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
              createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (class_id) REFERENCES rhs_classes(id) ON DELETE SET NULL
            )
        `);
    console.log('Table "rhs_users" created or already exists.');

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
      if (err.code !== 'ER_DUP_FIELDNAME') {
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

    connection.release();
    return { success: true };

  } catch (error) {
    console.error('Database setup failed:', error.message);
    if (serverConnection) await serverConnection.end();
    throw new Error(`Database setup failed: ${error.message}`);
  }
}