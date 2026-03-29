document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (!user || user.role !== 'committee') {
        window.location.href = '/index.html';
        return;
    }
    
    document.getElementById('userName').textContent = user.name;
    
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmtTmw = tomorrow.toISOString().split('T')[0];
    
    document.getElementById('settingDate').value = fmtTmw;
    document.getElementById('reportDate').value = fmtTmw;
    document.getElementById('attReviewDate').value = fmtTmw;
    document.getElementById('monthlyReportDate').value = currentMonth;

    document.getElementById('mealSettingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('settingMsg');
        msg.textContent = '';
        msg.style.color = 'var(--error-color)';

        const date = document.getElementById('settingDate').value;
        const settingsPayload = [];

        ['morning', 'noon', 'evening', 'night', 'icecream'].forEach(time => {
            const isEnabled = document.getElementById(`en-${time}`).checked;
            const nonveg = document.getElementById(`nv-${time}`).checked;
            settingsPayload.push({ time, is_enabled: isEnabled, nonveg_available: nonveg });
        });

        try {
            const res = await fetch('/api/committee/meal-settings/batch', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ date, settings: settingsPayload })
            });
            const data = await res.json();
            
            if (res.ok) {
                msg.style.color = 'var(--success-color)';
                msg.textContent = 'Settings saved successfully';
            } else {
                msg.textContent = data.error || 'Failed to save settings';
            }
        } catch (err) {
            msg.textContent = 'Network error';
        }
    });

    document.getElementById('settingDate').addEventListener('change', buildSettingsTable);
    document.getElementById('attReviewDate').addEventListener('change', loadAttendanceReview);
    document.getElementById('reportDate').addEventListener('change', loadDetailedReport);
    document.getElementById('monthlyReportDate').addEventListener('change', loadMonthlyReport);
    
    buildSettingsTable();
    loadAttendanceReview();
    loadDetailedReport();
    loadMonthlyReport();
});

async function buildSettingsTable() {
    const date = document.getElementById('settingDate').value;
    const tbody = document.getElementById('settingsTableBody');
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    try {
        const res = await fetch(`/api/committee/meal-settings?date=${date}`, {
            headers: getAuthHeaders()
        });
        const currentData = await res.json();
        
        tbody.innerHTML = '';
        const slots = ['morning', 'noon', 'evening', 'night', 'icecream'];
        
        slots.forEach(time => {
            const slotData = currentData.find(d => d.time === time);
            const isEn = slotData ? slotData.is_enabled : false;
            const isNv = slotData ? slotData.nonveg_available : false;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-transform: capitalize;">${time}</td>
                <td><input type="checkbox" id="en-${time}" ${isEn ? 'checked' : ''}></td>
                <td><input type="checkbox" id="nv-${time}" ${isNv ? 'checked' : ''}></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:var(--error-color)">Error loading data</td></tr>';
    }
}

async function loadDetailedReport() {
    const date = document.getElementById('reportDate').value;
    const tbody = document.querySelector('#detailedReportTable tbody');
    tbody.innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/committee/daily-detailed-reports?date=${date}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        const records = data.grouped;
        
        tbody.innerHTML = '';
        
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No meals entered for this date.</td></tr>';
            return;
        }

        const fmt = (val, time, stId, dt) => {
            if (!val) return '-';
            const typeLabel = val.type === 'veg' ? 'Veg' : (val.type === 'non-veg' ? 'Non-Veg' : '-');
            const chk = val.is_taken ? 'checked' : '';
            return `
                <div style="display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                    <span>${typeLabel}</span>
                    <input type="checkbox" onchange="toggleMealTaken(${stId}, '${dt}', '${time}', this.checked)" ${chk} title="Mark as taken" style="transform: scale(1.2); cursor:pointer;">
                </div>
            `;
        };

        records.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.name}</td>
                <td>${r.room || 'N/A'}</td>
                <td>${r.block || 'N/A'}</td>
                <td>${fmt(r.morning, 'morning', r.id, date)}</td>
                <td>${fmt(r.noon, 'noon', r.id, date)}</td>
                <td>${fmt(r.evening, 'evening', r.id, date)}</td>
                <td>${fmt(r.night, 'night', r.id, date)}</td>
                <td>${fmt(r.icecream, 'icecream', r.id, date)}</td>
                <td><strong>${r.total}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="9" style="color:var(--error-color)">Failed to load report</td></tr>';
    }
}

async function loadMonthlyReport() {
    const month = document.getElementById('monthlyReportDate').value;
    const tbody = document.querySelector('#monthlyTable tbody');
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/committee/monthly-reports?month=${month}`, {
            headers: getAuthHeaders()
        });
        const records = await res.json();
        
        tbody.innerHTML = '';
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3">No records found.</td></tr>';
            return;
        }

        records.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.name}</td>
                <td>${r.block || 'N/A'}</td>
                <td>${r.room_no || 'N/A'}</td>
                <td>${r.active_days || 0} Days <small>(${r.total_meals || 0} meals)</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" style="color:var(--error-color)">Failed to load report</td></tr>';
    }
}

async function loadAttendanceReview() {
    const date = document.getElementById('attReviewDate').value;
    const tbody = document.querySelector('#attReviewTable tbody');
    tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/committee/attendance-all?date=${date}`, {
            headers: getAuthHeaders()
        });
        const records = await res.json();
        
        tbody.innerHTML = '';
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No student records found.</td></tr>';
            return;
        }

        const regRecords = [];
        const tempRecords = [];

        records.forEach(r => {
            if (r.role === 'temporary') tempRecords.push(r);
            else regRecords.push(r);
        });

        const renderRow = (r) => {
            const tr = document.createElement('tr');
            let badge = '<span class="badge badge-danger" style="background:#666">Unmarked</span>';
            if (r.status === 'Present') badge = '<span class="badge badge-success">Present</span>';
            if (r.status === 'Absent') badge = '<span class="badge badge-danger">Absent</span>';
            
            tr.innerHTML = `
                <td>${r.name}</td>
                <td>${r.block || 'N/A'}</td>
                <td>${r.room_no || 'N/A'}</td>
                <td>${badge}</td>
            `;
            tbody.appendChild(tr);
        };

        if (regRecords.length > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" style="background:#f1f5f9; font-weight:bold; text-align:center;">Regular Students</td>';
            tbody.appendChild(tr);
            regRecords.forEach(renderRow);
        }

        if (tempRecords.length > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" style="background:#f1f5f9; font-weight:bold; text-align:center;">Temporary Inmates</td>';
            tbody.appendChild(tr);
            tempRecords.forEach(renderRow);
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:var(--error-color)">Failed to load data</td></tr>';
    }
}

window.toggleMealTaken = async function(student_id, date, time, is_taken) {
    try {
        const res = await fetch('/api/committee/meals/taken', {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ student_id, date, time, is_taken })
        });
        if (!res.ok) {
            console.error('Failed to update meal status');
            loadDetailedReport();
        }
    } catch (err) {
        console.error('Network Error');
        loadDetailedReport();
    }
};
