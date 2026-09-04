/**
 * 中国地图可视化模块
 * 基于ECharts实现中国地图，展示药材产地分布
 */

class WorldMapVisualization {
    constructor() {
        this.chart = null;
        this.chartDom = null;
        this.isInitialized = false;
        this.regionData = [];
        this.chinaMap = null;
        this.dataSourceStatus = '初始化中...';
    }

    /**
     * 初始化地图可视化（可重复进入）
     */
    async initialize() {
        try {
            console.log('开始初始化中国地图可视化模块...');

            const mapVisualizationElement = document.getElementById('map-visualization');
            const mapContainerElement = document.getElementById('map-container');

            if (!mapVisualizationElement || !mapContainerElement) {
                throw new Error('地图容器未找到');
            }

            mapContainerElement.style.display = 'block';
            mapVisualizationElement.style.display = 'block';

            // 检查ECharts是否可用
            if (typeof echarts === 'undefined') {
                throw new Error('ECharts库未加载');
            }

            // 如果已有图表实例，先销毁再重建（避免重复init报错）
            if (this.chart) {
                this.chart.dispose();
                this.chart = null;
            }

            // 清理容器（尺寸由 CSS .map-container/.map-visualization 控制，随地图卡片自适应）
            mapVisualizationElement.innerHTML = '';
            mapVisualizationElement.style.width = '100%';
            mapVisualizationElement.style.height = '100%';

            // 地图已注册则跳过重复注册
            if (!this.chinaMap) {
                await this.loadChinaMap();
            }

            // 产地数据已加载则跳过
            if (this.regionData.length === 0) {
                await this.loadRegionData();
            }

            // 创建图表（等容器渲染后初始化）
            this.chartDom = mapVisualizationElement;
            this.chart = echarts.init(this.chartDom);
            this.renderChart();
            setTimeout(() => { if (this.chart) this.chart.resize(); }, 100);

            // 窗口尺寸变化时自适应（仅容器可见时）
            window.addEventListener('resize', () => {
                const mapContainerElement = document.getElementById('map-container');
                if (this.chart && mapContainerElement && mapContainerElement.style.display === 'block') {
                    this.chart.resize();
                }
            });

            this.isInitialized = true;
            this.dataSourceStatus = '已加载';
            console.log('中国地图可视化模块初始化完成');

            if (window.knowledgeGraph) {
                window.knowledgeGraph.onMapReady();
            }

        } catch (error) {
            console.error('地图初始化失败:', error);
            this.dataSourceStatus = '加载失败: ' + error.message;
            const viz = document.getElementById('map-visualization');
            if (viz) {
                viz.innerHTML = '<div style="padding:20px;color:#fff;font-size:13px;background:rgba(255,0,0,0.3);border-radius:6px;margin:10px;">地图加载失败: ' + error.message + '</div>';
            }
            throw error;
        }
    }

    /**
     * 加载中国地图GeoJSON
     */
    async loadChinaMap() {
        try {
            const response = await fetch('/public/china.json');
            if (!response.ok) throw new Error('加载中国地图数据失败: HTTP ' + response.status);
            const geoJson = await response.json();

            // 注册到ECharts
            echarts.registerMap('china', geoJson);
            this.chinaMap = geoJson;
            console.log('中国地图注册成功，省份数:', geoJson.features.length);
        } catch (error) {
            console.error('加载中国地图失败:', error);
            throw error;
        }
    }

