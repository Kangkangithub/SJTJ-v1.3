// 首页图表脚本 - 中医药版本
document.addEventListener('DOMContentLoaded', function() {
    const herbCategoryElement = document.getElementById('herbCategoryChart');
    if (!herbCategoryElement) {
        console.log('index-charts.js: 不在首页，跳过图表初始化');
        return;
    }

    Chart.defaults.color = '#e0e0e0';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

    const colors = {
        blue: '#3498db',
        green: '#1abc9c',
        yellow: '#f1c40f',
        red: '#e74c3c',
        purple: '#9b59b6',
        lightBlue: '#00b0ff',
        lightGreen: '#2ecc71',
        orange: '#e67e22'
    };

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleFont: { size: 14 },
                bodyFont: { size: 13 },
                padding: 10,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
            }
        }
    };

    // 1. 药材分类统计柱状图
    const herbCategoryCtx = herbCategoryElement.getContext('2d');
    const herbCategoryChart = new Chart(herbCategoryCtx, {
        type: 'bar',
        data: {
            labels: ['补虚药', '清热药', '解表药', '活血化瘀药', '利水渗湿药'],
            datasets: [{
                label: '药材数量',
                data: [39, 35, 28, 25, 22],
                backgroundColor: colors.green,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    max: 45,
                    ticks: { stepSize: 10 }
                }
            }
        }
    });

    // 2. 平台使用趋势折线图
    const usageTrendCtx = document.getElementById('usageTrendChart').getContext('2d');
    const usageTrendChart = new Chart(usageTrendCtx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
            datasets: [{
                label: '查询次数',
                data: [320, 450, 560, 680, 750, 890, 960],
                borderColor: colors.blue,
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: colors.blue,
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    max: 1200,
                    ticks: { stepSize: 200 }
                }
            }
        }
    });

    // 3. 药性分布雷达图
    const propertyRadarCtx = document.getElementById('propertyRadarChart').getContext('2d');
    const propertyRadarChart = new Chart(propertyRadarCtx, {
        type: 'radar',
        data: {
            labels: ['寒', '热', '温', '凉', '平'],
            datasets: [{
                label: '药材数量',
                data: [62, 35, 48, 28, 57],
                backgroundColor: 'rgba(26, 188, 156, 0.2)',
                borderColor: colors.green,
                borderWidth: 2,
                pointBackgroundColor: colors.green,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: colors.green
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#e0e0e0', font: { size: 12 } },
                    ticks: {
                        backdropColor: 'transparent',
                        stepSize: 20,
                        max: 80,
                        min: 0,
                        display: false
                    },
                    suggestedMin: 0,
                    suggestedMax: 80
                }
            }
        }
    });

    // 4. 道地产区分布饼图
    const regionPieCtx = document.getElementById('regionPieChart').getContext('2d');
    const regionPieChart = new Chart(regionPieCtx, {
        type: 'pie',
        data: {
            labels: ['甘肃', '四川', '云南', '吉林', '河南'],
            datasets: [{
                label: '药材数量',
                data: [28, 25, 22, 18, 15],
                backgroundColor: [
                    colors.green,
                    colors.lightGreen,
                    colors.blue,
                    colors.yellow,
                    colors.orange
                ],
                borderWidth: 2,
                borderColor: '#131a27'
            }]
        },
        options: {
            ...commonOptions,
            cutout: '0%',
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    position: 'right',
                    display: true,
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        boxWidth: 8
                    }
                }
            }
        }
    });

    // 刷新按钮事件
    document.querySelectorAll('.card-action-btn').forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.card');
            const chartContainer = card.querySelector('.chart-container');
            const chartId = chartContainer.querySelector('canvas').id;

            switch (chartId) {
                case 'herbCategoryChart':
                    chart.data.datasets[0].data = Array.from({length: 5}, () => Math.floor(Math.random() * 20) + 20);
                    chart.update();
                    break;
                case 'usageTrendChart':
                    updateTrendChart(chart);
                    break;
                case 'propertyRadarChart':
                    chart.data.datasets[0].data = Array.from({length: 5}, () => Math.floor(Math.random() * 40) + 20);
                    chart.update();
                    break;
                case 'regionPieChart':
                    updateRegionChart(chart);
                    break;
            }
        });
    });

    function updateTrendChart(chart) {
        const base = 300;
        const data = [base];
        for (let i = 1; i < 7; i++) {
            data.push(data[i - 1] + Math.floor(Math.random() * 150) + 50);
        }
        chart.data.datasets[0].data = data;
        chart.update();
    }

    function updateRegionChart(chart) {
        const total = 100;
        const a = Math.floor(Math.random() * 20) + 15;
        const b = Math.floor(Math.random() * 20) + 15;
        const c = Math.floor(Math.random() * 15) + 10;
        const d = Math.floor(Math.random() * 15) + 10;
        const e = total - a - b - c - d;
        chart.data.datasets[0].data = [a, b, c, d, e];
        chart.update();
    }
});
