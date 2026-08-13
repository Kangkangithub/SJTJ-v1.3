// 医药图谱数据可视化分析脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log('医药图谱分析脚本开始加载...');

    // 检查是否在知识图谱页面
    if (!document.getElementById('weaponTypeChart')) {
        console.log('未找到图表元素，退出分析脚本');
        return;
    }

    // 设置Chart.js全局默认值
    Chart.defaults.color = '#e0e0e0';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    // 药材主题色配置（与图谱图例一致）
    const themeColors = {
        primary: '#40916C',
        secondary: '#B08968',
        accent: '#1B4332',
        warning: '#f39c12',
        info: '#9b59b6',
        success: '#1abc9c',
        danger: '#e74c3c',
        light: '#ecf0f1',
        dark: '#2c3e50',
        gradients: [
            '#4ecdc4', '#45d6c0', '#5dd8c9', '#3fb8b0', '#4ecdc4',
            '#63d3c8', '#38b3ab', '#5cd0c6', '#4ecdc4', '#6fd9ce',
            '#3fb5ae', '#4ecdc4', '#57cdc6', '#46c4bc', '#4ecdc4',
            '#62d1c7', '#4ecdc4'
        ],
        // 分类饼图高区分度调色板（17色，相邻色差明显）
        categoryColors: [
            '#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#1abc9c',
            '#3498db', '#9b59b6', '#e67e22', '#1e8449', '#2980b9',
            '#8e44ad', '#16a085', '#c0392b', '#d35400', '#27ae60',
            '#7f8c8d', '#e84393'
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
                    font: { size: 11 }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
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

    // 等待数据加载
    function waitForData() {
        console.log('等待医药图谱数据加载...');

        const checkData = () => {
            if (window.graphData && window.graphData.nodes && window.graphData.links) {
                console.log('找到window.graphData，开始生成图表');
                generateAllAnalysisCharts(window.graphData);
                isDataLoaded = true;
                return;
            }
            if (window.allNodes && window.allLinks) {
                console.log('找到window.allNodes和window.allLinks');
                generateAllAnalysisCharts({ nodes: window.allNodes, links: window.allLinks });
                isDataLoaded = true;
                return;
            }
            fetchDataFromAPI();
        };

        checkData();

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (isDataLoaded || attempts >= 1) {
                clearInterval(interval);
                if (!isDataLoaded) fetchDataFromAPI();
                return;
            }
            checkData();
        }, 2000);
    }

    // 从API获取统计数据
    async function fetchDataFromAPI() {
        try {
            console.log('尝试从API获取药材统计数据...');
            const statsResponse = await fetch('http://localhost:3001/api/herbs/statistics');
            if (statsResponse.ok) {
                const statsResult = await statsResponse.json();
                if (statsResult.success && statsResult.data) {
                    generateChartsFromStats(statsResult.data);
                    isDataLoaded = true;
                    return;
                }
            }
            throw new Error('获取统计数据失败');
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
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        charts = {};

        // 1. 药材分类分布（饼图）
        if (statsData.by_category && statsData.by_category.length > 0) {
            const ctx = document.getElementById('weaponTypeChart');
            if (ctx) {
                charts.category = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: statsData.by_category.map(item => item.name),
                        datasets: [{
                            data: statsData.by_category.map(item => item.count),
                            backgroundColor: themeColors.categoryColors.slice(0, statsData.by_category.length),
                            borderWidth: 2,
                            borderColor: '#131a27'
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            title: {
                                display: true,
                                text: '药材分类分布',
                                color: '#e0e0e0',
                                font: { size: 14, weight: 'bold' }
                            },
                            tooltip: {
                                ...commonOptions.plugins.tooltip,
                                callbacks: {
                                    label: function(context) {
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((context.raw / total) * 100).toFixed(1);
                                        return `${context.label}: ${context.raw} 味 (${percentage}%)`;
                                    }
                                }
                            }
                        }
                    }
                });
                console.log('药材分类图表生成完成');
            }
        }

        // 2. 产地药材数量统计（柱状图 - 由regionAnalysis脚本渲染）
        if (window.regionAnalysis) {
            window.regionAnalysis.generateRegionChart(statsData.by_region);
        }

        // 3. 主要功效分布（柱状图）
        if (statsData.by_efficacy && statsData.by_efficacy.length > 0) {
            const ctx = document.getElementById('countryManufacturerChart');
            if (ctx) {
                const topEfficacies = statsData.by_efficacy.slice(0, 10);
                charts.efficacy = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: topEfficacies.map(item => item.name),
                        datasets: [{
                            label: '药材数量',
                            data: topEfficacies.map(item => item.count),
                            backgroundColor: (context) => {
                                const { ctx, chartArea } = context.chart;
                                if (!chartArea) return '#ff9f43';
                                const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                g.addColorStop(0, '#ff9f43');
                                g.addColorStop(1, '#f97316');
                                return g;
                            },
                            borderRadius: 6
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
                            title: {
                                display: true,
                                text: '主要功效分布 (Top 10)',
                                color: '#e0e0e0',
                                font: { size: 14, weight: 'bold' }
                            }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: '功效', color: '#e0e0e0' },
                                ticks: { maxRotation: 45, minRotation: 30, color: '#e0e0e0' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: '药材数量', color: '#e0e0e0' },
                                ticks: { color: '#e0e0e0', stepSize: 1, precision: 0 },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            }
                        }
                    }
                });
                console.log('功效分布图表生成完成');
            }
        }

        console.log('统计数据图表生成完成');
    }

    // 显示无数据消息
    function showNoDataMessage() {
        ['weaponTypeChart', 'manufacturerChart', 'countryManufacturerChart'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = `
                    <div class="chart-no-data">
                        <i class="fas fa-chart-bar"></i>
                        <p>暂无数据</p>
                        <small>请等待数据加载或检查网络连接</small>
                    </div>
                `;
            }
        });
    }

    // 从图谱数据生成分析图表
    function generateAllAnalysisCharts(data) {
        console.log('开始生成医药图谱分析图表...', data);

        if (!data || !data.nodes || !data.links) {
            showNoDataMessage();
            return;
        }

        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') chart.destroy();
        });
        charts = {};

        const analysisData = preprocessData(data);
        console.log('预处理后的分析数据:', analysisData);

        // 分类分布（饼图）
        generateCategoryChart(analysisData);

        // 产地分布（交给regionAnalysis渲染manufacturerChart）
        if (window.regionAnalysis) {
            window.regionAnalysis.generateRegionChart(analysisData.regionCount);
        }

        // 功效分布（柱状图）
        generateEfficacyChart(analysisData);

        console.log('所有医药分析图表生成完成');
    }

    // 数据预处理
    function preprocessData(data) {
        const nodeMap = {};
        const categoryCount = {};
        const regionCount = {};

        data.nodes.forEach(node => {
            nodeMap[node.id] = node;

            // 药材分类统计
            if (node.labels.includes('Herb') && node.properties.category) {
                const cat = node.properties.category;
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            }

            // 药材产地统计
            if (node.labels.includes('Herb') && node.properties.region) {
                const region = node.properties.region;
                regionCount[region] = (regionCount[region] || 0) + 1;
            }
        });

        return {
            nodeMap,
            categoryCount,
            regionCount,
            totalNodes: data.nodes.length,
            totalLinks: data.links.length
        };
    }

    // 0. 节点类型分布图表（柱状图）
    function generateNodeTypeChart(analysisData) {
        const ctx = document.getElementById('nodeTypeDistributionChart');
        if (!ctx) return;

        const typeData = analysisData.nodeTypeCount;
        if (Object.keys(typeData).length === 0) {
            ctx.innerHTML = '<div class="chart-no-data"><i class="fas fa-chart-bar"></i><p>暂无节点类型数据</p></div>';
            return;
        }

        // 按数量排序
        const sorted = Object.entries(typeData).sort((a, b) => b[1] - a[1]);
        const labelNameMap = {
            'Herb': '药材', 'Category': '分类', 'Region': '产地',
            'Property': '性味', 'Meridian': '归经', 'Efficacy': '功效',
            'Source': '来源', 'Formula': '方剂'
        };

        charts.nodeType = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([k]) => labelNameMap[k] || k),
                datasets: [{
                    label: '节点数量',
                    data: sorted.map(([, v]) => v),
                    backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffbe0b', '#a786df', '#f97316', '#95a5a6', '#e74c3c'],
                    borderRadius: 6
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false },
                    title: { display: true, text: '节点类型分布', color: '#e0e0e0', font: { size: 14, weight: 'bold' } }
                },
                scales: {
                    x: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { beginAtZero: true, ticks: { color: '#e0e0e0', stepSize: 1, precision: 0 }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
        console.log('节点类型图表生成完成');
    }

    // 3. 性味分布图表（柱状图）
    function generatePropertyChart(analysisData) {
        const ctx = document.getElementById('weaponYearChart');
        if (!ctx) return;

        const propData = analysisData.propertyCount;
        if (Object.keys(propData).length === 0) {
            ctx.innerHTML = '<div class="chart-no-data"><i class="fas fa-chart-bar"></i><p>暂无性味数据</p></div>';
            return;
        }

        const sorted = Object.entries(propData).sort((a, b) => b[1] - a[1]);

        charts.property = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([k]) => k),
                datasets: [{
                    label: '关联药材数',
                    data: sorted.map(([, v]) => v),
                    backgroundColor: (context) => {
                        const { ctx, chartArea } = context.chart;
                        if (!chartArea) return '#ffbe0b';
                        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        g.addColorStop(0, '#ffbe0b');
                        g.addColorStop(1, '#f39c12');
                        return g;
                    },
                    borderRadius: 6
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false },
                    title: { display: true, text: '药材性味分布', color: '#e0e0e0', font: { size: 14, weight: 'bold' } }
                },
                scales: {
                    x: { ticks: { color: '#e0e0e0', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { beginAtZero: true, ticks: { color: '#e0e0e0', stepSize: 1, precision: 0 }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
        console.log('性味分布图表生成完成');
    }

    // 4. 归经分布图表（柱状图）
    function generateMeridianChart(analysisData) {
        const ctx = document.getElementById('countryWeaponChart');
        if (!ctx) return;

        const merData = analysisData.meridianCount;
        if (Object.keys(merData).length === 0) {
            ctx.innerHTML = '<div class="chart-no-data"><i class="fas fa-chart-bar"></i><p>暂无归经数据</p></div>';
            return;
        }

        const sorted = Object.entries(merData).sort((a, b) => b[1] - a[1]);

        charts.meridian = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sorted.map(([k]) => k),
                datasets: [{
                    label: '关联药材数',
                    data: sorted.map(([, v]) => v),
                    backgroundColor: (context) => {
                        const { ctx, chartArea } = context.chart;
                        if (!chartArea) return '#a786df';
                        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        g.addColorStop(0, '#a786df');
                        g.addColorStop(1, '#8e44ad');
                        return g;
                    },
                    borderRadius: 6
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: false },
                    title: { display: true, text: '药材归经分布', color: '#e0e0e0', font: { size: 14, weight: 'bold' } }
                },
                scales: {
                    x: { ticks: { color: '#e0e0e0', maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    y: { beginAtZero: true, ticks: { color: '#e0e0e0', stepSize: 1, precision: 0 }, grid: { color: 'rgba(255,255,255,0.1)' } }
                }
            }
        });
        console.log('归经分布图表生成完成');
    }

    // 1. 药材分类分布图表（饼图）
    function generateCategoryChart(analysisData) {
        const ctx = document.getElementById('weaponTypeChart');
        if (!ctx) return;

        const catData = analysisData.categoryCount;
        if (Object.keys(catData).length === 0) {
            ctx.innerHTML = `<div class="chart-no-data"><i class="fas fa-chart-pie"></i><p>暂无药材分类数据</p></div>`;
            return;
        }

        charts.category = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(catData),
                datasets: [{
                    data: Object.values(catData),
                    backgroundColor: themeColors.categoryColors.slice(0, Object.keys(catData).length),
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
                                return `${context.label}: ${context.raw} 味 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        console.log('药材分类图表生成完成');
    }

    // 3. 主要功效分布图表（柱状图）
    function generateEfficacyChart(analysisData) {
        const ctx = document.getElementById('countryManufacturerChart');
        if (!ctx) return;

        // 从统计接口获取功效数据
        fetch('http://localhost:3001/api/herbs/statistics')
            .then(r => r.json())
            .then(result => {
                if (!result.success || !result.data || !result.data.by_efficacy) {
                    ctx.innerHTML = `<div class="chart-no-data"><p>获取功效数据失败</p></div>`;
                    return;
                }
                const topEffs = result.data.by_efficacy.slice(0, 10);
                if (topEffs.length === 0) {
                    ctx.innerHTML = `<div class="chart-no-data"><p>暂无功效数据</p></div>`;
                    return;
                }

                if (charts.efficacy) charts.efficacy.destroy();
                charts.efficacy = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: topEffs.map(item => item.name),
                        datasets: [{
                            label: '药材数量',
                            data: topEffs.map(item => item.count),
                            backgroundColor: (context) => {
                                const { ctx, chartArea } = context.chart;
                                if (!chartArea) return '#ff9f43';
                                const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                                g.addColorStop(0, '#ff9f43');
                                g.addColorStop(1, '#f97316');
                                return g;
                            },
                            borderRadius: 6
                        }]
                    },
                    options: {
                        ...commonOptions,
                        plugins: {
                            ...commonOptions.plugins,
                            legend: { display: false },
                            title: {
                                display: true,
                                text: '主要功效分布 (Top 10)',
                                color: '#e0e0e0',
                                font: { size: 14, weight: 'bold' }
                            }
                        },
                        scales: {
                            x: {
                                title: { display: true, text: '功效', color: '#e0e0e0' },
                                ticks: { maxRotation: 45, minRotation: 30, color: '#e0e0e0' },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: '药材数量', color: '#e0e0e0' },
                                ticks: { color: '#e0e0e0', stepSize: 1, precision: 0 },
                                grid: { color: 'rgba(255, 255, 255, 0.1)' }
                            }
                        }
                    }
                });
                console.log('功效分布图表生成完成');
            })
            .catch(error => {
                console.error('获取功效数据出错:', error);
                ctx.innerHTML = `<div class="chart-no-data"><p>获取功效数据出错</p></div>`;
            });
    }

    // 刷新按钮功能
    function initializeRefreshButtons() {
        document.querySelectorAll('.card-action-btn').forEach(button => {
            button.addEventListener('click', function() {
                this.style.transform = 'rotate(360deg)';
                this.style.transition = 'transform 0.5s ease';
                setTimeout(() => {
                    this.style.transform = '';
                    this.style.transition = '';
                }, 500);
                isDataLoaded = false;
                waitForData();
            });
        });
    }

    // 监听图谱数据更新
    function observeGraphDataChanges() {
        let lastDataString = '';
        setInterval(() => {
            if (window.graphData) {
                const currentDataString = JSON.stringify(window.graphData);
                if (currentDataString !== lastDataString && currentDataString !== '{}') {
                    lastDataString = currentDataString;
                    generateAllAnalysisCharts(window.graphData);
                }
            }
        }, 30000);
    }

    // 初始化
    console.log('开始初始化医药图谱分析功能');
    waitForData();
    initializeRefreshButtons();
    observeGraphDataChanges();

    // 暴露给全局
    window.knowledgeGraphAnalysis = {
        generateAllAnalysisCharts,
        charts,
        waitForData
    };

    console.log('医药图谱分析脚本初始化完成');
});








