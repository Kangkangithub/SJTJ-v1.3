// 武器删除和更新功能修复脚本
console.log('加载武器删除修复脚本...');

// 强制重写删除武器函数，确保覆盖knowledge-graph.js中的函数
window.deleteWeapon = async function(weaponId, weaponName) {
    console.log('修复版删除武器函数被调用，ID:', weaponId, '名称:', weaponName);
    
    if (!confirm(`确定要删除武器 "${weaponName || '未知武器'}" 吗？此操作不可撤销。`)) {
        return;
    }
    
    try {
        // 使用完整的URL路径，确保请求到正确的端点
        const response = await fetch(`http://localhost:3001/api/weapons/direct-delete/${weaponId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-User': 'JunkangShen'
            }
        });
        
        console.log('删除响应状态:', response.status);
        console.log('删除响应头:', [...response.headers.entries()]);
        
        let result;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            console.log('非JSON响应内容:', text);
            
            if (response.ok) {
                result = { success: true, message: '删除成功' };
            } else {
                result = { success: false, message: `删除失败: ${response.status} ${response.statusText}` };
            }
        }
        
        console.log('删除结果:', result);
        
        if (result.success) {
            showMessage('武器删除成功！', 'success');
            // 刷新武器列表
            setTimeout(() => {
                refreshWeaponList();
            }, 1000);
        } else {
            showMessage(`删除失败: ${result.message}`, 'error');
        }
        
    } catch (error) {
        console.error('删除武器失败:', error);
        showMessage(`删除武器失败: ${error.message}`, 'error');
    }
};

// 确保函数在全局作用域中可用
if (typeof window !== 'undefined') {
    window.deleteWeapon = window.deleteWeapon;
    console.log('deleteWeapon函数已强制绑定到window对象');
}

// 重写更新武器函数
window.updateWeapon = async function(weaponId, weaponData) {
    console.log('开始更新武器，ID:', weaponId, '数据:', weaponData);
    
    try {
        const response = await fetch(`/api/weapons/direct-update/${weaponId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-User': 'JunkangShen'
            },
            body: JSON.stringify(weaponData)
        });
        
        console.log('更新响应状态:', response.status);
        
        let result;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            result = await response.json();
        } else {
            const text = await response.text();
            console.log('非JSON响应内容:', text);
            
            if (response.ok) {
                result = { success: true, message: '更新成功' };
            } else {
                result = { success: false, message: `更新失败: ${response.status} ${response.statusText}` };
            }
        }
        
        console.log('更新结果:', result);
        
        if (result.success) {
            showMessage('武器更新成功！', 'success');
            // 刷新武器列表
            setTimeout(() => {
                refreshWeaponList();
            }, 1000);
        } else {
            showMessage(`更新失败: ${result.message}`, 'error');
        }
        
        return result;
        
    } catch (error) {
        console.error('更新武器失败:', error);
        showMessage(`更新武器失败: ${error.message}`, 'error');
        return { success: false, message: error.message };
    }
};

// 消息提示函数
window.showMessage = function(message, type = 'info') {
    // 移除现有的消息框
    const existingMessage = document.querySelector('.weapon-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建消息框
    const messageDiv = document.createElement('div');
    messageDiv.className = `weapon-message weapon-message-${type}`;
    messageDiv.textContent = message;
    
    // 设置样式
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        max-width: 400px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
    `;
    
    // 根据类型设置背景色
    switch (type) {
        case 'success':
            messageDiv.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            break;
        case 'error':
            messageDiv.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
            break;
        case 'warning':
            messageDiv.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
            break;
        default:
            messageDiv.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
    }
    
    // 添加到页面
    document.body.appendChild(messageDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
};

// 刷新武器列表函数
window.refreshWeaponList = function() {
    console.log('尝试刷新武器列表...');
    
    // 尝试多种刷新方式
    if (typeof loadWeapons === 'function') {
        console.log('使用 loadWeapons() 刷新');
        loadWeapons();
    } else if (window.weaponDataManager && typeof window.weaponDataManager.loadWeapons === 'function') {
        console.log('使用 weaponDataManager.loadWeapons() 刷新');
        window.weaponDataManager.loadWeapons();
    } else if (typeof refreshWeaponList === 'function' && refreshWeaponList !== window.refreshWeaponList) {
        console.log('使用原始 refreshWeaponList() 刷新');
        refreshWeaponList();
    } else {
        console.log('使用页面刷新');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
};

console.log('武器删除修复脚本加载完成');