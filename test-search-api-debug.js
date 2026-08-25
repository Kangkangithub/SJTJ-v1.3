const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testSearchAPI() {
    console.log('开始测试搜索API...');
    
    const testQueries = ['M4', 'AK', 'Glock', '步枪', '美国'];
    
    for (const query of testQueries) {
        try {
            console.log(`\n测试搜索: "${query}"`);
            
            const response = await fetch(`http://localhost:3001/api/weapons/search?q=${encodeURIComponent(query)}`);
            
            console.log(`响应状态: ${response.status}`);
            
            if (response.ok) {
                const result = await response.json();
                console.log(`搜索结果:`, JSON.stringify(result, null, 2));
            } else {
                const errorText = await response.text();
                console.log(`错误响应:`, errorText);
            }
        } catch (error) {
            console.error(`搜索 "${query}" 失败:`, error.message);
        }
    }
}

// 也测试基本的武器列表API
async function testBasicAPI() {
    console.log('\n测试基本武器列表API...');
    
    try {
        const response = await fetch('http://localhost:3001/api/weapons?limit=3');
        console.log(`基本API响应状态: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('基本API结果:', JSON.stringify(result, null, 2));
        } else {
            const errorText = await response.text();
            console.log('基本API错误:', errorText);
        }
    } catch (error) {
        console.error('基本API测试失败:', error.message);
    }
}

async function main() {
    await testBasicAPI();
    await testSearchAPI();
}

main().catch(console.error);