class WeaponVideoManager {
    constructor() {
        this.currentWeaponId = null;
        this.currentWeaponName = null;
        this.videos = [];
        this.isUploading = false;
        this.init();
    }

    init() {
        this.injectStyles();
        this.bindEvents();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .video-management-area {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 85%;
                max-width: 1000px;
                max-height: 85vh;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                z-index: 1000;
                overflow: hidden;
                display: none;
            }

            .video-management-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .video-management-title {
                font-size: 20px;
                font-weight: bold;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .video-close-btn {
                background: none;
                border: none;
                color: white;
                font-size: 28px;
                cursor: pointer;
                padding: 5px;
                border-radius: 50%;
                transition: background-color 0.3s;
            }

            .video-close-btn:hover {
                background-color: rgba(255,255,255,0.2);
            }

            .video-management-body {
                padding: 20px;
                max-height: calc(85vh - 80px);
                overflow-y: auto;
            }

            .video-upload-section {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                border: 2px dashed #dee2e6;
                transition: all 0.3s;
            }

            .video-upload-section.dragover {
                border-color: #667eea;
                background: #f0f4ff;
            }

            .video-file-input-wrapper {
                position: relative;
                display: block;
                cursor: pointer;
                text-align: center;
                padding: 30px;
                border-radius: 8px;
                transition: all 0.3s;
            }

            .video-file-input-wrapper:hover {
                background: #e9ecef;
            }

            .video-file-input-wrapper input[type="file"] {
                position: absolute;
                opacity: 0;
                width: 100%;
                height: 100%;
                cursor: pointer;
            }

            .video-file-input-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }

            .video-file-input-content i {
                font-size: 48px;
                color: #667eea;
            }

            .video-file-input-content .main-text {
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }

            .video-file-input-content .sub-text {
                font-size: 14px;
                color: #666;
            }

            .video-description-input {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                margin-top: 15px;
                resize: vertical;
                min-height: 80px;
            }

            .video-upload-actions {
                display: flex;
                gap: 10px;
                margin-top: 15px;
                justify-content: center;
            }

            .upload-progress-container {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                border: 1px solid #e9ecef;
                animation: slideDown 0.3s ease-out;
            }

            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .upload-progress-item {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .upload-file-info {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                color: #333;
            }

            .upload-file-info i {
                color: #667eea;
                font-size: 16px;
            }

            .upload-filename {
                font-weight: 500;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .upload-progress-bar {
                width: 100%;
                height: 8px;
                background: #e9ecef;
                border-radius: 4px;
                overflow: hidden;
            }

            .upload-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 4px;
                width: 0%;
                transition: width 0.3s ease;
            }

            .upload-status {
                font-size: 13px;
                color: #666;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .video-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }

            .video-card {
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                overflow: hidden;
                transition: transform 0.3s, box-shadow 0.3s;
            }

            .video-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            }

            .video-container {
                position: relative;
                width: 100%;
                height: 200px;
                background: #000;
                overflow: hidden;
            }

            .video-container video {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .video-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .video-card:hover .video-overlay {
                opacity: 1;
            }

            .video-play-btn {
                background: rgba(255,255,255,0.9);
                border: none;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.3s;
            }

            .video-play-btn:hover {
                background: white;
                transform: scale(1.1);
            }

            .video-play-btn i {
                font-size: 24px;
                color: #667eea;
                margin-left: 3px;
            }

            .video-info {
                padding: 15px;
            }

            .video-title {
                font-size: 16px;
                font-weight: 600;
                color: #333;
                margin: 0 0 8px 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .video-meta {
                font-size: 12px;
                color: #666;
                margin-bottom: 10px;
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
            }

            .video-meta span {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .video-description {
                font-size: 14px;
                color: #555;
                line-height: 1.4;
                margin-bottom: 15px;
                max-height: 60px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
            }

            .video-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }

            .video-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .video-btn-primary {
                background: #667eea;
                color: white;
            }

            .video-btn-primary:hover {
                background: #5a6fd8;
            }

            .video-btn-warning {
                background: #ffc107;
                color: #333;
            }

            .video-btn-warning:hover {
                background: #e0a800;
            }

            .video-btn-danger {
                background: #dc3545;
                color: white;
            }

            .video-btn-danger:hover {
                background: #c82333;
            }

            .video-btn-success {
                background: #28a745;
                color: white;
            }

            .video-btn-success:hover {
                background: #218838;
            }

            .video-btn-secondary {
                background: #6c757d;
                color: white;
            }

            .video-btn-secondary:hover {
                background: #5a6268;
            }

            .no-videos {
                text-align: center;
                padding: 60px 20px;
                color: #666;
            }

            .no-videos i {
                font-size: 64px;
                color: #ddd;
                margin-bottom: 20px;
            }

            .no-videos h5 {
                font-size: 18px;
                margin: 0 0 10px 0;
            }

            .loading-videos {
                text-align: center;
                padding: 40px;
                color: #666;
            }

            .loading-videos i {
                font-size: 32px;
                margin-bottom: 15px;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .video-message {
                padding: 12px 16px;
                border-radius: 6px;
                margin: 15px 0;
                display: none;
            }

            .video-message.success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }

            .video-message.error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }

            .video-message.loading {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }

            .video-player-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.95);
                z-index: 2000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                box-sizing: border-box;
            }

            .video-player-content {
                position: relative;
                max-width: 95%;
                max-height: 95%;
                background: #000;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }

            .video-player-content video {
                width: 100%;
                height: auto;
                max-height: 85vh;
                display: block;
                position: relative;
                z-index: 1;
            }

            .video-player-close {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                font-size: 18px;
                z-index: 2001;
            }

            .video-player-info {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(rgba(0,0,0,0.8), transparent);
                color: white;
                padding: 15px 20px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s, visibility 0.3s;
                z-index: 10;
                pointer-events: none;
            }

            .video-player-info.show {
                opacity: 1;
                visibility: visible;
            }

            .video-player-info-toggle {
                position: absolute;
                top: 50px;
                right: 50px;
                background: rgba(0,0,0,0.7);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                font-size: 16px;
                z-index: 2001;
                transition: background-color 0.3s;
            }

            .video-player-info-toggle:hover {
                background: rgba(0,0,0,0.9);
            }

            .video-player-content video {
                width: 100%;
                height: auto;
                max-height: 80vh;
                position: relative;
                z-index: 1;
            }

            .video-player-info h4 {
                margin: 0 0 5px 0;
                font-size: 18px;
                font-weight: 600;
            }

            .video-player-info p {
                margin: 0;
                font-size: 14px;
                opacity: 0.9;
            }

            .edit-video-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 1500;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .edit-video-modal-content {
                background: white;
                border-radius: 8px;
                padding: 0;
                width: 90%;
                max-width: 500px;
                max-height: 80vh;
                overflow: hidden;
            }

            .edit-video-modal-header {
                background: #667eea;
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .edit-video-modal-close {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
            }

            .edit-video-form-group {
                padding: 20px;
            }

            .edit-video-form-group label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }

            .edit-video-form-group textarea {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 14px;
                resize: vertical;
                box-sizing: border-box;
            }

            .edit-video-modal-actions {
                padding: 0 20px 20px;
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
        `;
        document.head.appendChild(style);
    }

    bindEvents() {
        // 绑定拖拽上传事件
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });
    }

    // 显示武器视频管理区域
    showWeaponVideos(weaponId, weaponName) {
        this.currentWeaponId = weaponId;
        this.currentWeaponName = weaponName;
        
        this.createVideoManagementArea();
        this.loadWeaponVideos();
    }

    // 显示视频管理对话框（与showWeaponVideos功能相同，为了兼容性）
    showManagementDialog(weaponId, weaponName) {
        this.showWeaponVideos(weaponId, weaponName);
    }

    // 创建视频管理区域
    createVideoManagementArea() {
        // 检查是否已存在
        let existingArea = document.getElementById('videoManagementArea');
        if (existingArea) {
            existingArea.style.display = 'block';
            return;
        }

        const area = document.createElement('div');
        area.id = 'videoManagementArea';
        area.className = 'video-management-area';
        
        area.innerHTML = `
            <div class="video-management-header">
                <h3 class="video-management-title">
                    <i class="fas fa-video"></i>
                    ${this.currentWeaponName} - 视频管理
                </h3>
                <button class="video-close-btn" onclick="this.closest('.video-management-area').style.display='none'">&times;</button>
            </div>
            <div class="video-management-body">
                <div class="video-upload-section">
                    <label class="video-file-input-wrapper">
                        <input type="file" accept="video/*" id="videoFileInput">
                        <div class="video-file-input-content">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <div class="main-text">点击选择视频文件或拖拽到此处</div>
                            <div class="sub-text">支持 MP4, AVI, MOV 等格式，最大 100MB</div>
                        </div>
                    </label>
                    <textarea class="video-description-input" placeholder="请输入视频描述..."></textarea>
                    <div class="video-upload-actions">
                        <button class="video-btn video-btn-success" onclick="window.weaponVideoManager.uploadVideo()">
                            <i class="fas fa-upload"></i> 上传视频
                        </button>
                        <button class="video-btn video-btn-secondary" onclick="window.weaponVideoManager.clearUpload()">
                            <i class="fas fa-times"></i> 清空
                        </button>
                    </div>
                </div>
                <div id="videoMessage" class="video-message"></div>
                <div id="videoGrid" class="video-grid"></div>
            </div>
        `;

        document.body.appendChild(area);
        area.style.display = 'block';

        // 绑定文件选择事件
        const fileInput = area.querySelector('#videoFileInput');
        const uploadSection = area.querySelector('.video-upload-section');
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelection(e.target.files[0]);
            }
        });

        // 绑定拖拽事件
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
        });
    }

    // 处理文件选择
    handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            this.showMessage('请选择视频文件', 'error');
            return;
        }

        if (file.size > 100 * 1024 * 1024) { // 100MB
            this.showMessage('文件大小不能超过 100MB', 'error');
            return;
        }

        this.selectedFile = file;
        this.showMessage(`已选择文件: ${file.name} (${this.formatFileSize(file.size)})`, 'success');
        
        // 更新文件输入区域显示
        const inputContent = document.querySelector('.video-file-input-content');
        if (inputContent) {
            inputContent.innerHTML = `
                <i class="fas fa-video" style="color: #28a745;"></i>
                <div class="main-text" style="color: #28a745;">已选择: ${file.name}</div>
                <div class="sub-text">文件大小: ${this.formatFileSize(file.size)} | 点击重新选择</div>
            `;
        }
    }

    // 上传视频
    async uploadVideo() {
        if (!this.selectedFile) {
            this.showMessage('请先选择视频文件', 'error');
            return;
        }

        if (this.isUploading) {
            this.showMessage('正在上传中，请稍候...', 'error');
            return;
        }

        const description = document.querySelector('.video-description-input').value.trim();
        
        const formData = new FormData();
        formData.append('video', this.selectedFile);
        formData.append('description', description);

        try {
            this.isUploading = true;
            
            // 显示上传进度条
            const progressContainer = this.showUploadProgress(this.selectedFile.name);
            
            // 使用 XMLHttpRequest 来支持上传进度
            const xhr = new XMLHttpRequest();
            
            // 上传进度监听
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    this.updateUploadProgress(progressContainer, percent);
                }
            });
            
            // 完成监听
            xhr.addEventListener('load', () => {
                this.isUploading = false;
                
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.success) {
                            this.completeUpload(progressContainer, true);
                            this.showMessage('视频上传成功！', 'success');
                            this.clearUpload();
                            this.loadWeaponVideos();
                        } else {
                            this.completeUpload(progressContainer, false);
                            this.showMessage(data.error || '上传失败', 'error');
                        }
                    } catch (e) {
                        this.completeUpload(progressContainer, false);
                        this.showMessage('服务器响应格式错误', 'error');
                    }
                } else {
                    this.completeUpload(progressContainer, false);
                    this.showMessage(`上传失败 (${xhr.status})`, 'error');
                }
            });
            
            // 错误监听
            xhr.addEventListener('error', () => {
                this.isUploading = false;
                this.completeUpload(progressContainer, false);
                this.showMessage('网络错误，上传失败', 'error');
            });
            
            // 发送请求
            xhr.open('POST', `http://localhost:3001/api/weapon-videos/weapon/${this.currentWeaponId}/upload`);
            xhr.setRequestHeader('x-admin-user', 'admin');
            xhr.send(formData);
            
        } catch (error) {
            this.isUploading = false;
            console.error('上传视频失败:', error);
            this.showMessage('网络错误，上传失败', 'error');
        }
    }

    // 显示上传进度
    showUploadProgress(filename) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'upload-progress-container';
        progressContainer.innerHTML = `
            <div class="upload-progress-item">
                <div class="upload-file-info">
                    <i class="fas fa-video"></i>
                    <span class="upload-filename">${filename}</span>
                </div>
                <div class="upload-progress-bar">
                    <div class="upload-progress-fill"></div>
                </div>
                <div class="upload-status">准备上传...</div>
            </div>
        `;
        
        // 添加到上传区域上方
        const uploadSection = document.querySelector('.video-upload-section');
        uploadSection.parentNode.insertBefore(progressContainer, uploadSection);
        
        return progressContainer;
    }

