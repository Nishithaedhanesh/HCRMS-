require('dotenv').config();
const db = require('./db');

async function runMigration() {
    try {
        console.log("Starting DB Migration V2...");

        // Alter Meals table to include icecream
        console.log("Altering Meals time ENUM...");
        await db.query(`ALTER TABLE Meals MODIFY COLUMN time ENUM('morning', 'noon', 'evening', 'night', 'icecream') NOT NULL;`);

        // Alter Meal_Settings table to include icecream
        console.log("Altering Meal_Settings time ENUM...");
        await db.query(`ALTER TABLE Meal_Settings MODIFY COLUMN time ENUM('morning', 'noon', 'evening', 'night', 'icecream') NOT NULL;`);

        // Create Complaints Table
        console.log("Creating Complaints table...");
        const createComplaints = `
            CREATE TABLE IF NOT EXISTS Complaints (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                status ENUM('Pending', 'Resolved') DEFAULT 'Pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
            );
        `;
        await db.query(createComplaints);

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

runMigration();
