// 在页面加载后执行
document.addEventListener('DOMContentLoaded', function() {
    // 获取当前页面路径
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // 为当前页面的导航链接添加active类
    document.querySelectorAll('nav ul li a').forEach(link => {
        const href = link.getAttribute('href');
        // 处理首页特殊情况
        if (href === currentPage || 
            (currentPage === 'index.html' && href === 'index.html') || 
            (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        }
    });
});
