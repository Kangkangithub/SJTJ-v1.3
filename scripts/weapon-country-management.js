// 武器国家管理功能
class WeaponCountryManager {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadWeaponCountries();
    }

    bindEvents() {
        // 添加国家按钮事件
        const addCountryBtn = document.getElementById('add-weapon-country-btn');
        if (addCountryBtn) {
            addCountryBtn.addEventListener('click', () => this.showAddCountryModal());
        }

        // 国家模态框事件
        const countryModal = document.getElementById('weapon-country-modal');
        if (countryModal) {
            // 保存按钮
            const saveBtn = countryModal.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => this.saveWeaponCountry());
            }

            // 取消按钮
            const cancelBtn = countryModal.querySelector('.cancel-btn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.hideCountryModal());
            }

            // 点击背景关闭
            countryModal.addEventListener('click', (e) => {
                if (e.target === countryModal) {
                    this.hideCountryModal();
                }
            });
        }
    }

    // 内联添加国家功能
    async addCountryInline() {
        const input = document.getElementById('new-country-input');
        if (!input) return;

        const countryName = input.value.trim();
        if (!countryName) {
            this.showMessage('请输入国家名称', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/weapon-countries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: countryName,
                    code: ''
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                input.value = '';
                this.loadWeaponCountries();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('添加国家错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    async loadWeaponCountries() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/weapon-countries`);
            const result = await response.json();

            if (result.success) {
                this.displayWeaponCountries(result.data);
                this.updateCountrySelect(result.data);
            } else {
                console.error('加载国家失败:', result.message);
                this.showMessage('加载国家失败', 'error');
            }
        } catch (error) {
            console.error('加载国家错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    displayWeaponCountries(countries) {
        const container = document.getElementById('weapon-countries-list');
        if (!container) return;

        // 添加国家管理的特殊CSS类
        container.className = 'country-management';

        if (countries.length === 0) {
            container.innerHTML = `
                <div class="management-section">
                    <h4><i class="fas fa-globe"></i> 国家管理</h4>
                    <div class="add-item-form">
                        <input type="text" id="new-country-input" placeholder="输入新的国家名称">
                        <button id="add-country-btn-inline" onclick="weaponCountryManager.addCountryInline()">
                            <i class="fas fa-plus"></i> 添加国家
                        </button>
                    </div>
                    <div class="items-list">
                        <div class="empty-list">暂无国家数据</div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="management-section">
                <h4><i class="fas fa-globe"></i> 国家管理</h4>
                <div class="add-item-form">
                    <input type="text" id="new-country-input" placeholder="输入新的国家名称">
                    <button id="add-country-btn-inline" onclick="weaponCountryManager.addCountryInline()">
                        <i class="fas fa-plus"></i> 添加国家
                    </button>
                </div>
                <div class="items-list">
                    ${countries.map(country => `
                        <div class="item-row" data-id="${country.id}">
                            <div class="item-name">${country.name} ${country.code ? `(${country.code})` : ''}</div>
                            <div class="item-actions">
                                <button class="edit-item-btn" onclick="weaponCountryManager.editWeaponCountry('${country.id}', '${country.name}', '${country.code || ''}')">
                                    <i class="fas fa-edit"></i> 编辑
                                </button>
                                <button class="delete-item-btn" onclick="weaponCountryManager.deleteWeaponCountry('${country.id}', '${country.name}')">
                                    <i class="fas fa-trash"></i> 删除
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    updateCountrySelect(countries) {
        // 更新武器添加表单中的国家选择器
        const countrySelects = document.querySelectorAll('select[name="country"], #weapon-country-select');
        countrySelects.forEach(select => {
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">请选择国家</option>' +
                    countries.map(country => `<option value="${country.name}">${country.name}</option>`).join('');
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        });
    }

    showAddCountryModal() {
        const modal = document.getElementById('weapon-country-modal');
        const form = document.getElementById('weapon-country-form');
        
        if (modal && form) {
            // 重置表单
            form.reset();
            form.removeAttribute('data-edit-id');
            
            // 更新标题
            const title = modal.querySelector('.modal-title');
            if (title) title.textContent = '添加国家';
            
            modal.style.display = 'flex';
        }
    }

    editWeaponCountry(id, name, code) {
        const modal = document.getElementById('weapon-country-modal');
        const form = document.getElementById('weapon-country-form');
        
        if (modal && form) {
            // 填充表单数据
            form.querySelector('#country-name').value = name;
            form.querySelector('#country-code').value = code;
            form.setAttribute('data-edit-id', id);
            
            // 更新标题
            const title = modal.querySelector('.modal-title');
            if (title) title.textContent = '编辑国家';
            
            modal.style.display = 'flex';
        }
    }

    hideCountryModal() {
        const modal = document.getElementById('weapon-country-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async saveWeaponCountry() {
        const form = document.getElementById('weapon-country-form');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            name: formData.get('name').trim(),
            code: formData.get('code').trim()
        };

        // 验证数据
        if (!data.name) {
            this.showMessage('请输入国家名称', 'error');
            return;
        }

        const editId = form.getAttribute('data-edit-id');
        const isEdit = !!editId;

        try {
            const url = isEdit 
                ? `${this.apiBaseUrl}/weapon-countries/${editId}`
                : `${this.apiBaseUrl}/weapon-countries`;
            
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
                this.hideCountryModal();
                this.loadWeaponCountries();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('保存国家错误:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        }
    }

    async deleteWeaponCountry(id, name) {
        if (!confirm(`确定要删除国家"${name}"吗？\n注意：如果有武器关联到此国家，将无法删除。`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/weapon-countries/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage(result.message, 'success');
                this.loadWeaponCountries();
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('删除国家错误:', error);
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
let weaponCountryManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    weaponCountryManager = new WeaponCountryManager();
});