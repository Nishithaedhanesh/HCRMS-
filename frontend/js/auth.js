// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMsg');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorMsg.textContent = '';
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role })
                });

                const data = await res.json();
                
                if (res.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Redirect based on role
                    window.location.href = `/${data.user.role}.html`;
                } else {
                    errorMsg.textContent = data.error || 'Login failed';
                }
            } catch (err) {
                errorMsg.textContent = 'Network error. Please try again.';
            }
        });
    }
});

// Utility function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return {};
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function getUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = '/index.html';
        return null;
    }
    return JSON.parse(userStr);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

// Inject Change Password Modal
document.addEventListener('DOMContentLoaded', () => {
    // Only inject on dashboard pages
    if (document.querySelector('.header')) {
        const modalHtml = `
            <div id="changePasswordModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Change Password</h3>
                        <button class="modal-close" onclick="closePasswordModal()">&times;</button>
                    </div>
                    <form id="changePasswordForm">
                        <div class="form-group">
                            <label>Old Password</label>
                            <input type="password" id="oldPassword" required>
                        </div>
                        <div class="form-group">
                            <label>New Password</label>
                            <input type="password" id="newPassword" required>
                        </div>
                        <div id="pwdMsg" class="error-msg"></div>
                        <button type="submit" class="btn btn-primary">Update Password</button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('pwdMsg');
            msg.textContent = '';
            
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;

            try {
                const res = await fetch('/api/change-password', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ oldPassword, newPassword })
                });
                const data = await res.json();
                
                if (res.ok) {
                    msg.style.color = 'var(--success-color)';
                    msg.textContent = 'Password updated!';
                    setTimeout(() => {
                        closePasswordModal();
                        document.getElementById('changePasswordForm').reset();
                    }, 1500);
                } else {
                    msg.style.color = 'var(--error-color)';
                    msg.textContent = data.error || 'Failed to update';
                }
            } catch (err) {
                msg.style.color = 'var(--error-color)';
                msg.textContent = 'Network error';
            }
        });
    }
});

function openPasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'flex';
    document.getElementById('pwdMsg').textContent = '';
}

function closePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
}

// Inject Forgot Password Modal (for login page)
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('loginForm')) {
        const modalHtml = `
            <div id="forgotPasswordModal" class="modal-overlay">
                <div class="modal-content" style="text-align: center; padding: 40px;">
                    <div class="modal-header">
                        <h3>Reset Password</h3>
                        <button class="modal-close" onclick="closeForgotModal()">&times;</button>
                    </div>
                    <div id="forgotMsg" style="font-size: 1.1rem; margin: 20px 0; line-height: 1.6; color: #333;">
                        <p><strong>Please contact your administrator to reset your password.</strong></p>
                        <p style="font-size: 0.95rem; color: #666; margin-top: 15px;">Our admin team will help you regain access to your account.</p>
                    </div>
                    <button type="button" class="btn btn-primary" onclick="closeForgotModal()" style="margin-top: 20px;">OK</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
});

function openForgotModal(e) {
    if (e) e.preventDefault();
    document.getElementById('forgotPasswordModal').style.display = 'flex';
}

function closeForgotModal() {
    document.getElementById('forgotPasswordModal').style.display = 'none';
}
