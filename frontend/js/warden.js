document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (!user || user.role !== 'warden') {
        window.location.href = '/index.html';
        return;
    }
    
    document.getElementById('userName').textContent = user.name;
    
    const today = new Date();
    
    const fmtTdy = today.toISOString().split('T')[0];
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('reportMonth').value = currentMonth;
    document.getElementById('attReviewDate').value = fmtTdy;

    const reportTypeSelect = document.getElementById('reportHostelType');
    if (reportTypeSelect) {
        reportTypeSelect.addEventListener('change', (e) => {
            const type = e.target.value;
            const groupSelect = document.getElementById('reportGroup');
            groupSelect.innerHTML = '<option value="ALL">All Groups</option>';

            if (type === 'LH') {
                groupSelect.innerHTML += `
                    <option value="LHA&C">A & C</option>
                    <option value="LHB">B</option>
                `;
            } else if (type === 'MH') {
                groupSelect.innerHTML += `
                    <option value="MHA">A</option>
                    <option value="MHB">B</option>
                `;
            } else {
                groupSelect.innerHTML += `
                    <option value="LHA&C">LH A & C</option>
                    <option value="LHB">LH B</option>
                    <option value="MHA">MH A</option>
                    <option value="MHB">MH B</option>
                `;
            }
        });
    }

    loadStudentReport();
    loadAttendanceReview();
    loadComplaints();
});

async function loadStudentReport() {
    const month = document.getElementById('reportMonth').value;
    const group = document.getElementById('reportGroup').value;
    const type = document.getElementById('reportHostelType').value;
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/warden/student-fees?month=${encodeURIComponent(month)}&hostel_group=${encodeURIComponent(group)}&hostel_type=${encodeURIComponent(type)}`, {
            headers: getAuthHeaders()
        });
        const records = await res.json();
        
        tbody.innerHTML = '';
        
        if (records.length === 0) {
             tbody.innerHTML = '<tr><td colspan="5">No data found</td></tr>';
             return;
        }

        records.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${r.name}</td>
                <td>${r.block||'-'} / ${r.room_no||'-'}</td>
                <td>${r.hostel_type || 'LH'}</td>
                <td>${r.active_days} Days <small>(${r.total_meals} meals)</small></td>
                <td><strong>₹${r.total_fee.toFixed(2)}</strong></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="color:var(--error-color)">Failed to load report</td></tr>';
    }
}

async function loadAttendanceReview() {
    const date = document.getElementById('attReviewDate').value;
    const container = document.getElementById('attendanceTablesContainer');
    container.innerHTML = '<p>Loading...</p>';
    
    try {
        const res = await fetch(`/api/warden/attendance-all?date=${date}`, {
            headers: getAuthHeaders()
        });
        const records = await res.json();
        
        container.innerHTML = '';
        if (records.length === 0) {
             container.innerHTML = '<p>No students found.</p>';
             return;
        }

        const groups = {
            'LH A&C': [],
            'LHB': [],
            'MHA': [],
            'MHB': [],
            'Temporary Inmates': [],
            'Other': []
        };
        
        records.forEach(r => {
            if (r.role === 'temporary') {
                groups['Temporary Inmates'].push(r);
                return;
            }
            const t = r.hostel_type || 'LH'; 
            const b = r.block || '';
            let key = 'Other';
            if (t === 'LH' && (b === 'A' || b === 'C')) key = 'LH A&C';
            else if (t === 'LH' && b === 'B') key = 'LHB';
            else if (t === 'MH' && b === 'A') key = 'MHA';
            else if (t === 'MH' && b === 'B') key = 'MHB';
            else key = 'Other';
            groups[key].push(r);
        });

        for (const [key, grpRecords] of Object.entries(groups)) {
            if (grpRecords.length === 0) continue;
            
            const tableDiv = document.createElement('div');
            tableDiv.innerHTML = `
                <h4 style="margin-bottom:0.5rem; text-transform:uppercase; color:var(--text-color);">${key} Attendance</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Block</th>
                            <th>Room No</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grpRecords.map(r => {
                            const stateClr = r.status === 'Present' ? 'var(--success-color)' : (r.status === 'Absent' ? 'var(--error-color)' : '#666');
                            return `
                                <tr>
                                    <td>${r.name}</td>
                                    <td>${r.block||'-'}</td>
                                    <td>${r.room_no||'-'}</td>
                                    <td style="color:${stateClr}; font-weight:bold;">${r.status || 'Unmarked'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
            container.appendChild(tableDiv);
        }
    } catch (err) {
        container.innerHTML = '<p style="color:var(--error-color)">Error loading data</p>';
    }
}

async function loadComplaints() {
    const tbody = document.querySelector('#manageComplaintsTable tbody');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    
    let category = 'ALL', type = 'ALL', block = 'ALL';
    if (document.getElementById('filterCategory')) category = document.getElementById('filterCategory').value;
    if (document.getElementById('filterType')) type = document.getElementById('filterType').value;
    if (document.getElementById('filterBlock')) block = document.getElementById('filterBlock').value;

    const qs = new URLSearchParams();
    if (category !== 'ALL') qs.append('category', category);
    if (type !== 'ALL') qs.append('hostel_type', type);
    if (block !== 'ALL') qs.append('block', block);

    try {
        const res = await fetch('/api/warden/complaints?' + qs.toString(), {
            headers: getAuthHeaders()
        });
        const records = await res.json();
        
        tbody.innerHTML = '';
        if (records.length === 0) {
             tbody.innerHTML = '<tr><td colspan="5">No complaints found</td></tr>';
             return;
        }

        records.forEach(c => {
            const dt = new Date(c.created_at).toLocaleDateString();
            const isResolved = c.status === 'Resolved';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dt}</td>
                <td>${c.name} <br><small>${c.block||'-'} / ${c.room_no||'-'}</small></td>
                <td>${c.category}</td>
                <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${c.description}">${c.description}</td>
                <td>
                    ${isResolved ? 
                        '<span style="color:var(--success-color); font-weight:bold;">Resolved</span>' :
                        `<button class="btn btn-success" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="resolveComplaint(${c.id})">Mark Resolved</button>`
                    }
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--error-color)">Error</td></tr>';
    }
}

async function resolveComplaint(id) {
    if (!confirm("Mark this complaint as resolved?")) return;
    
    try {
        const res = await fetch(`/api/warden/complaints/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: 'Resolved' })
        });
        if (res.ok) {
            loadComplaints();
        } else {
            alert('Failed to update status');
        }
    } catch (err) {
        alert('Network error');
    }
}

