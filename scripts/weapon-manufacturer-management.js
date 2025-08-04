// 武器制造商管理功能
class WeaponManufacturerManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadManufacturers();
    }

    bindEvents() {
        // 添加制造商按钮事件
        const addManufacturerBtn = document.getElementById('add-manufacturer-btn');
        if (addManufacturerBtn) {
            addManufacturerBtn.addEventListener('click', () => this.showAddManufacturerModal());
        }

        // 制造商模态框事件
        const manufacturerModal = document.getElementById('manufacturer-modal');
        if (manufacturerModal) {
            // 保存按钮
            const saveBtn = manufacturerModal.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveManufacturer());
            }

            // 取消按钮
            const cancelBtn = manufacturerModal.querySelector('.cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.hideManufacturerModal());
            }

            // 点击背景关闭
            manufacturerModal.addEventListener('click', (e) => {
                if (e.target === manufacturerModal) {
                    this.hideManufacturerModal();
                }
            });
        }
    }

    // 内联添加制造商功能
    async addManufacturerInline() {
        const input = document.getElementById('new-manufacturer-input');
        if (!input) return;

        const manufacturerName = input.value.trim();
        if (!manufacturerName) {
            this.showMessage('请输入制造商名称', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/manufacturers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: manufacturerName,
                    country: '',
                    founded: null,
                    description: ''
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                input.value = '';
                this.loadManufacturers();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('添加制造商错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    async loadManufacturers() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/manufacturers`);
            const result = await response.json();

            if (result.success) {
                this.displayManufacturers(result.data);
                this.updateManufacturerSelect(result.data);
            } else {
                console.error('加载制造商失败:', result.message);
                this.showMessage('加载制造商失败', 'error');
            }
        } catch (error) {
            console.error('加载制造商错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    displayManufacturers(manufacturers) {
        const container = document.getElementById('manufacturers-list');
        if (!container) return;

        // 添加制造商管理的特殊CSS类
        container.className = 'manufacturer-management';

        if (manufacturers.length === 0) {
            container.innerHTML = `
                <div class="management-section">
                    <h4><i class="fas fa-industry"></i> 制造商管理</h4>
                    <div class="add-item-form">
                        <input type="text" id="new-manufacturer-input" placeholder="输入新的制造商名称">
                        <button id="add-manufacturer-btn-inline" onclick="weaponManufacturerManager.addManufacturerInline()">
                            <i class="fas fa-plus"></i> 添加制造商
                        </button>
                    </div>
                    <div class="items-list">
                        <div class="empty-list">暂无制造商数据</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="management-section">
                <h4><i class="fas fa-industry"></i> 制造商管理</h4>
                <div class="add-item-form">
                    <input type="text" id="new-manufacturer-input" placeholder="输入新的制造商名称">
                    <button id="add-manufacturer-btn-inline" onclick="weaponManufacturerManager.addManufacturerInline()">
                        <i class="fas fa-plus"></i> 添加制造商
                    </button>
                </div>
                <div class="items-list">
                    ${manufacturers.map(manufacturer => `
                        <div class="item-row" data-id="${manufacturer.id}">
                            <div class="item-name">
                                ${manufacturer.name}
                                <div style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin-top: 0.25rem;">
                                    ${manufacturer.country ? `${manufacturer.country}` : ''}
                                    ${manufacturer.founded ? ` • ${manufacturer.founded}年` : ''}
                                </div>
                            </div>
                            <div class="item-actions">
                                <button class="edit-item-btn" onclick="weaponManufacturerManager.editManufacturer('${manufacturer.id}', '${manufacturer.name}', '${manufacturer.country || ''}', '${manufacturer.founded || ''}', '${manufacturer.description || ''}')">
                                    <i class="fas fa-edit"></i> 编辑
                                </button>
                                <button class="delete-item-btn" onclick="weaponManufacturerManager.deleteManufacturer('${manufacturer.id}', '${manufacturer.name}')">
                                    <i class="fas fa-trash"></i> 删除
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateManufacturerSelect(manufacturers) {
        // 更新武器添加表单中的制造商选择器
        const manufacturerSelects = document.querySelectorAll('select[name="manufacturer"], #weaponManufacturer');
        manufacturerSelects.forEach(select => {
            if (select) {
                const currentValue = select.value;
                // 保留默认选项和自定义选项
                const defaultOptions = '<option value="">请选择制造商</option><option value="custom">+ 添加新制造商</option>';
                const manufacturerOptions = manufacturers.map(manufacturer => 
                    `<option value="${manufacturer.id}">${manufacturer.name} (${manufacturer.country || '未知'})</option>`
                ).join('');
                
                select.innerHTML = defaultOptions + manufacturerOptions;
                
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        });
    }

    showAddManufacturerModal() {
        const modal = document.getElementById('manufacturer-modal');
        const form = document.getElementById('manufacturer-form');
        
        if (modal && form) {
            // 重置表单
            form.reset();
            form.removeAttribute('data-edit-id');
            
            // 更新标题
            const title = modal.querySelector('.modal-title');
            if (title) title.textContent = '添加制造商';
            
            modal.style.display = 'flex';
        }
    }

    editManufacturer(id, name, country, founded, description) {
        const modal = document.getElementById('manufacturer-modal');
        const form = document.getElementById('manufacturer-form');
        
        if (modal && form) {
            // 填充表单数据
            form.querySelector('#manufacturer-name').value = name;
            form.querySelector('#manufacturer-country').value = country;
            form.querySelector('#manufacturer-founded').value = founded;
            form.querySelector('#manufacturer-description').value = description;
            form.setAttribute('data-edit-id', id);
            
            // 更新标题
            const title = modal.querySelector('.modal-title');
            if (title) title.textContent = '编辑制造商';
            
            modal.style.display = 'flex';
        }
    }

    hideManufacturerModal() {
        const modal = document.getElementById('manufacturer-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async saveManufacturer() {
        const form = document.getElementById('manufacturer-form');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            name: formData.get('name').trim(),
            country: formData.get('country').trim(),
            founded: formData.get('founded') ? parseInt(formData.get('founded')) : null,
            description: formData.get('description').trim()
        };

        // 验证数据
        if (!data.name) {
            this.showMessage('请输入制造商名称', 'error');
            return;
        }

        // 验证成立年份
        if (data.founded && (data.founded < 1500 || data.founded > 2030)) {
            this.showMessage('成立年份应在1500-2030之间', 'error');
            return;
        }

        const editId = form.getAttribute('data-edit-id');
        const isEdit = !!editId;

        try {
            const url = isEdit 
                ? `${this.apiBaseUrl}/manufacturers/${editId}`
                : `${this.apiBaseUrl}/manufacturers`;
            
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-user': 'JunkangShen'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                this.hideManufacturerModal();
                this.loadManufacturers();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('保存制造商错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    async deleteManufacturer(id, name) {
        if (!confirm(`确定要删除制造商"${name}"吗？\n注意：如果有武器关联到此制造商，将无法删除。`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/manufacturers/${id}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-user': 'JunkangShen'
                }
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                this.loadManufacturers();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('删除制造商错误:', error);
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
let weaponManufacturerManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    weaponManufacturerManager = new WeaponManufacturerManager();
});