document.addEventListener('DOMContentLoaded', () => {
    const user = getUser();
    if (!user || user.role !== 'admin') {
        window.location.href = '/index.html';
        return;
    }
    
    document.getElementById('userName').textContent = user.name;
    loadUsers();

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('statsMonth').value = currentMonth;
    document.getElementById('tempFeeMonth').value = currentMonth;
    loadStats();

    document.getElementById('addUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('addMsg');
        msg.textContent = '';
        msg.style.color = 'var(--error-color)';

        const payload = {
            name: document.getElementById('name').value,
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            role: document.getElementById('role').value,
            room_no: document.getElementById('room_no').value,
            block: document.getElementById('block').value,
            hostel_group: document.getElementById('hostel_group').value,
            hostel_type: document.getElementById('hostel_type').value
        };

        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok) {
                msg.style.color = 'var(--success-color)';
                msg.textContent = 'User added successfully';
                document.getElementById('addUserForm').reset();
                toggleRoleFields();
                loadUsers();
            } else {
                msg.textContent = data.error || 'Failed to add user';
            }
        } catch (err) {
            msg.textContent = 'Network error';
        }
    });

    document.getElementById('tempFeeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('tempFeeMsg');
        msg.textContent = '';
        msg.style.color = 'var(--error-color)';

        try {
            const res = await fetch('/api/admin/temporary-fee', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    month: document.getElementById('tempFeeMonth').value,
                    per_day_rate: document.getElementById('tempFeeRate').value
                })
            });
            const data = await res.json();
            
            if (res.ok) {
                msg.style.color = 'var(--success-color)';
                msg.textContent = 'Fee updated successfully!';
            } else {
                msg.textContent = data.error || 'Failed to update fee';
            }
        } catch (err) {
            msg.textContent = 'Network error';
        }
    });
});

function toggleRoleFields() {
    const role = document.getElementById('role').value;
    const sf = document.getElementById('studentFields');
    const gf = document.getElementById('groupField');
    const tf = document.getElementById('typeField');
    
    if (role === 'student' || role === 'temporary') {
        sf.classList.remove('hidden');
        gf.classList.add('hidden');
        tf.classList.remove('hidden');
    } else if (role === 'committee') {
        sf.classList.add('hidden');
        gf.classList.remove('hidden');
        tf.classList.remove('hidden');
    } else {
        sf.classList.add('hidden');
        gf.classList.add('hidden');
        tf.classList.add('hidden');
    }
}

async function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    const tempTbody = document.querySelector('#tempUsersTable tbody');
    tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    tempTbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    
    try {
        const res = await fetch('/api/admin/users', {
            headers: getAuthHeaders()
        });
        const users = await res.json();
        
        tbody.innerHTML = '';
        tempTbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            if (u.role === 'temporary') {
                tr.innerHTML = `
                    <td>${u.name}</td>
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td>${u.hostel_type || ''}</td>
                    <td>${u.block || '-'}</td>
                    <td>${u.room_no || '-'}</td>
                    <td>
                        ${u.id !== getUser().id ?  
                            `<button class="btn btn-warning" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 5px;" onclick="resetUserPassword(${u.id}, '${u.name}')">Reset Password</button>
                            <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="deleteUser(${u.id})">Delete</button>` 
                            : 'Current User'}
                    </td>
                `;
                tempTbody.appendChild(tr);
            } else {
                tr.innerHTML = `
                    <td>${u.name}</td>
                    <td>${u.username}</td>
                    <td>${u.email}</td>
                    <td style="text-transform: capitalize;">${u.role}</td>
                    <td><span class="badge" style="background:#475569">${u.hostel_type || ''} ${u.hostel_group || u.block || '-'}</span></td>
                    <td>${u.room_no || '-'}</td>
                    <td>
                        ${u.id !== getUser().id ?  
                            `<button class="btn btn-warning" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 5px;" onclick="resetUserPassword(${u.id}, '${u.name}')">Reset Password</button>
                            <button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="deleteUser(${u.id})">Delete</button>` 
                            : 'Current User'}
                    </td>
                `;
                tbody.appendChild(tr);
            }
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="8" style="color:var(--error-color)">Failed to load users</td></tr>';
        tempTbody.innerHTML = '<tr><td colspan="8" style="color:var(--error-color)">Failed to load users</td></tr>';
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
        const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            loadUsers();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete');
        }
    } catch (err) {
        alert('Network error');
    }
}

