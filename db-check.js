const mysql = require('mysql2/promise');

async function test() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'rushless_exam'
        });

        console.log("Connected to DB.");

        const [columns] = await connection.execute("SHOW COLUMNS FROM rhs_users");
        console.log("Columns in rhs_users:");
        columns.forEach(c => console.log(`- ${c.Field}: ${c.Type} (Null: ${c.Null})`));

        const [users] = await connection.execute("SELECT id, username, refresh_requested_at FROM rhs_users WHERE role = 'student' AND refresh_requested_at IS NOT NULL LIMIT 5");
        console.log("\nUsers with non-null refresh signal:");
        console.log(JSON.stringify(users, null, 2));

        const [activity] = await connection.execute("SELECT * FROM rhs_activity_logs WHERE action LIKE '%REFRESH%' ORDER BY created_at DESC LIMIT 5");
        console.log("\nRecent REFRESH activity logs:");
        console.log(JSON.stringify(activity, null, 2));

        await connection.end();
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

test();