    // 更新上传进度
    updateUploadProgress(progressContainer, percent) {
        const progressFill = progressContainer.querySelector('.upload-progress-fill');
        const statusText = progressContainer.querySelector('.upload-status');
        
        progressFill.style.width = `${percent}%`;
        statusText.textContent = `上传中... ${percent}%`;
    }

    // 完成上传
    completeUpload(progressContainer, success = true) {
        const statusText = progressContainer.querySelector('.upload-status');
        const progressFill = progressContainer.querySelector('.upload-progress-fill');
        
        if (success) {
            progressFill.style.width = '100%';
            progressFill.style.backgroundColor = '#4CAF50';
            statusText.textContent = '上传完成 ✓';
            statusText.style.color = '#4CAF50';
            
            // 2秒后移除进度条
            setTimeout(() => {
                if (progressContainer.parentNode) {
                    progressContainer.remove();
                }
            }, 2000);
        } else {
            progressFill.style.backgroundColor = '#f44336';
            statusText.textContent = '上传失败 ✗';
            statusText.style.color = '#f44336';
            
            // 3秒后移除进度条
            setTimeout(() => {
                if (progressContainer.parentNode) {
                    progressContainer.remove();
                }
            }, 3000);
        }
    }

    // 清空上传
    clearUpload() {
        document.getElementById('videoFileInput').value = '';
        document.querySelector('.video-description-input').value = '';
        this.selectedFile = null;
        this.hideMessage();
        
        // 重置文件输入区域显示
        const inputContent = document.querySelector('.video-file-input-content');
        if (inputContent) {
            inputContent.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <div class="main-text">点击选择视频文件或拖拽到此处</div>
                <div class="sub-text">支持 MP4, AVI, MOV 等格式，最大 100MB</div>
            `;
        }
    }

    // 加载武器视频
    async loadWeaponVideos() {
        try {
            const videoGrid = document.getElementById('videoGrid');
            videoGrid.innerHTML = '<div class="loading-videos"><i class="fas fa-spinner"></i><p>正在加载视频...</p></div>';

            const response = await fetch(`http://localhost:3001/api/weapon-videos/weapon/${this.currentWeaponId}`, {
                headers: {
                    'x-admin-user': 'admin'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.videos = data.data || [];
                this.renderVideoGrid();
            } else {
                videoGrid.innerHTML = '<div class="no-videos"><i class="fas fa-video-slash"></i><h5>加载失败</h5><p>无法加载视频列表</p></div>';
            }
        } catch (error) {
            console.error('加载视频失败:', error);
            document.getElementById('videoGrid').innerHTML = '<div class="no-videos"><i class="fas fa-exclamation-triangle"></i><h5>网络错误</h5><p>无法连接到服务器</p></div>';
        }
    }

