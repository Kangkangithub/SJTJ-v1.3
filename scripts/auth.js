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

    const userInfo = getStoredUserInfo();
    const userName = getStoredUserName(userInfo);
    userStatusElement.innerHTML = `
        <a href="profile.html" class="user-profile-link" aria-label="打开个人中心：${escapeHtml(userName || '个人中心')}">
            ${renderUserAvatar(userInfo, userName || '个人中心')}
            <span class="user-display-name">${escapeHtml(userName || '个人中心')}</span>
        </a>
    `;
}

function getStoredUserInfo() {
    try {
        return JSON.parse(localStorage.getItem('userInfo') || '{}') || {};
    } catch (error) {
        return {};
    }
}

function getStoredUserName(userInfo = getStoredUserInfo()) {
    const value = userInfo.name || userInfo.username || userInfo.email || '';
    return typeof value === 'string' ? value.trim() : '';
}

function renderUserAvatar(userInfo, label) {
    const avatar = userInfo && (userInfo.avatar || (userInfo.profile && userInfo.profile.avatar));
    if (typeof avatar === 'string' && avatar.indexOf('data:image/') === 0) {
        return `<span class="user-avatar"><img src="${escapeHtml(avatar)}" alt="用户头像"></span>`;
    }
    const initial = String(label || '用').trim().charAt(0).toUpperCase() || '用';
    return `<span class="user-avatar user-avatar-initial">${escapeHtml(initial)}</span>`;
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
