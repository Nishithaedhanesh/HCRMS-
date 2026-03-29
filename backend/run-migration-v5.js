require('dotenv').config();
const db = require('./db');

async function migrate() {
    try {
        console.log('Running V5 Migration (Add Temporary Inmate Role)...');

        // Add 'temporary' to role enum in Users table
        try {
            await db.query(`ALTER TABLE Users MODIFY COLUMN role ENUM('student', 'committee', 'warden', 'admin', 'temporary') NOT NULL`);
            console.log('Updated role ENUM in Users table to include temporary');
        } catch (e) {
            console.error('Error modifying Users role ENUM:', e.message);
        }

        console.log('V5 Migration Success!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