    // 渲染视频网格
    renderVideoGrid() {
        const videoGrid = document.getElementById('videoGrid');
        
        if (this.videos.length === 0) {
            videoGrid.innerHTML = '<div class="no-videos"><i class="fas fa-video"></i><h5>暂无视频</h5><p>点击上方按钮上传第一个视频</p></div>';
            return;
        }

        const videosHtml = this.videos.map(video => `
            <div class="video-card">
                <div class="video-container">
                    <video preload="metadata">
                        <source src="http://localhost:3001/api/weapon-videos/file/${video.filename}" type="${video.mime_type}">
                        您的浏览器不支持视频播放
                    </video>
                    <div class="video-overlay">
                        <button class="video-play-btn" onclick="window.weaponVideoManager.playVideo('${video.filename}', '${video.description || ''}')">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
                <div class="video-info">
                    <h4 class="video-title">${video.description || '未命名视频'}</h4>
                    <div class="video-meta">
                        <span><i class="fas fa-calendar"></i> ${new Date(video.upload_time).toLocaleDateString()}</span>
                        <span><i class="fas fa-file-video"></i> ${this.formatFileSize(video.file_size)}</span>
                    </div>
                    <div class="video-actions">
                        <button class="video-btn video-btn-primary" onclick="window.weaponVideoManager.playVideo('${video.filename}', '${video.description || ''}')">
                            <i class="fas fa-play"></i> 播放
                        </button>
                        <button class="video-btn video-btn-warning" onclick="window.weaponVideoManager.editVideo(${video.id}, '${video.description || ''}')">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="video-btn video-btn-danger" onclick="window.weaponVideoManager.deleteVideo(${video.id})">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        videoGrid.innerHTML = videosHtml;
    }

    // 播放视频
    playVideo(filename, description) {
        // 确保武器名称可用
        const weaponName = this.currentWeaponName || this.getWeaponNameFromContext() || '未知武器';
        
        const modal = document.createElement('div');
        modal.className = 'video-player-modal';
        modal.innerHTML = `
            <div class="video-player-content">
                <button class="video-player-close" onclick="this.closest('.video-player-modal').remove()">&times;</button>
                <button class="video-player-info-toggle" onclick="window.weaponVideoManager.toggleVideoInfo(this)" title="显示视频信息">
                    <i class="fas fa-info"></i>
                </button>
                <video controls autoplay>
                    <source src="http://localhost:3001/api/weapon-videos/file/${filename}" type="video/mp4">
                    您的浏览器不支持视频播放
                </video>
                <div class="video-player-info" id="videoPlayerInfo">
                    <h4>${description || '未命名视频'}</h4>
                    <p>武器: ${weaponName}</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.style.display = 'flex';

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // 键盘ESC关闭
        const handleKeyPress = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeyPress);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
    }

