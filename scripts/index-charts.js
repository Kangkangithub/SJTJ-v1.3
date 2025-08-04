// 首页图表脚本
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在正确的页面上（避免在其他页面执行）
    const weaponCountElement = document.getElementById('weaponCountChart');
    if (!weaponCountElement) {
        console.log('index-charts.js: 不在首页，跳过图表初始化');
        return; // 如果不是首页，直接返回
    }
    
    // 设置Chart.js全局默认值
    Chart.defaults.color = '#e0e0e0';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    
    // 自定义主题色
    const themeColors = {
        blue: '#3498db',
        green: '#1abc9c',
        yellow: '#f1c40f',
        red: '#e74c3c',
        purple: '#9b59b6',
        lightBlue: '#00b0ff',
        lightGreen: '#2ecc71',
        orange: '#e67e22'
    };
    
    // 通用图表配置
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
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
    
    // 1. 武器装备数量统计柱状图
    const weaponCountCtx = weaponCountElement.getContext('2d');
    const weaponCountChart = new Chart(weaponCountCtx, {
        type: 'bar',
        data: {
            labels: ['防空系统', '战斗机', '坦克', '导弹', '舰艇'],
            datasets: [{
                label: '数量',
                data: [68, 79, 58, 47, 39],
                backgroundColor: themeColors.blue,
                borderWidth: 0,
                borderRadius: 4,
                barPercentage: 0.6,
                categoryPercentage: 0.7
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 80,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            plugins: {
                ...commonOptions.plugins,
                title: {
                    display: false,
                    text: '武器装备数量统计'
                }
            }
        }
    });
    
    // 2. 武器装备使用趋势折线图
    const qaUsageCtx = document.getElementById('qaUsageChart').getContext('2d');
    const qaUsageChart = new Chart(qaUsageCtx, {
        type: 'line',
        data: {
            labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
            datasets: [{
                label: '使用次数',
                data: [450, 590, 680, 780, 890, 980, 1080],
                borderColor: themeColors.blue,
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: themeColors.blue,
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 1200,
                    ticks: {
                        stepSize: 200
                    }
                }
            }
        }
    });
    
    // 3. 推荐系统性能指标雷达图
    const recommendationMetricsCtx = document.getElementById('recommendationMetricsChart').getContext('2d');
    const recommendationMetricsChart = new Chart(recommendationMetricsCtx, {
        type: 'radar',
        data: {
            labels: ['准确性', '可靠性', '防护力', '火力', '机动性'],
            datasets: [{
                label: '武器性能',
                data: [85, 78, 90, 70, 85],
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: themeColors.blue,
                borderWidth: 2,
                pointBackgroundColor: themeColors.blue,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: themeColors.blue
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                r: {
                    angleLines: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        color: '#e0e0e0',
                        font: {
                            size: 12
                        }
                    },
                    ticks: {
                        backdropColor: 'transparent',
                        stepSize: 20,
                        max: 100,
                        min: 0,
                        display: false
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            },
            plugins: {
                ...commonOptions.plugins,
                legend: {
                    display: false
                }
            }
        }
    });
    
    // 4. 武器国别分布饼图
    const testPassRateCtx = document.getElementById('testPassRateChart').getContext('2d');
    const testPassRateChart = new Chart(testPassRateCtx, {
        type: 'pie',
        data: {
            labels: ['美国', '中国', '俄罗斯', '法国'],
            datasets: [{
                label: '武器分布',
                data: [38, 32, 18, 12],
                backgroundColor: [
                    themeColors.blue,
                    themeColors.lightBlue,
                    themeColors.lightGreen,
                    themeColors.green
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
    
    // 添加刷新按钮功能
    document.querySelectorAll('.card-action-btn').forEach(button => {
        button.addEventListener('click', function() {
            const card = this.closest('.card');
            const chartContainer = card.querySelector('.chart-container');
            const chartId = chartContainer.querySelector('canvas').id;
            
            // 模拟刷新数据
            switch (chartId) {
                case 'weaponCountChart':
                    updateWeaponCountChart(weaponCountChart);
                    break;
                case 'qaUsageChart':
                    updateQaUsageChart(qaUsageChart);
                    break;
                case 'recommendationMetricsChart':
                    updateRecommendationMetricsChart(recommendationMetricsChart);
                    break;
                case 'testPassRateChart':
                    updateTestPassRateChart(testPassRateChart);
                    break;
            }
        });
    });
    
    // 模拟刷新数据函数
    function updateWeaponCountChart(chart) {
        const newData = Array.from({length: 5}, () => Math.floor(Math.random() * 50) + 30);
        chart.data.datasets[0].data = newData;
        chart.update();
    }
    
    function updateQaUsageChart(chart) {
        const baseValue = 400;
        const newData = [baseValue];
        for (let i = 1; i < 7; i++) {
            newData.push(newData[i-1] + Math.floor(Math.random() * 150) + 50);
        }
        chart.data.datasets[0].data = newData;
        chart.update();
    }
    
    function updateRecommendationMetricsChart(chart) {
        const newData = Array.from({length: 5}, () => Math.floor(Math.random() * 30) + 70);
        chart.data.datasets[0].data = newData;
        chart.update();
    }
    
    function updateTestPassRateChart(chart) {
        const total = 100;
        const excellent = Math.floor(Math.random() * 40) + 20;
        const good = Math.floor(Math.random() * 30) + 20;
        const pass = Math.floor(Math.random() * 20) + 10;
        const fail = total - excellent - good - pass;
        
        chart.data.datasets[0].data = [excellent, good, pass, fail];
        chart.update();
    }
}); 