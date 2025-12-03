import mysql from 'mysql2/promise';

const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '1234',
};

// Function to connect to the MySQL server without selecting a database
async function connectToServer() {
  return await mysql.createConnection(dbConfig);
}

// Function to execute queries within the RUSHLESSEXAM database
export async function query({ query, values = [] }) {
  const dbconnection = await mysql.createConnection({
    ...dbConfig,
    database: 'RUSHLESSEXAM',
  });

  try {
    const [results] = await dbconnection.execute(query, values);
    dbconnection.end();
    return results;
  } catch (error) {
    // Re-throw the error to be caught by the calling function
    throw new Error(error.message);
  }
}

// Special function for the one-time setup
export async function setupDatabase() {
    let serverConnection;
    try {
        // 1. Connect to the server
        serverConnection = await connectToServer();
        
        // 2. Create the database if it doesn't exist
        await serverConnection.query(`CREATE DATABASE IF NOT EXISTS RUSHLESSEXAM`);
        console.log('Database RUSHLESSEXAM created or already exists.');
        
        // Close server connection
        await serverConnection.end();

        // 3. Connect to the specific database and create the table
        const dbConnection = await mysql.createConnection({ ...dbConfig, database: 'RUSHLESSEXAM' });
        
        

        await dbConnection.query(`
            CREATE TABLE IF NOT EXISTS rhs_classes (
              id INT AUTO_INCREMENT PRIMARY KEY,
              class_name VARCHAR(255) NOT NULL UNIQUE
            )
        `);
        console.log('Table "rhs_classes" created or already exists.');

        await dbConnection.query(`
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
        await dbConnection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exams (
              id INT AUTO_INCREMENT PRIMARY KEY,
              exam_name VARCHAR(255) NOT NULL,
              description TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table "rhs_exams" created or already exists.');

        // Create the 'rhs_exam_settings' table
        await dbConnection.query(`
            CREATE TABLE IF NOT EXISTS rhs_exam_settings (
              id INT AUTO_INCREMENT PRIMARY KEY,
              exam_id INT NOT NULL UNIQUE,
              start_time DATETIME,
              end_time DATETIME,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE
            )
        `);
        console.log('Table "rhs_exam_settings" created or already exists.');

        // Create the 'rhs_exam_questions' table
        await dbConnection.query(`
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

        await dbConnection.query(`
            CREATE TABLE IF NOT EXISTS rhs_student_answer (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              exam_id INT NOT NULL,
              question_id INT NOT NULL,
              selected_option VARCHAR(255) NOT NULL,
              is_correct BOOLEAN NOT NULL,
              submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES rhs_users(id) ON DELETE CASCADE,
              FOREIGN KEY (exam_id) REFERENCES rhs_exams(id) ON DELETE CASCADE,
              FOREIGN KEY (question_id) REFERENCES rhs_exam_questions(id) ON DELETE CASCADE
            )
        `);
        console.log('Table "rhs_student_answer" created or already exists.');

        await dbConnection.query(`
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

        await dbConnection.end();
        return { success: true };

    } catch (error) {
        console.error('Database setup failed:', error.message);
        if (serverConnection) await serverConnection.end();
        throw new Error(`Database setup failed: ${error.message}`);
    }
}