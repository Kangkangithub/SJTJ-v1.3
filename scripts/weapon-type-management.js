// 武器类型管理功能
class WeaponTypeManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadWeaponTypes();
    }

    bindEvents() {
        // 添加武器类型按钮事件
        const addTypeBtn = document.getElementById('add-weapon-type-btn');
        if (addTypeBtn) {
            addTypeBtn.addEventListener('click', () => this.showAddTypeModal());
        }

        // 武器类型模态框事件
        const typeModal = document.getElementById('weapon-type-modal');
        if (typeModal) {
            // 保存按钮
            const saveBtn = typeModal.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveWeaponType());
            }

            // 取消按钮
            const cancelBtn = typeModal.querySelector('.cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.hideTypeModal());
            }

            // 点击背景关闭
            typeModal.addEventListener('click', (e) => {
                if (e.target === typeModal) {
                    this.hideTypeModal();
                }
            });
        }
    }

    // 内联添加类型功能
    async addTypeInline() {
        const input = document.getElementById('new-type-input');
        if (!input) return;

        const typeName = input.value.trim();
        if (!typeName) {
            this.showMessage('请输入武器类型名称', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/weapon-types`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: typeName,
                    description: ''
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                input.value = '';
                this.loadWeaponTypes();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('添加武器类型错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    async loadWeaponTypes() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/weapon-types`);
            const result = await response.json();

            if (result.success) {
                this.displayWeaponTypes(result.data);
                this.updateTypeSelect(result.data);
            } else {
                console.error('加载武器类型失败:', result.message);
                this.showMessage('加载武器类型失败', 'error');
            }
        } catch (error) {
            console.error('加载武器类型错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    displayWeaponTypes(types) {
        const container = document.getElementById('weapon-types-list');
        if (!container) return;

        // 添加类型管理的特殊CSS类
        container.className = 'type-management';

        if (types.length === 0) {
            container.innerHTML = `
                <div class="management-section">
                    <h4><i class="fas fa-tags"></i> 武器类型管理</h4>
                    <div class="add-item-form">
                        <input type="text" id="new-type-input" placeholder="输入新的武器类型名称">
                        <button id="add-type-btn-inline" onclick="weaponTypeManager.addTypeInline()">
                            <i class="fas fa-plus"></i> 添加类型
                        </button>
                    </div>
                    <div class="items-list">
                        <div class="empty-list">暂无武器类型数据</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="management-section">
                <h4><i class="fas fa-tags"></i> 武器类型管理</h4>
                <div class="add-item-form">
                    <input type="text" id="new-type-input" placeholder="输入新的武器类型名称">
                    <button id="add-type-btn-inline" onclick="weaponTypeManager.addTypeInline()">
                        <i class="fas fa-plus"></i> 添加类型
                    </button>
                </div>
                <div class="items-list">
                    ${types.map(type => `
                        <div class="item-row" data-id="${type.id}">
                            <div class="item-name">${type.name}</div>
                            <div class="item-actions">
                                <button class="edit-item-btn" onclick="weaponTypeManager.editWeaponType('${type.id}', '${type.name}', '${type.description || ''}')">
                                    <i class="fas fa-edit"></i> 编辑
                                </button>
                                <button class="delete-item-btn" onclick="weaponTypeManager.deleteWeaponType('${type.id}', '${type.name}')">
                                    <i class="fas fa-trash"></i> 删除
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateTypeSelect(types) {
        // 更新武器添加表单中的类型选择器
        const typeSelects = document.querySelectorAll('select[name="type"], #weapon-type-select');
        typeSelects.forEach(select => {
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">请选择武器类型</option>' +
                    types.map(type => `<option value="${type.name}">${type.name}</option>`).join('');
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        });
    }

    showAddTypeModal() {
        const modal = document.getElementById('weapon-type-modal');
        const form = document.getElementById('weapon-type-form');
        
        if (modal && form) {
            // 重置表单
            form.reset();
            form.removeAttribute('data-edit-id');
            
            // 更新标题
            const title = modal.querySelector('.modal-title');
            if (title) title.textContent = '添加武器类型';
            
            modal.style.display = 'flex';
        }
    }

    editWeaponType(id, name, description) {
        const modal = document.getElementById('weapon-type-modal');
        const form = document.getElementById('weapon-type-form');
        
        if (modal && form) {
            // 填充表单数据
            form.querySelector('#type-name').value = name;
            form.querySelector('#type-description').value = description;
            form.setAttribute('data-edit-id', id);
            
            // 更新标题
            const title = modal.querySelector('.modal-title');
            if (title) title.textContent = '编辑武器类型';
            
            modal.style.display = 'flex';
        }
    }

    hideTypeModal() {
        const modal = document.getElementById('weapon-type-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async saveWeaponType() {
        const form = document.getElementById('weapon-type-form');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            name: formData.get('name').trim(),
            description: formData.get('description').trim()
        };

        // 验证数据
        if (!data.name) {
            this.showMessage('请输入武器类型名称', 'error');
            return;
        }

        const editId = form.getAttribute('data-edit-id');
        const isEdit = !!editId;

        try {
            const url = isEdit 
                ? `${this.apiBaseUrl}/weapon-types/${editId}`
                : `${this.apiBaseUrl}/weapon-types`;
            
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                this.hideTypeModal();
                this.loadWeaponTypes();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('保存武器类型错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    async deleteWeaponType(id, name) {
        if (!confirm(`确定要删除武器类型"${name}"吗？\n注意：如果有武器关联到此类型，将无法删除。`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/weapon-types/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                this.loadWeaponTypes();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('删除武器类型错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    showMessage(message, type = 'info') {
        // 创建消息提示
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;

        // 设置背景色
        switch (type) {
            case 'success':
                messageDiv.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                messageDiv.style.backgroundColor = '#f44336';
                break;
            case 'warning':
                messageDiv.style.backgroundColor = '#ff9800';
                break;
            default:
                messageDiv.style.backgroundColor = '#2196F3';
        }

        document.body.appendChild(messageDiv);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    messageDiv.remove();
                }, 300);
            }
        }, 3000);
    }
}

// 全局实例
let weaponTypeManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    weaponTypeManager = new WeaponTypeManager();
});