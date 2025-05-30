// 武器识别功能脚本
document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const uploadButton = document.getElementById('uploadButton');
    const cameraButton = document.getElementById('cameraButton');
    const recognizeButton = document.getElementById('recognizeButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const noResult = document.getElementById('noResult');
    const weaponInfo = document.getElementById('weaponInfo');
    const relatedWeapons = document.getElementById('relatedWeapons');
    const viewKnowledgeButton = document.getElementById('viewKnowledgeButton');
    
    // 摄像头相关元素
    const cameraModal = document.getElementById('cameraModal');
    const cameraPreview = document.getElementById('cameraPreview');
    const closeCameraModal = document.getElementById('closeCameraModal');
    const captureCameraButton = document.getElementById('captureCameraButton');
    const confirmCaptureButton = document.getElementById('confirmCaptureButton');
    const captureCanvas = document.getElementById('captureCanvas');
    
    // 结果显示元素
    const weaponNameText = document.getElementById('weaponNameText');
    const confidenceValue = document.getElementById('confidenceValue');
    const weaponTypeValue = document.getElementById('weaponTypeValue');
    const weaponCountryValue = document.getElementById('weaponCountryValue');
    const weaponYearValue = document.getElementById('weaponYearValue');
    const weaponManufacturerValue = document.getElementById('weaponManufacturerValue');
    const weaponDescriptionValue = document.getElementById('weaponDescriptionValue');
    const confidenceFill = document.getElementById('confidenceFill');
    const relatedList = document.getElementById('relatedList');
    
    // 状态变量
    let hasImage = false;
    let mediaStream = null;
    let recognizedWeaponId = null;
    
    // 武器数据库 - 实际应用中应从后端API获取
    const weaponsDatabase = [
        {
            id: '10',
            name: 'F-22猛禽',
            type: '战斗机',
            country: '美国',
            year: '2005',
            manufacturer: '洛克希德·马丁',
            description: 'F-22"猛禽"是美国洛克希德·马丁公司研制的单座双发高隐身性第五代战斗机。它集强大的隐身性能、超音速巡航能力、超机动性和先进的航空电子设备于一体，被认为是世界上最先进的空优战斗机之一。',
            imageUrl: 'images/weapons/f22.jpg',
            related: ['38', '11', '12']
        },
        {
            id: '11',
            name: 'Su-57',
            type: '战斗机',
            country: '俄罗斯',
            year: '2020',
            manufacturer: '苏霍伊设计局',
            description: 'Su-57是俄罗斯研发的第五代多用途战斗机，具有高度的隐身性、超音速巡航能力、超机动性和先进的航空电子系统。它配备有先进的雷达系统和武器装备，可执行空战和对地攻击任务。',
            imageUrl: 'images/weapons/su57.jpg',
            related: ['10', '12', '36']
        },
        {
            id: '12',
            name: 'J-20',
            type: '战斗机',
            country: '中国',
            year: '2017',
            manufacturer: '成都飞机工业集团',
            description: 'J-20"威龙"是中国自主研发的第五代隐身战斗机，具有高度的隐身性能、超音速巡航能力和先进的航电系统。它配备有先进的有源相控阵雷达和空对空导弹，主要执行空中优势和远程拦截任务。',
            imageUrl: 'images/weapons/j20.jpg',
            related: ['10', '11', '37']
        },
        {
            id: '3',
            name: 'T-72',
            type: '坦克',
            country: '俄罗斯',
            year: '1971',
            manufacturer: '卡拉什尼科夫公司',
            description: 'T-72是苏联设计的第二代主战坦克，自1971年开始生产，是20世纪最广泛使用的坦克之一。它配备了125毫米滑膛炮，采用自动装弹机，具有较好的机动性和防护性能。现已升级多个版本，仍在全球范围内服役。',
            imageUrl: 'images/weapons/t72.jpg',
            related: ['14', '31', '32']
        },
        {
            id: '1',
            name: 'AK-47',
            type: '自动步枪',
            country: '俄罗斯',
            year: '1947',
            manufacturer: '卡拉什尼科夫公司',
            description: 'AK-47(自动卡拉什尼科夫步枪)是一种由米哈伊尔·季莫费耶维奇·卡拉什尼科夫设计的气动式突击步枪，于1947年在苏联研制。因其可靠性和简易性，已成为全球最广泛使用的突击步枪，被称为"世界上最成功的步枪"。',
            imageUrl: 'images/weapons/ak47.jpg',
            related: ['2', '15', '16']
        },
        {
            id: '2',
            name: 'M16',
            type: '自动步枪',
            country: '美国',
            year: '1964',
            manufacturer: '柯尔特公司',
            description: 'M16是美国军队采用的制式步枪，于1960年代投入使用。它使用5.56×45mm北约弹药，具有轻量化设计和高速射击能力。M16及其变种已成为西方世界最常见的服役步枪之一。',
            imageUrl: 'images/weapons/m16.jpg',
            related: ['1', '15', '16']
        }
    ];
    
    // 上传区域点击事件
    uploadArea.addEventListener('click', function() {
        fileInput.click();
    });
    
    // 拖放功能
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('upload-area-active');
    });
    
    uploadArea.addEventListener('dragleave', function() {
        this.classList.remove('upload-area-active');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('upload-area-active');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageFile(file);
        }
    });
    
    // 文件选择处理
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            handleImageFile(this.files[0]);
        }
    });
    
    // 上传按钮点击事件
    uploadButton.addEventListener('click', function() {
        fileInput.click();
    });
    
    // 摄像头按钮点击事件
    cameraButton.addEventListener('click', function() {
        openCameraModal();
    });
    
    // 识别按钮点击事件
    recognizeButton.addEventListener('click', function() {
        startRecognition();
    });
    
    // 关闭摄像头模态框
    closeCameraModal.addEventListener('click', function() {
        closeCameraAndModal();
    });
    
    // 拍摄按钮
    captureCameraButton.addEventListener('click', function() {
        captureImage();
    });
    
    // 确认使用拍摄的图像
    confirmCaptureButton.addEventListener('click', function() {
        useCapturedImage();
    });
    
    // 查看知识图谱按钮
    viewKnowledgeButton.addEventListener('click', function() {
        if (recognizedWeaponId) {
            // 跳转到知识图谱页面并高亮显示该武器
            window.location.href = `knowledge-graph.html?highlight=${recognizedWeaponId}`;
        }
    });
    
    // 处理图像文件
    function handleImageFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            hasImage = true;
            recognizeButton.disabled = false;
        };
        
        reader.readAsDataURL(file);
    }
    
    // 开启摄像头模态框
    function openCameraModal() {
        cameraModal.style.display = 'flex';
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then(function(stream) {
                    mediaStream = stream;
                    cameraPreview.srcObject = stream;
                })
                .catch(function(error) {
                    console.error('摄像头访问失败:', error);
                    alert('无法访问摄像头，请检查权限或使用其他方式上传图片。');
                    closeCameraAndModal();
                });
        } else {
            alert('您的浏览器不支持摄像头功能，请使用其他方式上传图片。');
            closeCameraAndModal();
        }
    }
    
    // 关闭摄像头和模态框
    function closeCameraAndModal() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => {
                track.stop();
            });
            mediaStream = null;
        }
        
        cameraModal.style.display = 'none';
        confirmCaptureButton.style.display = 'none';
        captureCameraButton.style.display = 'block';
    }
    
    // 拍摄图像
    function captureImage() {
        const context = captureCanvas.getContext('2d');
        captureCanvas.width = cameraPreview.videoWidth;
        captureCanvas.height = cameraPreview.videoHeight;
        context.drawImage(cameraPreview, 0, 0, captureCanvas.width, captureCanvas.height);
        
        // 显示确认按钮，隐藏拍摄按钮
        confirmCaptureButton.style.display = 'block';
        captureCameraButton.style.display = 'none';
    }
    
    // 使用拍摄的图像
    function useCapturedImage() {
        const imageDataUrl = captureCanvas.toDataURL('image/png');
        imagePreview.src = imageDataUrl;
        imagePreview.style.display = 'block';
        hasImage = true;
        recognizeButton.disabled = false;
        closeCameraAndModal();
    }
    
    // 开始识别
    function startRecognition() {
        if (!hasImage) return;
        
        // 显示加载指示器
        loadingIndicator.style.display = 'flex';
        noResult.style.display = 'none';
        weaponInfo.style.display = 'none';
        relatedWeapons.style.display = 'none';
        viewKnowledgeButton.style.display = 'none';
        
        // 模拟API调用
        setTimeout(function() {
            // 模拟识别 - 随机选择一个武器作为识别结果
            const randomIndex = Math.floor(Math.random() * weaponsDatabase.length);
            const recognizedWeapon = weaponsDatabase[randomIndex];
            
            // 模拟置信度 - 70% 到 99% 之间的随机值
            const confidence = Math.floor(Math.random() * 30) + 70;
            
            // 显示识别结果
            displayRecognitionResult(recognizedWeapon, confidence);
            
            // 隐藏加载指示器
            loadingIndicator.style.display = 'none';
        }, 2000); // 模拟2秒的识别时间
    }
    
    // 显示识别结果
    function displayRecognitionResult(weapon, confidence) {
        // 存储识别的武器ID
        recognizedWeaponId = weapon.id;
        
        // 填充武器信息
        weaponNameText.textContent = weapon.name;
        confidenceValue.textContent = confidence + '%';
        weaponTypeValue.textContent = weapon.type;
        weaponCountryValue.textContent = weapon.country;
        weaponYearValue.textContent = weapon.year;
        weaponManufacturerValue.textContent = weapon.manufacturer;
        weaponDescriptionValue.textContent = weapon.description;
        
        // 设置置信度条
        confidenceFill.style.width = confidence + '%';
        
        // 显示相关武器
        displayRelatedWeapons(weapon.related);
        
        // 显示结果区域
        weaponInfo.style.display = 'block';
        relatedWeapons.style.display = 'block';
        viewKnowledgeButton.style.display = 'block';
    }
    
    // 显示相关武器
    function displayRelatedWeapons(relatedIds) {
        // 清空相关列表
        relatedList.innerHTML = '';
        
        // 添加相关武器
        relatedIds.forEach(id => {
            const relatedWeapon = weaponsDatabase.find(weapon => weapon.id === id);
            if (relatedWeapon) {
                const relatedItem = document.createElement('div');
                relatedItem.className = 'related-item';
                relatedItem.innerHTML = `
                    <div style="height: 100px; background-color: #1e2736; display: flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden;">
                        <i class="fas fa-fighter-jet" style="font-size: 2rem; color: var(--secondary-color);"></i>
                    </div>
                    <div class="related-item-name">${relatedWeapon.name}</div>
                `;
                
                // 点击相关武器时显示其详情
                relatedItem.addEventListener('click', function() {
                    displayRecognitionResult(relatedWeapon, 100);
                });
                
                relatedList.appendChild(relatedItem);
            }
        });
    }
    
    // 创建武器装备图片目录
    function createWeaponImagesDirectory() {
        console.log('在实际应用中，这个函数会在服务器上创建必要的目录来存储武器图片');
        // 实际应用中，这个函数会在服务器上创建必要的目录来存储武器图片
        // 由于这是前端代码，这里只是一个占位函数
    }
    
    // 模拟YOLOv8识别过程
    function simulateYOLOv8Recognition(imageData) {
        console.log('在实际应用中，这个函数会调用后端API进行YOLOv8模型推理');
        // 在实际实现中，这个函数会将图像数据发送到后端API
        // 后端会使用YOLOv8模型进行推理，并返回识别结果
        // 由于这是前端代码，这里只是一个占位函数
        return {
            success: true,
            weaponId: '1', // 示例ID
            confidence: 95.5
        };
    }
    
    // 初始化
    createWeaponImagesDirectory();
}); 