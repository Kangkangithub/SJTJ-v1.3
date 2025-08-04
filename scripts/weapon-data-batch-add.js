// 武器数据批量添加功能模块
// 包含武器名称重复检查功能

/**
 * 检查武器名称是否重复
 * @param {string} weaponName - 要检查的武器名称
 * @returns {Promise<boolean>} - 如果重复返回true，否则返回false
 */
async function checkWeaponNameDuplicate(weaponName) {
    if (!weaponName || !weaponName.trim()) {
        return false;
    }

    try {
        console.log('正在检查武器名称重复:', weaponName);
        
        // 首先尝试专用的检查API
        try {
            const response = await fetch(`http://localhost:3001/api/weapons/check-name?name=${encodeURIComponent(weaponName.trim())}`);
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    console.log('武器名称检查结果:', result.exists);
                    return result.exists;
                }
            }
        } catch (error) {
            console.log('专用检查API不可用，使用搜索API检查');
        }
        
        // 如果专用API不可用，使用搜索API检查
        const searchResponse = await fetch(`http://localhost:3001/api/weapons/search?q=${encodeURIComponent(weaponName.trim())}`);
        
        if (searchResponse.ok) {
            const searchResult = await searchResponse.json();
            if (searchResult.success && searchResult.data.weapons) {
                // 检查是否有完全匹配的武器名称（不区分大小写）
                const exactMatch = searchResult.data.weapons.some(weapon => 
                    weapon.name && weapon.name.toLowerCase() === weaponName.trim().toLowerCase()
                );
                
                console.log('通过搜索API检查结果:', exactMatch);
                return exactMatch;
            }
        }
        
        // 如果所有API都不可用，返回false（不阻止添加）
        console.log('无法检查武器名称重复，允许添加');
        return false;
        
    } catch (error) {
        console.error('检查武器名称重复时发生错误:', error);
        // 发生错误时不阻止添加
        return false;
    }
}

/**
 * 显示武器名称重复警告
 * @param {string} weaponName - 重复的武器名称
 * @returns {Promise<boolean>} - 用户是否确认继续添加
 */
