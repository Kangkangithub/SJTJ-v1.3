// 武器图片管理集成脚本
class WeaponImageManager {
    constructor() {
        this.currentWeaponId = null;
        this.currentWeaponName = null;
        this.isUploading = false;
        this.cachedImages = []; // 添加缓存
        this.init();
    }

    init() {
        this.bindEvents();
        console.log('✅ 武器图片管理器初始化完成');
    }

    // 创建图片管理面板
    createImageManagementPanel() {
        const panel = document.createElement('div');
        panel.id = 'weaponImageSection';
        panel.className = 'weapon-image-management-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 1200px;
            max-height: 85vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            display: none;
            overflow: hidden;
        `;
        
        panel.innerHTML = `
            <div class="weapon-image-panel-header" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 class="weapon-image-panel-title" style="margin: 0; font-size: 20px;">
                    <i class="fas fa-images"></i> 武器图片管理
                </h3>
                <button class="weapon-image-panel-close" onclick="weaponImageManager.hideWeaponImageSection()" style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="weapon-image-panel-body" style="
                padding: 20px;
                max-height: calc(85vh - 80px);
                overflow-y: auto;
            ">
                <div id="imageMessage" class="image-message" style="display: none;"></div>
                
                <div id="imageUploadArea" style="display: none; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">
                        <i class="fas fa-cloud-upload-alt"></i> 上传新图片
                    </h4>
                    <div class="file-input-wrapper" onclick="document.getElementById('weaponImageFile').click()" style="
                        border: 2px dashed #ddd;
                        border-radius: 8px;
                        padding: 30px;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.3s;
                        background: white;
                        margin-bottom: 15px;
                    ">
                        <div class="file-input-content">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #667eea; margin-bottom: 10px;"></i>
                            <div style="color: #333; font-size: 16px; margin-bottom: 5px;">点击选择图片文件</div>
                            <small style="color: #666;">支持 JPG, PNG, GIF, WebP 格式，最大 5MB</small>
                        </div>
                    </div>
                    <input type="file" id="weaponImageFile" accept="image/*" style="display: none;">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #333;">图片描述：</label>
                        <textarea id="weaponImageDescription" rows="3" placeholder="请输入图片描述..."
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                    </div>
                    <div class="upload-actions" style="display: flex; gap: 10px;">
                        <button id="confirmUploadBtn" class="btn-primary" style="
                            flex: 1;
                            padding: 10px;
                            background: #667eea;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                            <i class="fas fa-check"></i> 确认上传
                        </button>
                        <button id="cancelUploadBtn" class="btn-secondary" style="
                            flex: 1;
                            padding: 10px;
                            background: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    </div>
                </div>
                
                <div class="weapon-images-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                ">
                    <h4 style="margin: 0; color: #333;">
                        <i class="fas fa-images"></i> 图片列表
                    </h4>
                    <button id="uploadImageBtn" class="btn-primary" style="
                        padding: 8px 16px;
                        background: #667eea;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        <i class="fas fa-plus"></i> 上传图片
                    </button>
                </div>
                
                <div id="weaponImagesGrid" class="weapon-images-grid" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 20px;
                "></div>
            </div>
        `;
        
        return panel;
    }

    bindEvents() {
        // 这个方法用于页面初始化时，不做任何事
        // 实际绑定在bindPanelEvents中
    }
    
    // 绑定面板事件（面板创建后调用）
    bindPanelEvents() {
        // 上传按钮点击事件
        const uploadBtn = document.getElementById('uploadImageBtn');
        if (uploadBtn && !uploadBtn.dataset.bound) {
            uploadBtn.addEventListener('click', () => {
                this.toggleUploadArea();
            });
            uploadBtn.dataset.bound = 'true';
        }

        // 确认上传按钮
        const confirmBtn = document.getElementById('confirmUploadBtn');
        if (confirmBtn && !confirmBtn.dataset.bound) {
            confirmBtn.addEventListener('click', () => {
                this.uploadImage();
            });
            confirmBtn.dataset.bound = 'true';
        }

        // 取消上传按钮
        const cancelBtn = document.getElementById('cancelUploadBtn');
        if (cancelBtn && !cancelBtn.dataset.bound) {
            cancelBtn.addEventListener('click', () => {
                this.hideUploadArea();
            });
            cancelBtn.dataset.bound = 'true';
        }

        // 文件选择事件
        const fileInput = document.getElementById('weaponImageFile');
        if (fileInput && !fileInput.dataset.bound) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
            fileInput.dataset.bound = 'true';
        }
    }

    // 显示武器图片管理区域（创建浮动面板）
    showWeaponImageSection(weaponId, weaponName) {
        console.log('📋 显示武器图片管理区域:', weaponId, weaponName);
        this.currentWeaponId = weaponId;
        this.currentWeaponName = weaponName;
        
        // 创建或获取浮动面板
        let section = document.getElementById('weaponImageSection');
        if (!section) {
            section = this.createImageManagementPanel();
            document.body.appendChild(section);
            // 需要重新绑定事件，因为是新创建的元素
            this.bindPanelEvents();
        }
        
        // 更新标题
        const title = section.querySelector('.weapon-image-panel-title');
        if (title) {
            title.textContent = `${weaponName} - 图片管理`;
        }
        
        section.style.display = 'block';
        this.loadWeaponImages();
    }

    // 显示武器图片（兼容knowledge-graph.js调用）
    async showWeaponImages(weaponId, weaponName) {
        console.log('🖼️ 显示武器图片:', weaponId, weaponName);
        this.currentWeaponId = weaponId;
        this.currentWeaponName = weaponName;
        
        // 加载图片并显示第一张
        try {
            const response = await fetch(`http://localhost:3001/api/herb-images/${weaponId}`);
            const data = await response.json();
            
            if (data.success && data.data.images && data.data.images.length > 0) {
                this.cachedImages = data.data.images;
                this.currentWeaponName = weaponName || data.data.weaponName;
                // 直接打开灯箱显示第一张图片
                this.openLightbox(data.data.images[0].id);
            } else {
                alert('该武器暂无图片');
            }
        } catch (error) {
            console.error('加载武器图片失败:', error);
            alert('加载图片失败，请检查后端服务是否启动');
        }
    }

    // 显示上传对话框（兼容knowledge-graph.js调用）
    showUploadDialog(weaponId, weaponName) {
        console.log('📤 显示上传对话框:', weaponId, weaponName);
        this.currentWeaponId = weaponId;
        this.currentWeaponName = weaponName;
        this.showWeaponImageSection(weaponId, weaponName);
        setTimeout(() => this.showUploadArea(), 100);
    }

    // 显示管理对话框（兼容knowledge-graph.js调用）
    showManagementDialog(weaponId, weaponName) {
        console.log('⚙️ 显示管理对话框:', weaponId, weaponName);
        this.showWeaponImageSection(weaponId, weaponName);
    }

    // 加载武器图片缩略图（兼容knowledge-graph.js调用）
    async loadWeaponImageThumbnails(weaponId, displayArea) {
        if (!weaponId || !displayArea) return;

        displayArea.innerHTML = `
            <div class="loading-thumbnails">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在加载图片...</span>
            </div>
        `;

        try {
            const response = await fetch(`http://localhost:3001/api/herb-images/${weaponId}`);
            const data = await response.json();

            if (data.success && data.data.images && data.data.images.length > 0) {
                // 缓存图片数据和武器信息，用于灯箱显示
                this.cachedImages = data.data.images;
                this.currentWeaponId = weaponId;
                this.currentWeaponName = data.data.weaponName;
                
                const images = data.data.images.slice(0, 3); // 只显示前3张作为缩略图
                displayArea.innerHTML = `
                    <div class="weapon-thumbnails">
                        ${images.map(image => `
                            <div class="thumbnail-item" onclick="weaponImageManager.openLightboxDirectly(${image.id})" style="cursor: pointer;">
                                <img src="http://localhost:3001${image.path}" alt="${image.description || '武器图片'}" 
                                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA2MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0yMCAxNUgzMFYyNUgyMFYxNVoiIGZpbGw9IiNEREQiLz4KPHBhdGggZD0iTTIyIDE3SDI4VjIzSDIyVjE3WiIgZmlsbD0iI0JCQiIvPgo8dGV4dCB4PSIzMCIgeT0iMzUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4Ij7lm77niYc8L3RleHQ+Cjwvc3ZnPg=='"
                                     style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; margin-right: 5px;">
                            </div>
                        `).join('')}
                        ${data.data.images.length > 3 ? `<div class="thumbnail-more" style="cursor: pointer;" onclick="weaponImageManager.showWeaponImages(${weaponId}, '${data.data.weaponName}')">+${data.data.images.length - 3}</div>` : ''}
                    </div>
                `;
            } else {
                displayArea.innerHTML = `
                    <div class="no-thumbnails">
                        <i class="fas fa-image" style="color: #666; font-size: 16px;"></i>
                        <span style="color: #666; font-size: 12px; margin-left: 5px;">暂无图片</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载武器图片缩略图失败:', error);
            displayArea.innerHTML = `
                <div class="error-thumbnails">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 16px;"></i>
                    <span style="color: #e74c3c; font-size: 12px; margin-left: 5px;">加载失败</span>
                </div>
            `;
        }
    }

    // 隐藏武器图片管理区域
    hideWeaponImageSection() {
        const section = document.getElementById('weaponImageSection');
        if (section) {
            section.style.display = 'none';
        }
        this.currentWeaponId = null;
        this.currentWeaponName = null;
        this.cachedImages = [];
        this.hideUploadArea();
    }

    // 切换上传区域显示
    toggleUploadArea() {
        const uploadArea = document.getElementById('imageUploadArea');
        if (uploadArea) {
            const isVisible = uploadArea.style.display !== 'none';
            if (isVisible) {
                this.hideUploadArea();
            } else {
                this.showUploadArea();
            }
        }
    }

    // 显示上传区域
    showUploadArea() {
        const uploadArea = document.getElementById('imageUploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'block';
            // 清空表单
            document.getElementById('weaponImageFile').value = '';
            document.getElementById('weaponImageDescription').value = '';
            this.updateFileInputDisplay();
        }
    }

    // 隐藏上传区域
    hideUploadArea() {
        const uploadArea = document.getElementById('imageUploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
    }

    // 处理文件选择
    handleFileSelect(event) {
        const file = event.target.files[0];
        this.updateFileInputDisplay(file);
    }

    // 更新文件输入显示
    updateFileInputDisplay(file = null) {
        const wrapper = document.querySelector('.file-input-wrapper');
        const content = document.querySelector('.file-input-content');
        
        if (file) {
            content.innerHTML = `
                <i class="fas fa-check-circle" style="color: #28a745;"></i>
                <div>已选择: ${file.name}</div>
                <small>${this.formatFileSize(file.size)}</small>
            `;
            wrapper.style.borderColor = '#28a745';
            wrapper.style.background = '#f8fff8';
        } else {
            content.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <div>点击选择图片文件</div>
                <small>支持 JPG, PNG, GIF, WebP 格式，最大 5MB</small>
            `;
            wrapper.style.borderColor = '#ddd';
            wrapper.style.background = 'white';
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 显示消息
    showMessage(message, type = 'success') {
        const messageElement = document.getElementById('imageMessage');
        if (messageElement) {
            messageElement.className = `image-message ${type}`;
            messageElement.textContent = message;
            messageElement.style.display = 'block';
            
            // 3秒后自动隐藏成功消息
            if (type === 'success') {
                setTimeout(() => {
                    messageElement.style.display = 'none';
                }, 3000);
            }
        }
    }

    // 加载武器图片
    async loadWeaponImages() {
        if (!this.currentWeaponId) return;

        const grid = document.getElementById('weaponImagesGrid');
        if (!grid) return;

        // 显示加载状态
        grid.innerHTML = `
            <div class="loading-images">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在加载图片...</span>
            </div>
        `;

        try {
            const response = await fetch(`http://localhost:3001/api/herb-images/${this.currentWeaponId}`);
            const data = await response.json();

            if (data.success) {
                this.cachedImages = data.data.images; // 缓存图片数据
                this.displayImages(data.data.images);
            } else {
                this.showMessage(data.message || '获取武器图片失败', 'error');
                this.displayNoImages();
            }
        } catch (error) {
            console.error('获取武器图片失败:', error);
            this.showMessage('网络错误，请检查服务器连接', 'error');
            this.displayNoImages();
        }
    }

    // 显示图片
    displayImages(images) {
        const grid = document.getElementById('weaponImagesGrid');
        if (!grid) return;

        if (!images || images.length === 0) {
            this.displayNoImages();
            return;
        }

        grid.innerHTML = images.map(image => `
            <div class="weapon-image-card">
                <div class="image-container" onclick="weaponImageManager.openLightbox(${image.id})">
                    <img src="http://localhost:3001${image.path}" alt="${image.description || '武器图片'}" 
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik04MCA0MEgxMjBWODBIODBWNDBaIiBmaWxsPSIjREREIi8+CjxwYXRoIGQ9Ik05MCA1MEgxMTBWNzBIOTBWNTBaIiBmaWxsPSIjQkJCIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTAiPuWbvueJh+aXoOazleWKoOi9vTwvdGV4dD4KPC9zdmc+'">
                    <div class="image-overlay">
                        <div class="image-actions">
                            <button class="btn-warning btn-small" onclick="event.stopPropagation(); weaponImageManager.editImage(${image.id}, '${(image.description || '').replace(/'/g, '\\\'')}')" title="编辑">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-danger btn-small" onclick="event.stopPropagation(); weaponImageManager.deleteImage(${image.id})" title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="image-info">
                    <h5>${image.originalName || '未命名图片'}</h5>
                    <div class="image-meta">
                        <i class="fas fa-calendar"></i> ${new Date(image.uploadedAt).toLocaleDateString('zh-CN')}
                        <br>
                        <i class="fas fa-file"></i> ${this.formatFileSize(image.size)}
                    </div>
                    <div class="image-description">
                        ${image.description || '暂无描述'}
                    </div>
                    <div class="image-controls">
                        <button class="btn-primary btn-small" onclick="weaponImageManager.openLightbox(${image.id})" title="查看大图">
                            <i class="fas fa-search-plus"></i> 查看大图
                        </button>
                        <button class="btn-warning btn-small" onclick="weaponImageManager.editImage(${image.id}, '${(image.description || '').replace(/'/g, '\\\'')}')" title="编辑">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="btn-danger btn-small" onclick="weaponImageManager.deleteImage(${image.id})" title="删除">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 显示无图片状态
    displayNoImages() {
        const grid = document.getElementById('weaponImagesGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="no-images">
                    <i class="fas fa-image"></i>
                    <h5>暂无图片</h5>
                    <p>点击上方"上传图片"按钮添加第一张图片</p>
                </div>
            `;
        }
    }

    // 上传图片
    async uploadImage() {
        if (this.isUploading) return;

        const fileInput = document.getElementById('weaponImageFile');
        const description = document.getElementById('weaponImageDescription').value;

        if (!fileInput.files[0]) {
            this.showMessage('请选择要上传的图片', 'error');
            return;
        }

        if (!this.currentWeaponId) {
            this.showMessage('武器信息错误', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('description', description);

        this.isUploading = true;
        this.showMessage('正在上传图片...', 'loading');

        try {
            const response = await fetch(`http://localhost:3001/api/herb-images/${this.currentWeaponId}`, {
                method: 'POST',
                headers: {
                    'x-admin-user': 'true' // 使用简化管理员认证
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('图片上传成功！');
                this.hideUploadArea();
                this.loadWeaponImages(); // 重新加载图片
            } else {
                this.showMessage(data.message || '上传失败', 'error');
            }
        } catch (error) {
            console.error('上传图片失败:', error);
            this.showMessage('网络错误，请检查服务器连接', 'error');
        } finally {
            this.isUploading = false;
        }
    }

    // 编辑图片
    editImage(imageId, currentDescription) {
        // 创建编辑模态框
        const modal = this.createEditModal(imageId, currentDescription);
        document.body.appendChild(modal);
        modal.style.display = 'block';
    }

    // 创建编辑模态框
    createEditModal(imageId, currentDescription) {
        const modal = document.createElement('div');
        modal.className = 'edit-image-modal';
        modal.innerHTML = `
            <div class="edit-image-modal-content">
                <div class="edit-image-modal-header">
                    <h4><i class="fas fa-edit"></i> 编辑图片</h4>
                    <span class="edit-image-modal-close">&times;</span>
                </div>
                <div class="edit-image-form-group">
                    <label for="editImageDescription">图片描述:</label>
                    <textarea id="editImageDescription" rows="4" placeholder="请输入图片描述">${currentDescription}</textarea>
                </div>
                <div class="edit-image-modal-actions">
                    <button class="btn-primary btn-small save-edit-btn">
                        <i class="fas fa-save"></i> 保存
                    </button>
                    <button class="btn-secondary btn-small cancel-edit-btn">
                        <i class="fas fa-times"></i> 取消
                    </button>
                </div>
            </div>
        `;

        // 绑定事件
        modal.querySelector('.edit-image-modal-close').onclick = () => {
            document.body.removeChild(modal);
        };

        modal.querySelector('.cancel-edit-btn').onclick = () => {
            document.body.removeChild(modal);
        };

        modal.querySelector('.save-edit-btn').onclick = () => {
            const newDescription = modal.querySelector('#editImageDescription').value;
            this.saveImageEdit(imageId, newDescription);
            document.body.removeChild(modal);
        };

        // 点击模态框外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        return modal;
    }

    // 保存图片编辑
    async saveImageEdit(imageId, description) {
        if (!this.currentWeaponId) {
            this.showMessage('武器信息错误', 'error');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/herb-images/${this.currentWeaponId}/${imageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-user': 'true' // 使用简化管理员认证
                },
                body: JSON.stringify({ description })
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('图片信息更新成功！');
                this.loadWeaponImages(); // 重新加载图片
            } else {
                this.showMessage(data.message || '更新失败', 'error');
            }
        } catch (error) {
            console.error('更新图片信息失败:', error);
            this.showMessage('网络错误，请检查服务器连接', 'error');
        }
    }

    // 删除图片
    async deleteImage(imageId) {
        if (!confirm('确定要删除这张图片吗？此操作不可恢复。')) {
            return;
        }

        if (!this.currentWeaponId) {
            this.showMessage('武器信息错误', 'error');
            return;
        }

        this.showMessage('正在删除图片...', 'loading');

        try {
            const response = await fetch(`http://localhost:3001/api/herb-images/${this.currentWeaponId}/${imageId}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-user': 'true' // 使用简化管理员认证
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('图片删除成功！');
                this.loadWeaponImages(); // 重新加载图片
                this.closeLightbox(); // 如果灯箱打开，关闭它
            } else {
                this.showMessage(data.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除图片失败:', error);
            this.showMessage('网络错误，请检查服务器连接', 'error');
        }
    }

    // 打开灯箱
    openLightbox(imageId) {
        console.log('🔎 打开灯箱，图片ID:', imageId);
        console.log('📋 当前缓存图片:', this.cachedImages);
        
        const images = this.getCurrentImages();
        if (!images || images.length === 0) {
            console.error('❗ 无法获取图片数据');
            this.showMessage('无法加载图片', 'error');
            return;
        }
        
        const image = images.find(img => img.id === imageId);
        
        if (!image) {
            console.error('❗ 图片不存在，ID:', imageId);
            this.showMessage('图片不存在', 'error');
            return;
        }
        
        console.log('✅ 找到图片，开始显示灯箱:', image);
        this.renderLightbox(image);
    }
    
    // 从缩略图直接打开灯箱（先加载图片数据）
    async openLightboxDirectly(imageId) {
        console.log('🔗 从缩略图打开灯箱，图片ID:', imageId);
        
        // 如果没有缓存，先加载
        if (!this.cachedImages || this.cachedImages.length === 0) {
            if (!this.currentWeaponId) {
                console.error('❗ 无法加载图片：缺少武器ID');
                this.showMessage('无法加载图片', 'error');
                return;
            }
            
            try {
                const response = await fetch(`http://localhost:3001/api/herb-images/${this.currentWeaponId}`);
                const data = await response.json();
                
                if (data.success && data.data.images) {
                    this.cachedImages = data.data.images;
                    console.log('✅ 加载图片数据成功:', this.cachedImages.length, '张');
                } else {
                    throw new Error(data.message || '加载失败');
                }
            } catch (error) {
                console.error('❗ 加载图片失败:', error);
                this.showMessage('加载图片失败', 'error');
                return;
            }
        }
        
        // 打开灯箱
        this.openLightbox(imageId);
    }
    
    // 渲染灯箱
    renderLightbox(image) {
        console.log('🎨 开始渲染灯箱，图片信息:', image);

        // 创建灯箱HTML
        const lightboxHtml = `
            <div class="weapon-image-lightbox" id="weaponImageLightbox">
                <div class="lightbox-content">
                    <button class="lightbox-close" onclick="weaponImageManager.closeLightbox()">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="lightbox-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>加载中...</span>
                    </div>
                    <img class="lightbox-image" 
                         src="http://localhost:3001${image.path}" 
                         alt="${image.description || '武器图片'}"
                         onload="this.previousElementSibling.style.display='none'"
                         onerror="weaponImageManager.handleLightboxImageError(this)">
                    <div class="lightbox-info">
                        <div class="lightbox-title">
                            <i class="fas fa-image"></i>
                            ${image.originalName || '未命名图片'}
                        </div>
                        <div class="lightbox-description">
                            ${image.description || '暂无描述'}
                        </div>
                        <div class="lightbox-meta">
                            <span><i class="fas fa-calendar"></i> ${new Date(image.uploadedAt).toLocaleDateString('zh-CN')}</span>
                            <span><i class="fas fa-file"></i> ${this.formatFileSize(image.size)}</span>
                            <span><i class="fas fa-tag"></i> ${this.currentWeaponName}</span>
                        </div>
                    </div>
                    <div class="lightbox-controls">
                        <button class="lightbox-btn warning" onclick="weaponImageManager.editImageFromLightbox(${image.id}, '${(image.description || '').replace(/'/g, '\\\'')}')" title="编辑">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="lightbox-btn danger" onclick="weaponImageManager.deleteImageFromLightbox(${image.id})" title="删除">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 移除现有灯箱
        const existingLightbox = document.getElementById('weaponImageLightbox');
        if (existingLightbox) {
            existingLightbox.remove();
        }

        // 添加新灯箱
        document.body.insertAdjacentHTML('beforeend', lightboxHtml);
        
        // 显示灯箱
        const lightbox = document.getElementById('weaponImageLightbox');
        setTimeout(() => {
            lightbox.classList.add('show');
        }, 10);

        // 绑定键盘事件
        this.bindLightboxKeyEvents();
    }

    // 关闭灯箱
    closeLightbox() {
        const lightbox = document.getElementById('weaponImageLightbox');
        if (lightbox) {
            lightbox.classList.remove('show');
            setTimeout(() => {
                lightbox.remove();
                this.unbindLightboxKeyEvents();
            }, 300);
        }
    }

    // 处理灯箱图片加载错误
    handleLightboxImageError(img) {
        const loading = img.previousElementSibling;
        if (loading) {
            loading.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                <span>图片加载失败</span>
            `;
        }
    }

    // 从灯箱编辑图片
    editImageFromLightbox(imageId, currentDescription) {
        this.closeLightbox();
        this.editImage(imageId, currentDescription);
    }

    // 从灯箱删除图片
    deleteImageFromLightbox(imageId) {
        this.deleteImage(imageId);
    }

    // 获取当前图片数据
    getCurrentImages() {
        // 直接返回缓存数据，不依赖DOM元素
        return this.cachedImages || [];
    }

    // 绑定灯箱键盘事件
    bindLightboxKeyEvents() {
        this.lightboxKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeLightbox();
            }
        };
        document.addEventListener('keydown', this.lightboxKeyHandler);
        
        // 点击背景关闭
        const lightbox = document.getElementById('weaponImageLightbox');
        if (lightbox) {
            lightbox.addEventListener('click', (e) => {
                if (e.target === lightbox) {
                    this.closeLightbox();
                }
            });
        }
    }

    // 解绑灯箱键盘事件
    unbindLightboxKeyEvents() {
        if (this.lightboxKeyHandler) {
            document.removeEventListener('keydown', this.lightboxKeyHandler);
            this.lightboxKeyHandler = null;
        }
    }
}

// 创建全局实例
const weaponImageManager = new WeaponImageManager();

// 导出给其他脚本使用
window.weaponImageManager = weaponImageManager;