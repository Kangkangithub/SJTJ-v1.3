// === 制造商选择功能模块 ===
function initializeManufacturerSelection() {
    // 初始化制造商选择器
    const manufacturerSelect = document.getElementById('weaponManufacturer');
    const customManufacturerInput = document.getElementById('customManufacturer');
    const manufacturerDetailsGroup = document.getElementById('manufacturerDetailsGroup');
    const manufacturerFoundedGroup = document.getElementById('manufacturerFoundedGroup');
    
    if (manufacturerSelect) {
        // 加载现有制造商
        loadManufacturers();
        
        // 监听选择变化
        manufacturerSelect.addEventListener('change', function() {
            const isCustomManufacturer = this.value === 'custom';
            
            // 显示/隐藏自定义制造商输入框
            if (customManufacturerInput) {
                customManufacturerInput.style.display = isCustomManufacturer ? 'block' : 'none';
            }
            
            // 显示/隐藏制造商详细信息组
            if (manufacturerDetailsGroup) {
                manufacturerDetailsGroup.style.display = isCustomManufacturer ? 'block' : 'none';
            }
            
            if (manufacturerFoundedGroup) {
                manufacturerFoundedGroup.style.display = isCustomManufacturer ? 'block' : 'none';
            }
        });
    }
}

// 加载制造商列表
async function loadManufacturers() {
    try {
        const response = await fetch('http://localhost:3001/api/manufacturers');
        const result = await response.json();
        
        if (result.success) {
            const manufacturerSelect = document.getElementById('weaponManufacturer');
            
            // 清空现有选项（保留默认选项和自定义选项）
            const defaultOptions = Array.from(manufacturerSelect.querySelectorAll('option[value=""], option[value="custom"]'));
            manufacturerSelect.innerHTML = '';
            defaultOptions.forEach(option => manufacturerSelect.appendChild(option));
            
            // 添加制造商选项
            result.data.forEach(manufacturer => {
                const option = document.createElement('option');
                option.value = manufacturer.id;
                option.textContent = `${manufacturer.name} (${manufacturer.country || '未知'})`;
                option.dataset.manufacturerData = JSON.stringify(manufacturer);
                manufacturerSelect.appendChild(option);
            });
            
            console.log('制造商列表加载成功，共', result.data.length, '个制造商');
        } else {
            console.error('加载制造商列表失败:', result.message);
        }
    } catch (error) {
        console.error('加载制造商列表失败:', error);
        if (typeof showNotification === 'function') {
            showNotification('加载制造商列表失败', 'error');
        }
    }
}

// 获取选中的制造商信息
function getSelectedManufacturer() {
    const manufacturerSelect = document.getElementById('weaponManufacturer');
    const selectedValue = manufacturerSelect.value;
    
    if (!selectedValue) {
        return null;
    }
    
    if (selectedValue === 'custom') {
        // 新制造商
        const name = document.getElementById('customManufacturer').value.trim();
        const country = document.getElementById('manufacturerCountry').value.trim();
        const founded = document.getElementById('manufacturerFounded').value;
        const description = document.getElementById('manufacturerDescription').value.trim();
        
        if (!name) {
            if (typeof showNotification === 'function') {
                showNotification('请输入制造商名称', 'warning');
            }
            return false;
        }
        
        return {
            isNew: true,
            name: name,
            country: country || null,
            founded: founded ? parseInt(founded) : null,
            description: description || null
        };
    } else {
        // 现有制造商
        const selectedOption = manufacturerSelect.querySelector(`option[value="${selectedValue}"]`);
        if (selectedOption && selectedOption.dataset.manufacturerData) {
            const manufacturerData = JSON.parse(selectedOption.dataset.manufacturerData);
            return {
                isNew: false,
                id: manufacturerData.id,
                name: manufacturerData.name,
                country: manufacturerData.country,
                founded: manufacturerData.founded,
                description: manufacturerData.description
            };
        }
    }
    
    return null;
}

// 清空制造商选择
function clearManufacturerSelection() {
    const manufacturerSelect = document.getElementById('weaponManufacturer');
    const customManufacturerInput = document.getElementById('customManufacturer');
    const manufacturerDetailsGroup = document.getElementById('manufacturerDetailsGroup');
    const manufacturerFoundedGroup = document.getElementById('manufacturerFoundedGroup');
    
    if (manufacturerSelect) {
        manufacturerSelect.value = '';
    }
    
    if (customManufacturerInput) {
        customManufacturerInput.style.display = 'none';
        customManufacturerInput.value = '';
    }
    
    if (manufacturerDetailsGroup) {
        manufacturerDetailsGroup.style.display = 'none';
    }
    
    if (manufacturerFoundedGroup) {
        manufacturerFoundedGroup.style.display = 'none';
    }
    
    // 清空制造商详细信息表单
    const countryInput = document.getElementById('manufacturerCountry');
    const foundedInput = document.getElementById('manufacturerFounded');
    const descriptionInput = document.getElementById('manufacturerDescription');
    
    if (countryInput) countryInput.value = '';
    if (foundedInput) foundedInput.value = '';
    if (descriptionInput) descriptionInput.value = '';
}

// 创建制造商
async function createManufacturer(manufacturerData) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'x-admin-user': 'JunkangShen'
        };

        const response = await fetch('/api/manufacturers', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(manufacturerData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            console.log('制造商创建成功:', manufacturerData.name);
            return { success: true, data: result.data };
        } else {
            console.error('制造商创建失败:', result.message);
            return { success: false, message: result.message };
        }
    } catch (error) {
        console.error('创建制造商时发生错误:', error);
        return { success: false, message: '网络错误' };
    }
}

// === 制造商管理功能模块结束 ===