async function resetUserPassword(userId, userName) {
    // Create a modal for password input
    const modal = document.createElement('div');
    modal.id = 'resetPasswordModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 400px; width: 90%;">
            <h3 style="margin-top: 0; color: #1f2937;">Reset Password for ${userName}</h3>
            <form id="resetPwdForm" style="display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: 500; color: #333;">Enter New Password:</label>
                    <input type="text" id="newPwdInput" placeholder="Enter password" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; box-sizing: border-box;">
                </div>
                <div style="background: #f0f0f0; padding: 12px; border-radius: 6px; border: 1px solid #ddd;">
                    <label style="display: block; margin-bottom: 5px; font-size: 0.9rem; color: #666;">Password Preview:</label>
                    <div style="font-family: monospace; font-size: 1rem; font-weight: bold; letter-spacing: 1px; color: #333; word-break: break-all;" id="pwdPreview">-</div>
                </div>
                <div id="resetMsg" style="color: #d32f2f; font-size: 0.9rem; min-height: 18px;"></div>
                <div style="display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1; padding: 10px;">Set Password</button>
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('resetPasswordModal').remove()" style="flex: 1; padding: 10px;">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const pwdInput = document.getElementById('newPwdInput');
    const pwdPreview = document.getElementById('pwdPreview');
    const resetMsg = document.getElementById('resetMsg');
    const resetForm = document.getElementById('resetPwdForm');
    
    // Show password as user types
    pwdInput.addEventListener('input', () => {
        pwdPreview.textContent = pwdInput.value || '-';
    });
    
    // Handle form submission
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = pwdInput.value;
        
        if (!newPassword || newPassword.length < 4) {
            resetMsg.textContent = 'Password must be at least 4 characters';
            return;
        }
        
        resetMsg.textContent = 'Updating...';
        resetMsg.style.color = '#666';
        
        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ user_id: userId, new_password: newPassword })
            });
            const data = await res.json();
            
            if (res.ok) {
                // Show success in modal instead of alert
                resetForm.innerHTML = `
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 2.5rem; color: #22c55e; margin-bottom: 15px;">✓</div>
                        <h4 style="color: #1f2937; margin: 15px 0;">Password Reset Successful!</h4>
                        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: left; margin: 15px 0; font-size: 0.95rem;">
                            <p><strong>User:</strong> ${userName}</p>
                            <p><strong>Email:</strong> ${data.email}</p>
                            <p><strong>New Password:</strong> <span style="font-family: monospace; font-weight: bold; color: #1f2937;">${data.password}</span></p>
                        </div>
                        <p style="color: #666; font-size: 0.9rem;">Please share this password with the student.</p>
                        <button type="button" class="btn btn-primary" onclick="document.getElementById('resetPasswordModal').remove()" style="margin-top: 15px; padding: 10px 30px;">Done</button>
                    </div>
                `;
            } else {
                resetMsg.textContent = data.error || 'Failed to reset password';
                resetMsg.style.color = '#d32f2f';
            }
        } catch (err) {
            resetMsg.textContent = 'Network error';
            resetMsg.style.color = '#d32f2f';
        }
    });
    
    pwdInput.focus();
}

