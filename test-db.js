const { query } = require('./app/lib/db');

async function test() {
    try {
        console.log("Checking columns in rhs_users...");
        const columns = await query({ query: "SHOW COLUMNS FROM rhs_users;" });
        console.log("Columns:", JSON.stringify(columns, null, 2));

        console.log("\nChecking recent refresh requests...");
        const users = await query({ query: "SELECT id, username, refresh_requested_at, UNIX_TIMESTAMP(refresh_requested_at) as ts FROM rhs_users WHERE refresh_requested_at IS NOT NULL LIMIT 10;" });
        console.log("Users with refresh signal:", JSON.stringify(users, null, 2));
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
