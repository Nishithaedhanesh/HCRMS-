const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

router.use(authMiddleware);
router.use(requireRole(['temporary']));

const GROUP = 'TEMPORARY';

// Get today's meal settings (Temporary Inmates)
router.get('/settings', async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    try {
        let [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = ?', [date, GROUP]);
        if (settings.length === 0) {
            [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = "ALL"', [date]);
        }
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Mark attendance
router.post('/attendance', async (req, res) => {
    const { date, status } = req.body;
    const student_id = req.user.student_id;
    
    if (!date || !status) return res.status(400).json({ error: 'Date and status required' });

    try {
        const [existing] = await db.query('SELECT * FROM Attendance WHERE student_id = ? AND date = ?', [student_id, date]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Attendance already marked for today' });
        }

        await db.query(`INSERT INTO Attendance (student_id, date, status) VALUES (?, ?, ?)`, [student_id, date, status]);
        res.json({ message: 'Attendance marked' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get attendance
router.get('/attendance', async (req, res) => {
    const { month } = req.query; 
    const student_id = req.user.student_id;
    try {
        const [attendance] = await db.query(
            'SELECT date, status FROM Attendance WHERE student_id = ? AND date LIKE CONCAT(?, "%")',
            [student_id, month]
        );
        
        const attMap = {};
        attendance.forEach(a => {
            const dtStr = `${a.date.getFullYear()}-${String(a.date.getMonth()+1).padStart(2,'0')}-${String(a.date.getDate()).padStart(2,'0')}`;
            attMap[dtStr] = a.status;
        });
        
        const [year, mStr] = month.split('-');
        let endDate = new Date(year, parseInt(mStr), 0);
        const today = new Date();
        const yInt = parseInt(year);
        const mInt = parseInt(mStr) - 1;

        if (today.getFullYear() === yInt && today.getMonth() === mInt) {
            endDate = today;
        }
        
        const results = [];
        if (today >= new Date(yInt, mInt, 1)) {
            for (let d = new Date(yInt, mInt, 1); d <= endDate; d.setDate(d.getDate() + 1)) {
                const offset = d.getTimezoneOffset() * 60000;
                const dtStr = (new Date(d - offset)).toISOString().split('T')[0];
                results.push({
                    date: dtStr,
                    status: attMap[dtStr] || 'unmarked'
                });
            }
        }
        
        results.sort((a,b) => new Date(b.date) - new Date(a.date));
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Batch Enter meals
router.post('/meals/batch', async (req, res) => {
    const { date, entries } = req.body; 
    const student_id = req.user.student_id;

    try {
        let [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = ?', [date, GROUP]);
        if (settings.length === 0) {
            [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = "ALL"', [date]);
        }
        
        const conn = await db.getConnection();
        await conn.beginTransaction();
        
        try {
            for (const entry of entries) {
                const slotSetting = settings.find(s => s.time === entry.time);
                
                if (!entry.optIn) {
                    await conn.query('DELETE FROM Meals WHERE student_id = ? AND date = ? AND time = ?', [student_id, date, entry.time]);
                    continue;
                }

                if (!slotSetting || !slotSetting.is_enabled) continue;

                let type = 'veg';
                if (slotSetting.nonveg_available && entry.isNonVeg) {
                    type = 'non-veg';
                }

                await conn.query(
                    `INSERT INTO Meals (student_id, date, time, count, type) VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE count = ?, type = ?`,
                    [student_id, date, entry.time, 1, type, 1, type]
                );
            }

            await conn.commit();
            conn.release();
            res.json({ message: 'Meals saved successfully' });
        } catch (err) {
            await conn.rollback();
            conn.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to enter meals' });
    }
});

// Get meals layout & fees
router.get('/meals/recent', async (req, res) => {
    const { month } = req.query;
    const student_id = req.user.student_id;

    try {
        const [meals] = await db.query(
            'SELECT * FROM Meals WHERE student_id = ? AND date LIKE CONCAT(?, "%")',
            [student_id, month]
        );

        const grouped = {};
        const [year, mStr] = month.split('-');
        const yInt = parseInt(year);
        const mInt = parseInt(mStr) - 1;
        let endDate = new Date(yInt, mInt + 1, 0);
        const today = new Date();
        
        if (today.getFullYear() === yInt && today.getMonth() === mInt) {
            endDate = today;
        }
        if (today >= new Date(yInt, mInt, 1)) {
            for (let d = new Date(yInt, mInt, 1); d <= endDate; d.setDate(d.getDate() + 1)) {
                const offset = d.getTimezoneOffset() * 60000;
                const dtStr = (new Date(d - offset)).toISOString().split('T')[0];
                grouped[dtStr] = { date: dtStr, morning: null, noon: null, evening: null, night: null, icecream: null, total: 0 };
            }
        }

        meals.forEach(m => {
            const dtStr = `${m.date.getFullYear()}-${String(m.date.getMonth()+1).padStart(2,'0')}-${String(m.date.getDate()).padStart(2,'0')}`;
            if (!grouped[dtStr]) grouped[dtStr] = { date: dtStr, morning: null, noon: null, evening: null, night: null, icecream: null, total: 0 };
            grouped[dtStr][m.time] = m.type;
            grouped[dtStr].total += m.count;
        });

        // Get per_day_rate for TEMPORARY group
        let [fees] = await db.query('SELECT per_day_rate FROM Fees WHERE month = ? AND hostel_group = ?', [month, GROUP]);
        if (fees.length === 0) {
            [fees] = await db.query('SELECT per_day_rate FROM Fees WHERE month = ? AND hostel_group = "ALL"', [month]);
        }
        const perDayRate = fees.length > 0 ? parseFloat(fees[0].per_day_rate) : 0;
        
        const summaryArr = Object.values(grouped).sort((a,b) => new Date(b.date) - new Date(a.date));
        
        const distinctDays = summaryArr.filter(curr => curr.total > 0).length;

        res.json({
            meals: summaryArr,
            totalMeals: distinctDays,
            perDayRate,
            totalFee: distinctDays * perDayRate
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Complaints
router.post('/complaints', async (req, res) => {
    const { category, description } = req.body;
    const student_id = req.user.student_id;
    
    if (!category || !description) return res.status(400).json({ error: 'Category and description required' });

    try {
        await db.query(
            'INSERT INTO Complaints (student_id, category, description) VALUES (?, ?, ?)',
            [student_id, category, description]
        );
        res.status(201).json({ message: 'Complaint registered successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to register complaint' });
    }
});

router.get('/complaints', async (req, res) => {
    const student_id = req.user.student_id;
    try {
        const [complaints] = await db.query(
            'SELECT * FROM Complaints WHERE student_id = ? ORDER BY created_at DESC',
            [student_id]
        );
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

module.exports = router;