async function loadStats() {
    const month = document.getElementById('statsMonth').value;
    const totalRegularTbody = document.querySelector('#totalBlockTable tbody');
    const totalTempTbody = document.querySelector('#totalTempTable tbody');
    const activeTbody = document.querySelector('#activeMonthTable tbody');
    
    totalRegularTbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    totalTempTbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    activeTbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    
    try {
        const res = await fetch(`/api/admin/dashboard-stats?month=${month}`, {
            headers: getAuthHeaders()
        });
        const data = await res.json();
        
        totalRegularTbody.innerHTML = '';
        if (data.totalRegularStudents && data.totalRegularStudents.length > 0) {
            data.totalRegularStudents.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.hostel_type || '-'}</td><td>${row.block || '-'}</td><td><span class="badge" style="background:var(--primary-color)">${row.count}</span></td>`;
                totalRegularTbody.appendChild(tr);
            });
        } else {
            totalRegularTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No data found</td></tr>';
        }

        totalTempTbody.innerHTML = '';
        if (data.totalTemporaryStudents && data.totalTemporaryStudents.length > 0) {
            data.totalTemporaryStudents.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.hostel_type || '-'}</td><td>${row.block || '-'}</td><td><span class="badge" style="background:var(--primary-color)">${row.count}</span></td>`;
                totalTempTbody.appendChild(tr);
            });
        } else {
            totalTempTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No data found</td></tr>';
        }
        
        activeTbody.innerHTML = '';
        if (data.activeThisMonth && data.activeThisMonth.length > 0) {
            data.activeThisMonth.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${row.hostel_type || '-'}</td><td>${row.block || '-'}</td><td><span class="badge" style="background:var(--secondary-color)">${row.count}</span></td>`;
                activeTbody.appendChild(tr);
            });
        } else {
            activeTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No data found</td></tr>';
        }
    } catch (err) {
        totalRegularTbody.innerHTML = '<tr><td colspan="3" style="color:var(--error-color)">Failed to load data</td></tr>';
        totalTempTbody.innerHTML = '<tr><td colspan="3" style="color:var(--error-color)">Failed to load data</td></tr>';
        activeTbody.innerHTML = '<tr><td colspan="3" style="color:var(--error-color)">Failed to load data</td></tr>';
    }
}

// ==============================
// 4. Manage Bills
// ==============================

function initBills() {
    const today = new Date();
    document.getElementById('billsMonth').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Bind Add Bill Form
    const addBillForm = document.getElementById('addBillForm');
    addBillForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            invoice_no: document.getElementById('billInvoiceNo').value,
            shop_name: document.getElementById('billShop').value,
            date: document.getElementById('billDate').value,
            hostel_group: document.getElementById('billsHostelGroup').value,
            bill_amount: document.getElementById('billAmount').value,
            debt: document.getElementById('billDebt').value
        };

        try {
            const res = await fetch('/api/admin/bills', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                addBillForm.reset();
                document.getElementById('billDebt').value = "0";
                calcBillTotal();
                loadBills();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to add bill');
            }
        } catch (err) {
            alert('Network error');
        }
    };
    
    loadBills();
}

function calcBillTotal() {
    const amt = parseFloat(document.getElementById('billAmount').value) || 0;
    const debt = parseFloat(document.getElementById('billDebt').value) || 0;
    document.getElementById('billTotalCalc').value = (amt + debt).toFixed(2);
}

async function loadBills() {
    const month = document.getElementById('billsMonth').value;
    const group = document.getElementById('billsHostelGroup').value;
    const tbody = document.querySelector('#billsTable tbody');
    const totalsTbody = document.querySelector('#shopTotalsTable tbody');
    tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
    totalsTbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
    
    if (!month) return;
    try {
        const res = await fetch(`/api/admin/bills?month=${month}&hostel_group=${encodeURIComponent(group)}`, {
            headers: getAuthHeaders()
        });
        const bills = await res.json();
        
        tbody.innerHTML = '';
        totalsTbody.innerHTML = '';
        
        if (bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No bills found for this month</td></tr>';
            totalsTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No bills found</td></tr>';
            return;
        }
        
        const shopTotals = {};
        
        bills.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${b.si_no || '-'}</td>
                <td>${new Date(b.date).toLocaleDateString()}</td>
                <td>${b.invoice_no || '-'}</td>
                <td>${b.shop_name}</td>
                <td>₹${parseFloat(b.bill_amount).toFixed(2)}</td>
                <td>₹${parseFloat(b.debt).toFixed(2)}</td>
                <td>₹${parseFloat(b.total).toFixed(2)}</td>
                <td><button class="btn btn-danger" style="padding: 2px 5px; font-size: 0.8rem;" onclick="deleteBill(${b.id})">Delete</button></td>
            `;
            tbody.appendChild(tr);
            
            // Calculate totals
            const shop = b.shop_name || 'Unknown';
            const amt = parseFloat(b.total) || 0;
            if (!shopTotals[shop]) shopTotals[shop] = 0;
            shopTotals[shop] += amt;
        });
        
        // Render shop totals
        const sortedShops = Object.keys(shopTotals).sort();
        let grandTotal = 0;
        
        sortedShops.forEach(shop => {
            grandTotal += shopTotals[shop];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${shop}</td>
                <td><span class="badge" style="background:#059669; font-size: 1rem;">₹${shopTotals[shop].toFixed(2)}</span></td>
            `;
            totalsTbody.appendChild(tr);
        });
        
        const trTotal = document.createElement('tr');
        trTotal.innerHTML = `
            <td><strong>Grand Total</strong></td>
            <td><strong style="color: #059669; font-size: 1.1rem;">₹${grandTotal.toFixed(2)}</strong></td>
        `;
        totalsTbody.appendChild(trTotal);
        
    } catch {
        tbody.innerHTML = '<tr><td colspan="8" style="color:var(--error-color)">Failed to load bills</td></tr>';
        totalsTbody.innerHTML = '<tr><td colspan="2" style="color:var(--error-color)">Failed to load totals</td></tr>';
    }
}

async function deleteBill(id) {
    if (!confirm('Delete this bill?')) return;
    try {
        const res = await fetch(`/api/admin/bills/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) loadBills();
        else alert('Failed to delete');
    } catch {
        alert('Network error');
    }
}

