require('dotenv').config();
const db = require('./db');

async function runMigration() {
    try {
        console.log("Starting DB Migration V3...");

        // Check if username column exists
        const [columns] = await db.query(`SHOW COLUMNS FROM Users LIKE 'username'`);
        if (columns.length === 0) {
            console.log("Adding username column...");
            await db.query(`ALTER TABLE Users ADD COLUMN username VARCHAR(50)`);
            
            console.log("Backfilling existing users...");
            await db.query(`UPDATE Users SET username = SUBSTRING_INDEX(email, '@', 1) WHERE username IS NULL`);
            
            console.log("Enforcing UNIQUE and NOT NULL...");
            await db.query(`ALTER TABLE Users MODIFY COLUMN username VARCHAR(50) NOT NULL UNIQUE`);
        } else {
            console.log("Username column already exists.");
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runMigration();
