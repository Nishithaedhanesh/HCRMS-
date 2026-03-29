require('dotenv').config();
const db = require('./db');

async function migrate() {
    try {
        console.log('Running V4 Migration (Multi-Hostel Structure)...');

        // Add hostel_group to Users
        try {
            await db.query(`ALTER TABLE Users ADD COLUMN hostel_group VARCHAR(20) DEFAULT NULL`);
            console.log('Added hostel_group to Users');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
            console.log('Users.hostel_group already exists');
        }

        // Add hostel_group to Fees & modify unique key
        try {
            await db.query(`ALTER TABLE Fees ADD COLUMN hostel_group VARCHAR(20) NOT NULL DEFAULT 'ALL'`);
            console.log('Added hostel_group to Fees');
            
            try { await db.query(`ALTER TABLE Fees DROP INDEX month`); } catch (err) {}
            await db.query(`ALTER TABLE Fees ADD UNIQUE KEY month_group (month, hostel_group)`);
            console.log('Updated Fees unique key');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
            console.log('Fees.hostel_group already exists');
        }

        // Add hostel_group to Meal_Settings & modify unique key
        try {
            await db.query(`ALTER TABLE Meal_Settings ADD COLUMN hostel_group VARCHAR(20) NOT NULL DEFAULT 'ALL'`);
            console.log('Added hostel_group to Meal_Settings');
            
            try { await db.query(`ALTER TABLE Meal_Settings DROP INDEX date`); } catch (err) {}
            await db.query(`ALTER TABLE Meal_Settings ADD UNIQUE KEY date_time_group (date, time, hostel_group)`);
            console.log('Updated Meal_Settings unique key');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
            console.log('Meal_Settings.hostel_group already exists');
        }

        console.log('V4 Migration Success!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