    // 从上下文获取武器名称
    getWeaponNameFromContext() {
        // 尝试从知识图谱获取当前选中的武器名称
        if (window.selectedNode && window.selectedNode.properties && window.selectedNode.properties.name) {
            return window.selectedNode.properties.name;
        }
        
        // 尝试从页面标题获取
        const titleElement = document.querySelector('.video-management-title');
        if (titleElement) {
            const titleText = titleElement.textContent;
            const match = titleText.match(/^(.+?)\s*-\s*视频管理$/);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }

    // 切换视频信息显示
    toggleVideoInfo(button) {
        const info = document.getElementById('videoPlayerInfo');
        const icon = button.querySelector('i');
        
        if (info.classList.contains('show')) {
            info.classList.remove('show');
            icon.className = 'fas fa-info';
            button.title = '显示视频信息';
        } else {
            info.classList.add('show');
            icon.className = 'fas fa-times';
            button.title = '隐藏视频信息';
        }
    }

    // 编辑视频
    editVideo(videoId, currentDescription) {
        const modal = document.createElement('div');
        modal.className = 'edit-video-modal';
        modal.innerHTML = `
            <div class="edit-video-modal-content">
                <div class="edit-video-modal-header">
                    <h4>编辑视频</h4>
                    <button class="edit-video-modal-close" onclick="this.closest('.edit-video-modal').remove()">&times;</button>
                </div>
                <div class="edit-video-form-group">
                    <label>视频描述</label>
                    <textarea id="editVideoDescription" rows="4">${currentDescription}</textarea>
                </div>
                <div class="edit-video-modal-actions">
                    <button class="video-btn video-btn-success" onclick="window.weaponVideoManager.saveVideoEdit(${videoId})">
                        <i class="fas fa-save"></i> 保存
                    </button>
                    <button class="video-btn video-btn-secondary" onclick="this.closest('.edit-video-modal').remove()">
                        <i class="fas fa-times"></i> 取消
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // 保存视频编辑
    async saveVideoEdit(videoId) {
        const description = document.getElementById('editVideoDescription').value.trim();
        
        try {
            const response = await fetch(`http://localhost:3001/api/weapon-videos/${videoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-user': 'admin'
                },
                body: JSON.stringify({ description })
            });

            const data = await response.json();
            
            if (data.success) {
                this.showMessage('视频信息更新成功！', 'success');
                document.querySelector('.edit-video-modal').remove();
                this.loadWeaponVideos();
            } else {
                this.showMessage(data.error || '更新失败', 'error');
            }
        } catch (error) {
            console.error('更新视频失败:', error);
            this.showMessage('网络错误，更新失败', 'error');
        }
    }

    // 删除视频
    async deleteVideo(videoId) {
        if (!confirm('确定要删除这个视频吗？此操作不可撤销。')) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/weapon-videos/${videoId}`, {
                method: 'DELETE',
                headers: {
                    'x-admin-user': 'admin'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                this.showMessage('视频删除成功！', 'success');
                this.loadWeaponVideos();
            } else {
                this.showMessage(data.error || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除视频失败:', error);
            this.showMessage('网络错误，删除失败', 'error');
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('videoMessage');
        messageEl.textContent = message;
        messageEl.className = `video-message ${type}`;
        messageEl.style.display = 'block';

        if (type !== 'loading') {
            setTimeout(() => {
                this.hideMessage();
            }, 3000);
        }
    }

    // 隐藏消息
    hideMessage() {
        const messageEl = document.getElementById('videoMessage');
        messageEl.style.display = 'none';
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 加载武器视频缩略图（用于知识图谱显示）
    async loadWeaponVideoThumbnails(weaponId, displayArea) {
        try {
            const response = await fetch(`http://localhost:3001/api/weapon-videos/weapon/${weaponId}`, {
                headers: {
                    'x-admin-user': 'admin'
                }
            });

            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                const videos = data.data.slice(0, 3); // 只显示前3个视频
                const thumbnailsHtml = videos.map(video => `
                    <div class="video-thumbnail" style="display: inline-block; margin: 2px; width: 60px; height: 40px; background: #000; border-radius: 4px; position: relative; cursor: pointer;" onclick="window.weaponVideoManager.playVideo('${video.filename}', '${video.description || ''}')">
                        <video style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;" preload="metadata">
                            <source src="http://localhost:3001/api/weapon-videos/file/${video.filename}" type="${video.mime_type}">
                        </video>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 12px;">
                            <i class="fas fa-play"></i>
                        </div>
                    </div>
                `).join('');
                
                displayArea.innerHTML = `<div style="font-size: 12px; color: #ccc; margin-bottom: 5px;">视频 (${data.data.length})</div>${thumbnailsHtml}`;
            } else {
                displayArea.innerHTML = '<div style="font-size: 12px; color: #999;">暂无视频</div>';
            }
        } catch (error) {
            console.error('加载视频缩略图失败:', error);
            displayArea.innerHTML = '<div style="font-size: 12px; color: #999;">加载失败</div>';
        }
    }
}

// 创建全局实例
window.weaponVideoManager = new WeaponVideoManager();
