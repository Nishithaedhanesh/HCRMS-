const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

router.use(authMiddleware);
router.use(requireRole(['student']));

// Helper to map student blocks onto Groups natively
const mapStudentToGroup = (block, type) => {
    if (type === 'LH') {
        if (block === 'A' || block === 'C') return 'LHA&C';
        if (block === 'B') return 'LHB';
    } else if (type === 'MH') {
        if (block === 'A') return 'MHA';
        if (block === 'B') return 'MHB';
    }
    return 'ALL';
};

// Get today's meal settings
router.get('/settings', async (req, res) => {
    const { date } = req.query; // YYYY-MM-DD
    try {
        const [user] = await db.query('SELECT u.hostel_type, s.block FROM Users u JOIN Students s ON u.id = s.user_id WHERE s.id = ?', [req.user.student_id]);
        if (user.length === 0) return res.status(404).json({ error: 'Student not found' });
        
        const group = mapStudentToGroup(user[0].block, user[0].hostel_type);
        
        let [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = ?', [date, group]);
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
        // Check if already marked
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
    // entries: [{ time: 'morning', optIn: true, isNonVeg: false }, ...]
    const student_id = req.user.student_id;

    try {
        const [user] = await db.query('SELECT u.hostel_type, s.block FROM Users u JOIN Students s ON u.id = s.user_id WHERE s.id = ?', [student_id]);
        if (user.length === 0) return res.status(404).json({ error: 'Student not found' });
        const group = mapStudentToGroup(user[0].block, user[0].hostel_type);
        
        let [settings] = await db.query('SELECT * FROM Meal_Settings WHERE date = ? AND hostel_group = ?', [date, group]);
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

                if (!slotSetting || !slotSetting.is_enabled) {
                    continue;
                }

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

// Get meals layout
router.get('/meals/recent', async (req, res) => {
    const { month } = req.query;
    const student_id = req.user.student_id;

    try {
        const [meals] = await db.query(
            'SELECT * FROM Meals WHERE student_id = ? AND date LIKE CONCAT(?, "%")',
            [student_id, month]
        );

        // Pre-fill dates
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

        // Overlay meals
        meals.forEach(m => {
            const dtStr = `${m.date.getFullYear()}-${String(m.date.getMonth()+1).padStart(2,'0')}-${String(m.date.getDate()).padStart(2,'0')}`;
            if (!grouped[dtStr]) grouped[dtStr] = { date: dtStr, morning: null, noon: null, evening: null, night: null, icecream: null, total: 0 };
            grouped[dtStr][m.time] = m.type; // 'veg' or 'non-veg'
            grouped[dtStr].total += m.count;
        });

        // Get rates and fee calculation from Mess_Bills
        const [user] = await db.query('SELECT u.hostel_type, s.block FROM Users u JOIN Students s ON u.id = s.user_id WHERE s.id = ?', [student_id]);
        const group = user.length > 0 ? mapStudentToGroup(user[0].block, user[0].hostel_type) : 'ALL';
        
        const summaryArr = Object.values(grouped).sort((a,b) => new Date(b.date) - new Date(a.date));
        
        const totalMeals = summaryArr.reduce((acc, curr) => acc + curr.total, 0);
        const totalPoints = summaryArr.filter(curr => curr.total > 0).length; // Points = distinct days with at least 1 meal

        let [bills] = await db.query('SELECT rate_per_day, estt_per_head, cook_charge_per_head, fine_due_date, no_fine_due_date FROM Mess_Bills WHERE month = ? AND hostel_group = ?', [month, group]);
        const ratePerDay = bills.length > 0 ? parseFloat(bills[0].rate_per_day) : 0;
        const esttPerHead = bills.length > 0 ? parseFloat(bills[0].estt_per_head) : 0;
        const cookPerHead = bills.length > 0 ? parseFloat(bills[0].cook_charge_per_head) : 0;
        
        let totalFee = 0;
        if (bills.length > 0) {
            totalFee = (totalPoints * ratePerDay) + esttPerHead + cookPerHead;
        }

        res.json({
            meals: summaryArr,
            totalMeals,
            totalPoints,
            perDayRate: ratePerDay,
            esttPerHead,
            cookPerHead,
            totalFee: Math.round(totalFee), // the actual fee
            fineDates: bills.length > 0 ? {
                fine_due_date: bills[0].fine_due_date,
                no_fine_due_date: bills[0].no_fine_due_date
            } : null
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
