// 知识图谱数据可视化分析脚本 - 修复版
document.addEventListener('DOMContentLoaded', function() {
    console.log('知识图谱分析脚本开始加载...');
    
    // 检查是否在知识图谱页面
    if (!document.getElementById('weaponTypeChart')) {
        console.log('未找到图表元素，退出分析脚本');
        return;
    }

    // 设置Chart.js全局默认值
    Chart.defaults.color = '#e0e0e0';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    
    // 主题色配置
    const themeColors = {
        primary: '#3498db',
        secondary: '#2ecc71',
        accent: '#e74c3c',
        warning: '#f39c12',
        info: '#9b59b6',
        success: '#1abc9c',
        danger: '#e67e22',
        light: '#ecf0f1',
        dark: '#2c3e50',
        gradients: [
            '#ff6b6b', '#4ecdc4', '#ffbe0b', '#a786df', '#95e1d3',
            '#f38ba8', '#74c0fc', '#ffd43b', '#51cf66', '#ff8cc8',
            '#ff9f43', '#10ac84', '#ee5a24', '#0abde3', '#feca57'
        ]
    };
    
    // 通用图表配置
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 15,
                    boxWidth: 8,
                    font: {
                        size: 11
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: {
                    size: 14
                },
                bodyFont: {
                    size: 13
                },
                padding: 10,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                displayColors: true
            }
        }
    };

    // 存储所有图表实例
    let charts = {};
    let isDataLoaded = false;

    // 等待数据加载的函数
    function waitForData() {
        console.log('等待知识图谱数据加载...');
        
        const checkData = () => {
            // 检查多种可能的数据源
            if (window.graphData && window.graphData.nodes && window.graphData.links) {
                console.log('找到window.graphData，开始生成图表');
                generateAllAnalysisCharts(window.graphData);
                isDataLoaded = true;
                return;
            }
            
            // 检查是否有其他数据源
            if (window.allNodes && window.allLinks) {
                console.log('找到window.allNodes和window.allLinks，开始生成图表');
                const data = {
                    nodes: window.allNodes,
                    links: window.allLinks
                };
                generateAllAnalysisCharts(data);
                isDataLoaded = true;
                return;
            }
            
            // 尝试从API获取数据
            fetchDataFromAPI();
        };
        
        // 立即检查一次
        checkData();
        
        // 如果没有数据，每2秒检查一次，最多检查10次
        let attempts = 0;
        const maxAttempts = 10;
        const interval = setInterval(() => {
            attempts++;
            console.log(`第${attempts}次尝试获取数据...`);
            
            if (isDataLoaded || attempts >= maxAttempts) {
                clearInterval(interval);
                if (!isDataLoaded) {
                    console.log('数据加载超时，尝试从API获取');
                    fetchDataFromAPI();
                }
                return;
            }
            
            checkData();
        }, 2000);
    }

    // 从API获取数据
    async function fetchDataFromAPI() {
        try {
            console.log('尝试从API获取武器数据...');
            
            // 首先尝试获取统计数据
            try {
                const statsResponse = await fetch('http://localhost:3001/api/weapons/statistics');
                if (statsResponse.ok) {
                    const statsResult = await statsResponse.json();
                    console.log('获取到统计数据:', statsResult);
                    
                    if (statsResult.success && statsResult.data) {
                        generateChartsFromStats(statsResult.data);
                        isDataLoaded = true;
                        return;
                    }
                }
            } catch (statsError) {
                console.log('统计接口调用失败，尝试武器列表接口:', statsError);
            }
            
            // 如果统计接口失败，尝试武器列表接口
            const response = await fetch('http://localhost:3001/api/weapons?limit=1000');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('API返回的原始数据:', result);
            
            // 处理不同的API响应格式
            let weapons = [];
            if (Array.isArray(result)) {
                weapons = result;
            } else if (result.data && result.data.weapons && Array.isArray(result.data.weapons)) {
                weapons = result.data.weapons;
            } else if (result.data && Array.isArray(result.data)) {
                weapons = result.data;
            } else if (result.weapons && Array.isArray(result.weapons)) {
                weapons = result.weapons;
            } else if (result.success && result.data && result.data.weapons) {
                weapons = result.data.weapons;
            } else {
                console.error('API返回的数据格式不正确:', result);
                console.log('尝试直接使用result作为数组...');
                // 最后尝试：如果result本身看起来像武器数据
                if (result.name && result.type) {
                    weapons = [result];
                } else {
                    throw new Error('API返回的数据格式不正确');
                }
            }
            
            console.log('处理后的武器数据:', weapons.length, '条');
            
            if (weapons.length === 0) {
                console.log('没有武器数据，显示无数据提示');
                showNoDataMessage();
                return;
            }
            
            // 转换为图谱数据格式
            const graphData = convertWeaponsToGraphData(weapons);
            generateAllAnalysisCharts(graphData);
            isDataLoaded = true;
            
        } catch (error) {
            console.error('从API获取数据失败:', error);
            showNoDataMessage();
        }
    }

    // 从统计数据生成图表
    function generateChartsFromStats(statsData) {
        console.log('使用统计数据生成图表:', statsData);
        
        // 销毁现有图表
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        charts = {};

        // 1. 武器类型分布图表
        if (statsData.by_type && statsData.by_type.length > 0) {
            const ctx = document.getElementById('weaponTypeChart');
            if (ctx) {
                charts.weaponType = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: statsData.by_type.map(item => item.type),
                        datasets: [{
                            data: statsData.by_type.map(item => item.count),
                            backgroundColor: themeColors.gradients.slice(0, statsData.by_type.length),
                            borderWidth: 2,
                            borderColor: '#131a27'
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            tooltip: {
                                ...commonOptions.plugins.tooltip,
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((context.raw / total) * 100).toFixed(1);
                                        return `${context.label}: ${context.raw} (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
                console.log('武器类型图表生成完成');
            }
        }

        // 2. 国家制造商分布图表（使用国家武器数量作为替代）
        if (statsData.by_country && statsData.by_country.length > 0) {
            const ctx = document.getElementById('countryManufacturerChart');
            if (ctx) {
                charts.countryManufacturer = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: statsData.by_country.map(item => item.country),
                        datasets: [{
                            label: '武器数量',
                            data: statsData.by_country.map(item => item.count),
                            backgroundColor: themeColors.success,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: '国家' },
                                ticks: { 
                                    maxRotation: 45,
                                    color: '#e0e0e0'
                                },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: '武器数量' },
                                ticks: { color: '#e0e0e0' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            }
                        }
                    }
                });
                console.log('国家武器数量图表生成完成');
            }
        }

        // 3. 制造商图表 - 显示暂无数据提示
        const manufacturerCtx = document.getElementById('manufacturerChart');
        if (manufacturerCtx) {
            manufacturerCtx.innerHTML = `
                <div class="chart-no-data">
                    <i class="fas fa-chart-bar"></i>
                    <p>制造商数据需要完整武器数据</p>
                    <small>正在尝试获取详细数据...</small>
                </div>
            `;
        }

        console.log('统计数据图表生成完成');
    }

    // 将武器数据转换为图谱数据格式
    function convertWeaponsToGraphData(weapons) {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        
        weapons.forEach(weapon => {
            // 添加武器节点
            const weaponNode = {
                id: `weapon_${weapon.id}`,
                labels: ['Weapon'],
                properties: {
                    name: weapon.name,
                    type: weapon.type,
                    year: weapon.year,
                    description: weapon.description
                }
            };
            nodes.push(weaponNode);
            nodeMap.set(weaponNode.id, weaponNode);
            
            // 添加国家节点
            if (weapon.country) {
                const countryId = `country_${weapon.country}`;
                if (!nodeMap.has(countryId)) {
                    const countryNode = {
                        id: countryId,
                        labels: ['Country'],
                        properties: {
                            name: weapon.country
                        }
                    };
                    nodes.push(countryNode);
                    nodeMap.set(countryId, countryNode);
                }
                
                // 添加武器-国家关系
                links.push({
                    source: weaponNode.id,
                    target: countryId,
                    type: 'MANUFACTURED_IN'
                });
            }
            
            // 添加制造商节点
            if (weapon.manufacturer) {
                const manufacturerId = `manufacturer_${weapon.manufacturer}`;
                if (!nodeMap.has(manufacturerId)) {
                    const manufacturerNode = {
                        id: manufacturerId,
                        labels: ['Manufacturer'],
                        properties: {
                            name: weapon.manufacturer,
                            country: weapon.country
                        }
                    };
                    nodes.push(manufacturerNode);
                    nodeMap.set(manufacturerId, manufacturerNode);
                }
                
                // 添加武器-制造商关系
                links.push({
                    source: weaponNode.id,
                    target: manufacturerId,
                    type: 'MANUFACTURED_BY'
                });
            }
            
            // 添加类型节点
            if (weapon.type) {
                const typeId = `type_${weapon.type}`;
                if (!nodeMap.has(typeId)) {
                    const typeNode = {
                        id: typeId,
                        labels: ['Type'],
                        properties: {
                            name: weapon.type
                        }
                    };
                    nodes.push(typeNode);
                    nodeMap.set(typeId, typeNode);
                }
                
                // 添加武器-类型关系
                links.push({
                    source: weaponNode.id,
                    target: typeId,
                    type: 'IS_TYPE_OF'
                });
            }
        });
        
        console.log('转换后的图谱数据:', { nodes: nodes.length, links: links.length });
        return { nodes, links };
    }

    // 显示无数据消息
    function showNoDataMessage() {
        const chartContainers = ['weaponTypeChart', 'manufacturerChart', 'countryManufacturerChart'];
        
        chartContainers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="chart-no-data">
                        <i class="fas fa-chart-bar"></i>
                        <p>暂无数据</p>
                        <small>请等待数据加载或检查网络连接</small>
                    </div>
                `;
            }
        });
    }

    // 生成所有分析图表
    function generateAllAnalysisCharts(data) {
        console.log('开始生成知识图谱分析图表...', data);
        
        if (!data || !data.nodes || !data.links) {
            console.error('数据格式错误:', data);
            showNoDataMessage();
            return;
        }
        
        // 销毁现有图表
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        charts = {};

        // 数据预处理
        const analysisData = preprocessData(data);
        console.log('预处理后的分析数据:', analysisData);
        
        // 生成图表
        generateWeaponTypeChart(analysisData);
        
        // 使用修复版的制造商图表生成函数
        if (window.generateManufacturerChartFixed) {
            window.generateManufacturerChartFixed(analysisData);
        } else {
            generateManufacturerChart(analysisData);
        }
        
        generateCountryManufacturerChart(analysisData);

        console.log('所有分析图表生成完成');
    }

    // 数据预处理
    function preprocessData(data) {
        const nodeMap = {};
        const weaponTypeCount = {};
        const manufacturerWeaponCount = {};
        const countryManufacturerCount = {};
        const countryWeaponCount = {}; // 新增：国家武器数量统计

        console.log('开始预处理数据，节点数量:', data.nodes.length, '链接数量:', data.links.length);

        // 构建节点映射
        data.nodes.forEach(node => {
            nodeMap[node.id] = node;
            
            // 武器类型统计
            if (node.labels.includes('Weapon') && node.properties.type) {
                const type = node.properties.type;
                weaponTypeCount[type] = (weaponTypeCount[type] || 0) + 1;
            }
            
            // 制造商节点初始化
            if (node.labels.includes('Manufacturer') && node.properties.name) {
                const manufacturerName = node.properties.name;
                manufacturerWeaponCount[manufacturerName] = 0; // 初始化为0
                
                // 国家制造商统计
                if (node.properties.country) {
                    const country = node.properties.country;
                    countryManufacturerCount[country] = (countryManufacturerCount[country] || 0) + 1;
                }
            }
            
            // 国家节点初始化
            if (node.labels.includes('Country') && node.properties.name) {
                const countryName = node.properties.name;
                countryWeaponCount[countryName] = 0; // 初始化为0
            }
        });

        console.log('节点映射完成，武器类型:', Object.keys(weaponTypeCount).length, 
                   '制造商:', Object.keys(manufacturerWeaponCount).length);

        // 统计制造商的武器数量和国家武器数量
        data.links.forEach(link => {
            // 处理不同的链接格式
            const sourceId = link.source.id || link.source;
            const targetId = link.target.id || link.target;
            const sourceNode = nodeMap[sourceId];
            const targetNode = nodeMap[targetId];
            
            if (!sourceNode || !targetNode) {
                console.warn('找不到节点:', sourceId, targetId);
                return;
            }
            
            // 制造商武器数量统计 - 支持多种关系类型
            if ((link.type === 'MANUFACTURED_BY' || link.type === 'PRODUCED_BY') && 
                sourceNode.labels.includes('Weapon') && 
                targetNode.labels.includes('Manufacturer')) {
                const manufacturerName = targetNode.properties.name;
                if (manufacturerName) {
                    manufacturerWeaponCount[manufacturerName] = (manufacturerWeaponCount[manufacturerName] || 0) + 1;
                    console.log(`制造商 ${manufacturerName} 武器数量 +1，当前总数:`, manufacturerWeaponCount[manufacturerName]);
                }
            }
            
            // 反向关系：制造商 -> 武器
            if ((link.type === 'MANUFACTURES' || link.type === 'PRODUCES') && 
                sourceNode.labels.includes('Manufacturer') && 
                targetNode.labels.includes('Weapon')) {
                const manufacturerName = sourceNode.properties.name;
                if (manufacturerName) {
                    manufacturerWeaponCount[manufacturerName] = (manufacturerWeaponCount[manufacturerName] || 0) + 1;
                    console.log(`制造商 ${manufacturerName} 武器数量 +1 (反向)，当前总数:`, manufacturerWeaponCount[manufacturerName]);
                }
            }
            
            // 国家武器数量统计 - 支持多种关系类型
            if ((link.type === 'MANUFACTURED_IN' || link.type === 'PRODUCED_IN' || link.type === 'FROM_COUNTRY') && 
                sourceNode.labels.includes('Weapon') && 
                targetNode.labels.includes('Country')) {
                const countryName = targetNode.properties.name;
                if (countryName) {
                    countryWeaponCount[countryName] = (countryWeaponCount[countryName] || 0) + 1;
                }
            }
            
            // 反向关系：国家 -> 武器
            if ((link.type === 'PRODUCES_WEAPON' || link.type === 'HAS_WEAPON') && 
                sourceNode.labels.includes('Country') && 
                targetNode.labels.includes('Weapon')) {
                const countryName = sourceNode.properties.name;
                if (countryName) {
                    countryWeaponCount[countryName] = (countryWeaponCount[countryName] || 0) + 1;
                }
            }
        });

        console.log('制造商武器数量统计完成:', manufacturerWeaponCount);
        console.log('国家武器数量统计完成:', countryWeaponCount);

        return {
            nodeMap,
            weaponTypeCount,
            manufacturerWeaponCount,
            countryManufacturerCount,
            countryWeaponCount, // 新增
            totalNodes: data.nodes.length,
            totalLinks: data.links.length
        };
    }

    // 1. 武器类型分布图表
    function generateWeaponTypeChart(analysisData) {
        const ctx = document.getElementById('weaponTypeChart');
        if (!ctx) {
            console.error('未找到weaponTypeChart元素');
            return;
        }

        const typeData = analysisData.weaponTypeCount;
        console.log('武器类型数据:', typeData);
        
        if (Object.keys(typeData).length === 0) {
            ctx.innerHTML = `
                <div class="chart-no-data">
                    <i class="fas fa-chart-pie"></i>
                    <p>暂无武器类型数据</p>
                </div>
            `;
            return;
        }

        charts.weaponType = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(typeData),
                datasets: [{
                    data: Object.values(typeData),
                    backgroundColor: themeColors.gradients.slice(0, Object.keys(typeData).length),
                    borderWidth: 2,
                    borderColor: '#131a27'
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    tooltip: {
                        ...commonOptions.plugins.tooltip,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('武器类型图表生成完成');
    }

    // 2. 制造商武器数量统计图表
    function generateManufacturerChart(analysisData) {
        const ctx = document.getElementById('manufacturerChart');
        if (!ctx) {
            console.error('未找到manufacturerChart元素');
            return;
        }

        const manufacturerData = analysisData.manufacturerWeaponCount;
        console.log('制造商数据:', manufacturerData);
        
        // 过滤掉数量为0的制造商，并排序
        const filteredData = Object.entries(manufacturerData)
            .filter(([name, count]) => count > 0)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // 只显示前10个
        
        if (filteredData.length === 0) {
            ctx.innerHTML = `
                <div class="chart-no-data">
                    <i class="fas fa-chart-bar"></i>
                    <p>暂无制造商数据</p>
                </div>
            `;
            return;
        }

        charts.manufacturer = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: filteredData.map(([name]) => name.length > 12 ? name.substring(0, 12) + '...' : name),
                datasets: [{
                    label: '武器数量',
                    data: filteredData.map(([, count]) => count),
                    backgroundColor: themeColors.warning,
                    borderRadius: 4
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: {
                        title: { display: true, text: '制造商' },
                        ticks: { 
                            maxRotation: 45, 
                            minRotation: 30,
                            color: '#e0e0e0'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '武器数量' },
                        ticks: { color: '#e0e0e0' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
        
        console.log('制造商图表生成完成');
    }

    // 3. 国家制造商分布图表 - 从数据库获取制造商数据
    function generateCountryManufacturerChart(analysisData) {
        const ctx = document.getElementById('countryManufacturerChart');
        if (!ctx) {
            console.error('未找到countryManufacturerChart元素');
            return;
        }

        console.log('开始从数据库获取制造商数据...');
        
        // 从后端API获取制造商数据
        fetch('/api/manufacturer-statistics/details')
            .then(response => response.json())
            .then(data => {
                console.log('获取到制造商API响应:', data);
                
                if (!data || !data.success || !data.data || !data.data.manufacturers) {
                    console.error('获取制造商数据失败:', data);
                    ctx.innerHTML = `
                        <div class="chart-no-data">
                            <i class="fas fa-chart-bar"></i>
                            <p>获取制造商数据失败</p>
                            <small>请检查网络连接或稍后重试</small>
                        </div>
                    `;
                    return;
                }

                const manufacturers = data.data.manufacturers;
                console.log('制造商数据:', manufacturers);

                // 按国家统计制造商数量
                const countryManufacturerCount = {};
                manufacturers.forEach(manufacturer => {
                    if (manufacturer.country) {
                        countryManufacturerCount[manufacturer.country] = 
                            (countryManufacturerCount[manufacturer.country] || 0) + 1;
                    }
                });

                console.log('按国家统计的制造商数量:', countryManufacturerCount);

                if (Object.keys(countryManufacturerCount).length === 0) {
                    ctx.innerHTML = `
                        <div class="chart-no-data">
                            <i class="fas fa-chart-bar"></i>
                            <p>暂无国家制造商数据</p>
                        </div>
                    `;
                    return;
                }

                const sortedCountries = Object.entries(countryManufacturerCount)
                    .filter(([country, count]) => count > 0)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10);

                if (sortedCountries.length === 0) {
                    ctx.innerHTML = `
                        <div class="chart-no-data">
                            <i class="fas fa-chart-bar"></i>
                            <p>暂无有效的国家制造商数据</p>
                        </div>
                    `;
                    return;
                }

                // 销毁现有图表
                if (charts.countryManufacturer) {
                    charts.countryManufacturer.destroy();
                }

                charts.countryManufacturer = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: sortedCountries.map(([country]) => country),
                        datasets: [{
                            label: '制造商数量',
                            data: sortedCountries.map(([, count]) => count),
                            backgroundColor: themeColors.success,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: 'rgba(26, 188, 156, 0.8)'
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
                            title: {
                                display: true,
                                text: '各国制造商数量分布',
                                color: '#e0e0e0',
                                font: { size: 16, weight: 'bold' }
                            },
                            tooltip: {
                                ...commonOptions.plugins.tooltip,
                                callbacks: {
                                    label: function(context) {
                                        return `${context.label}: ${context.raw} 家制造商`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: { 
                                    display: true, 
                                    text: '国家',
                                    color: '#e0e0e0'
                                },
                                ticks: { 
                                    maxRotation: 45,
                                    minRotation: 30,
                                    color: '#e0e0e0'
                                },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            },
                            y: {
                                beginAtZero: true,
                                title: { 
                                    display: true, 
                                    text: '制造商数量',
                                    color: '#e0e0e0'
                                },
                                ticks: { 
                                    color: '#e0e0e0',
                                    stepSize: 1
                                },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            }
                        }
                    }
                });
                
                console.log('国家制造商分布图表生成完成');
            })
            .catch(error => {
                console.error('获取制造商数据出错:', error);
                ctx.innerHTML = `
                    <div class="chart-no-data">
                        <i class="fas fa-chart-bar"></i>
                        <p>获取制造商数据出错</p>
                        <small>${error.message}</small>
                    </div>
                `;
            });
    }

    // 刷新按钮功能
    function initializeRefreshButtons() {
        document.querySelectorAll('.card-action-btn').forEach(button => {
            button.addEventListener('click', function() {
                console.log('刷新按钮被点击');
                
                // 添加刷新动画
                this.style.transform = 'rotate(360deg)';
                this.style.transition = 'transform 0.5s ease';
                
                setTimeout(() => {
                    this.style.transform = '';
                    this.style.transition = '';
                }, 500);
                
                // 重新获取数据并生成图表
                isDataLoaded = false;
                waitForData();
            });
        });
    }

    // 监听知识图谱数据更新
    function observeGraphDataChanges() {
        let lastDataString = '';
        
        const checkForUpdates = () => {
            if (window.graphData) {
                const currentDataString = JSON.stringify(window.graphData);
                if (currentDataString !== lastDataString && currentDataString !== '{}') {
                    console.log('检测到图谱数据更新');
                    lastDataString = currentDataString;
                    generateAllAnalysisCharts(window.graphData);
                }
            }
        };
        
        // 每3秒检查一次数据更新
        setInterval(checkForUpdates, 3000);
    }

    // 初始化
    console.log('开始初始化知识图谱分析功能');
    waitForData();
    initializeRefreshButtons();
    observeGraphDataChanges();

    // 暴露给全局使用
    window.knowledgeGraphAnalysis = {
        generateAllAnalysisCharts,
        charts,
        waitForData
    };
    
    console.log('知识图谱分析脚本初始化完成');
});