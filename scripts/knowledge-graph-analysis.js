// 知识图谱数据可视化分析脚本
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在知识图谱页面
    if (!document.getElementById('nodeTypeDistributionChart')) {
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
            '#f38ba8', '#74c0fc', '#ffd43b', '#51cf66', '#ff8cc8'
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

    // 初始化所有图表
    function initializeCharts() {
        // 等待知识图谱数据加载完成
        setTimeout(() => {
            if (window.graphData && window.graphData.nodes && window.graphData.links) {
                generateAllAnalysisCharts(window.graphData);
            }
        }, 2000);
    }

    // 生成所有分析图表
    function generateAllAnalysisCharts(data) {
        console.log('开始生成知识图谱分析图表...');
        
        // 销毁现有图表
        Object.values(charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        charts = {};

        // 数据预处理
        const analysisData = preprocessData(data);
        
        // 生成各种图表
        generateNodeTypeChart(analysisData);
        generateWeaponYearChart(analysisData);
        generateCountryWeaponChart(analysisData);
        generateWeaponTypeChart(analysisData);
        generateManufacturerChart(analysisData);
        generateRelationTypeChart(analysisData);
        generateWeaponTrendChart(analysisData);
        generateNetworkDensityChart(analysisData);
        generateCountryManufacturerChart(analysisData);

        console.log('所有分析图表生成完成');
    }

    // 数据预处理
    function preprocessData(data) {
        const nodeMap = {};
        const nodeTypeCount = {};
        const weaponYearCount = {};
        const countryWeaponCount = {};
        const weaponTypeCount = {};
        const manufacturerCount = {};
        const relationTypeCount = {};
        const countryManufacturerCount = {};

        // 构建节点映射和统计
        data.nodes.forEach(node => {
            nodeMap[node.id] = node;
            const type = node.labels[0];
            nodeTypeCount[type] = (nodeTypeCount[type] || 0) + 1;

            // 武器相关统计
            if (type === 'Weapon') {
                const year = node.properties.year;
                const weaponType = node.properties.type;
                
                if (year) {
                    weaponYearCount[year] = (weaponYearCount[year] || 0) + 1;
                }
                
                if (weaponType) {
                    weaponTypeCount[weaponType] = (weaponTypeCount[weaponType] || 0) + 1;
                }
            }

            // 制造商统计
            if (type === 'Manufacturer') {
                const manufacturerName = node.properties.name;
                const country = node.properties.country;
                
                if (manufacturerName) {
                    manufacturerCount[manufacturerName] = (manufacturerCount[manufacturerName] || 0) + 1;
                }
                
                if (country) {
                    countryManufacturerCount[country] = (countryManufacturerCount[country] || 0) + 1;
                }
            }
        });

        // 关系统计
        data.links.forEach(link => {
            const relationType = link.type;
            if (relationType) {
                relationTypeCount[relationType] = (relationTypeCount[relationType] || 0) + 1;
            }

            // 国家-武器关系统计
            const sourceNode = nodeMap[link.source.id || link.source];
            const targetNode = nodeMap[link.target.id || link.target];
            
            if (sourceNode && targetNode) {
                if (sourceNode.labels.includes('Weapon') && targetNode.labels.includes('Country')) {
                    const countryName = targetNode.properties.name;
                    if (countryName) {
                        countryWeaponCount[countryName] = (countryWeaponCount[countryName] || 0) + 1;
                    }
                } else if (sourceNode.labels.includes('Country') && targetNode.labels.includes('Weapon')) {
                    const countryName = sourceNode.properties.name;
                    if (countryName) {
                        countryWeaponCount[countryName] = (countryWeaponCount[countryName] || 0) + 1;
                    }
                }
            }
        });

        return {
            nodeMap,
            nodeTypeCount,
            weaponYearCount,
            countryWeaponCount,
            weaponTypeCount,
            manufacturerCount,
            relationTypeCount,
            countryManufacturerCount,
            totalNodes: data.nodes.length,
            totalLinks: data.links.length
        };
    }

    // 1. 节点类型分布图表
    function generateNodeTypeChart(analysisData) {
        const ctx = document.getElementById('nodeTypeDistributionChart');
        if (!ctx) return;

        charts.nodeType = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(analysisData.nodeTypeCount),
                datasets: [{
                    data: Object.values(analysisData.nodeTypeCount),
                    backgroundColor: themeColors.gradients.slice(0, Object.keys(analysisData.nodeTypeCount).length),
                    borderWidth: 2,
                    borderColor: '#131a27'
                }]
            },
            options: {
                ...commonOptions,
                cutout: '50%',
                plugins: {
                    ...commonOptions.plugins,
                    title: {
                        display: false
                    },
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
    }

    // 2. 武器年代分布图表
    function generateWeaponYearChart(analysisData) {
        const ctx = document.getElementById('weaponYearChart');
        if (!ctx) return;

        const sortedYears = Object.keys(analysisData.weaponYearCount).sort();
        
        charts.weaponYear = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedYears,
                datasets: [{
                    label: '武器数量',
                    data: sortedYears.map(year => analysisData.weaponYearCount[year]),
                    backgroundColor: themeColors.primary,
                    borderRadius: 4,
                    barPercentage: 0.8
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
                        title: { display: true, text: '服役年份' },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '数量' }
                    }
                }
            }
        });
    }

    // 3. 国家武器数量排行图表
    function generateCountryWeaponChart(analysisData) {
        const ctx = document.getElementById('countryWeaponChart');
        if (!ctx) return;

        const sortedCountries = Object.entries(analysisData.countryWeaponCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        charts.countryWeapon = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: sortedCountries.map(([country]) => country),
                datasets: [{
                    label: '武器数量',
                    data: sortedCountries.map(([, count]) => count),
                    backgroundColor: themeColors.secondary,
                    borderRadius: 4
                }]
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: { display: true, text: '武器数量' }
                    },
                    y: {
                        title: { display: true, text: '国家' }
                    }
                }
            }
        });
    }

    // 4. 武器类型分布图表
    function generateWeaponTypeChart(analysisData) {
        const ctx = document.getElementById('weaponTypeChart');
        if (!ctx) return;

        charts.weaponType = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(analysisData.weaponTypeCount),
                datasets: [{
                    data: Object.values(analysisData.weaponTypeCount),
                    backgroundColor: themeColors.gradients,
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
    }

    // 5. 制造商武器数量统计图表
    function generateManufacturerChart(analysisData) {
        const ctx = document.getElementById('manufacturerChart');
        if (!ctx) return;

        // 从后端API获取制造商武器数量数据
        fetch('/api/manufacturer-statistics/weapon-count')
            .then(response => response.json())
            .then(data => {
                if (!data || !data.success || !data.data) {
                    console.error('获取制造商武器数量数据失败:', data);
                    return;
                }

                // 从API响应中提取制造商统计数据
                const manufacturerStats = data.data.statistics || [];
                
                // 按武器数量排序并取前8名
                const sortedManufacturers = manufacturerStats
                    .sort((a, b) => b.weapon_count - a.weapon_count)
                    .slice(0, 8)
                    .map(item => ({
                        name: item.manufacturer_name,
                        weaponCount: item.weapon_count,
                        country: item.manufacturer_country
                    }));

                charts.manufacturer = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: sortedManufacturers.map(item => 
                            item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name
                        ),
                        datasets: [{
                            label: '武器数量',
                            data: sortedManufacturers.map(item => item.weaponCount),
                            backgroundColor: themeColors.warning,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
                            tooltip: {
                                ...commonOptions.plugins.tooltip,
                                callbacks: {
                                    title: function(tooltipItems) {
                                        // 显示完整的制造商名称
                                        const index = tooltipItems[0].dataIndex;
                                        return sortedManufacturers[index].name;
                                    },
                                    label: function(context) {
                                        return `武器数量: ${context.raw}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: '制造商' },
                                ticks: { maxRotation: 45, minRotation: 30 }
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: '武器数量' }
                            }
                        }
                    }
                });
            })
            .catch(error => {
                console.error('获取制造商武器数量数据出错:', error);
            });
    }

    // 6. 关系类型分布图表
    function generateRelationTypeChart(analysisData) {
        const ctx = document.getElementById('relationTypeChart');
        if (!ctx) return;

        charts.relationType = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(analysisData.relationTypeCount),
                datasets: [{
                    data: Object.values(analysisData.relationTypeCount),
                    backgroundColor: themeColors.gradients,
                    borderWidth: 2,
                    borderColor: '#131a27'
                }]
            },
            options: {
                ...commonOptions,
                cutout: '40%',
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
    }

    // 7. 武器服役年代趋势图表
    function generateWeaponTrendChart(analysisData) {
        const ctx = document.getElementById('weaponTrendChart');
        if (!ctx) return;

        // 按年代区间统计
        const decades = {};
        Object.entries(analysisData.weaponYearCount).forEach(([year, count]) => {
            const decade = Math.floor(parseInt(year) / 10) * 10;
            decades[decade] = (decades[decade] || 0) + count;
        });

        const sortedDecades = Object.keys(decades).sort();

        charts.weaponTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDecades.map(d => `${d}年代`),
                datasets: [{
                    label: '武器数量',
                    data: sortedDecades.map(d => decades[d]),
                    borderColor: themeColors.accent,
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: themeColors.accent,
                    pointBorderColor: '#fff',
                    pointRadius: 5,
                    pointHoverRadius: 7
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
                        title: { display: true, text: '年代' }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '武器数量' }
                    }
                }
            }
        });
    }

    // 8. 网络密度分析图表
    function generateNetworkDensityChart(analysisData) {
        const ctx = document.getElementById('networkDensityChart');
        if (!ctx) return;

        // 计算网络密度指标
        const totalNodes = analysisData.totalNodes;
        const totalLinks = analysisData.totalLinks;
        const maxPossibleLinks = totalNodes * (totalNodes - 1) / 2;
        const density = (totalLinks / maxPossibleLinks * 100).toFixed(2);
        
        // 计算各类型节点的连接度
        const nodeConnectivity = {};
        Object.keys(analysisData.nodeTypeCount).forEach(type => {
            nodeConnectivity[type] = 0;
        });

        if (window.graphData && window.graphData.links) {
            window.graphData.links.forEach(link => {
                const sourceNode = analysisData.nodeMap[link.source.id || link.source];
                const targetNode = analysisData.nodeMap[link.target.id || link.target];
                
                if (sourceNode && targetNode) {
                    nodeConnectivity[sourceNode.labels[0]]++;
                    nodeConnectivity[targetNode.labels[0]]++;
                }
            });
        }

        charts.networkDensity = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(nodeConnectivity),
                datasets: [{
                    label: '连接度',
                    data: Object.values(nodeConnectivity),
                    backgroundColor: 'rgba(155, 89, 182, 0.2)',
                    borderColor: themeColors.info,
                    borderWidth: 2,
                    pointBackgroundColor: themeColors.info,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: themeColors.info
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: {
                            color: '#e0e0e0',
                            font: { size: 12 }
                        },
                        ticks: {
                            backdropColor: 'transparent',
                            display: false
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...commonOptions.plugins.tooltip,
                        callbacks: {
                            afterBody: function() {
                                return `网络密度: ${density}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 9. 国家制造商分布图表
    function generateCountryManufacturerChart(analysisData) {
        const ctx = document.getElementById('countryManufacturerChart');
        if (!ctx) return;

        // 从后端API获取制造商数据
        fetch('/api/manufacturer-statistics/details')
            .then(response => response.json())
            .then(data => {
                if (!data || !Array.isArray(data)) {
                    console.error('获取制造商数据失败:', data);
                    return;
                }

                // 按国家统计制造商数量
                const countryManufacturerCount = {};
                data.forEach(manufacturer => {
                    if (manufacturer.country) {
                        countryManufacturerCount[manufacturer.country] = 
                            (countryManufacturerCount[manufacturer.country] || 0) + 1;
                    }
                });

                const sortedCountries = Object.entries(countryManufacturerCount)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8);

                charts.countryManufacturer = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: sortedCountries.map(([country]) => country),
                        datasets: [{
                            label: '制造商数量',
                            data: sortedCountries.map(([, count]) => count),
                            backgroundColor: themeColors.success,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
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
                                title: { display: true, text: '国家' },
                                ticks: { maxRotation: 45 }
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: '制造商数量' }
                            }
                        }
                    }
                });
            })
            .catch(error => {
                console.error('获取制造商数据出错:', error);
            });
    }

    // 刷新按钮功能
    function initializeRefreshButtons() {
        document.querySelectorAll('.card-action-btn').forEach(button => {
            button.addEventListener('click', function() {
                const card = this.closest('.card');
                const canvas = card.querySelector('canvas');
                
                if (canvas && window.graphData) {
                    // 添加刷新动画
                    this.style.transform = 'rotate(360deg)';
                    this.style.transition = 'transform 0.5s ease';
                    
                    setTimeout(() => {
                        this.style.transform = '';
                        this.style.transition = '';
                    }, 500);
                    
                    // 重新生成对应的图表
                    setTimeout(() => {
                        generateAllAnalysisCharts(window.graphData);
                    }, 100);
                }
            });
        });
    }

    // 监听知识图谱数据更新
    function observeGraphDataChanges() {
        // 监听全局graphData变化
        let lastDataString = '';
        
        setInterval(() => {
            if (window.graphData) {
                const currentDataString = JSON.stringify(window.graphData);
                if (currentDataString !== lastDataString) {
                    lastDataString = currentDataString;
                    generateAllAnalysisCharts(window.graphData);
                }
            }
        }, 3000);
    }

    // 初始化
    initializeCharts();
    initializeRefreshButtons();
    observeGraphDataChanges();

    // 暴露给全局使用
    window.knowledgeGraphAnalysis = {
        generateAllAnalysisCharts,
        charts
    };
});