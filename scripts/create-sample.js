const fs = require('fs');
const path = require('path');

// 从转换后的大文件中提取前100个节点和相关连接作为样本
const convertedFile = path.join(__dirname, '../data/converted_graphData.json');
const sampleFile = path.join(__dirname, '../data/sample_converted_graphData.json');

console.log('创建样本文件...');

// 流式读取并提取样本
let rawData = '';
const readStream = fs.createReadStream(convertedFile, { encoding: 'utf8' });

readStream.on('data', (chunk) => {
    rawData += chunk;
    
    // 当我们有足够的数据时，提取样本
    if (rawData.length > 50000) {
        readStream.destroy();
        
        try {
            const data = JSON.parse(rawData);
            
            // 提取前100个节点
            const sampleNodes = data.nodes.slice(0, 100);
            const nodeIds = new Set(sampleNodes.map(node => node.id));
            
            // 提取与这些节点相关的连接
            const sampleLinks = data.links.filter(link => 
                nodeIds.has(link.source) && nodeIds.has(link.target)
            ).slice(0, 150);
            
            const sampleData = {
                nodes: sampleNodes,
                links: sampleLinks
            };
            
            // 写入样本文件
            fs.writeFileSync(sampleFile, JSON.stringify(sampleData, null, 2));
            
            console.log('✅ 样本文件创建成功！');
            console.log(`- 样本节点数量: ${sampleData.nodes.length}`);
            console.log(`- 样本连接数量: ${sampleData.links.length}`);
            console.log(`- 样本文件: ${sampleFile}`);
            
        } catch (error) {
            console.error('处理数据时出错:', error.message);
        }
    }
});

readStream.on('error', (error) => {
    console.error('读取文件失败:', error.message);
});