const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

// Login
router.post('/login', async (req, res) => {
    let { email, password, role } = req.body; 
    let filterGroup = null;

    if (role === 'lh_ac_committee') { role = 'committee'; filterGroup = 'LHA&C'; }
    else if (role === 'lh_b_committee') { role = 'committee'; filterGroup = 'LHB'; }
    else if (role === 'mha_committee') { role = 'committee'; filterGroup = 'MHA'; }
    else if (role === 'mhb_committee') { role = 'committee'; filterGroup = 'MHB'; }
    
    if (!email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        let query = 'SELECT * FROM Users WHERE (email = ? OR username = ?) AND role = ?';
        let params = [email, email, role];
        if (filterGroup) {
            query += ' AND hostel_group = ?';
            params.push(filterGroup);
        }
        const [users] = await db.query(query, params);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials or role' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials or role' });
        }

        const tokenPayload = {
            id: user.id,
            role: user.role,
            name: user.name,
            username: user.username,
            email: user.email,
            hostel_group: user.hostel_group
        };

        // If student or temporary inmate, attach student_id
        if (user.role === 'student' || user.role === 'temporary') {
            const [students] = await db.query('SELECT id FROM Students WHERE user_id = ?', [user.id]);
            if (students.length > 0) {
                tokenPayload.student_id = students[0].id;
            }
        }

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'secret123', { expiresIn: '24h' });
        
        res.json({ message: 'Login successful', token, user: tokenPayload });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/change-password', require('../middleware').authMiddleware, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new passwords are required' });
    }

    try {
        const [users] = await db.query('SELECT password FROM Users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const isMatch = await bcrypt.compare(oldPassword, users[0].password);
        if (!isMatch) return res.status(401).json({ error: 'Incorrect old password' });
        
        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE Users SET password = ? WHERE id = ?', [hashed, userId]);
        
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Forgot Password - Direct to Admin
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const [users] = await db.query('SELECT id, name FROM Users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'No account found with that email address.' });
        }

        // Just return a message directing user to admin (don't reset password here)
        res.json({ 
            message: 'Please contact your administrator to reset your password. They can help you immediately!',
            contactAdmin: true
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

module.exports = router;