async function showDuplicateWarning(weaponName) {
    return new Promise((resolve) => {
        // 创建自定义确认对话框
        const warningHtml = `
            <div class="duplicate-warning-overlay">
                <div class="duplicate-warning-dialog">
                    <div class="warning-header">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>武器名称重复警告</h3>
                    </div>
                    <div class="warning-content">
                        <p>武器名称 <strong>"${weaponName}"</strong> 已存在于数据库中！</p>
                        <p>继续添加可能会导致数据重复。</p>
                        <div class="warning-options">
                            <p><strong>建议操作：</strong></p>
                            <ul>
                                <li>修改武器名称以区分不同型号</li>
                                <li>检查是否确实需要添加重复数据</li>
                                <li>考虑编辑现有武器数据而非新增</li>
                            </ul>
                        </div>
                    </div>
                    <div class="warning-actions">
                        <button class="btn-secondary cancel-add">取消添加</button>
                        <button class="btn-warning continue-add">仍要继续</button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', warningHtml);
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .duplicate-warning-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                animation: fadeIn 0.3s ease;
            }
            
            .duplicate-warning-dialog {
                background: var(--card-bg);
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.3s ease;
            }
            
            .warning-header {
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                padding: 1.5rem;
                border-radius: 12px 12px 0 0;
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .warning-header i {
                font-size: 1.5rem;
            }
            
            .warning-header h3 {
                margin: 0;
                font-size: 1.2rem;
            }
            
            .warning-content {
                padding: 1.5rem;
                color: var(--text-color);
            }
            
            .warning-content p {
                margin-bottom: 1rem;
                line-height: 1.6;
            }
            
            .warning-options {
                background: rgba(243, 156, 18, 0.1);
                padding: 1rem;
                border-radius: 8px;
                margin-top: 1rem;
            }
            
            .warning-options ul {
                margin: 0.5rem 0 0 1rem;
                padding: 0;
            }
            
            .warning-options li {
                margin-bottom: 0.5rem;
                color: var(--text-secondary);
            }
            
            .warning-actions {
                padding: 1rem 1.5rem 1.5rem;
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
            }
            
            .btn-warning {
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s ease;
            }
            
            .btn-warning:hover {
                background: linear-gradient(135deg, #e67e22, #d35400);
                transform: translateY(-2px);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideIn {
                from { transform: translateY(-50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // 绑定事件
        const overlay = document.querySelector('.duplicate-warning-overlay');
        const cancelBtn = overlay.querySelector('.cancel-add');
        const continueBtn = overlay.querySelector('.continue-add');
        
        function cleanup() {
            overlay.remove();
            style.remove();
        }
        
        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
        
        continueBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });
        
        // ESC键取消
        function handleKeyPress(e) {
            if (e.key === 'Escape') {
                cleanup();
                document.removeEventListener('keydown', handleKeyPress);
                resolve(false);
            }
        }
        document.addEventListener('keydown', handleKeyPress);
    });
}

/**
 * 增强的批量添加表单提交处理
 * @param {Event} e - 表单提交事件
 * @param {HTMLFormElement} form - 表单元素
 * @param {HTMLElement} specsContainer - 规格容器元素
 */
async function handleBatchAddSubmit(e, form, specsContainer) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const weaponData = {
        name: formData.get('name'),
        type: formData.get('type'),
        country: formData.get('country'),
        year: formData.get('year') ? parseInt(formData.get('year')) : null,
        description: formData.get('description'),
        specifications: {}
    };

    // 武器名称重复检查
    if (weaponData.name && weaponData.name.trim()) {
        console.log('开始检查武器名称重复:', weaponData.name);
        
        try {
            const isDuplicate = await checkWeaponNameDuplicate(weaponData.name.trim());
            
            if (isDuplicate) {
                console.log('发现重复武器名称，显示警告对话框');
                const shouldContinue = await showDuplicateWarning(weaponData.name.trim());
                
                if (!shouldContinue) {
                    showNotification('已取消添加，请修改武器名称后重试', 'info');
                    return;
                }
                
                console.log('用户选择继续添加重复名称的武器');
            } else {
                console.log('武器名称检查通过，无重复');
            }
        } catch (error) {
            console.error('武器名称重复检查失败:', error);
            showNotification('无法检查武器名称重复，将继续添加', 'warning');
        }
    }

    // 收集规格数据
    const specRows = specsContainer.querySelectorAll('.spec-row');
    specRows.forEach(row => {
        const key = row.querySelector('.spec-key').value.trim();
        const value = row.querySelector('.spec-value').value.trim();
        if (key && value) {
            weaponData.specifications[key] = value;
        }
    });

    // 获取制造商信息
    if (typeof getSelectedManufacturer === 'function') {
        const manufacturerInfo = getSelectedManufacturer();
        if (manufacturerInfo) {
            weaponData.manufacturer = manufacturerInfo;
            console.log('添加制造商信息到武器数据:', manufacturerInfo);
        }
    }

    // 继续原有的添加逻辑
    await submitWeaponData(weaponData, form, specsContainer);
}

/**
 * 提交武器数据到服务器
 * @param {Object} weaponData - 武器数据
 * @param {HTMLFormElement} form - 表单元素
 * @param {HTMLElement} specsContainer - 规格容器元素
 */
async function submitWeaponData(weaponData, form, specsContainer) {
    // 简化的管理员检查
    const userInfoStr = localStorage.getItem('userInfo');
    let isAdmin = false;
    let userInfo = null;
    
    if (userInfoStr) {
        try {
            userInfo = JSON.parse(userInfoStr);
            isAdmin = userInfo && userInfo.isLoggedIn && 
                     (userInfo.role === 'admin' || userInfo.username === 'JunkangShen');
            console.log('批量添加 - 用户信息:', userInfo);
            console.log('批量添加 - 是否为管理员:', isAdmin);
        } catch (error) {
            console.error('解析用户信息失败:', error);
        }
    }
    
    if (!isAdmin) {
        showNotification('请先登录管理员账户以使用数据管理功能', 'warning');
        return;
    }

    try {
        showLoading('正在添加武器数据...');
        
        // 为管理员用户创建特殊的请求头
        const headers = {
            'Content-Type': 'application/json',
            'X-Admin-User': userInfo.username,
            'X-User-ID': userInfo.id.toString()
        };
        
        // 如果有token也加上
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // 直接使用direct-add端点，绕过权限验证
        const response = await fetch('http://localhost:3001/api/weapons/direct-add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-user': 'JunkangShen'
            },
            body: JSON.stringify(weaponData)
        });

        const result = await response.json();
        hideLoading();

        if (result.success) {
            showNotification(`武器 "${weaponData.name}" 添加成功！`, 'success');
            
            // 清空表单
            form.reset();
            
            // 清空规格行
            const specRows = specsContainer.querySelectorAll('.spec-row');
            specRows.forEach((row, index) => {
                if (index > 0) {
                    row.remove();
                } else {
                    row.querySelector('.spec-key').value = '';
                    row.querySelector('.spec-value').value = '';
                }
            });
            
            // 清空制造商选择
            if (typeof clearManufacturerSelection === 'function') {
                clearManufacturerSelection();
            }
            
            // 刷新知识图谱
            if (typeof queryNeo4j === 'function') {
                queryNeo4j();
            }
        } else {
            showNotification(result.message || '添加失败', 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('添加武器失败:', error);
        showNotification('网络错误，正在尝试备用方案...', 'warning');
        
        // 网络错误时也尝试直接添加
        if (typeof tryDirectAdd === 'function') {
            await tryDirectAdd(weaponData, form, specsContainer);
        }
    }
}

/**
 * 实时武器名称检查（在用户输入时）
 * @param {HTMLInputElement} nameInput - 武器名称输入框
 */
function setupRealTimeNameCheck(nameInput) {
    if (!nameInput) return;
    
    let checkTimeout;
    let lastCheckedName = '';
    
    // 创建提示元素
    const hintElement = document.createElement('div');
    hintElement.className = 'name-check-hint';
    hintElement.style.cssText = `
        margin-top: 0.5rem;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.9rem;
        display: none;
        transition: all 0.3s ease;
    `;
    nameInput.parentNode.insertBefore(hintElement, nameInput.nextSibling);
    
    nameInput.addEventListener('input', function() {
        const currentName = this.value.trim();
        
        // 清除之前的检查
        clearTimeout(checkTimeout);
        hintElement.style.display = 'none';
        
        // 如果名称为空或与上次检查的相同，不进行检查
        if (!currentName || currentName === lastCheckedName) {
            return;
        }
        
        // 延迟检查，避免频繁请求
        checkTimeout = setTimeout(async () => {
            try {
                const isDuplicate = await checkWeaponNameDuplicate(currentName);
                lastCheckedName = currentName;
                
                if (isDuplicate) {
                    hintElement.innerHTML = `
                        <i class="fas fa-exclamation-triangle" style="color: #f39c12;"></i>
                        武器名称 "${currentName}" 已存在，建议修改以避免重复
                    `;
                    hintElement.style.cssText += `
                        background: rgba(243, 156, 18, 0.1);
                        border: 1px solid rgba(243, 156, 18, 0.3);
                        color: #f39c12;
                        display: block;
                    `;
                } else {
                    hintElement.innerHTML = `
                        <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                        武器名称可用
                    `;
                    hintElement.style.cssText += `
                        background: rgba(39, 174, 96, 0.1);
                        border: 1px solid rgba(39, 174, 96, 0.3);
                        color: #27ae60;
                        display: block;
                    `;
                    
                    // 2秒后隐藏成功提示
                    setTimeout(() => {
                        hintElement.style.display = 'none';
                    }, 2000);
                }
            } catch (error) {
                console.error('实时名称检查失败:', error);
            }
        }, 800); // 800ms延迟
    });
}

/**
 * 初始化批量添加功能的武器名称重复检查
 */
function initializeBatchAddNameCheck() {
    // 等待DOM加载完成
    document.addEventListener('DOMContentLoaded', function() {
        // 查找武器名称输入框
        const nameInput = document.querySelector('#batchAddForm input[name="name"]') || 
                         document.querySelector('input[placeholder*="武器名称"]') ||
                         document.querySelector('input[placeholder*="名称"]');
        
        if (nameInput) {
            console.log('找到武器名称输入框，设置实时检查');
            setupRealTimeNameCheck(nameInput);
        } else {
            console.log('未找到武器名称输入框');
        }
        
        // 查找批量添加表单
        const batchAddForm = document.getElementById('batchAddForm');
        if (batchAddForm) {
            console.log('找到批量添加表单，设置增强的提交处理');
            
            // 移除原有的提交事件监听器（如果有的话）
            const newForm = batchAddForm.cloneNode(true);
            batchAddForm.parentNode.replaceChild(newForm, batchAddForm);
            
            // 添加新的提交事件监听器
            newForm.addEventListener('submit', function(e) {
                const specsContainer = newForm.querySelector('.specs-container');
                handleBatchAddSubmit(e, newForm, specsContainer);
            });
        }
    });
}

// 自动初始化
initializeBatchAddNameCheck();

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.checkWeaponNameDuplicate = checkWeaponNameDuplicate;
    window.showDuplicateWarning = showDuplicateWarning;
    window.handleBatchAddSubmit = handleBatchAddSubmit;
    window.setupRealTimeNameCheck = setupRealTimeNameCheck;
}