const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

router.use(authMiddleware);
router.use(requireRole(['warden']));

const parseHostelGroup = (group) => {
    switch(group) {
        case 'LHA&C': return { type: 'LH', blocks: ['A', 'C'] };
        case 'LHB': return { type: 'LH', blocks: ['B'] };
        case 'MHA': return { type: 'MH', blocks: ['A'] };
        case 'MHB': return { type: 'MH', blocks: ['B'] };
        case 'TEMPORARY': return { isTemp: true };
        default: return null;
    }
};

// Set or update monthly fee
router.post('/fees', async (req, res) => {
    const { month, per_day_rate, hostel_group } = req.body; // 'YYYY-MM'
    const group = hostel_group || 'ALL';
    if (!month || !per_day_rate) return res.status(400).json({ error: 'Month and rate are required' });

    try {
        await db.query(
            `INSERT INTO Fees (month, per_day_rate, hostel_group) VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE per_day_rate = ?`,
            [month, per_day_rate, group, per_day_rate]
        );
        res.json({ message: 'Fee updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update fee' });
    }
});

router.get('/fees', async (req, res) => {
    try {
        const [fees] = await db.query('SELECT * FROM Fees ORDER BY month DESC');
        res.json(fees);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch fees' });
    }
});

// View student meal counts and fees for a month
router.get('/student-fees', async (req, res) => {
    const { month, hostel_group, hostel_type } = req.query; 
    const group = hostel_group || 'ALL';
    const type = hostel_type || 'ALL';
    if (!month) return res.status(400).json({ error: 'Month is required' });

    try {
        const [feeRecords] = await db.query('SELECT hostel_group, per_day_rate FROM Fees WHERE month = ?', [month]);
        const feeMap = {};
        feeRecords.forEach(f => { feeMap[f.hostel_group] = parseFloat(f.per_day_rate); });
        const globalRate = feeMap['ALL'] || 0;

        let blockFilter = '';
        let typeFilter = '';
        let queryParams = [];

        if (group !== 'ALL') {
            const parsed = parseHostelGroup(group);
            if (parsed) {
                if (parsed.isTemp) {
                    blockFilter = 'AND u.role = ?';
                    queryParams.push('temporary');
                } else {
                    blockFilter = 'AND s.block IN (?) AND u.hostel_type = ? AND u.role != ?';
                    queryParams.push(parsed.blocks);
                    queryParams.push(parsed.type);
                    queryParams.push('temporary');
                }
            }
        } else if (type !== 'ALL') {
            typeFilter = 'AND u.hostel_type = ? AND u.role != ?';
            queryParams.push(type);
            queryParams.push('temporary');
        }
        
        queryParams.push(month);

        const query = `
            SELECT s.id as student_id, u.name, s.room_no, s.block, u.hostel_type,
                   COUNT(DISTINCT m.date) as active_days,
                   SUM(m.count) as total_meals
            FROM Students s
            JOIN Users u ON s.user_id = u.id ${blockFilter} ${typeFilter}
            LEFT JOIN Meals m ON s.id = m.student_id AND m.date LIKE CONCAT(?, '%')
            GROUP BY s.id, u.name, s.room_no, s.block, u.hostel_type
            ORDER BY 
                u.hostel_type DESC,
                CASE WHEN s.block = 'A' THEN 1 
                     WHEN s.block = 'C' THEN 2 
                     WHEN s.block = 'B' THEN 3 
                     ELSE 4 
                END, 
                s.room_no`;
        
        const [students] = await db.query(query, queryParams);
        
        const getStudentFeeRate = (studentBlock, studentType, studentRole) => {
             if (studentRole === 'temporary') return feeMap['TEMPORARY'] !== undefined ? feeMap['TEMPORARY'] : globalRate;
             let studentGroup = 'ALL';
             if (studentType === 'LH') {
                 if (studentBlock === 'A' || studentBlock === 'C') studentGroup = 'LHA&C';
                 else if (studentBlock === 'B') studentGroup = 'LHB';
             } else if (studentType === 'MH') {
                 if (studentBlock === 'A') studentGroup = 'MHA';
                 else if (studentBlock === 'B') studentGroup = 'MHB';
             }
             return feeMap[studentGroup] !== undefined ? feeMap[studentGroup] : globalRate;
        };

        const results = students.map(student => {
            const studentRate = getStudentFeeRate(student.block, student.hostel_type, student.hostel_type ? 'student' : 'temporary');
            return {
                ...student,
                active_days: student.active_days || 0,
                total_meals: student.total_meals || 0,
                total_fee: (student.active_days || 0) * studentRate,
                per_day_rate: studentRate
            };
        });

        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch student fees' });
    }
});

// Get attendance of all students
router.get('/attendance-all', async (req, res) => {
    const { date } = req.query;
    try {
        const query = `
            SELECT u.name, u.role, s.room_no, s.block, u.hostel_type, a.status 
            FROM Students s
            JOIN Users u ON s.user_id = u.id
            LEFT JOIN Attendance a ON s.id = a.student_id AND a.date = ?
            ORDER BY 
                u.hostel_type DESC,
                CASE WHEN s.block = 'A' THEN 1 
                     WHEN s.block = 'C' THEN 2 
                     WHEN s.block = 'B' THEN 3 
                     ELSE 4 
                END, 
                s.room_no
        `;
        const [records] = await db.query(query, [date]);
        res.json(records);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Complaints routes
router.get('/complaints', async (req, res) => {
    try {
        let qs = `
            SELECT c.*, u.name, s.room_no, s.block, u.hostel_type 
            FROM Complaints c
            JOIN Students s ON c.student_id = s.id
            JOIN Users u ON s.user_id = u.id
            WHERE 1=1
        `;
        let params = [];
        
        if (req.query.category && req.query.category !== 'ALL') {
            qs += ' AND c.category = ?';
            params.push(req.query.category);
        }
        if (req.query.hostel_type && req.query.hostel_type !== 'ALL') {
            qs += ' AND u.hostel_type = ?';
            params.push(req.query.hostel_type);
        }
        if (req.query.block && req.query.block !== 'ALL') {
            qs += ' AND s.block = ?';
            params.push(req.query.block);
        }
        
        qs += ' ORDER BY c.created_at DESC';
        
        const [complaints] = await db.query(qs, params);
        res.json(complaints);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

router.put('/complaints/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status required' });

    try {
        await db.query('UPDATE Complaints SET status = ? WHERE id = ?', [status, id]);
        res.json({ message: 'Complaint status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update complaint' });
    }
});

module.exports = router;
