// 用于处理用户认证相关的脚本

// 在页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', function() {
    updateUserStatusDisplay();
});

// 更新用户状态显示
function updateUserStatusDisplay() {
    const userStatusElement = document.querySelector('.user-status');
    
    // 如果找不到用户状态元素，直接返回
    if (!userStatusElement) return;
    
    // 从localStorage获取用户信息
    const userInfoStr = localStorage.getItem('userInfo');
    
    // 如果没有用户信息或用户未登录，显示登录按钮
    if (!userInfoStr) {
        userStatusElement.innerHTML = '<a href="login.html" class="btn">登录</a>';
        return;
    }
    
    try {
        // 解析用户信息
        const userInfo = JSON.parse(userInfoStr);
        
        // 检查是否登录
        if (userInfo && userInfo.isLoggedIn) {
            // 显示用户信息和登出按钮
            userStatusElement.innerHTML = `
                <div class="user-info">
                    <span class="username">${userInfo.username}</span>
                    <button class="logout-btn" onclick="logout()">退出登录</button>
                </div>
            `;
        } else {
            // 如果未登录，显示登录按钮
            userStatusElement.innerHTML = '<a href="login.html" class="btn">登录</a>';
        }
    } catch (error) {
        console.error('解析用户信息时出错:', error);
        userStatusElement.innerHTML = '<a href="login.html" class="btn">登录</a>';
    }
}

// 登出函数
function logout() {
    // 清除localStorage中的用户信息
    localStorage.removeItem('userInfo');
    
    // 更新显示
    updateUserStatusDisplay();
    
    // 显示登出成功消息
    alert('已成功退出登录');
    
    // 如果当前页面是个人中心页面，则跳转到首页
    if (window.location.pathname.includes('profile.html')) {
        window.location.href = 'index.html';
    }
} 