    /**
     * 从后端加载产地数据
     */
    async loadRegionData() {
        try {
            const response = await fetch('/api/knowledge/region-distribution');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && data.data.regions) {
                    this.regionData = data.data.regions.map(r => ({
                        id: r.id,
                        name: r.name,
                        herbCount: r.herb_count,
                        description: r.description
                    }));
                    console.log('产地数据加载完成:', this.regionData.length, '个省份');
                    return;
                }
            }
            throw new Error('获取产地数据失败');
        } catch (error) {
            console.warn('无法从后端获取产地数据:', error);
            // 使用备用数据
            this.regionData = [
                { name: '四川', herbCount: 25 }, { name: '广东', herbCount: 27 },
                { name: '浙江', herbCount: 23 }, { name: '甘肃', herbCount: 8 },
                { name: '吉林', herbCount: 3 }, { name: '云南', herbCount: 2 }
            ];
        }
    }

    /**
     * 渲染中国地图图表
     */
    renderChart() {
        if (!this.chart || !this.regionData) return;

        // 将短省名（四川）映射为地图中的全名（四川省）
        const fullNameMap = {};
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features.forEach(f => {
                const full = f.properties.name || '';
                // 生成短名用于匹配
                let short = full.replace(/省$/, '').replace(/市$/, '')
                    .replace(/壮族自治区$/, '').replace(/维吾尔自治区$/, '')
                    .replace(/回族自治区$/, '').replace(/自治区$/, '');
                fullNameMap[short] = full;
            });
        }

        // 构建省份数据，使用地图中的完整省名
        const mapData = this.regionData.map(r => {
            const fullName = fullNameMap[r.name] || r.name;
            return {
                name: fullName,
                value: r.herbCount,
                description: r.description || ''
            };
        });

        // 给地图中所有省份补默认值（0），确保全部省份着色
        const allProvinceData = [];
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features.forEach(f => {
                const full = f.properties.name || '';
                const existing = mapData.find(m => m.name === full);
                allProvinceData.push(existing || { name: full, value: 0 });
            });
        }

        // 动态色阶上限（广东 32 最高，取数据最大值 + 缓冲）
        const maxValue = Math.max(...this.regionData.map(r => r.herbCount), 0);
        const visualMax = Math.max(30, maxValue + 2);

        const option = {
            backgroundColor: '#e8f1ea',  // 水域浅蓝灰
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(27,67,50,0.94)',
                borderColor: 'rgba(176,137,104,0.45)',
                textStyle: { color: '#F8F1E3', fontSize: 13 },
                formatter: function(params) {
                    if (params.data && params.data.value !== undefined) {
                        return `<b>${params.name}</b><br/>药材数量：${params.data.value} 种`;
                    }
                    return params.name;
                }
            },
            visualMap: {
                type: 'continuous',
                orient: 'vertical',
                min: 0,
                max: visualMax,
                left: 16,
                top: 'center',
                text: ['多', '少'],
                calculable: true,
                itemWidth: 14,
                itemHeight: 130,
                inRange: {
                    // 药材数量少→多：浅米 → 浅绿 → 中绿 → 深绿
                    color: ['#f7f1e1', '#dfeccb', '#aed294', '#79b083', '#2f6a4f']
                },
                textStyle: { color: '#4a5d52', fontSize: 12 },
                handleStyle: { color: '#40916C' }
            },
            series: [{
                name: '药材产地',
                type: 'map',
                map: 'china',
                roam: true,
                zoom: 1.2,
                label: {
                    show: true,
                    fontSize: 11,
                    color: '#3c4f46'
                },
                itemStyle: {
                    borderColor: '#d5e3da',
                    borderWidth: 1
                },
                emphasis: {
                    label: { color: '#1B4332', fontWeight: 'bold', fontSize: 12 },
                    itemStyle: {
                        areaColor: '#2e7d52',
                        shadowBlur: 12,
                        shadowColor: 'rgba(27,67,50,0.35)'
                    }
                },
                data: allProvinceData
            }]
        };

        this.chart.setOption(option);

        // 点击省份显示药材列表
        this.chart.on('click', (params) => {
            if (params.name) {
                this.showRegionDetails(params.name);
            }
        });
    }

    /**
     * 省份名称规范化（四川省→四川，用于匹配产地数据）
     */
    normalizeProvinceName(name) {
        if (!name) return '';
        return name.replace(/省$/, '').replace(/市$/, '')
            .replace(/壮族自治区$/, '').replace(/维吾尔自治区$/, '')
            .replace(/回族自治区$/, '').replace(/自治区$/, '');
    }

    // 省份英文名映射
    provinceEnNames = {
        '北京': 'Beijing', '天津': 'Tianjin', '河北': 'Hebei', '山西': 'Shanxi',
        '内蒙古': 'Inner Mongolia', '辽宁': 'Liaoning', '吉林': 'Jilin',
        '黑龙江': 'Heilongjiang', '上海': 'Shanghai', '江苏': 'Jiangsu',
        '浙江': 'Zhejiang', '安徽': 'Anhui', '福建': 'Fujian', '江西': 'Jiangxi',
        '山东': 'Shandong', '河南': 'Henan', '湖北': 'Hubei', '湖南': 'Hunan',
        '广东': 'Guangdong', '广西': 'Guangxi', '海南': 'Hainan', '重庆': 'Chongqing',
        '四川': 'Sichuan', '贵州': 'Guizhou', '云南': 'Yunnan', '西藏': 'Tibet',
        '陕西': 'Shaanxi', '甘肃': 'Gansu', '青海': 'Qinghai', '宁夏': 'Ningxia',
        '新疆': 'Xinjiang', '台湾': 'Taiwan', '香港': 'Hong Kong', '澳门': 'Macau'
    };

    /**
     * 显示产地详情面板（中药抽屉风格）
     */
    async showRegionDetails(regionName) {
        // 规范化省份名以匹配产地数据（四川省→四川）
        const shortName = this.normalizeProvinceName(regionName);
        const region = this.regionData.find(r => r.name === shortName);

        const panel = document.getElementById('regionDetailsPanel');
        if (!panel) return;

        panel.classList.add('open');
        const layout = document.querySelector('.map-layout');
        if (layout) layout.classList.add('panel-open');
        const body = document.getElementById('regionPanelBody');
        body.innerHTML = `<div class="panel-loading">📜 正在翻阅药典...</div>`;

        // 更新标题
        document.getElementById('panelRegionCn').textContent = shortName;
        document.getElementById('panelRegionEn').textContent = (this.provinceEnNames[shortName] || '') + ' Province';

        try {
            // 获取该产地的药材（使用 Neo4j herbs-manage API，按产地名称查询）
            let herbs = [];
            const response = await fetch(`/api/herbs-manage?region=${encodeURIComponent(shortName)}&limit=100`);
                const result = await response.json();
                herbs = result.data && result.data.herbs ? result.data.herbs : [];

            // 分类统计（按药材分类）
            const catMap = {};
            herbs.forEach(h => {
                if (h.category_name) catMap[h.category_name] = (catMap[h.category_name] || 0) + 1;
            });
            const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

            // 常用药 / 其他
            const commonHerbs = herbs.filter(h => h.is_common);
            const normalHerbs = herbs.filter(h => !h.is_common);

            // 并行获取主要药材的详细信息（功效、性味、归经）
            const detailHerbs = [...commonHerbs, ...normalHerbs].slice(0, 10);
            const details = await Promise.all(detailHerbs.map(async h => {
                try {
                    const r = await fetch(`/api/herbs-manage/${encodeURIComponent(h.name)}`);
                    const d = await r.json();
                    return d.data ? { ...h, ...d.data } : h;
                } catch (e) {
                    return h;
                }
            }));

            // 统计主要功效数
            const effSet = new Set();
            details.forEach(d => (d.efficacies || []).forEach(e => effSet.add(e.name)));
            const mainEffCount = effSet.size || categories.length;
            const herbCount = herbs.length;
            const catCount = categories.length;

            // 其他药材折叠展示（前 12 种，超出显示“展开全部”）
            const NORMAL_LIMIT = 12;
            const normalCollapsed = normalHerbs.length > NORMAL_LIMIT;
            const normalShown = normalCollapsed ? normalHerbs.slice(0, NORMAL_LIMIT) : normalHerbs;
            const normalTagsHtml = normalShown.map(h => `<span class="herb-tag">${h.name}</span>`).join('');
            const normalExpandBtn = normalCollapsed
                ? `<button type="button" class="herb-tag-expand js-expand-herbs" data-count="${normalHerbs.length}">展开全部 ${normalHerbs.length} 种</button>`
                : '';

            // 生成内容
            body.innerHTML = `
                <!-- 药材概况 -->
                <div class="herb-stats">
                    <div class="stat-card">
                        <div class="stat-num">${herbCount}</div>
                        <div class="stat-label">药材总数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-num">${catCount}</div>
                        <div class="stat-label">药材分类</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-num">${mainEffCount}</div>
                        <div class="stat-label">主要功效</div>
                    </div>
                </div>

                <!-- 药材分类 -->
                ${categories.length > 0 ? `
                <div class="panel-section">
                    <h4 class="section-title">🌿 药材分类</h4>
                    <div class="category-tags">
                        ${categories.map(([name, count]) => `
                            <span class="category-tag"><span>${name}</span><b>${count}</b></span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 常用药材 -->
                ${commonHerbs.length > 0 ? `
                <div class="panel-section">
                    <h4 class="section-title star-title">⭐ 常用药材</h4>
                    <div class="herb-tags">
                        ${commonHerbs.map(h => `
                            <span class="herb-tag common">${h.name}</span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 其他药材 -->
                ${normalHerbs.length > 0 ? `
                <div class="panel-section">
                    <h4 class="section-title">🌿 其他药材</h4>
                    <div class="herb-tags">
                        ${normalTagsHtml}
                        ${normalExpandBtn}
                    </div>
                </div>
                ` : ''}

                <!-- 主要药材详情 -->
                ${details.length > 0 ? `
                <div class="panel-section">
                    <h4 class="section-title herb-detail-title">📖 主要药材详情</h4>
                    ${details.map(d => this.buildHerbCard(d)).join('')}
                </div>
                ` : ''}

                ${herbs.length === 0 ? '<p class="panel-empty">暂无药材数据</p>' : ''}
            `;

            // 绑定主要药材卡片点击跳转图谱
            body.querySelectorAll('.herb-card').forEach(card => {
                card.addEventListener('click', () => {
                    const herb = card.getAttribute('data-herb');
                    if (herb) window.location.href = 'knowledge-graph.html?herb=' + encodeURIComponent(herb);
                });
            });

            // 绑定“其他药材”展开/收回事件（展开后显示“收回”，点击恢复折叠）
            const otherSection = Array.from(body.querySelectorAll('.panel-section')).find(s =>
                (s.querySelector('.section-title')?.textContent || '').includes('其他药材')
            );
            const herbsTagsBox = otherSection ? otherSection.querySelector('.herb-tags') : null;
            if (herbsTagsBox) {
                // 折叠态：前 NORMAL_LIMIT 种 + “展开全部 N 种”
                const renderCollapsed = () => {
                    herbsTagsBox.innerHTML = normalShown.map(h => `<span class="herb-tag">${h.name}</span>`).join('')
                        + (normalCollapsed
                            ? `<button type="button" class="herb-tag-expand js-expand-herbs" data-count="${normalHerbs.length}">展开全部 ${normalHerbs.length} 种</button>`
                            : '');
                };
                // 展开态：全部 + “收回”按钮
                const renderExpanded = () => {
                    herbsTagsBox.innerHTML = normalHerbs.map(h => `<span class="herb-tag">${h.name}</span>`).join('')
                        + `<button type="button" class="herb-tag-expand js-collapse-herbs">收回</button>`;
                };
                herbsTagsBox.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;
                    if (btn.classList.contains('js-expand-herbs')) {
                        renderExpanded();
                    } else if (btn.classList.contains('js-collapse-herbs')) {
                        renderCollapsed();
                    }
                });
            }
        } catch (error) {
            body.innerHTML = `<div class="panel-error">加载失败: ${error.message}</div>`;
        }
    }

    /**
     * 生成药材信息卡片（药典风格）
     * 字段统一使用两列 grid：固定标签列 + 可自由换行的正文列，杜绝窄列竖排
     */
    buildHerbCard(d) {
        const props = (d.properties || []).map(p => p.name).join('、');
        const meridians = (d.meridians || []).map(m => m.name).join('、');
        const effs = (d.efficacies || []).map(e => e.name).join('、') || d.description || '未记载';
        const intro = `${d.name}，${d.pinyin || ''}，为${d.category_name || '未分类'}。${d.description || ''}`.trim();

        const rows = [];
        if (props) rows.push(this.buildDetailRow('性味', props));
        if (meridians) rows.push(this.buildDetailRow('归经', meridians));
        rows.push(this.buildDetailRow('功效', effs));
        if (d.usage_dosage) rows.push(this.buildDetailRow('用量', d.usage_dosage));
        rows.push(this.buildDetailRow('简介', intro));

        return `
            <div class="herb-card" data-herb="${d.name}" role="link" tabindex="0">
                <div class="herb-card-header">
                    <span class="herb-icon">🌿</span>
                    <span class="herb-name">${d.name}</span>
                    ${d.is_common ? '<span class="herb-common-badge">⭐ 常用</span>' : ''}
                </div>
                ${d.category_name ? `<div class="herb-category">分类：${d.category_name}</div>` : ''}
                <div class="herb-detail-grid">
                    ${rows.join('')}
                </div>
            </div>
        `;
    }

    /**
     * 单行详情字段（grid 两列，minmax(0,1fr) 保证正文可正常换行）
     */
    buildDetailRow(label, value) {
        return `
            <div class="herb-detail-row">
                <span class="detail-label">${label}</span>
                <span class="detail-value">${value}</span>
            </div>
        `;
    }

    /**
     * 切换地图显示状态
     */
    toggleMap(show) {
        const mapContainer = document.getElementById('map-container');
        const graphContainer = document.getElementById('graph-container');

        if (show) {
            mapContainer.style.display = 'block';
            graphContainer.style.display = 'none';
            if (this.chart) setTimeout(() => this.chart.resize(), 100);
        } else {
            mapContainer.style.display = 'none';
            graphContainer.style.display = 'block';
        }
    }

    /**
     * 销毁地图实例
     */
    destroy() {
        if (this.chart) {
            this.chart.dispose();
            this.chart = null;
        }
        this.isInitialized = false;
        console.log('中国地图可视化模块已销毁');
    }
}

// 创建全局地图实例
window.worldMapVisualization = new WorldMapVisualization();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMapVisualization;
}




