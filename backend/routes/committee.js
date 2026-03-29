const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

router.use(authMiddleware);
router.use(requireRole(['committee']));

const parseHostelGroup = (group) => {
    switch(group) {
        case 'LHA&C': return { type: 'LH', blocks: ['A', 'C'] };
        case 'LHB': return { type: 'LH', blocks: ['B'] };
        case 'MHA': return { type: 'MH', blocks: ['A'] };
        case 'MHB': return { type: 'MH', blocks: ['B'] };
        default: return null;
    }
};

router.get('/meal-settings', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        const [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = ?', [date, req.user.hostel_group || 'ALL']);
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Batch update meal settings
router.post('/meal-settings/batch', async (req, res) => {
    const { date, settings } = req.body; 
    // settings: [{ time: 'morning', is_enabled: true, nonveg_available: false }, ...]
    
    if (!date || !settings) return res.status(400).json({ error: 'Date and settings are required' });

    try {
        const conn = await db.getConnection();
        await conn.beginTransaction();
        try {
            // List of hostel groups to update (committee group + TEMPORARY to include temporary inmates)
            const groupsToUpdate = [req.user.hostel_group || 'ALL', 'TEMPORARY'];
            
            for (const slot of settings) {
                // Insert for each hostel group
                for (const group of groupsToUpdate) {
                    await conn.query(
                        `INSERT INTO Meal_Settings (date, time, is_enabled, nonveg_available, hostel_group) 
                         VALUES (?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE is_enabled = ?, nonveg_available = ?`,
                        [date, slot.time, slot.is_enabled, slot.nonveg_available, group, slot.is_enabled, slot.nonveg_available]
                    );
                }
            }
            await conn.commit();
            conn.release();
            res.json({ message: 'Settings batch updated' });
        } catch (err) {
            await conn.rollback();
            conn.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get daily detailed report (Name, Room, Block, Meal details)
router.get('/daily-detailed-reports', async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    try {
        const parsed = parseHostelGroup(req.user.hostel_group);
        if (!parsed) return res.json({ grouped: [], raw: [] });

        const query = `
            SELECT s.id as student_id, u.name, s.room_no, s.block, m.time, m.type, m.count, m.is_taken 
            FROM Meals m
            JOIN Students s ON m.student_id = s.id AND s.block IN (?)
            JOIN Users u ON s.user_id = u.id AND u.hostel_type = ?
            WHERE m.date = ?
            ORDER BY 
                CASE WHEN s.block = 'A' THEN 1 
                     WHEN s.block = 'C' THEN 2 
                     WHEN s.block = 'B' THEN 3 
                     ELSE 4 
                END, 
                s.room_no
        `;
        const [records] = await db.query(query, [parsed.blocks, parsed.type, date]);
        
        // Group by student
        const grouped = {};
        records.forEach(row => {
            if (!grouped[row.student_id]) {
                grouped[row.student_id] = { 
                    id: row.student_id, 
                    name: row.name, 
                    room: row.room_no, 
                    block: row.block, 
                    morning: null, noon: null, evening: null, night: null, icecream: null, total: 0 
                };
            }
            if (row.count > 0) {
                grouped[row.student_id][row.time] = { type: row.type || 'veg', is_taken: row.is_taken };
                grouped[row.student_id].total += row.count;
            }
        });
        res.json({ grouped: Object.values(grouped), raw: records });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Get monthly report per student
router.get('/monthly-reports', async (req, res) => {
    const { month } = req.query; 
    if (!month) return res.status(400).json({ error: 'Month is required' });

    try {
        const parsed = parseHostelGroup(req.user.hostel_group);
        if (!parsed) return res.json([]);

        const query = `
            SELECT s.id as student_id, u.name, s.room_no, s.block,
                   COUNT(DISTINCT m.date) as active_days,
                   SUM(m.count) as total_meals
            FROM Students s
            JOIN Users u ON s.user_id = u.id AND u.hostel_type = ?
            LEFT JOIN Meals m ON s.id = m.student_id AND m.date LIKE CONCAT(?, '%')
            WHERE s.block IN (?)
            GROUP BY s.id, u.name, s.room_no, s.block
            ORDER BY 
                CASE WHEN s.block = 'A' THEN 1 
                     WHEN s.block = 'C' THEN 2 
                     WHEN s.block = 'B' THEN 3 
                     ELSE 4 
                END, 
                s.room_no
        `;
        
        const [reports] = await db.query(query, [parsed.type, month, parsed.blocks]);
        res.json(reports);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate monthly reports' });
    }
});

router.get('/attendance-all', async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    try {
        const parsed = parseHostelGroup(req.user.hostel_group);
        if (!parsed) return res.json([]);

        const query = `
            SELECT u.name, u.role, s.room_no, s.block, a.status 
            FROM Students s
            JOIN Users u ON s.user_id = u.id AND u.hostel_type = ?
            LEFT JOIN Attendance a ON s.id = a.student_id AND a.date = ?
            WHERE s.block IN (?)
            ORDER BY 
                CASE WHEN s.block = 'A' THEN 1 
                     WHEN s.block = 'C' THEN 2 
                     WHEN s.block = 'B' THEN 3 
                     ELSE 4 
                END, 
                s.room_no
        `;
        const [records] = await db.query(query, [parsed.type, date, parsed.blocks]);
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Toggle meal taken status
router.put('/meals/taken', async (req, res) => {
    const { student_id, date, time, is_taken } = req.body;
    if (!student_id || !date || !time) return res.status(400).json({ error: 'Missing parameters' });
    
    const parsed = parseHostelGroup(req.user.hostel_group);
    if (parsed) {
        const [st] = await db.query(
            'SELECT s.id FROM Students s JOIN Users u ON s.user_id = u.id WHERE s.id = ? AND s.block IN (?) AND u.hostel_type = ?', 
            [student_id, parsed.blocks, parsed.type]
        );
        if (st.length === 0) return res.status(403).json({ error: 'Access denied to this student block' });
    }

    try {
        await db.query(
            'UPDATE Meals SET is_taken = ? WHERE student_id = ? AND date = ? AND time = ?',
            [is_taken ? 1 : 0, student_id, date, time]
        );
        res.json({ message: 'Meal status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update meal status' });
    }
});

module.exports = router;
