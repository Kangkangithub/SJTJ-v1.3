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
    const userInfo = getStoredUserInfo();
    const avatar = userInfo.avatar || '';
    // 有头像显示头像，没头像显示默认 SVG 头像占位
    const avatarHtml = (typeof avatar === 'string' && avatar.indexOf('data:image/') === 0)
        ? '<img class="user-avatar-img" src="' + escapeHtml(avatar) + '" alt="用户头像">'
        : '<img class="user-avatar-img" src="assets/default-avatar.svg" alt="默认头像">';
    userStatusElement.innerHTML = `
        <a href="profile.html" class="btn btn-secondary secondary">${avatarHtml}<span>${escapeHtml(userName || '个人中心')}</span></a>
    `;
}

function getStoredUserInfo() {
    try {
        return JSON.parse(localStorage.getItem('userInfo') || '{}');
    } catch (error) {
        return {};
    }
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
