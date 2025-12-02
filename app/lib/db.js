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
            CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table "users" created or already exists.');

        await dbConnection.end();
        return { success: true };

    } catch (error) {
        console.error('Database setup failed:', error.message);
        if (serverConnection) await serverConnection.end();
        throw new Error(`Database setup failed: ${error.message}`);
    }
}