require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function initDB() {
    try {
        console.log("Connecting to MySQL server...");
        // initial connection without db to create it
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });
        
        console.log("Creating database...");
        await connection.query("CREATE DATABASE IF NOT EXISTS hostel_db;");
        await connection.query("USE hostel_db;");

        console.log("Creating tables...");
        const queries = [
            `CREATE TABLE IF NOT EXISTS Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('student', 'committee', 'warden', 'admin') NOT NULL
            );`,
            `CREATE TABLE IF NOT EXISTS Students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                room_no VARCHAR(50),
                block VARCHAR(50),
                FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
            );`,
            `CREATE TABLE IF NOT EXISTS Attendance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                date DATE NOT NULL,
                status ENUM('Present', 'Absent', 'Not Marked') DEFAULT 'Not Marked',
                FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
                UNIQUE KEY (student_id, date)
            );`,
            `CREATE TABLE IF NOT EXISTS Meals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                date DATE NOT NULL,
                time ENUM('morning', 'noon', 'evening', 'night') NOT NULL,
                count INT DEFAULT 0,
                type ENUM('veg', 'non-veg') NULL,
                FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
                UNIQUE KEY (student_id, date, time)
            );`,
            `CREATE TABLE IF NOT EXISTS Meal_Settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                date DATE NOT NULL,
                time ENUM('morning', 'noon', 'evening', 'night') NOT NULL,
                is_enabled BOOLEAN DEFAULT FALSE,
                nonveg_available BOOLEAN DEFAULT FALSE,
                UNIQUE KEY (date, time)
            );`,
            `CREATE TABLE IF NOT EXISTS Fees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                month VARCHAR(20) NOT NULL,
                per_day_rate DECIMAL(10,2) NOT NULL,
                UNIQUE KEY (month)
            );`
        ];

        for (const q of queries) {
            await connection.query(q);
        }

        console.log("Checking for admin user...");
        const [rows] = await connection.query("SELECT * FROM Users WHERE email = 'admin@hostel.com'");
        if (rows.length === 0) {
            console.log("Creating default admin user...");
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await connection.query(
                "INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)",
                ['Admin', 'admin@hostel.com', hashedPassword, 'admin']
            );
            console.log("Admin user created: admin@hostel.com / admin123");
        } else {
            console.log("Admin user already exists.");
        }

        await connection.end();
        console.log("Database initialization complete.");
        process.exit(0);
    } catch (err) {
        console.error("Error initializing database:", err);
        process.exit(1);
    }
}

initDB();
