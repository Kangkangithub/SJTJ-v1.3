// 制造商武器数量统计修复脚本
document.addEventListener('DOMContentLoaded', function() {
    console.log('制造商统计修复脚本加载...');
    
    // 等待主脚本加载完成后再执行修复
    setTimeout(() => {
        if (window.knowledgeGraphAnalysis) {
            // 重写制造商图表生成函数
            window.generateManufacturerChartFixed = generateManufacturerChartFixed;
            
            // 监听图表刷新事件
            document.querySelectorAll('.card-action-btn').forEach(button => {
                const card = button.closest('.card');
                const chartCanvas = card.querySelector('#manufacturerChart');
                
                if (chartCanvas) {
                    button.addEventListener('click', function() {
                        console.log('制造商图表刷新按钮被点击');
                        refreshManufacturerChart();
                    });
                }
            });
            
            console.log('制造商统计修复脚本初始化完成');
        }
    }, 2000);
});

// 修复版制造商图表生成函数
function generateManufacturerChartFixed(analysisData) {
    const ctx = document.getElementById('manufacturerChart');
    if (!ctx) {
        console.error('未找到manufacturerChart元素');
        return;
    }

    let manufacturerData = analysisData.manufacturerWeaponCount || {};
    console.log('原始制造商数据:', manufacturerData);
    
    // 如果图谱数据中没有制造商信息，尝试从武器数据中提取
    if (Object.keys(manufacturerData).length === 0) {
        console.log('图谱数据中无制造商信息，尝试从武器数据提取...');
        manufacturerData = extractManufacturerDataFromWeapons(analysisData);
    }
    
    // 过滤掉数量为0的制造商，并排序
    const filteredData = Object.entries(manufacturerData)
        .filter(([name, count]) => count > 0)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // 只显示前10个
    
    console.log('过滤后的制造商数据:', filteredData);
    
    if (filteredData.length === 0) {
        // 如果还是没有数据，尝试从API获取
        fetchManufacturerDataFromAPI(ctx);
        return;
    }

    // 销毁现有图表
    if (window.knowledgeGraphAnalysis && window.knowledgeGraphAnalysis.charts.manufacturer) {
        window.knowledgeGraphAnalysis.charts.manufacturer.destroy();
    }

    // 创建新图表
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: filteredData.map(([name]) => name.length > 12 ? name.substring(0, 12) + '...' : name),
            datasets: [{
                label: '武器数量',
                data: filteredData.map(([, count]) => count),
                backgroundColor: '#f39c12',
                borderRadius: 4,
                borderWidth: 1,
                borderColor: 'rgba(243, 156, 18, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: '制造商武器数量统计',
                    color: '#e0e0e0'
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#e0e0e0',
                    bodyColor: '#e0e0e0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            const fullName = filteredData[context[0].dataIndex][0];
                            return fullName;
                        },
                        label: function(context) {
                            return `武器数量: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: '制造商',
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
                        text: '武器数量',
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
    
    // 保存图表实例
    if (window.knowledgeGraphAnalysis) {
        window.knowledgeGraphAnalysis.charts.manufacturer = chart;
    }
    
    console.log('制造商图表生成完成，数据点数量:', filteredData.length);
}

// 从武器数据中提取制造商信息
function extractManufacturerDataFromWeapons(analysisData) {
    const manufacturerCount = {};
    
    // 遍历所有节点，寻找武器节点
    if (analysisData.nodeMap) {
        Object.values(analysisData.nodeMap).forEach(node => {
            if (node.labels.includes('Weapon') && node.properties.manufacturer) {
                const manufacturer = node.properties.manufacturer;
                manufacturerCount[manufacturer] = (manufacturerCount[manufacturer] || 0) + 1;
            }
        });
    }
    
    console.log('从武器数据提取的制造商信息:', manufacturerCount);
    return manufacturerCount;
}

// 从API获取制造商数据
async function fetchManufacturerDataFromAPI(ctx) {
    try {
        console.log('尝试从API获取制造商数据...');
        
        // 显示加载状态
        ctx.innerHTML = `
            <div class="chart-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>正在加载制造商数据...</p>
            </div>
        `;
        
        // 尝试获取武器数据并统计制造商
        const response = await fetch('http://localhost:3001/api/weapons?limit=1000');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('API返回的武器数据:', result);
        
        let weapons = [];
        if (Array.isArray(result)) {
            weapons = result;
        } else if (result.data && result.data.weapons && Array.isArray(result.data.weapons)) {
            weapons = result.data.weapons;
        } else if (result.data && Array.isArray(result.data)) {
            weapons = result.data;
        } else if (result.weapons && Array.isArray(result.weapons)) {
            weapons = result.weapons;
        }
        
        console.log('处理后的武器数据:', weapons.length, '条');
        
        if (weapons.length === 0) {
            showNoManufacturerData(ctx);
            return;
        }
        
        // 统计制造商
        const manufacturerCount = {};
        weapons.forEach(weapon => {
            if (weapon.manufacturer) {
                manufacturerCount[weapon.manufacturer] = (manufacturerCount[weapon.manufacturer] || 0) + 1;
            }
        });
        
        console.log('从API数据统计的制造商:', manufacturerCount);
        
        if (Object.keys(manufacturerCount).length === 0) {
            showNoManufacturerData(ctx);
            return;
        }
        
        // 生成图表
        const filteredData = Object.entries(manufacturerCount)
            .filter(([name, count]) => count > 0)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        generateManufacturerChartFromData(ctx, filteredData);
        
    } catch (error) {
        console.error('从API获取制造商数据失败:', error);
        showNoManufacturerData(ctx, '数据加载失败');
    }
}

// 从数据生成制造商图表
function generateManufacturerChartFromData(ctx, data) {
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(([name]) => name.length > 12 ? name.substring(0, 12) + '...' : name),
            datasets: [{
                label: '武器数量',
                data: data.map(([, count]) => count),
                backgroundColor: '#f39c12',
                borderRadius: 4,
                borderWidth: 1,
                borderColor: 'rgba(243, 156, 18, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: '制造商武器数量统计',
                    color: '#e0e0e0'
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#e0e0e0',
                    bodyColor: '#e0e0e0',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            const fullName = data[context[0].dataIndex][0];
                            return fullName;
                        },
                        label: function(context) {
                            return `武器数量: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { 
                        display: true, 
                        text: '制造商',
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
                        text: '武器数量',
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
    
    // 保存图表实例
    if (window.knowledgeGraphAnalysis) {
        window.knowledgeGraphAnalysis.charts.manufacturer = chart;
    }
    
    console.log('从API数据生成制造商图表完成');
}

// 显示无制造商数据
function showNoManufacturerData(ctx, message = '暂无制造商数据') {
    ctx.innerHTML = `
        <div class="chart-no-data">
            <i class="fas fa-chart-bar"></i>
            <p>${message}</p>
            <small>请检查武器数据中是否包含制造商信息</small>
        </div>
    `;
}

// 刷新制造商图表
function refreshManufacturerChart() {
    console.log('刷新制造商图表...');
    
    // 如果有图谱数据，重新生成
    if (window.graphData && window.graphData.nodes && window.graphData.links) {
        const analysisData = preprocessGraphData(window.graphData);
        generateManufacturerChartFixed(analysisData);
    } else {
        // 否则从API获取
        const ctx = document.getElementById('manufacturerChart');
        if (ctx) {
            fetchManufacturerDataFromAPI(ctx);
        }
    }
}

// 预处理图谱数据
function preprocessGraphData(data) {
    const nodeMap = {};
    const manufacturerWeaponCount = {};
    
    // 构建节点映射
    data.nodes.forEach(node => {
        nodeMap[node.id] = node;
        
        // 制造商节点初始化
        if (node.labels.includes('Manufacturer') && node.properties.name) {
            const manufacturerName = node.properties.name;
            manufacturerWeaponCount[manufacturerName] = 0;
        }
    });
    
    // 统计制造商的武器数量
    data.links.forEach(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        const sourceNode = nodeMap[sourceId];
        const targetNode = nodeMap[targetId];
        
        if (!sourceNode || !targetNode) {
            return;
        }
        
        // 制造商武器数量统计 - 支持多种关系类型
        if ((link.type === 'MANUFACTURED_BY' || link.type === 'PRODUCED_BY') && 
            sourceNode.labels.includes('Weapon') && 
            targetNode.labels.includes('Manufacturer')) {
            const manufacturerName = targetNode.properties.name;
            if (manufacturerName) {
                manufacturerWeaponCount[manufacturerName] = (manufacturerWeaponCount[manufacturerName] || 0) + 1;
            }
        }
        
        // 反向关系：制造商 -> 武器
        if ((link.type === 'MANUFACTURES' || link.type === 'PRODUCES') && 
            sourceNode.labels.includes('Manufacturer') && 
            targetNode.labels.includes('Weapon')) {
            const manufacturerName = sourceNode.properties.name;
            if (manufacturerName) {
                manufacturerWeaponCount[manufacturerName] = (manufacturerWeaponCount[manufacturerName] || 0) + 1;
            }
        }
    });
    
    return {
        nodeMap,
        manufacturerWeaponCount
    };
}

// 添加样式
const style = document.createElement('style');
style.textContent = `
    .chart-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #e0e0e0;
    }
    
    .chart-loading i {
        font-size: 2rem;
        margin-bottom: 1rem;
        color: #3498db;
    }
    
    .chart-no-data {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #e0e0e0;
        text-align: center;
    }
    
    .chart-no-data i {
        font-size: 2rem;
        margin-bottom: 1rem;
        color: #95a5a6;
    }
    
    .chart-no-data p {
        margin: 0.5rem 0;
        font-size: 1.1rem;
    }
    
    .chart-no-data small {
        color: #bdc3c7;
        font-size: 0.9rem;
    }
`;
document.head.appendChild(style);

console.log('制造商武器数量统计修复脚本加载完成');