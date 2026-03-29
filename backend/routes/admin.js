const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware');

// Protect all routes
router.use(authMiddleware);
router.use(requireRole(['admin']));

// Get all users
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT u.id, u.name, u.username, u.email, u.role, u.hostel_group, u.hostel_type, s.block, s.room_no 
            FROM Users u 
            LEFT JOIN Students s ON u.id = s.user_id
        `);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get Admin Dashboard Stats
router.get('/dashboard-stats', async (req, res) => {
    const { month } = req.query; // e.g. 'YYYY-MM'
    if (!month) return res.status(400).json({ error: 'Month is required' });

    try {
        // Total completely registered regular students
        const [totalRegularStudents] = await db.query(`
            SELECT u.hostel_type, s.block, COUNT(DISTINCT u.id) as count
            FROM Users u
            JOIN Students s ON u.id = s.user_id
            WHERE u.role = 'student' AND s.block IS NOT NULL
            GROUP BY u.hostel_type, s.block
        `);

        // Total completely registered temporary inmates
        const [totalTemporaryStudents] = await db.query(`
            SELECT u.hostel_type, s.block, COUNT(DISTINCT u.id) as count
            FROM Users u
            JOIN Students s ON u.id = s.user_id
            WHERE u.role = 'temporary' AND s.block IS NOT NULL
            GROUP BY u.hostel_type, s.block
        `);

        // Active students that had meals in the given month, grouped by hostel_type and block
        const [activeThisMonth] = await db.query(`
            SELECT u.hostel_type, s.block, COUNT(DISTINCT m.student_id) as count
            FROM Meals m
            JOIN Students s ON m.student_id = s.id
            JOIN Users u ON s.user_id = u.id
            WHERE m.date LIKE CONCAT(?, '%') AND u.role IN ('student', 'temporary')
            GROUP BY u.hostel_type, s.block
        `, [month]);

        res.json({
            totalRegularStudents,
            totalTemporaryStudents,
            activeThisMonth
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Add new user
router.post('/users', async (req, res) => {
    const { name, username, email, password, role, room_no, block, hostel_group, hostel_type } = req.body;
    
    if (!name || !username || !email || !password || !role) {
        return res.status(400).json({ error: 'All primary fields (including username) are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const conn = await db.getConnection();
        await conn.beginTransaction();
        
        try {
            const [result] = await conn.query(
                'INSERT INTO Users (name, username, email, password, role, hostel_group, hostel_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    name, 
                    username, 
                    email, 
                    hashedPassword, 
                    role, 
                    (role === 'student' || role === 'warden' || role === 'temporary') ? null : (hostel_group || null), 
                    (role === 'warden') ? null : (hostel_type || null)
                ]
            );
            
            if (role === 'student' || role === 'temporary') {
                await conn.query(
                    'INSERT INTO Students (user_id, room_no, block, hostel_type) VALUES (?, ?, ?, ?)',
                    [result.insertId, room_no || null, block || null, hostel_type || null]
                );
            }
            
            await conn.commit();
            conn.release();
            res.status(201).json({ message: 'User created successfully', id: result.insertId });
        } catch (err) {
            await conn.rollback();
            conn.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Delete a user
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    
    try {
        await db.query('DELETE FROM Users WHERE id = ?', [id]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Reset user password (admin action)
router.post('/reset-password', async (req, res) => {
    const { user_id, new_password } = req.body;
    
    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!new_password || new_password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    
    if (parseInt(user_id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot reset your own password. Use change password instead.' });
    }
    
    try {
        // Get user details
        const [users] = await db.query('SELECT id, name, email FROM Users WHERE id = ?', [user_id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[0];
        
        // Hash the password provided by admin
        const hashed = await bcrypt.hash(new_password, 10);
        
        // Update user password
        await db.query('UPDATE Users SET password = ? WHERE id = ?', [hashed, user_id]);
        
        res.json({ 
            message: 'Password has been successfully updated.',
            email: user.email,
            password: new_password
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// --- BILLS MANAGEMENT ---

router.get('/bills', async (req, res) => {
    const { month, hostel_group } = req.query; // month format YYYY-MM
    if (!month || !hostel_group) return res.status(400).json({ error: 'Month and hostel group are required' });

    try {
        const [bills] = await db.query(
            'SELECT * FROM Bills WHERE date LIKE CONCAT(?, "%") AND hostel_group = ? ORDER BY CAST(si_no AS UNSIGNED) ASC',
            [month, hostel_group]
        );
        res.json(bills);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch bills' });
    }
});

router.post('/bills', async (req, res) => {
    const { invoice_no, shop_name, date, hostel_group, bill_amount, debt } = req.body;
    if (!shop_name || !date || !hostel_group) return res.status(400).json({ error: 'Shop name, date, and hostel group are required' });

    const amt = parseFloat(bill_amount) || 0;
    const dbt = parseFloat(debt) || 0;
    const total = amt + dbt;

    try {
        const monthStr = date.substring(0, 7); // Extracts 'YYYY-MM'
        const [maxRes] = await db.query(
            "SELECT MAX(CAST(si_no AS UNSIGNED)) as max_si_no FROM Bills WHERE date LIKE CONCAT(?, '%') AND hostel_group = ?",
            [monthStr, hostel_group]
        );
        
        let generated_si_no = '1';
        if (maxRes[0] && maxRes[0].max_si_no) {
            generated_si_no = (parseInt(maxRes[0].max_si_no) + 1).toString();
        }

        await db.query(
            'INSERT INTO Bills (si_no, invoice_no, shop_name, date, hostel_group, bill_amount, debt, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [generated_si_no, invoice_no || '', shop_name, date, hostel_group, amt, dbt, total]
        );
        res.status(201).json({ message: 'Bill added successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add bill' });
    }
});

router.delete('/bills/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM Bills WHERE id = ?', [req.params.id]);
        res.json({ message: 'Bill deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete bill' });
    }
});

// --- MESS BILL CALCULATION ---

const parseHostelGroup = (group) => {
    switch(group) {
        case 'LHA&C': return { type: 'LH', blocks: ['A', 'C'] };
        case 'LHB': return { type: 'LH', blocks: ['B'] };
        case 'MHA': return { type: 'MH', blocks: ['A'] };
        case 'MHB': return { type: 'MH', blocks: ['B'] };
        default: return null;
    }
};

router.post('/generate-mess-bill', async (req, res) => {
    const { month, hostel_group, opening_balance, guest_charge, closing_stock, establishment_charge, cook_charge } = req.body;
    
    if (!month || !hostel_group) return res.status(400).json({ error: 'Month and hostel group are required' });

    try {
        const parsed = parseHostelGroup(hostel_group);
        if (!parsed) return res.status(400).json({ error: 'Invalid hostel group' });

        // 1. Calculate Purchase (sum of bills for this month and hostel group)
        const [billRes] = await db.query(
            'SELECT SUM(total) as total_purchase FROM Bills WHERE date LIKE CONCAT(?, "%") AND hostel_group = ?',
            [month, hostel_group]
        );
        const purchase = parseFloat(billRes[0].total_purchase) || 0;

        // 2. Net Expenditure = Opening + Purchase + Guest - Closing
        const op_bal = parseFloat(opening_balance) || 0;
        const gues_chg = parseFloat(guest_charge) || 0;
        const cl_stk = parseFloat(closing_stock) || 0;
        const net_expenditure = op_bal + purchase + gues_chg - cl_stk;

        // 3. Total Inmates in this block
        const [inmatesRes] = await db.query(`
            SELECT COUNT(DISTINCT s.id) as count
            FROM Students s
            JOIN Users u ON s.user_id = u.id AND u.hostel_type = ?
            WHERE s.block IN (?) AND u.role IN ('student', 'temporary')
        `, [parsed.type, parsed.blocks]);
        const total_inmates = parseInt(inmatesRes[0].count) || 1; // avoid divide by zero

        // 4. Total Points (Days with at least 1 meal per student) in this block
        const [pointsRes] = await db.query(`
            SELECT COUNT(DISTINCT m.student_id, m.date) as total_points
            FROM Meals m
            JOIN Students s ON m.student_id = s.id
            JOIN Users u ON s.user_id = u.id AND u.hostel_type = ?
            WHERE m.date LIKE CONCAT(?, "%") AND s.block IN (?)
        `, [parsed.type, month, parsed.blocks]);
        const total_points = parseInt(pointsRes[0].total_points) || 1;

        // 5. Rate Per Day = Net Expenditure / Total Points
        let rate_per_day = null;
        if(total_points > 0) {
            rate_per_day = net_expenditure / total_points;
        } else {
            rate_per_day = 0;
        }
        const rounded_rate_per_day = Math.ceil(rate_per_day); // as per physical bill logic

        // 6. Establishment Charge Per Head
        const estt = parseFloat(establishment_charge) || 0;
        const estt_per_head = estt / total_inmates;
        const rounded_estt_per_head = Math.ceil(estt_per_head);
        
        // 7. Total Inmates in ALL messes (for Cook Charge)
        const [allInmates] = await db.query(`
            SELECT COUNT(DISTINCT s.id) as count
            FROM Students s
            JOIN Users u ON s.user_id = u.id
            WHERE u.role IN ('student', 'temporary')
        `);
        const total_inmates_all = parseInt(allInmates[0].count) || 1;

        // 8. Cook Charge Per Head
        const cook_chg = parseFloat(cook_charge) || 0;
        const cook_charge_per_head = cook_chg / total_inmates_all;
        const rounded_cook_charge_per_head = Math.ceil(cook_charge_per_head);

        res.json({
            opening_balance: op_bal,
            purchase,
            guest_charge: gues_chg,
            closing_stock: cl_stk,
            net_expenditure,
            total_inmates,
            total_points,
            raw_rate_per_day: rate_per_day,
            rate_per_day: rounded_rate_per_day,
            establishment_charge: estt,
            raw_estt_per_head: estt_per_head,
            estt_per_head: rounded_estt_per_head,
            total_inmates_all,
            cook_charge: cook_chg,
            raw_cook_charge_per_head: cook_charge_per_head,
            cook_charge_per_head: rounded_cook_charge_per_head
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to generate mess bill' });
    }
});

router.post('/save-mess-bill', async (req, res) => {
    const { month, hostel_group, opening_balance, purchase, guest_charge, closing_stock, net_expenditure,
            total_inmates, total_points, rate_per_day, establishment_charge, estt_per_head, total_inmates_all,
            cook_charge, cook_charge_per_head, no_fine_due_date, fine_due_date, removal_due_date } = req.body;
    
    if (!month || !hostel_group) return res.status(400).json({ error: 'Month and hostel group required' });

    try {
        await db.query(`
            INSERT INTO Mess_Bills (
                month, hostel_group, opening_balance, purchase, guest_charge, closing_stock, net_expenditure,
                total_inmates, total_points, rate_per_day, establishment_charge, estt_per_head, total_inmates_all,
                cook_charge, cook_charge_per_head, no_fine_due_date, fine_due_date, removal_due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                opening_balance=?, purchase=?, guest_charge=?, closing_stock=?, net_expenditure=?,
                total_inmates=?, total_points=?, rate_per_day=?, establishment_charge=?, estt_per_head=?,
                total_inmates_all=?, cook_charge=?, cook_charge_per_head=?, no_fine_due_date=?, fine_due_date=?, removal_due_date=?
        `, [
            month, hostel_group, opening_balance, purchase, guest_charge, closing_stock, net_expenditure,
            total_inmates, total_points, rate_per_day, establishment_charge, estt_per_head, total_inmates_all,
            cook_charge, cook_charge_per_head, no_fine_due_date, fine_due_date, removal_due_date,
            // Update values
            opening_balance, purchase, guest_charge, closing_stock, net_expenditure,
            total_inmates, total_points, rate_per_day, establishment_charge, estt_per_head, 
            total_inmates_all, cook_charge, cook_charge_per_head, no_fine_due_date, fine_due_date, removal_due_date
        ]);

        res.json({ message: 'Mess bill saved successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save mess bill' });
    }
});

router.get('/saved-mess-bills', async (req, res) => {
    const { month, hostel_group } = req.query;
    
    console.log('GET /saved-mess-bills called with:', { month, hostel_group, user: req.user?.id, role: req.user?.role });

    try {
        let query = 'SELECT * FROM Mess_Bills WHERE 1=1';
        const params = [];

        if (month) {
            query += ' AND month = ?';
            params.push(month);
        }

        if (hostel_group) {
            query += ' AND hostel_group = ?';
            params.push(hostel_group);
        }

        query += ' ORDER BY month DESC';
        console.log('Executing query:', query, 'with params:', params);
        const [bills] = await db.query(query, params);
        console.log('Query result:', bills.length, 'bills found');
        res.json(bills);
    } catch (err) {
        console.error('Error in /saved-mess-bills:', err.message);
        res.status(500).json({ error: 'Failed to fetch saved mess bills', details: err.message });
    }
});


// --- ADMIN REPORTS ---

router.get('/daily-detailed-reports', async (req, res) => {
    const { date, hostel_group } = req.query;
    if (!date || !hostel_group) return res.status(400).json({ error: 'Date and hostel group are required' });

    try {
        const parsed = parseHostelGroup(hostel_group);
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

router.get('/monthly-reports', async (req, res) => {
    const { month, hostel_group } = req.query; 
    if (!month || !hostel_group) return res.status(400).json({ error: 'Month and hostel group are required' });

    try {
        const parsed = parseHostelGroup(hostel_group);
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

// --- TEMPORARY INMATE FEE SETTING ---
router.post('/temporary-fee', async (req, res) => {
    const { month, per_day_rate } = req.body;
    if (!month || !per_day_rate) return res.status(400).json({ error: 'Month and rate are required' });

    try {
        await db.query(
            `INSERT INTO Fees (month, per_day_rate, hostel_group) VALUES (?, ?, 'TEMPORARY') 
             ON DUPLICATE KEY UPDATE per_day_rate = ?`,
            [month, per_day_rate, per_day_rate]
        );
        res.json({ message: 'Temporary inmate fee updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update temporary fee' });
    }
});

module.exports = router;
