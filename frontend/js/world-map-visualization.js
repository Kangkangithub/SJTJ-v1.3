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
        this.outlineGeo = null;
        this.coastline = [];
        this.outlineLines = [];
        this.insetChart = null;
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
            if (this.insetChart) {
                this.insetChart.dispose();
                this.insetChart = null;
            }

            // 清理容器（尺寸由 CSS .map-container/.map-visualization 控制，随地图卡片自适应）
            mapVisualizationElement.innerHTML = '';
            mapVisualizationElement.style.width = '100%';
            mapVisualizationElement.style.height = '100%';
            this.ensureOverlayDom(mapContainerElement);

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
            this.renderInset();
            setTimeout(() => { if (this.chart) this.chart.resize(); }, 100);

            // 窗口尺寸变化时自适应（仅容器可见时）
            window.addEventListener('resize', () => {
                const mapContainerElement = document.getElementById('map-container');
                if (this.chart && mapContainerElement && mapContainerElement.style.display === 'block') {
                    this.chart.resize();
                    if (this.insetChart) this.insetChart.resize();
                    this.updateScaleBar();
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
            const [response, outlineResponse, coastlineResponse] = await Promise.all([
                fetch('/public/china.json'),
                fetch('/public/china-outline.json').catch(() => null),
                fetch('/public/china-coastline.json').catch(() => null)
            ]);
            if (!response.ok) throw new Error('加载中国地图数据失败: HTTP ' + response.status);
            const geoJson = await response.json();

            // 注册到ECharts
            echarts.registerMap('china', geoJson);
            this.chinaMap = geoJson;

            if (outlineResponse && outlineResponse.ok) {
                try {
                    const outline = await outlineResponse.json();
                    this.outlineGeo = outline;
                    this.outlineLines = this.geoJsonToPolylines(outline);
                } catch (error) {
                    console.warn('国界外轮廓加载失败:', error.message);
                }
            }
            if (coastlineResponse && coastlineResponse.ok) {
                try {
                    const coastline = await coastlineResponse.json();
                    this.coastline = Array.isArray(coastline) ? coastline : [];
                } catch (error) {
                    console.warn('海岸线数据加载失败:', error.message);
                }
            }
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

        const fullNameMap = {};
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features.forEach(f => {
                const full = f.properties.name || '';
                if (!full) return;
                fullNameMap[this.normalizeProvinceName(full)] = full;
            });
        }

        const mapData = this.regionData.map(r => ({
            name: fullNameMap[r.name] || r.name,
            value: r.herbCount,
            description: r.description || ''
        }));

        const maxValue = Math.max(...this.regionData.map(r => r.herbCount), 0);
        const visualMax = Math.max(30, maxValue + 2);
        this.densityMax = visualMax;
        this.densityRange = { min: 0, max: visualMax };

        const regionValues = [];
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features.forEach(f => {
                const name = f.properties.name || '';
                if (!name || name === '南海诸岛') return;
                const item = mapData.find(m => m.name === name);
                regionValues.push({ name: name, value: item ? item.value : 0 });
            });
        }
        this.regionValues = regionValues;
        const regionStyles = regionValues.map(r => ({
            name: r.name,
            itemStyle: { areaColor: this.densityColor(r.value) }
        }));

        const southSeaDashes = [];
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features
                .filter(f => f.properties && f.properties.name === '南海诸岛')
                .forEach(f => {
                    (f.geometry.coordinates || []).forEach(poly => {
                        if (poly && poly[0]) southSeaDashes.push({ coords: poly[0] });
                    });
                });
        }

        const provincePoints = [];
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features.forEach(f => {
                const name = f.properties.name || '';
                if (!name || name === '南海诸岛') return;
                const center = f.properties.center || f.properties.centroid;
                if (Array.isArray(center) && center.length === 2) {
                    provincePoints.push({ name: name, value: center });
                }
            });
        }

        const option = {
            backgroundColor: '#dbe7ef',
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(27,67,50,0.94)',
                borderColor: 'rgba(176,137,104,0.45)',
                textStyle: { color: '#F8F1E3', fontSize: 13 },
                formatter: (params) => {
                    if (!params || !params.name || params.name === '南海诸岛') return '';
                    if (params.seriesName === '国界' || params.seriesName === '海岸线' || params.seriesName === '南海诸岛界线') return '';
                    if (params.seriesName === '钓鱼岛') return '<b>' + params.name + '</b>';
                    const shortName = this.normalizeProvinceName(params.name);
                    const region = this.regionData.find(r => r.name === shortName);
                    const count = region ? region.herbCount : 0;
                    return '<b>' + shortName + '</b><br/>药材数量：' + count + ' 种';
                }
            },
            geo: {
                map: 'china',
                roam: true,
                zoom: 1.15,
                center: [104, 36],
                scaleLimit: { min: 0.7, max: 10 },
                label: { show: true, fontSize: 11, color: '#33473c' },
                itemStyle: {
                    areaColor: '#efe6d2',
                    borderColor: '#9fa9b3',
                    borderWidth: 0.8,
                    borderType: [4, 3]
                },
                emphasis: {
                    label: { color: '#1B4332', fontWeight: 'bold', fontSize: 12 },
                    itemStyle: {
                        areaColor: '#2e7d52',
                        shadowBlur: 12,
                        shadowColor: 'rgba(27,67,50,0.35)'
                    }
                },
                select: { disabled: true },
                regions: regionStyles
            },
            series: [
                {
                    name: '省份热区',
                    type: 'scatter',
                    coordinateSystem: 'geo',
                    symbolSize: 18,
                    itemStyle: { color: 'rgba(0,0,0,0)' },
                    emphasis: { disabled: true },
                    z: 5,
                    data: provincePoints
                },
                {
                    name: '国界',
                    type: 'lines',
                    coordinateSystem: 'geo',
                    polyline: true,
                    silent: true,
                    z: 6,
                    lineStyle: { color: '#8c2f1f', width: 2.2, opacity: 1 },
                    data: (this.outlineLines || []).map(line => ({ coords: line }))
                },
                {
                    name: '海岸线',
                    type: 'lines',
                    coordinateSystem: 'geo',
                    polyline: true,
                    silent: true,
                    z: 7,
                    lineStyle: { color: '#2f6fa3', width: 1.2, opacity: 0.95 },
                    data: (this.coastline || []).map(line => ({ coords: line }))
                },
                {
                    name: '南海诸岛界线',
                    type: 'lines',
                    coordinateSystem: 'geo',
                    polyline: true,
                    silent: true,
                    z: 8,
                    lineStyle: { color: '#8c2f1f', width: 1.8, type: 'dashed', opacity: 1 },
                    data: southSeaDashes
                },
                {
                    name: '钓鱼岛',
                    type: 'scatter',
                    coordinateSystem: 'geo',
                    z: 9,
                    symbolSize: 4,
                    itemStyle: { color: '#8c2f1f', borderColor: '#ffffff', borderWidth: 1 },
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{b}',
                        fontSize: 9,
                        color: '#5a2b20',
                        distance: 3
                    },
                    data: [
                        { name: '钓鱼岛', value: [123.48, 25.75] },
                        { name: '赤尾屿', value: [124.56, 25.92] }
                    ]
                }
            ]
        };

        this.chart.setOption(option);
        this.updateDensityUI();
        this.bindDensityHandles();
        this.chart.off('georoam');
        this.chart.on('georoam', () => this.updateScaleBar());

        this.chart.off('click');
        this.chart.on('click', (params) => {
            if (params.name && params.name !== '南海诸岛') {
                this.showRegionDetails(params.name);
            }
        });

        setTimeout(() => this.updateScaleBar(), 120);
    }

    geoJsonToPolylines(geo) {
        const lines = [];
        const push = (coords) => {
            if (Array.isArray(coords) && coords.length > 1) lines.push(coords);
        };
        const walk = (geometry) => {
            if (!geometry) return;
            if (geometry.type === 'Polygon') geometry.coordinates.forEach(push);
            else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(poly => poly.forEach(push));
            else if (geometry.type === 'LineString') push(geometry.coordinates);
            else if (geometry.type === 'MultiLineString') geometry.coordinates.forEach(push);
        };
        if (geo.type === 'FeatureCollection') (geo.features || []).forEach(f => walk(f.geometry));
        else if (geo.type === 'Feature') walk(geo.geometry);
        else walk(geo);
        return lines;
    }

    /**
     * 注入地图下方的图例 / 比例尺 / 指北针 / 南海诸岛小图 / 编制信息
     */
    ensureOverlayDom(mapContainer) {
        if (!mapContainer || mapContainer.querySelector('.map-inset-wrap')) return;

        const inset = document.createElement('div');
        inset.className = 'map-inset-wrap';
        inset.innerHTML = `
            <div class="map-inset-title">南海诸岛</div>
            <div id="south-sea-inset" class="map-inset"></div>
        `;
        mapContainer.appendChild(inset);

        const furniture = document.createElement('div');
        furniture.className = 'map-furniture';
        furniture.tabIndex = 0;
        furniture.innerHTML = `
            <div class="map-furniture-label">图例</div>
            <div class="map-furniture-body">
            <div class="map-key">
                <div class="map-key-title">图例</div>
                <div class="map-key-row"><span class="k-line k-border"></span>国界</div>
                <div class="map-key-row"><span class="k-line k-coast"></span>海岸线</div>
                <div class="map-key-row"><span class="k-line k-prov"></span>省界</div>
            </div>
            <div class="map-tools">
                <div class="map-north"><span class="map-north-arrow">▲</span><span>N</span></div>
                <div class="map-scale">
                    <div class="map-scale-bar"><i id="map-scalebar-fill"></i></div>
                    <div class="map-scale-labels"><span>0</span><span>1000 km</span></div>
                </div>
            </div>
            </div>
        `;
        mapContainer.appendChild(furniture);

        const credit = document.createElement('div');
        credit.className = 'map-credit';
        credit.innerHTML = `
            <span>审图号：GS(20XX)XXXX号（待补充）</span>
            <span>编制单位：神农AI项目组</span>
            <span>资料来源：项目自建知识图谱；底图：阿里云 DataV 中国地图</span>
        `;
        mapContainer.appendChild(credit);

        const density = document.createElement('div');
        density.className = 'map-density';
        density.innerHTML = `
            <div class="map-density-title">药材数量</div>
            <span class="map-density-label" id="map-density-top">多</span>
            <div class="map-density-bar" id="map-density-bar">
                <div class="map-density-handle" id="map-density-handle-max"></div>
                <div class="map-density-handle" id="map-density-handle-min"></div>
            </div>
            <span class="map-density-label" id="map-density-bottom">少</span>
        `;
        mapContainer.appendChild(density);
    }

    /**
     * 南海诸岛小图
     */
    renderInset() {
        const el = document.getElementById('south-sea-inset');
        if (!el) return;
        if (this.insetChart) {
            this.insetChart.dispose();
            this.insetChart = null;
        }
        this.insetChart = echarts.init(el);

        const dashes = [];
        if (this.chinaMap && this.chinaMap.features) {
            this.chinaMap.features
                .filter(f => f.properties && f.properties.name === '南海诸岛')
                .forEach(f => {
                    (f.geometry.coordinates || []).forEach(poly => {
                        if (poly && poly[0]) dashes.push({ coords: poly[0] });
                    });
                });
        }

        this.insetChart.setOption({
            backgroundColor: '#f4f8fb',
            geo: {
                map: 'china',
                boundingCoords: [[105, 3], [123, 23]],
                roam: false,
                silent: true,
                itemStyle: { areaColor: '#efe6d2', borderColor: '#b9c4cc', borderWidth: 0.6 },
                emphasis: { disabled: true },
                regions: [
                    { name: '南海诸岛', itemStyle: { areaColor: 'transparent', borderColor: 'transparent' } }
                ]
            },
            series: [
                {
                    type: 'lines',
                    coordinateSystem: 'geo',
                    polyline: true,
                    silent: true,
                    lineStyle: { color: '#8c2f1f', width: 1.4, type: 'dashed', opacity: 1 },
                    data: dashes
                },
                {
                    type: 'scatter',
                    coordinateSystem: 'geo',
                    symbolSize: 3,
                    itemStyle: { color: '#8c2f1f' },
                    label: {
                        show: true,
                        position: 'right',
                        fontSize: 8,
                        color: '#5a2b20',
                        formatter: '{b}',
                        distance: 2
                    },
                    data: [
                        { name: '东沙群岛', value: [116.7, 20.7] },
                        { name: '西沙群岛', value: [112.3, 16.8] },
                        { name: '中沙群岛', value: [114.4, 15.7] },
                        { name: '南沙群岛', value: [114.0, 10.0] },
                        { name: '曾母暗沙', value: [112.3, 3.97] }
                    ]
                }
            ]
        });
    }

    /**
     * 依据当前投影估算 500km 比例尺长度
     */
    densityColor(value) {
        const palette = ['#efe6d2', '#dfe7c4', '#b7d39a', '#7fb383', '#2f6a4f'];
        const max = this.densityMax || 1;
        const t = Math.max(0, Math.min(1, value / max));
        const pos = t * (palette.length - 1);
        const i = Math.min(palette.length - 2, Math.floor(pos));
        const f = pos - i;
        const hexToRgb = (hex) => {
            const n = parseInt(hex.slice(1), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const a = hexToRgb(palette[i]);
        const b = hexToRgb(palette[i + 1]);
        const c = a.map((v, idx) => Math.round(v + (b[idx] - v) * f));
        return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }

    updateDensityUI() {
        const max = this.densityMax || 1;
        const maxHandle = document.getElementById('map-density-handle-max');
        const minHandle = document.getElementById('map-density-handle-min');
        const topLabel = document.getElementById('map-density-top');
        const bottomLabel = document.getElementById('map-density-bottom');
        if (maxHandle) maxHandle.style.top = (1 - this.densityRange.max / max) * 100 + '%';
        if (minHandle) minHandle.style.top = (1 - this.densityRange.min / max) * 100 + '%';
        if (topLabel) topLabel.textContent = '多 · ' + this.densityRange.max;
        if (bottomLabel) bottomLabel.textContent = '少 · ' + this.densityRange.min;
    }

    applyDensityFilter() {
        if (!this.chart || !this.regionValues) return;
        const min = this.densityRange.min;
        const max = this.densityRange.max;
        const regions = this.regionValues.map(r => ({
            name: r.name,
            itemStyle: {
                areaColor: r.value >= min && r.value <= max ? this.densityColor(r.value) : '#d7dde2'
            }
        }));
        this.chart.setOption({ geo: { regions: regions } });
    }

    bindDensityHandles() {
        const bar = document.getElementById('map-density-bar');
        if (!bar || bar.dataset.bound === '1') return;
        bar.dataset.bound = '1';

        const startDrag = (which) => (event) => {
            event.preventDefault();
            event.stopPropagation();
            const rect = bar.getBoundingClientRect();
            const onMove = (ev) => {
                const y = Math.min(Math.max(ev.clientY - rect.top, 0), rect.height);
                let value = Math.round((1 - y / rect.height) * (this.densityMax || 0));
                if (which === 'max') {
                    this.densityRange.max = Math.min(this.densityMax, Math.max(value, this.densityRange.min + 1));
                } else {
                    this.densityRange.min = Math.max(0, Math.min(value, this.densityRange.max - 1));
                }
                this.updateDensityUI();
                this.applyDensityFilter();
            };
            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
            };
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        };

        document.getElementById('map-density-handle-max')?.addEventListener('pointerdown', startDrag('max'));
        document.getElementById('map-density-handle-min')?.addEventListener('pointerdown', startDrag('min'));
        bar.addEventListener('dblclick', () => {
            this.densityRange = { min: 0, max: this.densityMax };
            this.updateDensityUI();
            this.applyDensityFilter();
        });
    }

    updateScaleBar() {
        if (!this.chart) return;
        const fill = document.getElementById('map-scalebar-fill');
        if (!fill) return;
        try {
            const p1 = this.chart.convertToPixel({ geoIndex: 0 }, [100, 35]);
            const p2 = this.chart.convertToPixel({ geoIndex: 0 }, [105, 35]);
            if (!p1 || !p2) return;
            const pxPerDeg = Math.abs(p2[0] - p1[0]) / 5;
            const kmPerDeg = 111.32 * Math.cos(35 * Math.PI / 180);
            const px = Math.round((1000 / kmPerDeg) * pxPerDeg);
            fill.style.width = Math.max(28, px) + 'px';
        } catch (error) {
            // 比例尺为示意值，计算失败时保留默认宽度
        }
    }

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




