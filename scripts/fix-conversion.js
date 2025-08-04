const fs = require('fs');
const path = require('path');

// 修复转换脚本
const inputFile = path.join(__dirname, '../data/[100K]Full_graphData.json');
const outputFile = path.join(__dirname, '../data/fixed_graphData.json');

console.log('开始修复转换...');

// 分块读取并修复数据
function fixConversion() {
    return new Promise((resolve, reject) => {
        console.log('读取原始文件...');
        
        let rawData = '';
        const readStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
        
        readStream.on('data', (chunk) => {
            rawData += chunk;
        });
        
        readStream.on('end', () => {
            try {
                console.log('解析原始数据...');
                const inputData = JSON.parse(rawData);
                
                console.log('原始数据统计:');
                console.log('- 节点数量:', inputData.nodes?.length || 0);
                console.log('- 连接数量:', inputData.links?.length || 0);
                
                if (inputData.nodes && inputData.nodes.length > 0) {
                    console.log('- 第一个节点:', JSON.stringify(inputData.nodes[0], null, 2));
                }
                if (inputData.links && inputData.links.length > 0) {
                    console.log('- 第一个连接:', JSON.stringify(inputData.links[0], null, 2));
                }
                
                // 修复并转换数据
                const fixedData = {
                    nodes: [],
                    links: []
                };
                
                // 处理节点
                if (inputData.nodes) {
                    console.log('处理节点数据...');
                    fixedData.nodes = inputData.nodes.map((node, index) => {
                        const fixedNode = {
                            id: String(node.id || index),
                            labels: [],
                            properties: {}
                        };
                        
                        // 处理标签
                        if (node.labels && Array.isArray(node.labels)) {
                            fixedNode.labels = node.labels;
                        } else if (node.label) {
                            fixedNode.labels = [node.label];
                        } else if (node.type) {
                            fixedNode.labels = [node.type];
                        } else {
                            // 根据节点ID或其他属性推断类型
                            if (node.id && typeof node.id === 'string') {
                                if (node.id.includes('武器') || node.id.includes('战机') || node.id.includes('导弹')) {
                                    fixedNode.labels = ['Weapon'];
                                } else if (node.id.includes('国家') || node.id.includes('中国') || node.id.includes('美国')) {
                                    fixedNode.labels = ['Country'];
                                } else if (node.id.includes('公司') || node.id.includes('厂')) {
                                    fixedNode.labels = ['Manufacturer'];
                                } else {
                                    fixedNode.labels = ['Entity'];
                                }
                            } else {
                                fixedNode.labels = ['Entity'];
                            }
                        }
                        
                        // 处理属性
                        if (node.properties && typeof node.properties === 'object') {
                            fixedNode.properties = { ...node.properties };
                        }
                        
                        // 如果没有name属性，尝试从其他字段获取
                        if (!fixedNode.properties.name) {
                            if (node.name) {
                                fixedNode.properties.name = node.name;
                            } else if (node.label) {
                                fixedNode.properties.name = node.label;
                            } else if (typeof node.id === 'string' && node.id.length > 0) {
                                fixedNode.properties.name = node.id;
                            } else {
                                fixedNode.properties.name = `节点${index + 1}`;
                            }
                        }
                        
                        return fixedNode;
                    });
                }
                
                // 处理连接
                if (inputData.links) {
                    console.log('处理连接数据...');
                    fixedData.links = inputData.links.map((link, index) => {
                        return {
                            source: String(link.source),
                            target: String(link.target),
                            type: link.type || link.relationship || link.label || '关联'
                        };
                    });
                }
                
                console.log('修复后数据统计:');
                console.log('- 节点数量:', fixedData.nodes.length);
                console.log('- 连接数量:', fixedData.links.length);
                
                // 显示修复后的样本
                if (fixedData.nodes.length > 0) {
                    console.log('- 修复后第一个节点:', JSON.stringify(fixedData.nodes[0], null, 2));
                }
                if (fixedData.links.length > 0) {
                    console.log('- 修复后第一个连接:', JSON.stringify(fixedData.links[0], null, 2));
                }
                
                // 写入修复后的文件
                console.log('写入修复后的文件...');
                fs.writeFileSync(outputFile, JSON.stringify(fixedData, null, 2));
                
                console.log('✅ 修复完成！');
                resolve(fixedData);
                
            } catch (error) {
                console.error('修复过程中出错:', error.message);
                reject(error);
            }
        });
        
        readStream.on('error', (error) => {
            console.error('读取文件失败:', error.message);
            reject(error);
        });
    });
}

// 执行修复
fixConversion()
    .then(() => {
        console.log('\n🎉 数据修复完成！');
        console.log('输出文件:', outputFile);
        
        // 创建一个小样本用于测试
        console.log('\n创建测试样本...');
        const fixedData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        
        const sampleData = {
            nodes: fixedData.nodes.slice(0, 50),
            links: fixedData.links.slice(0, 100)
        };
        
        const sampleFile = path.join(__dirname, '../data/sample_fixed_graphData.json');
        fs.writeFileSync(sampleFile, JSON.stringify(sampleData, null, 2));
        
        console.log('✅ 测试样本创建完成！');
        console.log('样本文件:', sampleFile);
        console.log('样本包含:', sampleData.nodes.length, '个节点和', sampleData.links.length, '个连接');
        
    })
    .catch((error) => {
        console.error('❌ 修复失败:', error.message);
    });