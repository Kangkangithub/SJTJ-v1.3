const fs = require('fs');
const path = require('path');

// 验证转换结果的脚本
const convertedFile = path.join(__dirname, '../data/converted_graphData.json');

console.log('验证转换后的文件格式...');

// 读取文件的前几行来验证格式
const readStream = fs.createReadStream(convertedFile, { encoding: 'utf8' });
let buffer = '';
let sampleData = null;

readStream.on('data', (chunk) => {
    buffer += chunk;
    
    // 当我们有足够的数据时，尝试解析前几个节点
    if (buffer.length > 10000 && !sampleData) {
        try {
            // 找到第一个完整的节点
            const firstBrace = buffer.indexOf('{');
            const nodesStart = buffer.indexOf('"nodes"');
            
            if (nodesStart !== -1) {
                // 提取前几个节点作为样本
                const nodesArrayStart = buffer.indexOf('[', nodesStart);
                if (nodesArrayStart !== -1) {
                    // 找到前3个节点
                    let nodeCount = 0;
                    let braceCount = 0;
                    let inNode = false;
                    let sampleEnd = nodesArrayStart + 1;
                    
                    for (let i = nodesArrayStart + 1; i < buffer.length && nodeCount < 3; i++) {
                        const char = buffer[i];
                        
                        if (char === '{') {
                            braceCount++;
                            inNode = true;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0 && inNode) {
                                nodeCount++;
                                inNode = false;
                                sampleEnd = i + 1;
                                
                                // 跳过可能的逗号和空白
                                while (i + 1 < buffer.length && (buffer[i + 1] === ',' || buffer[i + 1] === ' ' || buffer[i + 1] === '\n')) {
                                    i++;
                                    sampleEnd = i + 1;
                                }
                            }
                        }
                    }
                    
                    const sampleNodes = buffer.substring(nodesArrayStart + 1, sampleEnd - 1);
                    console.log('前3个节点样本:');
                    console.log('[' + sampleNodes + ']');
                    
                    // 尝试解析样本
                    try {
                        const parsedSample = JSON.parse('[' + sampleNodes + ']');
                        console.log('\n✅ 格式验证成功！');
                        console.log('样本节点结构:');
                        parsedSample.forEach((node, index) => {
                            console.log(`节点 ${index + 1}:`, JSON.stringify(node, null, 2));
                        });
                        
                        sampleData = parsedSample;
                    } catch (parseError) {
                        console.log('❌ 样本解析失败:', parseError.message);
                    }
                }
            }
        } catch (error) {
            console.log('提取样本时出错:', error.message);
        }
        
        readStream.destroy(); // 停止读取
    }
});

readStream.on('end', () => {
    if (!sampleData) {
        console.log('未能提取到有效样本');
    }
});

readStream.on('error', (error) => {
    console.error('读取文件失败:', error.message);
});

// 同时检查文件大小
fs.stat(convertedFile, (err, stats) => {
    if (err) {
        console.error('获取文件信息失败:', err.message);
    } else {
        console.log(`\n文件信息:`);
        console.log(`- 文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- 修改时间: ${stats.mtime}`);
    }
});