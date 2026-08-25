// 用于处理用户认证相关的脚本

document.addEventListener('DOMContentLoaded', function() {
    updateUserStatusDisplay();
});

function updateUserStatusDisplay() {
    const userStatusElement = document.querySelector('.user-status');
    if (!userStatusElement) return;

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
        userStatusElement.innerHTML = '<a href="login.html" class="btn btn-primary"><i class="fa-solid fa-right-to-bracket"></i> 登录</a>';
        return;
    }

    const userName = getStoredUserName();
    userStatusElement.innerHTML = `
        <a href="profile.html" class="btn btn-secondary secondary"><i class="fa-solid fa-user"></i> ${escapeHtml(userName || '个人中心')}</a>
    `;
}

function getStoredUserName() {
    try {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const value = userInfo.name || userInfo.username || '';
        return typeof value === 'string' ? value.trim() : '';
    } catch (error) {
        return '';
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    updateUserStatusDisplay();
    if (window.location.pathname.includes('profile.html')) {
        window.location.href = 'index.html';
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