// ==============================
// 5. Generate Mess Bill
// ==============================

let currentCalculatedBill = null;

function initGenerateBill() {
    const today = new Date();
    document.getElementById('genMonth').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('printBillArea').classList.add('hidden');
    document.getElementById('billActions').classList.add('hidden');
}

async function calculateMessBill() {
    const month = document.getElementById('genMonth').value;
    const group = document.getElementById('genGroup').value;
    if (!month) { alert('Select month'); return; }

    const payload = {
        month,
        hostel_group: group,
        opening_balance: document.getElementById('genOpening').value,
        closing_stock: document.getElementById('genClosing').value,
        guest_charge: document.getElementById('genGuest').value,
        establishment_charge: document.getElementById('genEstt').value,
        cook_charge: document.getElementById('genCook').value
    };

    try {
        const res = await fetch('/api/admin/generate-mess-bill', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(!res.ok) { alert(data.error); return; }

        currentCalculatedBill = { ...payload, ...data };
        
        // Grab fines
        currentCalculatedBill.no_fine_due_date = document.getElementById('noFineDate').value || null;
        currentCalculatedBill.fine_due_date = document.getElementById('fineDate').value || null;
        currentCalculatedBill.removal_due_date = document.getElementById('removalDate').value || null;

        // Populate printable view
        document.getElementById('lblMonth').textContent = new Date(month + '-01').toLocaleString('default', { month: 'short', year: '2-digit' }).toUpperCase();
        document.getElementById('lblGroup').textContent = group.replace('LH', 'LH ').replace('MH', 'MH ');
        
        document.getElementById('resOpBal').textContent = data.opening_balance;
        document.getElementById('resPurch').textContent = data.purchase;
        document.getElementById('resSubTot1').textContent = data.opening_balance + data.purchase;
        document.getElementById('resGuest').textContent = data.guest_charge;
        document.getElementById('resClosing').textContent = data.closing_stock;
        document.getElementById('resSubTot2').textContent = data.closing_stock; // Usually closing stock is subtracted, so listing its total separately makes sense? Wait, sub total 2 is usually just closing stock.
        document.getElementById('resNet').textContent = data.net_expenditure;
        
        document.getElementById('resInmates').textContent = data.total_inmates;
        document.getElementById('resPoints').textContent = data.total_points;
        document.getElementById('resRate').innerHTML = `<span style="text-decoration: line-through; opacity: 0.6; margin-right: 10px;">${parseFloat(data.raw_rate_per_day).toFixed(2)}</span> ${data.rate_per_day}`;
        
        document.getElementById('resEsttCharge').textContent = data.establishment_charge;
        document.getElementById('resEsttHead').innerHTML = `<span style="text-decoration: line-through; opacity: 0.6; margin-right: 10px;">${parseFloat(data.raw_estt_per_head).toFixed(2)}</span> ${data.estt_per_head}`;
        
        document.getElementById('resAllInmates').textContent = data.total_inmates_all;
        document.getElementById('resCookCharge').textContent = parseFloat(data.cook_charge).toFixed(2);
        document.getElementById('resCookHead').innerHTML = `<span style="text-decoration: line-through; opacity: 0.6; margin-right: 10px;">${parseFloat(data.raw_cook_charge_per_head).toFixed(2)}</span> ${data.cook_charge_per_head}`;

        document.getElementById('lblNoFineDate').textContent = currentCalculatedBill.no_fine_due_date || '___';
        document.getElementById('lblFineDate').textContent = currentCalculatedBill.fine_due_date || '___';
        document.getElementById('lblRemovalDate').textContent = currentCalculatedBill.removal_due_date || '___';

        document.getElementById('printBillArea').classList.remove('hidden');
        document.getElementById('billActions').classList.remove('hidden');

    } catch(err) {
        alert('Failed to calculate. Ensure backend is running.');
    }
}

async function saveMessBill() {
    if (!currentCalculatedBill) return;
    try {
        const res = await fetch('/api/admin/save-mess-bill', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(currentCalculatedBill)
        });
        if(res.ok) {
            alert('Mess bill saved & published successfully.');
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to save');
        }
    } catch {
        alert('Network error');
    }
}

