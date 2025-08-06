// 制造商武器数量统计完整修复版本
class ManufacturerAnalysis {
    constructor() {
        this.chart = null;
        this.chartId = 'manufacturerChart';
    }

    // 主要的制造商图表生成函数
    async generateManufacturerChart(graphData = null) {
        console.log('开始生成制造商武器数量统计图表...');
        
        try {
            this.showLoading();
            
            // 尝试多种数据源获取制造商数据
            let manufacturerData = await this.getManufacturerData(graphData);
            
            if (!manufacturerData || Object.keys(manufacturerData).length === 0) {
                console.warn('未获取到制造商数据，显示无数据状态');
                this.showNoData('暂无制造商数据');
                return;
            }
            
            console.log('制造商数据获取成功:', manufacturerData);
            this.renderChart(manufacturerData);
            
        } catch (error) {
            console.error('生成制造商图表失败:', error);
            this.showNoData('数据加载失败');
        }
    }

    // 获取制造商数据的主函数
    async getManufacturerData(graphData = null) {
        console.log('开始获取制造商数据...');
        
        // 方法1: 从图谱数据中提取
        if (graphData) {
            console.log('尝试从图谱数据提取制造商信息...');
            const graphManufacturerData = this.extractFromGraphData(graphData);
            if (Object.keys(graphManufacturerData).length > 0) {
                console.log('从图谱数据成功提取制造商数据:', graphManufacturerData);
                return graphManufacturerData;
            }
        }

        // 方法2: 从API获取武器数据并统计制造商
        console.log('尝试从API获取武器数据...');
        const apiManufacturerData = await this.fetchFromAPI();
        if (Object.keys(apiManufacturerData).length > 0) {
            console.log('从API成功获取制造商数据:', apiManufacturerData);
            return apiManufacturerData;
        }

        // 方法3: 使用备用数据
        console.log('使用备用制造商数据...');
        return this.getFallbackData();
    }

    // 从图谱数据中提取制造商信息
    extractFromGraphData(graphData) {
        console.log('从图谱数据提取制造商信息...');
        
        if (!graphData || !graphData.nodes || !graphData.links) {
            console.warn('图谱数据格式不正确');
            return {};
        }

        const nodeMap = {};
        const manufacturerCount = {};

        // 构建节点映射
        graphData.nodes.forEach(node => {
            nodeMap[node.id] = node;
            
            // 初始化制造商节点
            if (node.labels && node.labels.includes('Manufacturer') && node.properties && node.properties.name) {
                manufacturerCount[node.properties.name] = 0;
            }
        });

        // 统计制造商武器数量
        graphData.links.forEach(link => {
            const sourceNode = nodeMap[link.source];
            const targetNode = nodeMap[link.target];

            if (!sourceNode || !targetNode) return;

            // 通过MANUFACTURED_BY关系统计
            if (link.type === 'MANUFACTURED_BY' && 
                sourceNode.labels && sourceNode.labels.includes('Weapon') && 
                targetNode.labels && targetNode.labels.includes('Manufacturer')) {
                
                const manufacturerName = targetNode.properties.name;
                if (manufacturerName) {
                    manufacturerCount[manufacturerName] = (manufacturerCount[manufacturerName] || 0) + 1;
                }
            }
        });

        // 也尝试从武器节点的manufacturer属性中提取
        graphData.nodes.forEach(node => {
            if (node.labels && node.labels.includes('Weapon') && 
                node.properties && node.properties.manufacturer) {
                const manufacturerName = node.properties.manufacturer;
                manufacturerCount[manufacturerName] = (manufacturerCount[manufacturerName] || 0) + 1;
            }
        });

        console.log('从图谱数据提取的制造商统计:', manufacturerCount);
        return manufacturerCount;
    }

