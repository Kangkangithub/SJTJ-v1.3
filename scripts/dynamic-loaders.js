// 动态加载视频管理器的函数
function loadVideoManagerAndShow(weaponId, weaponName, action) {
    // 检查CSS是否已加载
    if (!document.querySelector('link[href*="weapon-video-integration.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'styles/weapon-video-integration.css';
        document.head.appendChild(cssLink);
    }
    
    // 检查JS是否已加载
    if (!document.querySelector('script[src*="weapon-video-integration.js"]')) {
        const script = document.createElement('script');
        script.src = 'scripts/weapon-video-integration.js';
        script.onload = function() {
            console.log('视频管理器加载完成');
            // 等待一小段时间确保初始化完成
            setTimeout(() => {
                if (window.weaponVideoManager && typeof window.weaponVideoManager[action] === 'function') {
                    window.weaponVideoManager[action](weaponId, weaponName);
                } else {
                    alert('视频功能加载失败，请刷新页面重试');
                }
            }, 100);
        };
        script.onerror = function() {
            alert('视频功能加载失败，请检查文件是否存在');
        };
        document.head.appendChild(script);
    } else {
        // 脚本已存在，直接调用
        setTimeout(() => {
            if (window.weaponVideoManager && typeof window.weaponVideoManager[action] === 'function') {
                window.weaponVideoManager[action](weaponId, weaponName);
            } else {
                alert('视频功能尚未初始化，请稍后重试');
            }
        }, 100);
    }
}

// 动态加载3D模型管理器的函数
function loadModelManagerAndShow(weaponId, weaponName, action) {
    // 检查CSS是否已加载
    if (!document.querySelector('link[href*="weapon-model-integration.css"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'styles/weapon-model-integration.css';
        document.head.appendChild(cssLink);
    }
    
    // 检查JS是否已加载
    if (!document.querySelector('script[src*="weapon-model-integration.js"]')) {
        const script = document.createElement('script');
        script.src = 'scripts/weapon-model-integration.js';
        script.onload = function() {
            console.log('3D模型管理器加载完成');
            // 等待一小段时间确保初始化完成
            setTimeout(() => {
                if (window.weaponModelManager && typeof window.weaponModelManager[action] === 'function') {
                    window.weaponModelManager[action](weaponId, weaponName);
                } else {
                    alert('3D模型功能加载失败，请刷新页面重试');
                }
            }, 100);
        };
        script.onerror = function() {
            alert('3D模型功能加载失败，请检查文件是否存在');
        };
        document.head.appendChild(script);
    } else {
        // 脚本已存在，直接调用
        setTimeout(() => {
            if (window.weaponModelManager && typeof window.weaponModelManager[action] === 'function') {
                window.weaponModelManager[action](weaponId, weaponName);
            } else {
                alert('3D模型功能尚未初始化，请稍后重试');
            }
        }, 100);
    }
}

// 将函数暴露到全局作用域
window.loadVideoManagerAndShow = loadVideoManagerAndShow;
window.loadModelManagerAndShow = loadModelManagerAndShow;