function printMessBill() {
    const printContent = document.getElementById('printBillArea').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); // Reload to restore events
}

// ==============================
// 5b. View Saved Mess Bills
// ==============================

async function loadSavedMessBills() {
    const month = document.getElementById('viewMonth').value || '';
    const group = document.getElementById('viewGroup').value || '';
    const tbody = document.getElementById('savedBillsTable');
    tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center;">Loading...</td></tr>';
    
    try {
        let url = '/api/admin/saved-mess-bills?';
        if (month) url += `month=${month}`;
        if (group) url += `${month ? '&' : ''}hostel_group=${encodeURIComponent(group)}`;
        
        const res = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP ${res.status}`);
        }
        
        const bills = await res.json();
        
        tbody.innerHTML = '';
        if (!bills || bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #94a3b8;">No saved bills found</td></tr>';
            return;
        }
        
        bills.forEach(bill => {
            const monthDate = new Date(bill.month + '-01');
            const monthStr = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${monthStr}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${bill.hostel_group}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${parseFloat(bill.rate_per_day).toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${parseFloat(bill.estt_per_head).toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${parseFloat(bill.cook_charge_per_head).toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${parseFloat(bill.net_expenditure).toFixed(2)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                    <button class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" onclick="viewBillDetails('${bill.month}', '${bill.hostel_group}', ${bill.id})">View</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error loading saved bills:', err);
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--error-color);">Error: ${err.message}</td></tr>`;
    }
}

function viewBillDetails(month, group, id) {
    fetch(`/api/admin/saved-mess-bills?month=${month}&hostel_group=${encodeURIComponent(group)}`, {
        headers: getAuthHeaders()
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
    })
    .then(bills => {
        const bill = bills[0];
        if (!bill) {
            alert('Bill not found');
            return;
        }
        // Populate the saved bill display area
        const monthDate = new Date(bill.month + '-01');
        const monthStr = monthDate.toLocaleString('default', { month: 'short', year: '2-digit' }).toUpperCase();
        
        document.getElementById('savedLblMonth').textContent = monthStr;
        document.getElementById('savedLblGroup').textContent = group.replace('LH', 'LH ').replace('MH', 'MH ');
        
        document.getElementById('savedResOpBal').textContent = bill.opening_balance;
        document.getElementById('savedResPurch').textContent = bill.purchase;
        document.getElementById('savedResSubTot1').textContent = parseFloat(bill.opening_balance) + parseFloat(bill.purchase);
        document.getElementById('savedResGuest').textContent = bill.guest_charge;
        document.getElementById('savedResClosing').textContent = bill.closing_stock;
        document.getElementById('savedResSubTot2').textContent = parseFloat(bill.opening_balance) + parseFloat(bill.purchase) + parseFloat(bill.guest_charge) - parseFloat(bill.closing_stock);
        document.getElementById('savedResNet').textContent = bill.net_expenditure;
        
        document.getElementById('savedResInmates').textContent = bill.total_inmates;
        document.getElementById('savedResPoints').textContent = bill.total_points;
        document.getElementById('savedResRate').textContent = bill.rate_per_day;
        
        document.getElementById('savedResEsttCharge').textContent = bill.establishment_charge;
        document.getElementById('savedResEsttHead').textContent = bill.estt_per_head;
        
        document.getElementById('savedResAllInmates').textContent = bill.total_inmates_all || '-';
        document.getElementById('savedResCookCharge').textContent = bill.cook_charge;
        document.getElementById('savedResCookHead').textContent = bill.cook_charge_per_head;
        
        document.getElementById('savedLblNoFineDate').textContent = bill.no_fine_due_date || '___';
        document.getElementById('savedLblFineDate').textContent = bill.fine_due_date || '___';
        document.getElementById('savedLblRemovalDate').textContent = bill.removal_due_date || '___';
        
        // Show the bill display area and hide the table
        document.getElementById('savedBillsTable').parentElement.parentElement.classList.add('hidden');
        document.getElementById('savedBillDisplayArea').classList.remove('hidden');
    })
    .catch(err => {
        console.error('Error fetching bill details:', err);
        alert('Error loading bill details: ' + err.message);
    });
}

