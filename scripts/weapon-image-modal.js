// 武器图片模态框管理
class WeaponImageModal {
    constructor() {
        this.currentWeaponId = null;
        this.currentImages = [];
        this.isAdmin = false;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
        this.checkAdminStatus();
    }

    checkAdminStatus() {
        // 检查用户是否为管理员
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.isAdmin = user.role === 'admin' || user.username === 'JunkangShen';
    }

    createModal() {
        const modalHTML = `
            <div id="weaponImageModal" class="modal weapon-image-modal">
                <div class="modal-content weapon-image-content">
                    <div class="modal-header">
                        <h3 id="weaponImageTitle">武器图片</h3>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="image-upload-section" style="display: none;">
                            <h4>上传新图片</h4>
                            <div class="upload-area">
                                <input type="file" id="imageUpload" accept="image/*" multiple>
                                <label for="imageUpload" class="upload-label">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <span>点击选择图片或拖拽到此处</span>
                                </label>
                            </div>
                            <div class="upload-progress" style="display: none;">
                                <div class="progress-bar">
                                    <div class="progress-fill"></div>
                                </div>
                                <span class="progress-text">0%</span>
                            </div>
                        </div>
                        <div class="image-gallery">
                            <div class="gallery-header">
                                <h4>武器图片库</h4>
                                <div class="gallery-controls">
                                    <button id="uploadImageBtn" class="btn-primary" style="display: none;">
                                        <i class="fas fa-plus"></i> 上传图片
                                    </button>
                                    <button id="refreshImagesBtn" class="btn-secondary">
                                        <i class="fas fa-sync-alt"></i> 刷新
                                    </button>
                                </div>
                            </div>
                            <div id="imageList" class="image-list">
                                <div class="loading">正在加载图片...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    bindEvents() {
        const modal = document.getElementById('weaponImageModal');
        const closeBtn = modal.querySelector('.close');
        const uploadBtn = document.getElementById('uploadImageBtn');
        const refreshBtn = document.getElementById('refreshImagesBtn');
        const fileInput = document.getElementById('imageUpload');

        // 关闭模态框
        closeBtn.addEventListener('click', () => this.hide());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hide();
        });

        // 上传按钮
        uploadBtn.addEventListener('click', () => {
            document.querySelector('.image-upload-section').style.display = 'block';
        });

        // 刷新按钮
        refreshBtn.addEventListener('click', () => this.loadImages());

        // 文件选择
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // 拖拽上传
        const uploadArea = modal.querySelector('.upload-area');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            this.uploadFiles(files);
        });
    }

    async show(weaponId, weaponName) {
        this.currentWeaponId = weaponId;
        
        const modal = document.getElementById('weaponImageModal');
        const title = document.getElementById('weaponImageTitle');
        const uploadBtn = document.getElementById('uploadImageBtn');
        const uploadSection = document.querySelector('.image-upload-section');

        title.textContent = `${weaponName} - 图片管理`;
        
        // 根据管理员权限显示/隐藏上传功能
        if (this.isAdmin) {
            uploadBtn.style.display = 'inline-block';
        } else {
            uploadSection.style.display = 'none';
        }

        modal.style.display = 'block';
        await this.loadImages();
    }

    hide() {
        const modal = document.getElementById('weaponImageModal');
        modal.style.display = 'none';
        document.querySelector('.image-upload-section').style.display = 'none';
    }

    async loadImages() {
        const imageList = document.getElementById('imageList');
        imageList.innerHTML = '<div class="loading">正在加载图片...</div>';

        try {
            // 确保weaponId是数字格式，去掉可能的前缀
            let weaponId = this.currentWeaponId;
            console.log('原始武器ID:', weaponId, '类型:', typeof weaponId);
            
            if (typeof weaponId === 'string') {
                // 处理各种可能的ID格式
                if (weaponId.startsWith('weapon_')) {
                    weaponId = weaponId.replace('weapon_', '');
                } else if (weaponId.includes('_')) {
                    // 如果包含下划线，取最后一部分
                    const parts = weaponId.split('_');
                    weaponId = parts[parts.length - 1];
                }
            }
            
            // 确保是数字
            weaponId = parseInt(weaponId);
            if (isNaN(weaponId)) {
                throw new Error('无效的武器ID格式');
            }
            
            console.log('处理后的武器ID:', weaponId);
            const apiUrl = `http://localhost:3001/api/herb-images/${weaponId}`;
            console.log('请求URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            console.log('响应状态:', response.status, response.statusText);
            
            if (!response.ok) {
                // 尝试读取响应内容以获取更多错误信息
                let responseText = '';
                try {
                    responseText = await response.text();
                    console.log('错误响应内容:', responseText);
                } catch (e) {
                    console.log('无法读取错误响应内容');
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('API响应结果:', result);

            if (result.success) {
                this.currentImages = result.data.images || [];
                console.log('成功加载图片数据:', this.currentImages);
                this.renderImages();
            } else {
                console.error('API返回失败:', result.message);
                imageList.innerHTML = `<div class="error">加载图片失败: ${result.message}</div>`;
            }
        } catch (error) {
            console.error('加载图片失败:', error);
            
            // 提供更详细的错误信息和解决建议
            let errorMessage = `
                <div class="error">
                    <h4>图片加载失败</h4>
                    <p><strong>错误信息：</strong>${error.message}</p>
                    <p><strong>武器ID：</strong>${this.currentWeaponId}</p>
                    <p><strong>可能原因：</strong></p>
                    <ul>
                        <li>后端服务器未启动 (请确保 http://localhost:3001 可访问)</li>
                        <li>数据库连接问题</li>
                        <li>武器数据不存在</li>
                    </ul>
                    <button onclick="this.parentElement.parentElement.querySelector('.loading').style.display='block'; window.weaponImageModal.loadImages();" 
                            style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        重试加载
                    </button>
                </div>
            `;
            imageList.innerHTML = errorMessage;
        }
    }

    renderImages() {
        const imageList = document.getElementById('imageList');
        
        if (this.currentImages.length === 0) {
            imageList.innerHTML = '<div class="no-images">暂无图片</div>';
            return;
        }

        const imagesHTML = this.currentImages.map(image => `
            <div class="image-item" data-image-id="${image.id}">
                <div class="image-container">
                    <img src="${image.path}" alt="${image.description || '武器图片'}" 
                         onerror="this.src='/images/placeholder.png'">
                    <div class="image-overlay">
                        <button class="image-action-btn view-btn" title="查看大图">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${this.isAdmin ? `
                            <button class="image-action-btn edit-btn" title="编辑描述">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="image-action-btn delete-btn" title="删除图片">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="image-info">
                    <div class="image-description">${image.description || '无描述'}</div>
                    <div class="image-meta">
                        <span class="image-size">${this.formatFileSize(image.size)}</span>
                        <span class="image-date">${this.formatDate(image.uploadedAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');

        imageList.innerHTML = imagesHTML;
        this.bindImageEvents();
    }

    bindImageEvents() {
        const imageList = document.getElementById('imageList');

        // 查看大图
        imageList.addEventListener('click', (e) => {
            if (e.target.closest('.view-btn')) {
                const imageItem = e.target.closest('.image-item');
                const imageId = parseInt(imageItem.dataset.imageId);
                const image = this.currentImages.find(img => img.id === imageId);
                if (image) {
                    this.showImageViewer(image);
                }
            }
        });

        // 编辑描述
        if (this.isAdmin) {
            imageList.addEventListener('click', (e) => {
                if (e.target.closest('.edit-btn')) {
                    const imageItem = e.target.closest('.image-item');
                    const imageId = parseInt(imageItem.dataset.imageId);
                    const image = this.currentImages.find(img => img.id === imageId);
                    if (image) {
                        this.editImageDescription(image);
                    }
                }
            });

            // 删除图片
            imageList.addEventListener('click', (e) => {
                if (e.target.closest('.delete-btn')) {
                    const imageItem = e.target.closest('.image-item');
                    const imageId = parseInt(imageItem.dataset.imageId);
                    const image = this.currentImages.find(img => img.id === imageId);
                    if (image) {
                        this.deleteImage(image);
                    }
                }
            });
        }
    }

    async handleFileUpload(event) {
        const files = event.target.files;
        if (files.length > 0) {
            await this.uploadFiles(files);
        }
    }

    async uploadFiles(files) {
        const progressSection = document.querySelector('.upload-progress');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');

        progressSection.style.display = 'block';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('image', file);

            try {
                // 确保weaponId是数字格式
                let weaponId = this.currentWeaponId;
                if (typeof weaponId === 'string' && weaponId.startsWith('weapon_')) {
                    weaponId = weaponId.replace('weapon_', '');
                }

                const response = await fetch(`/api/herb-images/${weaponId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-admin-user': 'JunkangShen'
                    },
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    const progress = ((i + 1) / files.length) * 100;
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `${Math.round(progress)}%`;
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('上传失败:', error);
                alert(`上传 ${file.name} 失败: ${error.message}`);
            }
        }

        // 上传完成后刷新图片列表
        setTimeout(() => {
            progressSection.style.display = 'none';
            document.querySelector('.image-upload-section').style.display = 'none';
            document.getElementById('imageUpload').value = '';
            this.loadImages();
        }, 1000);
    }

    showImageViewer(image) {
        const viewerHTML = `
            <div id="imageViewer" class="image-viewer">
                <div class="viewer-content">
                    <div class="viewer-header">
                        <h4>${image.description || '武器图片'}</h4>
                        <button class="close-viewer">&times;</button>
                    </div>
                    <div class="viewer-body">
                        <img src="${image.path}" alt="${image.description || '武器图片'}">
                    </div>
                    <div class="viewer-footer">
                        <div class="image-details">
                            <span>文件名: ${image.originalName}</span>
                            <span>大小: ${this.formatFileSize(image.size)}</span>
                            <span>上传时间: ${this.formatDate(image.uploadedAt)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', viewerHTML);

        const viewer = document.getElementById('imageViewer');
        const closeBtn = viewer.querySelector('.close-viewer');

        closeBtn.addEventListener('click', () => {
            viewer.remove();
        });

        viewer.addEventListener('click', (e) => {
            if (e.target === viewer) {
                viewer.remove();
            }
        });
    }

    async editImageDescription(image) {
        const newDescription = prompt('请输入新的图片描述:', image.description || '');
        
        if (newDescription !== null) {
            try {
                // 确保weaponId是数字格式
                let weaponId = this.currentWeaponId;
                if (typeof weaponId === 'string' && weaponId.startsWith('weapon_')) {
                    weaponId = weaponId.replace('weapon_', '');
                }

                const response = await fetch(`/api/herb-images/${weaponId}/${image.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-admin-user': 'JunkangShen'
                    },
                    body: JSON.stringify({ description: newDescription })
                });

                const result = await response.json();
                
                if (result.success) {
                    alert('图片描述更新成功');
                    this.loadImages();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('更新描述失败:', error);
                alert('更新描述失败: ' + error.message);
            }
        }
    }

    async deleteImage(image) {
        if (confirm(`确定要删除图片 "${image.description || image.originalName}" 吗？`)) {
            try {
                // 确保weaponId是数字格式
                let weaponId = this.currentWeaponId;
                if (typeof weaponId === 'string' && weaponId.startsWith('weapon_')) {
                    weaponId = weaponId.replace('weapon_', '');
                }

                const response = await fetch(`/api/herb-images/${weaponId}/${image.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-admin-user': 'JunkangShen'
                    }
                });

                const result = await response.json();
                
                if (result.success) {
                    alert('图片删除成功');
                    this.loadImages();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                console.error('删除图片失败:', error);
                alert('删除图片失败: ' + error.message);
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN');
    }
}

// 全局实例
window.weaponImageModal = new WeaponImageModal();