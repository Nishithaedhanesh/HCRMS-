require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const committeeRoutes = require('./routes/committee');
const wardenRoutes = require('./routes/warden');
const studentRoutes = require('./routes/student');
const temporaryRoutes = require('./routes/temporary');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/committee', committeeRoutes);
app.use('/api/warden', wardenRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/temporary', temporaryRoutes);

// Simple test route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hostel Management API is running' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

