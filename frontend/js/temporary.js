document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (!user || user.role !== 'temporary') {
        window.location.href = '/index.html';
        return;
    }
    
    document.getElementById('userName').textContent = user.name;
    
    const today = new Date();
    const fmtTdy = today.toISOString().split('T')[0];
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmtTmw = tomorrow.toISOString().split('T')[0];

    document.getElementById('attDate').value = fmtTdy;
    document.getElementById('attDate').max = fmtTdy;
    document.getElementById('mealDate').value = fmtTdy;
    document.getElementById('mealDate').min = fmtTdy;
    
    document.getElementById('summaryMonth').value = currentMonth;
    document.getElementById('attMonthFilter').value = currentMonth;

    // Initial loads
    buildMealTable();
    loadSummary();
    loadAttendanceHistory();
    loadComplaints();

    document.getElementById('summaryMonth').addEventListener('change', loadSummary);
    document.getElementById('mealDate').addEventListener('change', buildMealTable);
    document.getElementById('attMonthFilter').addEventListener('change', loadAttendanceHistory);

    document.getElementById('attendanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('attMsg');
        msg.textContent = '';
        
        const attDate = document.getElementById('attDate').value;
        const attStatus = document.getElementById('attStatus').value;

        try {
            const res = await fetch('/api/temporary/attendance', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ date: attDate, status: attStatus })
            });
            const data = await res.json();
            
            if (res.ok) {
                msg.style.color = 'var(--success-color)';
                msg.textContent = data.message;
                loadAttendanceHistory(); // Refresh table
            } else {
                msg.style.color = 'var(--error-color)';
                msg.textContent = data.error || 'Failed to mark attendance';
            }
        } catch (err) {
            msg.style.color = 'var(--error-color)';
            msg.textContent = 'Network error';
        }
    });

    document.getElementById('mealForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('mealMsg');
        msg.textContent = '';
        
        const date = document.getElementById('mealDate').value;
        const entries = [];
        
        ['morning', 'noon', 'evening', 'night', 'icecream'].forEach(time => {
            const tr = document.getElementById(`row-${time}`);
            if (tr && tr.style.display !== 'none') {
                const optIn = document.getElementById(`opt-${time}`).checked;
                const isNonVeg = document.getElementById(`nv-${time}`).checked;
                entries.push({ time, optIn, isNonVeg });
            }
        });

        try {
            const res = await fetch('/api/temporary/meals/batch', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ date, entries })
            });
            const data = await res.json();
            
            if (res.ok) {
                msg.style.color = 'var(--success-color)';
                msg.textContent = 'Meals saved!';
                loadSummary();
            } else {
                msg.style.color = 'var(--error-color)';
                msg.textContent = data.error || 'Failed to save meals';
            }
        } catch (err) {
            msg.style.color = 'var(--error-color)';
            msg.textContent = 'Network error';
        }
    });
});