function closeSavedBillView() {
    document.getElementById('savedBillDisplayArea').classList.add('hidden');
    document.getElementById('savedBillsTable').parentElement.parentElement.classList.remove('hidden');
}

async function deleteSavedBill(id) {
    if (!confirm('Are you sure you want to delete this saved bill?')) return;
    
    try {
        // Note: You might want to add a DELETE endpoint for this
        alert('Delete functionality coming soon. For now, contact admin.');
    } catch (err) {
        alert('Error');
    }
}

// ==============================
// 6. Mess Reports
// ==============================

function initReports() {
    const today = new Date();
    document.getElementById('reportDate').value = today.toISOString().split('T')[0];
    document.getElementById('reportMonth').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

function toggleReportType() {
    const type = document.getElementById('reportType').value;
    if (type === 'daily') {
        document.getElementById('dailyInput').classList.remove('hidden');
        document.getElementById('monthlyInput').classList.add('hidden');
    } else {
        document.getElementById('dailyInput').classList.add('hidden');
        document.getElementById('monthlyInput').classList.remove('hidden');
    }
}

async function loadMessReports() {
    const type = document.getElementById('reportType').value;
    const group = document.getElementById('reportGroup').value;
    const container = document.getElementById('reportsContainer');
    
    container.innerHTML = '<div style="padding: 15px;">Loading...</div>';

    try {
        if (type === 'daily') {
            const date = document.getElementById('reportDate').value;
            if(!date) return;
            const res = await fetch(`/api/admin/daily-detailed-reports?date=${date}&hostel_group=${encodeURIComponent(group)}`, { headers: getAuthHeaders() });
            const data = await res.json();
            
            let html = `
                <table style="width: 100%; min-width: 600px;">
                    <thead style="background: #f1f5f9;">
                        <tr><th>Room</th><th>Name</th><th>Morning</th><th>Noon</th><th>Evening</th><th>Night</th><th>Total</th></tr>
                    </thead>
                    <tbody>
            `;
            if(data.grouped && data.grouped.length > 0) {
                data.grouped.forEach(s => {
                    html += `
                        <tr>
                            <td>${s.room || '-'}</td>
                            <td>${s.name}</td>
                            <td>${renderMealStatus(s.morning)}</td>
                            <td>${renderMealStatus(s.noon)}</td>
                            <td>${renderMealStatus(s.evening)}</td>
                            <td>${renderMealStatus(s.night)}</td>
                            <td><span class="badge" style="background:#3b82f6">${s.total}</span></td>
                        </tr>
                    `;
                });
            } else {
                html += '<tr><td colspan="7" style="text-align:center;">No data found</td></tr>';
            }
            html += `</tbody></table>`;
            container.innerHTML = html;
        } else {
            const month = document.getElementById('reportMonth').value;
            if(!month) return;
            const res = await fetch(`/api/admin/monthly-reports?month=${month}&hostel_group=${encodeURIComponent(group)}`, { headers: getAuthHeaders() });
            const data = await res.json();
            
            let html = `
                <table style="width: 100%; min-width: 600px;">
                    <thead style="background: #f1f5f9;">
                        <tr><th>Room</th><th>Name</th><th>Active Days</th><th>Total Meals</th></tr>
                    </thead>
                    <tbody>
            `;
            if(data && data.length > 0) {
                data.forEach(s => {
                    html += `
                        <tr>
                            <td>${s.room_no || '-'}</td>
                            <td>${s.name}</td>
                            <td>${s.active_days}</td>
                            <td><span class="badge" style="background:#3b82f6">${s.total_meals || 0}</span></td>
                        </tr>
                    `;
                });
            } else {
                html += '<tr><td colspan="4" style="text-align:center;">No data found</td></tr>';
            }
            html += `</tbody></table>`;
            container.innerHTML = html;
        }
    } catch {
        container.innerHTML = '<div style="padding: 15px; color: red;">Failed to load report</div>';
    }
}

function renderMealStatus(meal) {
    if (!meal) return '-';
    let dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;background:${meal.type === 'veg' ? '#22c55e' : '#ef4444'};"></span>`;
    return meal.is_taken ? `${dot} <span style="color:#22c55e">✓</span>` : `${dot} <span>-</span>`;
}
