-- database.sql
-- Run this script to initialize the hostel database

CREATE DATABASE IF NOT EXISTS hostel_db;
USE hostel_db;

CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'committee', 'warden', 'admin') NOT NULL
);

CREATE TABLE IF NOT EXISTS Students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    room_no VARCHAR(50),
    block VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent') NOT NULL,
    UNIQUE KEY unique_student_date (student_id, date),
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Meals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    time ENUM('morning', 'noon', 'evening', 'night') NOT NULL,
    count INT DEFAULT 0,
    type ENUM('veg', 'non-veg') NULL,
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
    UNIQUE KEY (student_id, date, time)
);

CREATE TABLE IF NOT EXISTS Meal_Settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    time ENUM('morning', 'noon', 'evening', 'night') NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    nonveg_available BOOLEAN DEFAULT FALSE,
    UNIQUE KEY (date, time)
);

CREATE TABLE IF NOT EXISTS Fees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(20) NOT NULL,
    per_day_rate DECIMAL(10,2) NOT NULL,
    UNIQUE KEY (month)
);

-- Default Admin User (password is 'admin123' without hashing for simplicity or will be hashed by admin script)
-- Insert manually or handle through an admin init script.