async function buildMealTable() {
    const date = document.getElementById('mealDate').value;
    const tbody = document.getElementById('mealTableBody');
    const saveBtn = document.getElementById('saveMealsBtn');
    
    tbody.innerHTML = '<tr><td colspan="3">Loading slots...</td></tr>';
    saveBtn.disabled = true;

    try {
        const res = await fetch(`/api/temporary/settings?date=${date}`, {
            headers: getAuthHeaders()
        });
        const slots = await res.json();
        
        tbody.innerHTML = '';
        let hasActive = false;

        ['morning', 'noon', 'evening', 'night', 'icecream'].forEach(time => {
            const slot = slots.find(s => s.time === time);
            if (slot && slot.is_enabled) {
                hasActive = true;
                const tr = document.createElement('tr');
                tr.id = `row-${time}`;
                tr.innerHTML = `
                    <td style="text-transform: capitalize;">${time}</td>
                    <td><input type="checkbox" id="opt-${time}"></td>
                    <td>
                        <input type="checkbox" id="nv-${time}" ${!slot.nonveg_available ? 'disabled' : ''}>
                        ${!slot.nonveg_available ? '<small style="display:block;color:#999">N/A</small>' : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
        
        if (!hasActive) {
            tbody.innerHTML = '<tr><td colspan="3">No meal slots enabled by committee for this date.</td></tr>';
        } else {
            saveBtn.disabled = false;
        }

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:var(--error-color)">Failed to fetch slots</td></tr>';
    }
}

async function loadSummary() {
    const month = document.getElementById('summaryMonth').value;
    try {
        const res = await fetch(`/api/temporary/meals/recent?month=${month}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('totalMeals').textContent = data.totalMeals;
            document.getElementById('totalFee').textContent = data.totalFee.toFixed(2);
            document.getElementById('rateDisplay').textContent = data.perDayRate;
            
            const tbody = document.querySelector('#recentMealsTable tbody');
            tbody.innerHTML = '';
            
            if (data.meals.length === 0) {
                 tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No meals found</td></tr>';
                 return;
            }

            const displayCell = (val) => val ? `<span style="color:var(--success-color)">Yes (${val})</span>` : '-';

            data.meals.slice(0, 10).forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${m.date}</td>
                    <td>${displayCell(m.morning)}</td>
                    <td>${displayCell(m.noon)}</td>
                    <td>${displayCell(m.evening)}</td>
                    <td>${displayCell(m.night)}</td>
                    <td>${displayCell(m.icecream)}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Dashboard error:", err);
    }
}

let currentMLCategory = '';

function analyzeComplaint() {
    const desc = document.getElementById('compDesc').value.toLowerCase();
    const msg = document.getElementById('compMsg');
    msg.textContent = '';
    
    if (!desc.trim()) {
        msg.textContent = 'Please enter a description.';
        return;
    }

    let determinedCategory = 'Other';
    const plumbingKeys = ['pipe', 'water', 'leak', 'tap', 'drain', 'plumbing', 'bathroom'];
    const filterKeys = ['filter', 'purifier', 'drinking', 'aqua'];
    const messKeys = ['food', 'rice', 'meal', 'taste', 'curry', 'mess'];
    const cleanKeys = ['dust', 'sweep', 'clean', 'dirty', 'trash', 'garbage', 'waste'];
    const electricalKeys = ['light', 'fan', 'bulb', 'switch', 'current', 'wire'];

    if (plumbingKeys.some(k => desc.includes(k))) determinedCategory = 'Plumbing';
    else if (electricalKeys.some(k => desc.includes(k))) determinedCategory = 'Electrical';
    else if (filterKeys.some(k => desc.includes(k))) determinedCategory = 'Water Filter';
    else if (messKeys.some(k => desc.includes(k))) determinedCategory = 'Mess/Food';
    else if (cleanKeys.some(k => desc.includes(k))) determinedCategory = 'Cleaning';

    currentMLCategory = determinedCategory;
    document.getElementById('mlCategoryText').textContent = determinedCategory;
    document.getElementById('mlModal').style.display = 'flex';
}

function closeMlModal() {
    document.getElementById('mlModal').style.display = 'none';
}

async function confirmComplaint() {
    closeMlModal();
    const desc = document.getElementById('compDesc').value;
    
    try {
        const res = await fetch('/api/temporary/complaints', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ category: currentMLCategory, description: desc })
        });
        
        const msg = document.getElementById('compMsg');
        if (res.ok) {
            msg.style.color = 'var(--success-color)';
            msg.textContent = 'Complaint registered!';
            document.getElementById('compDesc').value = '';
            loadComplaints();
        } else {
            msg.style.color = 'var(--error-color)';
            msg.textContent = 'Failed to register';
        }
    } catch(err) {
        document.getElementById('compMsg').textContent = 'Network error';
    }
}

async function loadComplaints() {
    const tbody = document.querySelector('#complaintsTable tbody');
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    
    try {
        const res = await fetch('/api/temporary/complaints', { headers: getAuthHeaders() });
        const lst = await res.json();
        
        tbody.innerHTML = '';
        if (lst.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">No complaints registered</td></tr>';
            return;
        }

        lst.forEach(c => {
            const d = new Date(c.created_at).toLocaleString();
            const color = c.status === 'Resolved' ? 'var(--success-color)' : '#f59e0b';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d}</td>
                <td>${c.category}</td>
                <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${c.description}">${c.description}</td>
                <td style="color:${color}; font-weight:bold;">${c.status}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {}
}

async function loadAttendanceHistory() {
    const month = document.getElementById('attMonthFilter').value;
    const tbody = document.querySelector('#attHistoryTable tbody');
    tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/temporary/attendance?month=${month}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        
        tbody.innerHTML = '';
        if (data.error) throw new Error(data.error);
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No attendance records found for this month.</td></tr>';
            return;
        }

        data.forEach(att => {
            let badgeCls = 'danger';
            if (att.status.toLowerCase() === 'present') badgeCls = 'success';
            if (att.status.toLowerCase() === 'unmarked') badgeCls = 'warning';
            
            const statusLabel = att.status.toUpperCase();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${att.date.split('T')[0]}</td>
                <td><span class="badge badge-${badgeCls}">${statusLabel}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="2" style="color:var(--error-color)">Failed to load data</td></tr>';
    }
}
