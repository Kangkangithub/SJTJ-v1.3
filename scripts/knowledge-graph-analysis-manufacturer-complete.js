// 药材产地数量统计（原制造商统计改造）
class RegionAnalysis {
    constructor() {
        this.chart = null;
        this.chartId = 'manufacturerChart';
    }

    // 生成产地药材数量统计图表
    async generateRegionChart(regionData = null) {
        console.log('开始生成产地药材数量统计图表...');

        try {
            this.showLoading();

            let regionMap = null;
            if (regionData) {
                // 支持数组或对象两种格式
                if (Array.isArray(regionData)) {
                    regionMap = {};
                    regionData.forEach(r => {
                        if (r.name) regionMap[r.name] = r.count;
                    });
                } else if (typeof regionData === 'object') {
                    regionMap = regionData;
                }
            }

            if (!regionMap || Object.keys(regionMap).length === 0) {
                console.log('未传入产地数据，从API获取');
                regionMap = await this.fetchFromAPI();
            }

            if (!regionMap || Object.keys(regionMap).length === 0) {
                console.warn('未获取到产地数据');
                this.showNoData('暂无产地数据');
                return;
            }

            this.renderChart(regionMap);
        } catch (error) {
            console.error('生成产地图表失败:', error);
            this.showNoData('数据加载失败');
        }
    }

    // 从API获取产地数据
    async fetchFromAPI() {
        try {
            console.log('从产地分布API获取数据...');

            // 方法1: 从统计接口
            const statsResponse = await fetch('http://localhost:3001/api/herbs/statistics');
            if (statsResponse.ok) {
                const statsResult = await statsResponse.json();
                if (statsResult.success && statsResult.data && statsResult.data.by_region) {
                    const regionMap = {};
                    statsResult.data.by_region.forEach(r => {
                        regionMap[r.name] = r.count;
                    });
                    return regionMap;
                }
            }

            // 方法2: 从地图产地分布接口
            const distResponse = await fetch('http://localhost:3001/api/knowledge/region-distribution');
            if (distResponse.ok) {
                const distResult = await distResponse.json();
                if (distResult.success && distResult.data && distResult.data.regions) {
                    const regionMap = {};
                    distResult.data.regions.forEach(r => {
                        regionMap[r.name] = r.herb_count;
                    });
                    return regionMap;
                }
            }

            return {};
        } catch (error) {
            console.error('获取产地数据失败:', error);
            return this.getFallbackData();
        }
    }

    // 备用数据
    getFallbackData() {
        return {
            '广东': 27, '四川': 25, '浙江': 23, '江苏': 22, '山东': 15,
            '湖北': 11, '河北': 10, '贵州': 9, '甘肃': 9, '河南': 9
        };
    }

    // 渲染图表
    renderChart(regionMap) {
        const ctx = document.getElementById(this.chartId);
        if (!ctx) {
            console.error(`未找到图表容器: ${this.chartId}`);
            return;
        }

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        // 过滤和排序
        const filteredData = Object.entries(regionMap)
            .filter(([name, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        if (filteredData.length === 0) {
            this.showNoData('没有有效的产地数据');
            return;
        }

        console.log(`准备渲染产地图表，数据点: ${filteredData.length} 个`);

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: filteredData.map(([name]) => name),
                datasets: [{
                    label: '药材数量',
                    data: filteredData.map(([, count]) => count),
                    backgroundColor: (context) => {
                        const { ctx, chartArea } = context.chart;
                        if (!chartArea) return '#45b7d1';
                        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        g.addColorStop(0, '#5cc3db');
                        g.addColorStop(1, '#45b7d1');
                        return g;
                    },
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: '产地药材数量统计 (Top 10)',
                        color: '#e0e0e0',
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `药材数量: ${context.raw} 味`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '产地', color: '#e0e0e0' },
                        ticks: { color: '#e0e0e0', autoSkip: false },
                        grid: { color: 'rgba(255, 255, 255, 0.06)' }
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

        console.log('产地图表渲染完成');
    }

    // 显示加载状态
    showLoading() {
        const ctx = document.getElementById(this.chartId);
        if (ctx) {
            ctx.innerHTML = `
                <div class="chart-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>正在加载产地数据...</p>
                </div>
            `;
        }
    }

    // 显示无数据状态
    showNoData(message = '暂无产地数据') {
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
    async refresh(regionData = null) {
        console.log('刷新产地图表...');
        await this.generateRegionChart(regionData);
    }

    // 销毁图表
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// 全局产地分析实例
window.regionAnalysis = new RegionAnalysis();

// 兼容性函数
window.generateManufacturerChart = function(data) {
    if (window.regionAnalysis) {
        window.regionAnalysis.generateRegionChart(data);
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('产地分析模块加载完成');

    const refreshButtons = document.querySelectorAll('.card-action-btn');
    refreshButtons.forEach(button => {
        if (button.closest('.card') && button.closest('.card').querySelector('#manufacturerChart')) {
            button.addEventListener('click', () => {
                if (window.regionAnalysis) {
                    window.regionAnalysis.refresh();
                }
            });
        }
    });
});
