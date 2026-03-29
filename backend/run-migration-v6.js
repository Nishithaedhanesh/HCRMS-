require('dotenv').config();
const db = require('./db');

async function migrate() {
    try {
        console.log('Running V6 Migration (Add Bills and Mess_Bills tables)...');

        // Create Bills table
        await db.query(`
            CREATE TABLE IF NOT EXISTS Bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                si_no VARCHAR(50),
                invoice_no VARCHAR(100),
                shop_name VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                hostel_group VARCHAR(50) NOT NULL,
                bill_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
                debt DECIMAL(10,2) NOT NULL DEFAULT 0,
                total DECIMAL(10,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created Bills table');

        // Create Mess_Bills table
        await db.query(`
            CREATE TABLE IF NOT EXISTS Mess_Bills (
                id INT AUTO_INCREMENT PRIMARY KEY,
                month VARCHAR(20) NOT NULL,
                hostel_group VARCHAR(50) NOT NULL,
                opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
                purchase DECIMAL(10,2) NOT NULL DEFAULT 0,
                guest_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
                closing_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
                net_expenditure DECIMAL(10,2) NOT NULL DEFAULT 0,
                total_inmates INT NOT NULL DEFAULT 0,
                total_points DECIMAL(10,2) NOT NULL DEFAULT 0,
                rate_per_day DECIMAL(10,2) NOT NULL DEFAULT 0,
                establishment_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
                estt_per_head DECIMAL(10,2) NOT NULL DEFAULT 0,
                total_inmates_all INT NOT NULL DEFAULT 0,
                cook_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
                cook_charge_per_head DECIMAL(10,2) NOT NULL DEFAULT 0,
                no_fine_due_date DATE,
                fine_due_date DATE,
                removal_due_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_month_group (month, hostel_group)
            )
        `);
        console.log('Created Mess_Bills table');

        console.log('V6 Migration Success!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