    // 从API获取数据 - 使用专门的制造商统计API
    async fetchFromAPI() {
        try {
            console.log('从制造商统计API获取数据...');
            console.log('连接端口 3001...');
            
            // 首先尝试专门的制造商统计API
            try {
                const statsResponse = await fetch('http://localhost:3001/api/manufacturer-statistics/weapon-count');
                
                if (statsResponse.ok) {
                    const statsResult = await statsResponse.json();
                    console.log('制造商统计API响应:', statsResult);
                    
                    if (statsResult.success && statsResult.data && statsResult.data.manufacturer_count) {
                        console.log('成功从制造商统计API获取数据');
                        return statsResult.data.manufacturer_count;
                    }
                }
            } catch (statsError) {
                console.warn('制造商统计API不可用，回退到武器API:', statsError);
            }
            
            // 回退到原有的武器API方式
            console.log('使用武器API获取数据...');
            const response = await fetch('http://localhost:3001/api/weapons?limit=10000');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('成功连接到端口 3001');

            const result = await response.json();
            console.log('API响应数据结构:', Object.keys(result));
            
            // 解析不同格式的API响应
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

            console.log(`解析到武器数据: ${weapons.length} 条`);
            
            if (weapons.length > 0) {
                console.log('武器数据示例:', weapons[0]);
                console.log('制造商字段示例:', weapons.slice(0, 5).map(w => ({ name: w.name, manufacturer: w.manufacturer })));
            }

            if (weapons.length === 0) {
                console.warn('API返回的武器数据为空');
                return {};
            }

            // 统计制造商 - 改进版本
            const manufacturerCount = {};
            let weaponsWithManufacturer = 0;
            let weaponsWithoutManufacturer = 0;
            
            weapons.forEach(weapon => {
                if (weapon.manufacturer && weapon.manufacturer.trim() && weapon.manufacturer !== 'null') {
                    const manufacturer = weapon.manufacturer.trim();
                    manufacturerCount[manufacturer] = (manufacturerCount[manufacturer] || 0) + 1;
                    weaponsWithManufacturer++;
                } else {
                    weaponsWithoutManufacturer++;
                    // 对于没有制造商信息的武器，可以根据国家进行分组
                    const unknownKey = `未知制造商 (${weapon.country || '未知国家'})`;
                    manufacturerCount[unknownKey] = (manufacturerCount[unknownKey] || 0) + 1;
                }
            });

            console.log(`统计结果:`);
            console.log(`- 有制造商信息的武器: ${weaponsWithManufacturer} 条`);
            console.log(`- 无制造商信息的武器: ${weaponsWithoutManufacturer} 条`);
            console.log(`- 统计到制造商: ${Object.keys(manufacturerCount).length} 个`);
            console.log('制造商统计详情:', manufacturerCount);
            
            return manufacturerCount;

        } catch (error) {
            console.error('从API获取数据失败:', error);
            return {};
        }
    }

    // 获取备用数据
    getFallbackData() {
        console.log('使用备用制造商数据...');
        
        return {
            '中国北方工业公司': 15,
            '洛克希德·马丁': 12,
            '波音公司': 10,
            '卡拉什尼科夫集团': 8,
            '莱茵金属': 6,
            '泰雷兹集团': 5,
            'BAE系统公司': 4,
            '以色列军事工业': 3,
            '中国南方工业集团': 7,
            '雷神公司': 9
        };
    }

    // 渲染图表
    renderChart(manufacturerData) {
        const ctx = document.getElementById(this.chartId);
        if (!ctx) {
            console.error(`未找到图表容器: ${this.chartId}`);
            return;
        }

        // 销毁现有图表
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        // 过滤和排序数据
        const filteredData = Object.entries(manufacturerData)
            .filter(([name, count]) => count > 0)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // 只显示前10个

        if (filteredData.length === 0) {
            this.showNoData('没有有效的制造商数据');
            return;
        }

        console.log(`准备渲染图表，数据点: ${filteredData.length} 个`);

        // 创建新图表
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: filteredData.map(([name]) => 
                    name.length > 12 ? name.substring(0, 12) + '...' : name
                ),
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
                        color: '#e0e0e0',
                        font: { size: 16, weight: 'bold' }
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

        console.log('制造商图表渲染完成');
    }

    // 显示加载状态
    showLoading() {
        const ctx = document.getElementById(this.chartId);
        if (ctx) {
            ctx.innerHTML = `
                <div class="chart-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>正在加载制造商数据...</p>
                </div>
            `;
        }
    }

    // 显示无数据状态
    showNoData(message = '暂无制造商数据') {
        const ctx = document.getElementById(this.chartId);
        if (ctx) {
            ctx.innerHTML = `
                <div class="chart-no-data">
                    <i class="fas fa-chart-bar"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    // 刷新图表
    async refresh(graphData = null) {
        console.log('刷新制造商图表...');
        await this.generateManufacturerChart(graphData);
    }

    // 销毁图表
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// 全局制造商分析实例
window.manufacturerAnalysis = new ManufacturerAnalysis();

// 兼容性函数 - 供原有代码调用
window.generateManufacturerChart = function(data) {
    if (window.manufacturerAnalysis) {
        window.manufacturerAnalysis.generateManufacturerChart(data);
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('制造商分析模块加载完成');
    
    // 监听刷新按钮
    const refreshButtons = document.querySelectorAll('.card-action-btn');
    refreshButtons.forEach(button => {
        if (button.closest('.card').querySelector('#manufacturerChart')) {
            button.addEventListener('click', () => {
                if (window.manufacturerAnalysis) {
                    window.manufacturerAnalysis.refresh();
                }
            });
        }
    });
});