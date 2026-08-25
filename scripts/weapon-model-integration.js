/**
 * 武器3D模型管理集成类
 * 负责处理武器3D模型的上传、展示、编辑和删除功能
 */
class WeaponModelManager {
    constructor() {
        this.currentWeaponId = null;
        this.models = [];
        this.isUploading = false;
        this.modelViewer = null;
        this.init();
    }

    /**
     * 初始化模型管理器
     */
    init() {
        this.bindEvents();
        this.loadThreeJS();
    }

    /**
     * 创建3D模型管理面板
     */
    createModelManagementPanel() {
        const panel = document.createElement('div');
        panel.id = 'weaponModelSection';
        panel.className = 'weapon-model-management-panel';
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
            <div class="weapon-model-panel-header" style="
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 class="weapon-model-panel-title" style="margin: 0; font-size: 20px;">
                    <i class="fas fa-cube"></i> 武器3D模型管理
                </h3>
                <button class="weapon-model-panel-close" onclick="weaponModelManager.hideModelManagement()" style="
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
            <div class="weapon-model-panel-body" style="
                padding: 20px;
                max-height: calc(85vh - 80px);
                overflow-y: auto;
            ">
                <div id="modelMessage" class="model-message" style="display: none;"></div>
                
                <div id="modelUploadArea" style="display: none; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #333;">
                        <i class="fas fa-cloud-upload-alt"></i> 上传新3D模型
                    </h4>
                    <div class="model-file-input-wrapper" onclick="document.getElementById('weaponModelFile').click()" style="
                        border: 2px dashed #ddd;
                        border-radius: 8px;
                        padding: 30px;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.3s;
                        background: white;
                        margin-bottom: 15px;
                    ">
                        <div class="model-file-input-content">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 48px; color: #e74c3c; margin-bottom: 10px;"></i>
                            <div style="color: #333; font-size: 16px; margin-bottom: 5px;">点击选择3D模型文件</div>
                            <small style="color: #666;">支持 GLB, GLTF, OBJ, FBX, DAE, 3DS, PLY, STL 格式，最大 50MB</small>
                        </div>
                    </div>
                    <input type="file" id="weaponModelFile" accept=".glb,.gltf,.obj,.fbx,.dae,.3ds,.ply,.stl" style="display: none;">
                    <div class="form-group" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; color: #333;">模型描述：</label>
                        <textarea id="weaponModelDescription" rows="3" placeholder="请输入模型描述..."
                            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                    </div>
                    <div class="upload-actions" style="display: flex; gap: 10px;">
                        <button id="confirmModelUploadBtn" class="btn-primary" style="
                            flex: 1;
                            padding: 10px;
                            background: #e74c3c;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                            <i class="fas fa-check"></i> 确认上传
                        </button>
                        <button id="cancelModelUploadBtn" class="btn-secondary" style="
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
                
                <div class="weapon-models-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                ">
                    <h4 style="margin: 0; color: #333;">
                        <i class="fas fa-cube"></i> 3D模型列表
                    </h4>
                    <button id="manageModelBtn" class="btn-primary" style="
                        padding: 8px 16px;
                        background: #e74c3c;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        <i class="fas fa-plus"></i> 上传模型
                    </button>
                </div>
                
                <div id="weaponModelsGrid" class="weapon-models-grid" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 20px;
                "></div>
            </div>
        `;
        
        return panel;
    }

    /**
     * 加载Three.js库
     */
    async loadThreeJS() {
        try {
            // 使用兼容性更好的版本和CDN
            const threeCDNs = [
                "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
                "https://unpkg.com/three@0.128.0/build/three.min.js",
                "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"
            ];
            
            // 加载核心库
            if (!window.THREE) {
                for (const cdn of threeCDNs) {
                    try {
                        await this.loadScript(cdn);
                        console.log(`Three.js核心库加载完成: ${cdn}`);
                        await new Promise(resolve => setTimeout(resolve, 200));
                        if (window.THREE) break;
                    } catch (error) {
                        console.warn(`Three.js CDN加载失败 (${cdn}):`, error);
                    }
                }
            }

            // 验证核心库
            if (!window.THREE) {
                throw new Error("Three.js核心库加载失败");
            }

            // 加载GLTFLoader和OrbitControls
            await this.createGLTFLoader();
            await this.createOrbitControls();

            console.log("Three.js及扩展库全部加载完成 ✅");
        } catch (error) {
            console.error("加载Three.js库失败:", error);
            throw error;
        }
    }

    /**
     * 创建GLTFLoader（使用外部CDN）
     */
    async createGLTFLoader() {
        if (window.THREE && !window.THREE.GLTFLoader) {
            // 尝试加载真正的GLTFLoader
            const gltfLoaderUrls = [
                'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js',
                'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
                'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/GLTFLoader.js'
            ];
            
            for (const url of gltfLoaderUrls) {
                try {
                    await this.loadScript(url);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (window.THREE.GLTFLoader) {
                        console.log(`GLTFLoader加载成功: ${url}`);
                        return;
                    }
                } catch (error) {
                    console.warn(`GLTFLoader加载失败 (${url}):`, error);
                }
            }
            
            // 如果所有CDN都失败，创建一个基本的占位符加载器
            console.warn('所有GLTFLoader CDN都失败，创建占位符加载器');
            window.THREE.GLTFLoader = function() {
                this.load = function(url, onLoad, onProgress, onError) {
                    if (onError) {
                        onError(new Error('GLTFLoader不可用，请检查网络连接'));
                    }
                };
            };
        }
    }

    /**
     * 创建OrbitControls（符合直觉的操作逻辑）
     */
    async createOrbitControls() {
        if (window.THREE && !window.THREE.OrbitControls) {
            // 标准直觉操作的OrbitControls实现
            window.THREE.OrbitControls = function(camera, domElement) {
                this.camera = camera;
                this.domElement = domElement || document;
                this.target = new THREE.Vector3(0, 0, 0);
                this.enableDamping = true;
                this.dampingFactor = 0.05;
                this.enableZoom = true;
                this.enableRotate = true;
                this.enablePan = true;
                
                // 控制参数
                this.rotateSpeed = 0.2;
                this.zoomSpeed = 0.7;
                this.panSpeed = 0.2;
                this.minDistance = 0.1;
                this.maxDistance = 1000;
                this.minPolarAngle = 0; // 垂直旋转限制
                this.maxPolarAngle = Math.PI; // 垂直旋转限制
                
                // 内部状态
                this.spherical = new THREE.Spherical();
                this.sphericalDelta = new THREE.Spherical();
                this.scale = 1;
                this.panOffset = new THREE.Vector3();
                
                // 鼠标状态
                const STATE = { NONE: -1, ROTATE: 0, DOLLY: 1, PAN: 2 };
                let state = STATE.NONE;
                let rotateStart = new THREE.Vector2();
                let rotateEnd = new THREE.Vector2();
                let rotateDelta = new THREE.Vector2();
                let panStart = new THREE.Vector2();
                let panEnd = new THREE.Vector2();
                let panDelta = new THREE.Vector2();
                let dollyStart = new THREE.Vector2();
                let dollyEnd = new THREE.Vector2();
                let dollyDelta = new THREE.Vector2();
                
                // 鼠标按下事件
                const onMouseDown = (event) => {
                    event.preventDefault();
                    
                    switch (event.button) {
                        case 0: // 左键 - 旋转
                            if (!this.enableRotate) return;
                            state = STATE.ROTATE;
                            rotateStart.set(event.clientX, event.clientY);
                            break;
                            
                        case 1: // 中键 - 平移
                            if (!this.enablePan) return;
                            state = STATE.PAN;
                            panStart.set(event.clientX, event.clientY);
                            break;
                            
                        case 2: // 右键 - 平移
                            if (!this.enablePan) return;
                            state = STATE.PAN;
                            panStart.set(event.clientX, event.clientY);
                            break;
                    }
                    
                    if (state !== STATE.NONE) {
                        this.domElement.addEventListener('mousemove', onMouseMove, false);
                        this.domElement.addEventListener('mouseup', onMouseUp, false);
                    }
                };
                
                // 鼠标移动事件
                const onMouseMove = (event) => {
                    event.preventDefault();
                    
                    switch (state) {
                        case STATE.ROTATE:
                            if (!this.enableRotate) return;
                            rotateEnd.set(event.clientX, event.clientY);
                            rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(this.rotateSpeed);
                            
                            const element = this.domElement;
                            // 水平旋转（绕Y轴）
                            this.rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight);
                            // 垂直旋转（绕X轴）
                            this.rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);
                            
                            rotateStart.copy(rotateEnd);
                            this.update();
                            break;
                            
                        case STATE.PAN:
                            if (!this.enablePan) return;
                            panEnd.set(event.clientX, event.clientY);
                            panDelta.subVectors(panEnd, panStart).multiplyScalar(this.panSpeed);
                            this.pan(panDelta.x, panDelta.y);
                            panStart.copy(panEnd);
                            this.update();
                            break;
                    }
                };
                
                // 鼠标释放事件
                const onMouseUp = (event) => {
                    event.preventDefault();
                    this.domElement.removeEventListener('mousemove', onMouseMove, false);
                    this.domElement.removeEventListener('mouseup', onMouseUp, false);
                    state = STATE.NONE;
                };
                
                // 滚轮事件
                const onMouseWheel = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    if (!this.enableZoom) return;
                    
                    if (event.deltaY < 0) {
                        this.dollyIn(this.getZoomScale());
                    } else if (event.deltaY > 0) {
                        this.dollyOut(this.getZoomScale());
                    }
                    
                    this.update();
                };
                
                // 右键菜单禁用
                const onContextMenu = (event) => {
                    event.preventDefault();
                };
                
                // 绑定事件
                this.domElement.addEventListener('mousedown', onMouseDown, false);
                this.domElement.addEventListener('wheel', onMouseWheel, false);
                this.domElement.addEventListener('contextmenu', onContextMenu, false);
                
                // 旋转方法
                this.rotateLeft = (angle) => {
                    this.sphericalDelta.theta -= angle;
                };
                
                this.rotateUp = (angle) => {
                    this.sphericalDelta.phi -= angle;
                };
                
                // 平移方法
                this.pan = (deltaX, deltaY) => {
                    const element = this.domElement;
                    const position = this.camera.position;
                    const targetDistance = position.distanceTo(this.target);
                    
                    // 根据相机距离调整平移速度
                    const factor = targetDistance * Math.tan((this.camera.fov / 2) * Math.PI / 180);
                    
                    const panLeft = new THREE.Vector3();
                    const panUp = new THREE.Vector3();
                    
                    // 计算平移向量
                    panLeft.setFromMatrixColumn(this.camera.matrix, 0);
                    panUp.setFromMatrixColumn(this.camera.matrix, 1);
                    
                    panLeft.multiplyScalar(-2 * deltaX * factor / element.clientHeight);
                    panUp.multiplyScalar(2 * deltaY * factor / element.clientHeight);
                    
                    this.panOffset.add(panLeft).add(panUp);
                };
                
                // 缩放方法
                this.dollyIn = (dollyScale) => {
                    this.scale /= dollyScale;
                };
                
                this.dollyOut = (dollyScale) => {
                    this.scale *= dollyScale;
                };
                
                this.getZoomScale = () => {
                    return Math.pow(0.95, this.zoomSpeed);
                };
                
                // 更新相机位置
                this.update = () => {
                    const position = this.camera.position;
                    const offset = new THREE.Vector3();
                    
                    // 计算从目标到相机的偏移
                    offset.copy(position).sub(this.target);
                    
                    // 转换为球坐标
                    this.spherical.setFromVector3(offset);
                    
                    // 应用旋转
                    this.spherical.theta += this.sphericalDelta.theta;
                    this.spherical.phi += this.sphericalDelta.phi;
                    
                    // 限制垂直角度
                    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
                    
                    // 应用缩放
                    this.spherical.radius *= this.scale;
                    
                    // 限制距离
                    this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
                    
                    // 应用平移
                    this.target.add(this.panOffset);
                    
                    // 转换回笛卡尔坐标
                    offset.setFromSpherical(this.spherical);
                    
                    // 更新相机位置
                    position.copy(this.target).add(offset);
                    
                    this.camera.lookAt(this.target);
                    
                    // 应用阻尼
                    if (this.enableDamping) {
                        this.sphericalDelta.theta *= (1 - this.dampingFactor);
                        this.sphericalDelta.phi *= (1 - this.dampingFactor);
                        this.panOffset.multiplyScalar(1 - this.dampingFactor);
                    } else {
                        this.sphericalDelta.set(0, 0, 0);
                        this.panOffset.set(0, 0, 0);
                    }
                    
                    this.scale = 1;
                };
                
                // 重置方法
                this.reset = () => {
                    this.target.set(0, 0, 0);
                    this.camera.position.set(0, 0, 5);
                    this.camera.lookAt(this.target);
                    this.sphericalDelta.set(0, 0, 0);
                    this.panOffset.set(0, 0, 0);
                    this.scale = 1;
                    this.update();
                };
                
                // 初始化
                this.update();
            };
            console.log("OrbitControls已创建（标准直觉操作版）");
        }
    }

    /**
     * 动态加载脚本
     */
    loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(new Error(`加载脚本失败: ${src}, ${err.message}`));
        document.head.appendChild(script);
    });
}


    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 这个方法用于页面初始化时，不做任何事
        // 实际绑定在bindPanelEvents中
    }
    
    /**
     * 绑定面板事件（面板创建后调用）
     */
    bindPanelEvents() {
        // 管理3D模型按钮
        const manageModelBtn = document.getElementById('manageModelBtn');
        if (manageModelBtn && !manageModelBtn.dataset.bound) {
            manageModelBtn.addEventListener('click', () => this.toggleModelUpload());
            manageModelBtn.dataset.bound = 'true';
        }

        // 上传确认按钮
        const confirmModelUploadBtn = document.getElementById('confirmModelUploadBtn');
        if (confirmModelUploadBtn && !confirmModelUploadBtn.dataset.bound) {
            confirmModelUploadBtn.addEventListener('click', () => this.uploadModel());
            confirmModelUploadBtn.dataset.bound = 'true';
        }

        // 取消上传按钮
        const cancelModelUploadBtn = document.getElementById('cancelModelUploadBtn');
        if (cancelModelUploadBtn && !cancelModelUploadBtn.dataset.bound) {
            cancelModelUploadBtn.addEventListener('click', () => this.cancelUpload());
            cancelModelUploadBtn.dataset.bound = 'true';
        }

        // 文件选择
        const modelFileInput = document.getElementById('weaponModelFile');
        if (modelFileInput && !modelFileInput.dataset.bound) {
            modelFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
            modelFileInput.dataset.bound = 'true';
        }

        // 模型查看器关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('model-viewer-close')) {
                this.closeModelViewer();
            }
        });
    }

    /**
     * 显示武器3D模型管理界面
     */
    showModelManagement(weaponId, weaponName) {
        console.log('🎮 显示3D模型管理界面，武器ID:', weaponId, '武器名称:', weaponName);
        
        // 创建或获取浮动面板
        let modelSection = document.getElementById('weaponModelSection');
        if (!modelSection) {
            modelSection = this.createModelManagementPanel();
            document.body.appendChild(modelSection);
            // 需要重新绑定事件，因为是新创建的元素
            this.bindPanelEvents();
        }
        
        // 更新标题
        const title = modelSection.querySelector('.weapon-model-panel-title');
        if (title) {
            title.innerHTML = `<i class="fas fa-cube"></i> ${weaponName} - 3D模型管理`;
        }
        
        // 显示界面
        modelSection.style.display = 'block';
        
        // 如果是同一个武器且数据已加载，不需要重新加载数据
        if (this.currentWeaponId === weaponId && this.models.length > 0) {
            console.log('同一武器且数据已存在，直接显示');
            return;
        }
        
        // 更新当前武器ID
        this.currentWeaponId = weaponId;
        
        // 清空之前的模型数据
        this.models = [];
        
        // 重置上传表单
        this.resetUploadForm();
        
        // 隐藏上传区域
        const uploadArea = document.getElementById('modelUploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        
        // 立即加载新武器的模型
        this.loadWeaponModels(weaponId);
    }

    /**
     * 加载武器3D模型缩略图（兼容knowledge-graph.js调用）
     */
    loadWeaponModelThumbnails(weaponId, displayArea) {
        // 更新当前武器ID
        this.currentWeaponId = weaponId;
        
        // 如果显示区域存在，加载模型
        if (displayArea) {
            this.loadWeaponModels(weaponId);
        }
    }

    /**
     * 显示3D模型查看器（兼容knowledge-graph.js调用）
     */
    async showModelViewer(weaponId, weaponName) {
        try {
            // 确保Three.js库已加载
            await this.ensureThreeJSLoaded();
            
            // 更新当前武器ID
            this.currentWeaponId = weaponId;
            
            // 获取该武器的3D模型
            const response = await fetch(`http://localhost:3001/api/weapon-models/weapon/${weaponId}`);
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                // 如果有模型，显示第一个模型
                const firstModel = result.data[0];
                this.viewModel(firstModel.id);
            } else {
                // 如果没有模型，显示管理界面让用户上传
                this.showMessage('该武器暂无3D模型，请先上传模型文件', 'info');
                this.showModelManagement(weaponId, weaponName);
            }
        } catch (error) {
            console.error('显示3D模型失败:', error);
            this.showMessage('3D模型功能初始化失败，请稍后重试', 'error');
        }
    }

    /**
     * 隐藏武器3D模型管理界面
     */
    hideModelManagement() {
        const modelSection = document.getElementById('weaponModelSection');
        if (modelSection) {
            modelSection.style.display = 'none';
        }
        this.currentWeaponId = null;
        this.models = [];
    }

    /**
     * 切换模型上传区域显示
     */
    toggleModelUpload() {
        const uploadArea = document.getElementById('modelUploadArea');
        if (uploadArea) {
            const isVisible = uploadArea.style.display !== 'none';
            uploadArea.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                // 重置表单
                this.resetUploadForm();
            }
        }
    }

    /**
     * 重置上传表单
     */
    resetUploadForm() {
        const fileInput = document.getElementById('weaponModelFile');
        const descriptionInput = document.getElementById('weaponModelDescription');
        
        if (fileInput) fileInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        this.updateFileInputDisplay();
    }

    /**
     * 处理文件选择
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        this.updateFileInputDisplay(file);
    }

    /**
     * 更新文件输入显示
     */
    updateFileInputDisplay(file = null) {
        const fileInputContent = document.querySelector('.model-file-input-content');
        if (!fileInputContent) return;

        if (file) {
            const formatSize = this.formatFileSize(file.size);
            const fileExtension = file.name.split('.').pop().toUpperCase();
            
            fileInputContent.innerHTML = `
                <i class="fas fa-cube"></i>
                <div>已选择: ${file.name}</div>
                <small>格式: ${fileExtension} | 大小: ${formatSize}</small>
            `;
        } else {
            fileInputContent.innerHTML = `
                <i class="fas fa-cloud-upload-alt"></i>
                <div>点击选择3D模型文件</div>
                <small>支持 GLB, GLTF, OBJ, FBX, DAE, 3DS, PLY, STL 格式，最大 50MB</small>
            `;
        }
    }

    /**
     * 上传3D模型
     */
    async uploadModel() {
        if (this.isUploading) return;

        const fileInput = document.getElementById('weaponModelFile');
        const descriptionInput = document.getElementById('weaponModelDescription');
        
        if (!fileInput || !fileInput.files[0]) {
            this.showMessage('请选择要上传的3D模型文件', 'error');
            return;
        }

        const file = fileInput.files[0];
        const description = descriptionInput ? descriptionInput.value.trim() : '';

        // 验证文件类型
        const allowedExtensions = ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.3ds', '.ply', '.stl'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            this.showMessage('不支持的文件格式，请选择 GLB, GLTF, OBJ, FBX, DAE, 3DS, PLY, STL 格式的文件', 'error');
            return;
        }

        // 验证文件大小
        if (file.size > 50 * 1024 * 1024) {
            this.showMessage('文件大小不能超过 50MB', 'error');
            return;
        }

        this.isUploading = true;
        this.showUploadProgress(true);

        try {
            const formData = new FormData();
            formData.append('model', file);
            formData.append('description', description);

            const response = await fetch(`http://localhost:3001/api/weapon-models/weapon/${this.currentWeaponId}/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('3D模型上传成功', 'success');
                this.resetUploadForm();
                this.toggleModelUpload();
                await this.loadWeaponModels(this.currentWeaponId);
            } else {
                this.showMessage(result.message || '上传失败', 'error');
            }
        } catch (error) {
            console.error('上传3D模型失败:', error);
            this.showMessage('上传失败，请检查网络连接', 'error');
        } finally {
            this.isUploading = false;
            this.showUploadProgress(false);
        }
    }

    /**
     * 取消上传
     */
    cancelUpload() {
        this.resetUploadForm();
        this.toggleModelUpload();
    }

    /**
     * 显示上传进度
     */
    showUploadProgress(show) {
        const confirmBtn = document.getElementById('confirmModelUploadBtn');
        if (confirmBtn) {
            confirmBtn.disabled = show;
            confirmBtn.innerHTML = show 
                ? '<i class="fas fa-spinner fa-spin"></i> 上传中...' 
                : '<i class="fas fa-check"></i> 确认上传';
        }
    }

    /**
     * 加载武器3D模型
     */
    async loadWeaponModels(weaponId) {
        console.log('开始加载武器3D模型，武器ID:', weaponId);
        
        const modelsGrid = document.getElementById('weaponModelsGrid');
        if (!modelsGrid) {
            console.error('找不到weaponModelsGrid元素');
            return;
        }

        // 显示加载状态
        modelsGrid.innerHTML = `
            <div class="loading-models">
                <i class="fas fa-spinner fa-spin"></i>
                <span>正在加载3D模型...</span>
            </div>
        `;

        try {
            const apiUrl = `http://localhost:3001/api/weapon-models/weapon/${weaponId}`;
            console.log('请求API:', apiUrl);
            
            const response = await fetch(apiUrl);
            console.log('API响应状态:', response.status, response.statusText);
            
            const result = await response.json();
            console.log('API响应数据:', result);

            if (result.success) {
                this.models = result.data;
                console.log('加载到的模型数量:', this.models.length);
                this.renderModelsGrid();
            } else {
                console.error('API返回错误:', result.message);
                this.showMessage(result.message || '加载3D模型失败', 'error');
                modelsGrid.innerHTML = `
                    <div class="no-models">
                        <i class="fas fa-cube"></i>
                        <p>加载3D模型失败: ${result.message || '未知错误'}</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('加载武器3D模型失败:', error);
            this.showMessage('加载3D模型失败，请检查网络连接', 'error');
            modelsGrid.innerHTML = `
                <div class="no-models">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>网络错误，无法加载3D模型</p>
                    <small>错误详情: ${error.message}</small>
                </div>
            `;
        }
    }

    /**
     * 渲染3D模型网格
     */
    renderModelsGrid() {
        const modelsGrid = document.getElementById('weaponModelsGrid');
        if (!modelsGrid) return;

        if (this.models.length === 0) {
            modelsGrid.innerHTML = `
                <div class="no-models">
                    <i class="fas fa-cube"></i>
                    <p>暂无3D模型</p>
                    <small>点击"管理3D模型"按钮上传模型文件</small>
                </div>
            `;
            return;
        }

        const modelsHtml = this.models.map(model => this.createModelItemHtml(model)).join('');
        modelsGrid.innerHTML = modelsHtml;

        // 绑定模型项事件
        this.bindModelItemEvents();
    }

    /**
     * 创建3D模型项HTML
     */
    createModelItemHtml(model) {
        const formatSize = this.formatFileSize(model.file_size);
        const uploadDate = new Date(model.created_at).toLocaleDateString();
        
        return `
            <div class="model-item" data-model-id="${model.id}">
                <div class="model-preview" onclick="weaponModelManager.viewModel(${model.id})">
                    <div class="model-format-icon">
                        <i class="fas fa-cube"></i>
                    </div>
                    <div class="model-format-badge">${model.model_format}</div>
                </div>
                <div class="model-info">
                    <div class="model-name" title="${model.original_name}">${model.original_name}</div>
                    <div class="model-description">${model.description || '无描述'}</div>
                    <div class="model-meta">
                        <span>${formatSize}</span>
                        <span>${uploadDate}</span>
                    </div>
                    <div class="model-actions">
                        <button class="model-action-btn view" onclick="weaponModelManager.viewModel(${model.id})" title="查看3D模型">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="model-action-btn edit" onclick="weaponModelManager.editModel(${model.id})" title="编辑描述">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="model-action-btn delete" onclick="weaponModelManager.deleteModel(${model.id})" title="删除模型">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 绑定模型项事件
     */
    bindModelItemEvents() {
        // 事件已在HTML中通过onclick绑定
    }

    /**
     * 查看3D模型
     */
    async viewModel(modelId) {
        console.log('开始查看3D模型，ID:', modelId);
        
        // 显示加载提示
        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'threejs-loading';
        loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:5px;z-index:10000;font-family:Arial,sans-serif;';
        loadingMsg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在初始化3D模型功能...';
        document.body.appendChild(loadingMsg);
        
        try {
            // 确保Three.js库已加载
            console.log('开始加载Three.js库...');
            await this.ensureThreeJSLoaded();
            console.log('Three.js库加载完成');
            
            // 移除加载提示
            if (document.getElementById('threejs-loading')) {
                document.getElementById('threejs-loading').remove();
            }
            
            let model = this.models.find(m => m.id === modelId);
            
            // 如果在当前models数组中找不到，尝试从服务器获取
            if (!model) {
                console.log('在本地缓存中未找到模型，从服务器获取...');
                try {
                    const response = await fetch(`http://localhost:3001/api/weapon-models/weapon/${this.currentWeaponId}`);
                    const result = await response.json();
                    
                    if (result.success) {
                        this.models = result.data;
                        model = this.models.find(m => m.id === modelId);
                    }
                } catch (error) {
                    console.error('获取模型数据失败:', error);
                }
            }
            
            if (!model) {
                this.showMessage('找不到指定的3D模型', 'error');
                return;
            }
            
            console.log('找到模型数据:', model);
            
            // 创建模型查看器
            this.createModelViewer(model);
            
        } catch (error) {
            console.error('3D模型功能初始化失败:', error);
            
            // 移除加载提示
            if (document.getElementById('threejs-loading')) {
                document.getElementById('threejs-loading').remove();
            }
            
            // 提供更详细的错误信息
            let errorMessage = '3D模型功能初始化失败';
            if (error.message.includes('Three.js')) {
                errorMessage = '3D引擎加载失败，请检查网络连接后重试';
            } else if (error.message.includes('GLTFLoader')) {
                errorMessage = '3D模型加载器初始化失败，请刷新页面重试';
            } else if (error.message.includes('OrbitControls')) {
                errorMessage = '3D控制器初始化失败，请刷新页面重试';
            }
            
            this.showMessage(errorMessage + '技术详情: ' + error.message, 'error');
        }
    }

    /**
     * 确保Three.js库已加载
     */
    async ensureThreeJSLoaded() {
        console.log('开始验证Three.js库...');
        
        // 第一步：确保Three.js核心库已加载
        if (!window.THREE) {
            console.log('Three.js核心库未加载，开始加载...');
            await this.loadThreeJS();
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // 如果还是没有加载成功，尝试备用CDN
        if (!window.THREE) {
            console.log('第一次加载失败，使用备用CDN重新尝试...');
            const backupUrls = [
                'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
                'https://unpkg.com/three@0.128.0/build/three.min.js',
                'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'
            ];
            
            for (const url of backupUrls) {
                try {
                    await this.loadScript(url);
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (window.THREE) {
                        console.log(`Three.js核心库从备用CDN加载成功: ${url}`);
                        break;
                    }
                } catch (error) {
                    console.warn(`备用CDN加载失败 (${url}):`, error);
                }
            }
        }
        
        // 验证核心库
        if (!window.THREE) {
            throw new Error('Three.js核心库加载失败，请检查网络连接');
        }
        
        console.log('Three.js核心库验证成功');
        
        // 确保扩展组件已创建
        if (!window.THREE.GLTFLoader) {
            await this.createGLTFLoader();
        }
        
        if (!window.THREE.OrbitControls) {
            await this.createOrbitControls();
        }
        
        // 最终验证
        console.log('Three.js库验证完成');
        console.log('THREE:', !!window.THREE);
        console.log('GLTFLoader:', !!window.THREE?.GLTFLoader);
        console.log('OrbitControls:', !!window.THREE?.OrbitControls);
        
        // 只有核心库是必需的
        if (!window.THREE) {
            throw new Error('Three.js核心库加载失败');
        }
    }

    /**
     * 创建3D模型查看器
     */
    createModelViewer(model) {
        // 创建模态框HTML
        const modalHtml = `
            <div id="modelViewerModal" class="model-viewer-modal">
                <div class="model-viewer-content">
                    <div class="model-viewer-header">
                        <div class="model-viewer-title">${model.original_name}</div>
                        <button class="model-viewer-close" id="closeModelViewerBtn">&times;</button>
                    </div>
                    <div class="model-viewer-body">
                        <div class="model-canvas-container">
                            <canvas id="modelCanvas" class="model-canvas"></canvas>
                        </div>
                        <div class="model-controls">
                            <button class="model-control-btn" onclick="weaponModelManager.resetModelView()" title="重置相机视角到初始位置">
                                <i class="fas fa-redo"></i> 重置视角
                            </button>
                            <button class="model-control-btn" onclick="weaponModelManager.toggleWireframe()" title="切换线框模式">
                                <i class="fas fa-project-diagram"></i> 线框模式
                            </button>
                            <button class="model-control-btn" onclick="weaponModelManager.toggleAutoRotate()" title="开启/关闭自动旋转">
                                <i class="fas fa-sync-alt"></i> 自动旋转
                            </button>
                            <button class="model-control-btn" onclick="weaponModelManager.toggleBackground()" title="切换背景颜色">
                                <i class="fas fa-adjust"></i> 切换背景
                            </button>
                            <button class="model-control-btn" onclick="weaponModelManager.toggleGrid()" title="显示/隐藏网格">
                                <i class="fas fa-th"></i> 网格地面
                            </button>
                        </div>
                        <div class="model-info-panel">
                            <h4>模型信息</h4>
                            <p><strong>格式:</strong> ${model.model_format}</p>
                            <p><strong>大小:</strong> ${this.formatFileSize(model.file_size)}</p>
                            <p><strong>上传时间:</strong> ${new Date(model.created_at).toLocaleString()}</p>
                            ${model.description ? `<p><strong>描述:</strong> ${model.description}</p>` : ''}
                            <div class="model-tips" style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 12px; color: #999;">
                                <strong>操作提示：</strong><br>
                                • 左键拖动：旋转模型<br>
                                • 滚轮：缩放视图（支持10倍缩放）<br>
                                • 右键拖动：平移视图<br>
                                • ESC键：关闭查看器
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 显示模态框
        const modal = document.getElementById('modelViewerModal');
        modal.style.display = 'block';

        // 绑定关闭按钮事件
        const closeBtn = document.getElementById('closeModelViewerBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('🔴 点击关闭按钮');
                this.closeModelViewer();
            });
        }

        // 绑定模态框背景点击事件
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('🔴 点击模态框背景');
                this.closeModelViewer();
            }
        });

        // 绑定ESC键关闭
        this.escKeyHandler = (e) => {
            if (e.key === 'Escape') {
                console.log('🔴 按下ESC键');
                this.closeModelViewer();
            }
        };
        document.addEventListener('keydown', this.escKeyHandler);

        // 初始化3D查看器
        this.initModelViewer(model);
    }

    /**
     * 初始化3D模型查看器
     */
    async initModelViewer(model) {
        // 确保Three.js库完全加载
        try {
            await this.ensureThreeJSLoaded();
        } catch (error) {
            console.error('Three.js库加载失败:', error);
            this.showMessage('3D模型功能初始化失败', 'error');
            return;
        }

        const canvas = document.getElementById('modelCanvas');
        const container = canvas.parentElement;

        // 创建场景 - 使用深色背景增强模型细节
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a); // 深灰色背景
        // 雾效设置：初始使用很大的距离，后续根据模型大小动态调整
        // 参数：near(开始雾化距离), far(完全雾化距离)
        scene.fog = new THREE.Fog(0x1a1a1a, 100, 500); // 大幅增加距离

        // 创建相机
        const camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );

        // 创建渲染器 - 启用更多特性
        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: true,
            alpha: true // 支持透明度
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio); // 高清渲染
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // 色调映射
        renderer.toneMappingExposure = 1.2; // 曝光度
        renderer.outputEncoding = THREE.sRGBEncoding; // 颜色空间

        // 改进光照系统 - 多光源设置
        // 1. 半球光 - 模拟天空和地面的环境光
        const hemisphereLight = new THREE.HemisphereLight(
            0xffffff, // 天空颜色（白色）
            0x444444, // 地面颜色（深灰）
            0.6       // 强度
        );
        scene.add(hemisphereLight);

        // 2. 主光源 - 模拟太阳光
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 50;
        scene.add(mainLight);

        // 3. 补光 - 从另一侧照亮模型
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-5, 5, -5);
        scene.add(fillLight);

        // 4. 背光 - 增强轮廓
        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(0, 3, -10);
        scene.add(backLight);

        // 5. 环境光 - 整体提亮
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        scene.add(ambientLight);

        // 添加网格地面 - 增强空间感
        const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
        gridHelper.position.y = -2;
        scene.add(gridHelper);

        // 添加坐标轴辅助线（可选，用于调试）
        // const axesHelper = new THREE.AxesHelper(5);
        // scene.add(axesHelper);

        // 创建控制器 - 增大缩放范围
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 0.5;   // 最小距离（从1减小到0.5，可以更近距离观察）
        controls.maxDistance = 100;   // 最大距离（从50增加到100，支持10倍缩放）
        controls.autoRotate = false;  // 初始化为false，用户可以通过按钮切换
        controls.autoRotateSpeed = 5.0; // 增加旋转速度（2.0 → 5.0），让效果更明显
        controls.zoomSpeed = 1.2;     // 缩放速度（默认1.0）
        controls.rotateSpeed = 0.5;   // 旋转速度

        // 先保存引用，这样loadModel方法中就能访问到this.modelViewer
        this.modelViewer = {
            scene,
            camera,
            renderer,
            controls,
            model: null,
            wireframe: false,
            lights: {
                hemisphere: hemisphereLight,
                main: mainLight,
                fill: fillLight,
                back: backLight,
                ambient: ambientLight
            }
        };

        // 加载模型
        try {
            await this.loadModel(scene, model, camera, controls);
        } catch (error) {
            console.error('加载3D模型失败:', error);
        }

        // 渲染循环 - 保存animationId以便后续取消
        const animate = () => {
            if (this.modelViewer) {
                this.modelViewer.animationId = requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            }
        };
        animate();

        // 处理窗口大小变化
        const handleResize = () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);
    }

    /**
     * 加载3D模型
     */
    async loadModel(scene, modelData, camera, controls) {
        const modelUrl = `http://localhost:3001/api/weapon-models/file/${modelData.filename}`;
        
        console.log('尝试加载3D模型:', modelUrl);
        console.log('模型数据:', modelData);
        
        // 首先测试URL是否可访问
        try {
            const testResponse = await fetch(modelUrl, { 
                method: 'HEAD',
                mode: 'cors',
                credentials: 'omit'
            });
            if (!testResponse.ok) {
                // 如果HEAD请求失败，尝试GET请求
                const getResponse = await fetch(modelUrl, {
                    method: 'GET',
                    mode: 'cors',
                    credentials: 'omit'
                });
                if (!getResponse.ok) {
                    throw new Error(`模型文件不可访问: ${getResponse.status} ${getResponse.statusText}`);
                }
            }
            console.log('模型文件URL验证成功');
        } catch (error) {
            console.error('模型文件URL验证失败:', error);
            // 显示更详细的错误信息
            this.createErrorPlaceholder(scene, camera, `文件访问失败: ${error.message}
请检查文件是否存在`);
            return;
        }
        
        if (modelData.model_format === 'GLB' || modelData.model_format === 'GLTF') {
            // 检查GLTFLoader是否可用
            if (!window.THREE || !window.THREE.GLTFLoader) {
                console.warn('GLTFLoader不可用，显示占位符');
                this.createInfoPlaceholder(scene, camera, 'GLTFLoader不可用，请刷新页面重试');
                return;
            }
            
            // 使用GLTFLoader加载GLB/GLTF模型
            const loader = new THREE.GLTFLoader();
            
            return new Promise((resolve, reject) => {
                // 设置超时
                const timeoutId = setTimeout(() => {
                    console.error('模型加载超时');
                    this.createErrorPlaceholder(scene, camera, '模型加载超时（30秒），请检查网络连接或文件大小');
                    resolve(null);
                }, 30000);
                
                loader.load(
                    modelUrl,
                    (gltf) => {
                        clearTimeout(timeoutId);
                        console.log('GLTF模型加载成功:', gltf);
                        const model = gltf.scene;
                        
                        // 先将模型添加到场景，然后立即计算边界框
                        scene.add(model);
                        
                        // 计算模型的准确边界框
                        const box = new THREE.Box3().setFromObject(model);
                        const center = box.getCenter(new THREE.Vector3());
                        const size = box.getSize(new THREE.Vector3());
                        
                        console.log('📦 模型边界框信息:');
                        console.log('  中心点:', center);
                        console.log('  尺寸:', size);
                        console.log('  边界:', { min: box.min, max: box.max });
                        
                        // 将模型移动到原点（以中心为基准）
                        model.position.x = -center.x;
                        model.position.y = -center.y;
                        model.position.z = -center.z;
                        
                        // 重新计算移动后的边界框
                        box.setFromObject(model);
                        const newCenter = box.getCenter(new THREE.Vector3());
                        const newMin = box.min;
                        const newMax = box.max;
                        
                        console.log('📦 调整后模型中心:', newCenter);
                        console.log('📦 调整后边界:', { min: newMin, max: newMax });
                        
                        // 🔵 使用包围球算法 - 更准确的相机定位
                        const boundingSphere = new THREE.Sphere();
                        box.getBoundingSphere(boundingSphere);
                        const sphereRadius = boundingSphere.radius;
                        
                        console.log('🔵 包围球半径:', sphereRadius);
                        console.log('🔵 包围球中心:', boundingSphere.center);
                        
                        // 调整网格地面位置 - 放在模型最低点下方
                        const gridHelper = scene.children.find(child => child.type === 'GridHelper');
                        if (gridHelper) {
                            gridHelper.position.y = newMin.y - 1.0; // 增加到1.0单位
                            console.log('🏁 网格地面位置:', gridHelper.position.y);
                        }
                        
                        // 🎯 通用相机定位算法 - 简单且保守
                        const maxDim = Math.max(size.x, size.y, size.z);
                        console.log('📏 模型最大尺寸:', maxDim);
                        
                        // 确保模型尺寸有效
                        if (maxDim === 0 || !isFinite(maxDim) || sphereRadius === 0 || !isFinite(sphereRadius)) {
                            console.warn('⚠️ 模型尺寸无效，使用默认相机位置');
                            camera.position.set(10, 10, 10);
                            camera.lookAt(0, 0, 0);
                            controls.target.set(0, 0, 0);
                        } else {
                            // 📷 方法1: 基于包围球的简单算法（最保守）
                            // 相机距离 = 包围球半径 × 5倍（非常保守的系数）
                            const method1Distance = sphereRadius * 5;
                            
                            // 📷 方法2: 基于FOV的精确算法
                            const fov = camera.fov * (Math.PI / 180);
                            const method2Distance = sphereRadius / Math.sin(fov / 2) * 1.5;
                            
                            // 📷 方法3: 基于边界框对角线
                            const diagonal = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
                            const method3Distance = diagonal * 2;
                            
                            console.log('📐 三种算法距离:', {
                                method1: method1Distance,
                                method2: method2Distance,
                                method3: method3Distance
                            });
                            
                            // 🔒 选择最大值，确保绝对能看到完整模型
                            let cameraDistance = Math.max(method1Distance, method2Distance, method3Distance);
                            
                            // 设置最小距离为5，避免相机太近
                            cameraDistance = Math.max(5, Math.min(cameraDistance, 200));
                            
                            console.log('✅ 最终相机距离:', cameraDistance);
                            
                            // 🎯 相机位置：使用等距离的45度角位置（简单且稳定）
                            const distance = cameraDistance;
                            const angle = Math.PI / 4; // 45度
                            
                            camera.position.set(
                                distance * 0.7,  // x: cos(45°) ≈ 0.707
                                distance * 0.7,  // y: 等高观察
                                distance * 0.7   // z: sin(45°) ≈ 0.707
                            );
                            
                            // 相机看向原点（模型中心）
                            camera.lookAt(0, 0, 0);
                            
                            // 设置控制器目标为原点
                            controls.target.set(0, 0, 0);
                            controls.update();
                            
                            // 🌫️ 动态调整雾效距离 - 根据相机距离计算
                            // near = 相机距离 × 2（在相机后面才开始雾化）
                            // far = 相机距离 × 5（非常远才完全雾化）
                            const fogNear = distance * 2;
                            const fogFar = distance * 5;
                            scene.fog.near = fogNear;
                            scene.fog.far = fogFar;
                            
                            console.log('🌫️ 雾效距离:', { near: fogNear, far: fogFar });
                            
                            console.log('📷 相机位置:', camera.position);
                            console.log('🎯 控制器目标:', controls.target);
                            console.log('📏 相机到模型中心距离:', camera.position.length().toFixed(2));
                        }
                        
                        // 确保this.modelViewer存在后再设置model
                        if (this.modelViewer) {
                            this.modelViewer.model = model;
                            // 保存初始相机位置和目标，用于重置视角
                            this.modelViewer.initialCameraPosition = camera.position.clone();
                            this.modelViewer.initialControlsTarget = controls.target.clone();
                        }
                        
                        console.log('✅ 模型加载和相机设置完成');
                        resolve(model);
                    },
                    (progress) => {
                        if (progress.total > 0) {
                            const percent = (progress.loaded / progress.total * 100).toFixed(1);
                            console.log('加载进度:', percent + '%');
                        }
                    },
                    (error) => {
                        clearTimeout(timeoutId);
                        console.error('加载GLB/GLTF模型失败:', error);
                        console.error('错误详情:', error.message);
                        
                        // 如果GLTFLoader加载失败，创建一个基本的占位符模型
                        console.log('GLTFLoader加载失败，创建占位符模型');
                        try {
                            const group = new THREE.Group();
                            
                            // 创建一个基本的武器形状作为占位符
                            const mainGeometry = new THREE.BoxGeometry(2, 0.3, 0.15);
                            const mainMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
                            const mainMesh = new THREE.Mesh(mainGeometry, mainMaterial);
                            group.add(mainMesh);
                            
                            // 创建枪管
                            const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
                            const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
                            const barrelMesh = new THREE.Mesh(barrelGeometry, barrelMaterial);
                            barrelMesh.rotation.z = Math.PI / 2;
                            barrelMesh.position.set(1.1, 0, 0);
                            group.add(barrelMesh);
                            
                            scene.add(group);
                            
                            // 调整相机位置
                            camera.position.set(4, 2, 4);
                            camera.lookAt(0, 0, 0);
                            controls.target.set(0, 0, 0);
                            
                            if (this.modelViewer) {
                                this.modelViewer.model = group;
                            }
                            
                            console.log('占位符模型创建成功');
                            resolve(group);
                        } catch (placeholderError) {
                            console.error('创建占位符模型也失败:', placeholderError);
                            this.createErrorPlaceholder(scene, camera, `模型加载失败: ${error.message}`);
                            resolve(null);
                        }
                    }
                );
            });
        } else {
            // 对于其他格式，显示信息占位符
            this.createInfoPlaceholder(scene, camera, `暂不支持 ${modelData.model_format} 格式
仅支持 GLB/GLTF 格式`);
        }
    }

    /**
     * 创建信息占位符
     */
    createInfoPlaceholder(scene, camera, message) {
        // 创建一个蓝色的立方体作为占位符
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        // 添加文字纹理
        this.addTextToPlaceholder(cube, message, 0x4CAF50);
        
        camera.position.set(5, 5, 5);
        camera.lookAt(0, 0, 0);
        
        if (this.modelViewer) {
            this.modelViewer.model = cube;
        }
    }

    /**
     * 创建错误占位符
     */
    createErrorPlaceholder(scene, camera, message) {
        // 创建一个红色的立方体作为占位符
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshLambertMaterial({ color: 0xF44336 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        
        // 添加文字纹理
        this.addTextToPlaceholder(cube, message, 0xF44336);
        
        camera.position.set(5, 5, 5);
        camera.lookAt(0, 0, 0);
        
        if (this.modelViewer) {
            this.modelViewer.model = cube;
        }
    }

    /**
     * 为占位符添加文字
     */
    addTextToPlaceholder(mesh, text, color) {
        // 简单的文字显示，可以在控制台输出
        console.log('占位符信息:', text);
        
        // 可以在这里添加更复杂的文字纹理逻辑
        // 暂时只在控制台显示信息
    }

    /**
     * 重置模型视角
     */
    resetModelView() {
        if (!this.modelViewer) return;
        
        console.log('🔄 重置视角...');
        
        const { camera, controls } = this.modelViewer;
        
        // 如果保存了初始位置，直接使用
        if (this.modelViewer.initialCameraPosition && this.modelViewer.initialControlsTarget) {
            camera.position.copy(this.modelViewer.initialCameraPosition);
            controls.target.copy(this.modelViewer.initialControlsTarget);
            camera.lookAt(controls.target);
            controls.update();
            
            console.log('✅ 已重置到初始视角');
            this.showMessage('已重置到初始视角', 'success');
        } else {
            // 如果没有保存的初始位置，重新计算
            console.log('⚠️ 没有保存的初始位置，重新计算...');
            const { model, scene } = this.modelViewer;
            
            if (model) {
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const min = box.min;
                
                // 使用包围球算法
                const boundingSphere = new THREE.Sphere();
                box.getBoundingSphere(boundingSphere);
                const sphereRadius = boundingSphere.radius;
                
                const maxDim = Math.max(size.x, size.y, size.z);
                
                // 三种算法计算距离
                const method1Distance = sphereRadius * 5;
                const fov = camera.fov * (Math.PI / 180);
                const method2Distance = sphereRadius / Math.sin(fov / 2) * 1.5;
                const diagonal = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
                const method3Distance = diagonal * 2;
                
                // 选择最大值
                let cameraDistance = Math.max(method1Distance, method2Distance, method3Distance);
                cameraDistance = Math.max(5, Math.min(cameraDistance, 200));
                
                // 45度角等距离位置
                const distance = cameraDistance;
                camera.position.set(
                    distance * 0.7,
                    distance * 0.7,
                    distance * 0.7
                );
                
                camera.lookAt(0, 0, 0);
                controls.target.set(0, 0, 0);
                controls.update();
                
                // 调整网格地面位置
                const gridHelper = scene.children.find(child => child.type === 'GridHelper');
                if (gridHelper) {
                    gridHelper.position.y = min.y - 1.0;
                }
                
                console.log('✅ 已重新计算并设置视角');
                this.showMessage('已重置视角', 'success');
            }
        }
    }

    /**
     * 切换线框模式
     */
    toggleWireframe() {
        if (!this.modelViewer || !this.modelViewer.model) return;
        
        this.modelViewer.wireframe = !this.modelViewer.wireframe;
        
        this.modelViewer.model.traverse((child) => {
            if (child.isMesh) {
                child.material.wireframe = this.modelViewer.wireframe;
            }
        });
        
        this.showMessage(
            this.modelViewer.wireframe ? '线框模式已开启' : '线框模式已关闭',
            'info'
        );
    }

    /**
     * 切换自动旋转
     */
    toggleAutoRotate() {
        console.log('🔄 toggleAutoRotate 被调用');
        
        if (!this.modelViewer) {
            console.warn('⚠️ modelViewer 不存在');
            this.showMessage('模型查看器未初始化', 'error');
            return;
        }
        
        if (!this.modelViewer.controls) {
            console.warn('⚠️ controls 不存在');
            this.showMessage('控制器未初始化', 'error');
            return;
        }
        
        // 切换自动旋转状态
        const wasRotating = this.modelViewer.controls.autoRotate;
        this.modelViewer.controls.autoRotate = !wasRotating;
        
        console.log('🔄 自动旋转状态:', {
            之前: wasRotating,
            现在: this.modelViewer.controls.autoRotate,
            旋转速度: this.modelViewer.controls.autoRotateSpeed
        });
        
        this.showMessage(
            this.modelViewer.controls.autoRotate ? '自动旋转已开启' : '自动旋转已关闭',
            'success'
        );
    }

    /**
     * 切换背景颜色
     */
    toggleBackground() {
        if (!this.modelViewer || !this.modelViewer.scene) return;
        
        const scene = this.modelViewer.scene;
        const currentColor = scene.background.getHex();
        
        // 在三种背景之间切换
        if (currentColor === 0x1a1a1a) {
            // 深灰 -> 中灰
            scene.background.setHex(0x808080);
            scene.fog.color.setHex(0x808080);
            this.showMessage('已切换到中灰背景', 'info');
        } else if (currentColor === 0x808080) {
            // 中灰 -> 浅灰
            scene.background.setHex(0xf0f0f0);
            scene.fog.color.setHex(0xf0f0f0);
            this.showMessage('已切换到浅灰背景', 'info');
        } else {
            // 浅灰 -> 深灰
            scene.background.setHex(0x1a1a1a);
            scene.fog.color.setHex(0x1a1a1a);
            this.showMessage('已切换到深灰背景', 'info');
        }
    }

    /**
     * 切换网格显示
     */
    toggleGrid() {
        if (!this.modelViewer || !this.modelViewer.scene) return;
        
        const scene = this.modelViewer.scene;
        
        // 查找网格对象
        let gridHelper = null;
        scene.children.forEach(child => {
            if (child.type === 'GridHelper') {
                gridHelper = child;
            }
        });
        
        if (gridHelper) {
            gridHelper.visible = !gridHelper.visible;
            this.showMessage(
                gridHelper.visible ? '网格已显示' : '网格已隐藏',
                'info'
            );
        }
    }

    /**
     * 关闭模型查看器
     */
    closeModelViewer() {
        console.log('🔴 关闭模型查看器...');
        
        // 移除ESC键监听
        if (this.escKeyHandler) {
            document.removeEventListener('keydown', this.escKeyHandler);
            this.escKeyHandler = null;
        }
        
        // 清理Three.js资源
        if (this.modelViewer) {
            // 停止渲染循环
            if (this.modelViewer.animationId) {
                cancelAnimationFrame(this.modelViewer.animationId);
            }
            
            // 释放渲染器
            if (this.modelViewer.renderer) {
                this.modelViewer.renderer.dispose();
                this.modelViewer.renderer.forceContextLoss();
                this.modelViewer.renderer = null;
            }
            
            // 清理场景
            if (this.modelViewer.scene) {
                this.modelViewer.scene.traverse((object) => {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
            }
            
            // 清空引用
            this.modelViewer = null;
        }
        
        // 移除模态框
        const modal = document.getElementById('modelViewerModal');
        if (modal) {
            modal.remove();
        }
        
        console.log('✅ 模型查看器已关闭');
    }

    /**
     * 编辑3D模型
     */
    async editModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;

        const newDescription = prompt('请输入新的模型描述:', model.description || '');
        if (newDescription === null) return; // 用户取消

        try {
            const response = await fetch(`http://localhost:3001/api/weapon-models/${modelId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: newDescription
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('模型描述更新成功', 'success');
                await this.loadWeaponModels(this.currentWeaponId);
            } else {
                this.showMessage(result.message || '更新失败', 'error');
            }
        } catch (error) {
            console.error('更新模型描述失败:', error);
            this.showMessage('更新失败，请检查网络连接', 'error');
        }
    }

    /**
     * 删除3D模型
     */
    async deleteModel(modelId) {
        const model = this.models.find(m => m.id === modelId);
        if (!model) return;

        if (!confirm(`确定要删除3D模型"${model.original_name}"吗？此操作不可撤销。`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/weapon-models/${modelId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('3D模型删除成功', 'success');
                await this.loadWeaponModels(this.currentWeaponId);
            } else {
                this.showMessage(result.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除3D模型失败:', error);
            this.showMessage('删除失败，请检查网络连接', 'error');
        }
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'info') {
        const messageDiv = document.getElementById('modelMessage');
        if (messageDiv) {
            messageDiv.className = `model-message ${type}`;
            messageDiv.textContent = message;
            messageDiv.style.display = 'block';

            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 创建全局实例
const weaponModelManager = new WeaponModelManager();

// 导出到全局作用域
window.weaponModelManager = weaponModelManager;