// 武器图片显示功能
class WeaponImageDisplay {
    constructor() {
        this.init();
    }

    init() {
        // 监听知识图谱节点点击事件
        document.addEventListener('weaponNodeClicked', (event) => {
            const weaponData = event.detail;
            this.addImageButtonToNodeDetails(weaponData);
        });
    }

    // 在节点详情中添加图片按钮
    addImageButtonToNodeDetails(weaponData) {
        const nodeDetails = document.getElementById('nodeDetails');
        if (!nodeDetails) return;

        // 检查是否已经有图片按钮
        const existingButton = nodeDetails.querySelector('.weapon-image-btn');
        if (existingButton) {
            existingButton.remove();
        }

        // 创建图片按钮
        const imageButton = document.createElement('button');
        imageButton.className = 'weapon-image-btn btn-primary';
        imageButton.innerHTML = '<i class="fas fa-images"></i> 查看武器图片';
        imageButton.style.marginTop = '15px';
        imageButton.style.width = '100%';

        // 添加点击事件
        imageButton.addEventListener('click', () => {
            this.showWeaponImages(weaponData);
        });

        // 添加到节点详情末尾
        nodeDetails.appendChild(imageButton);
    }

    // 显示武器图片
    async showWeaponImages(weaponData) {
        try {
            // 使用全局的武器图片模态框
            if (window.weaponImageModal) {
                await window.weaponImageModal.show(weaponData.id, weaponData.name);
            } else {
                console.error('武器图片模态框未初始化');
                alert('图片功能暂时不可用，请刷新页面重试');
            }
        } catch (error) {
            console.error('显示武器图片失败:', error);
            alert('显示武器图片失败: ' + error.message);
        }
    }

    // 在知识图谱中为武器节点添加图片图标
    static addImageIconToWeaponNodes() {
        // 这个方法可以在知识图谱渲染时调用，为武器节点添加图片图标
        const weaponNodes = document.querySelectorAll('.node[data-type="Weapon"]');
        
        weaponNodes.forEach(node => {
            // 检查是否已经有图片图标
            if (node.querySelector('.weapon-image-icon')) return;

            // 创建图片图标
            const imageIcon = document.createElement('div');
            imageIcon.className = 'weapon-image-icon';
            imageIcon.innerHTML = '<i class="fas fa-camera"></i>';
            imageIcon.title = '点击查看武器图片';
            
            // 添加样式
            imageIcon.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                width: 20px;
                height: 20px;
                background: #007bff;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                cursor: pointer;
                z-index: 10;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;

            // 添加悬停效果
            imageIcon.addEventListener('mouseenter', () => {
                imageIcon.style.transform = 'scale(1.1)';
                imageIcon.style.background = '#0056b3';
            });

            imageIcon.addEventListener('mouseleave', () => {
                imageIcon.style.transform = 'scale(1)';
                imageIcon.style.background = '#007bff';
            });

            // 添加点击事件
            imageIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const weaponData = {
                    id: node.dataset.weaponId,
                    name: node.dataset.weaponName || node.textContent.trim()
                };
                
                if (window.weaponImageModal) {
                    window.weaponImageModal.show(weaponData.id, weaponData.name);
                }
            });

            node.style.position = 'relative';
            node.appendChild(imageIcon);
        });
    }
}

// 初始化武器图片显示功能
window.weaponImageDisplay = new WeaponImageDisplay();

// 为知识图谱提供的辅助函数
window.triggerWeaponNodeClick = function(weaponData) {
    const event = new CustomEvent('weaponNodeClicked', {
        detail: weaponData
    });
    document.dispatchEvent(event);
};