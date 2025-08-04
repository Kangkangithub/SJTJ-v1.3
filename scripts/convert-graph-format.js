const fs = require('fs');
const path = require('path');

// 输入和输出文件路径
const inputFile = path.join(__dirname, '../data/[100K]Full_graphData.json');
const outputFile = path.join(__dirname, '../data/converted_graphData.json');
const templateFile = path.join(__dirname, '../data/graphData.json');

console.log('开始转换图数据格式...');
console.log('输入文件:', inputFile);
console.log('输出文件:', outputFile);
console.log('模板文件:', templateFile);

// 读取模板文件以了解目标格式
let templateData;
try {
    const templateContent = fs.readFileSync(templateFile, 'utf8');
    templateData = JSON.parse(templateContent);
    console.log('模板格式分析:');
    console.log('- 节点数量:', templateData.nodes.length);
    console.log('- 连接数量:', templateData.links.length);
    console.log('- 节点结构示例:', JSON.stringify(templateData.nodes[0], null, 2));
    console.log('- 连接结构示例:', JSON.stringify(templateData.links[0], null, 2));
} catch (error) {
    console.error('读取模板文件失败:', error.message);
    process.exit(1);
}

// 分块读取大文件
function convertLargeFile() {
    return new Promise((resolve, reject) => {
        console.log('\n开始读取大文件...');
        
        // 使用流式读取来处理大文件
        let rawData = '';
        const readStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
        
        readStream.on('data', (chunk) => {
            rawData += chunk;
        });
        
        readStream.on('end', () => {
            try {
                console.log('文件读取完成，开始解析JSON...');
                const inputData = JSON.parse(rawData);
                
                console.log('原始数据分析:');
                console.log('- 数据类型:', typeof inputData);
                console.log('- 是否为数组:', Array.isArray(inputData));
                
                if (inputData.nodes && inputData.links) {
                    console.log('- 原始节点数量:', inputData.nodes.length);
                    console.log('- 原始连接数量:', inputData.links.length);
                    console.log('- 原始节点结构示例:', JSON.stringify(inputData.nodes[0], null, 2));
                    console.log('- 原始连接结构示例:', JSON.stringify(inputData.links[0], null, 2));
                }
                
                // 转换数据格式
                const convertedData = convertToTargetFormat(inputData, templateData);
                
                // 写入转换后的文件
                console.log('\n开始写入转换后的文件...');
                fs.writeFileSync(outputFile, JSON.stringify(convertedData, null, 2), 'utf8');
                
                console.log('✅ 转换完成！');
                console.log('转换后数据统计:');
                console.log('- 节点数量:', convertedData.nodes.length);
                console.log('- 连接数量:', convertedData.links.length);
                
                resolve(convertedData);
                
            } catch (parseError) {
                console.error('解析JSON失败:', parseError.message);
                reject(parseError);
            }
        });
        
        readStream.on('error', (error) => {
            console.error('读取文件失败:', error.message);
            reject(error);
        });
    });
}

// 转换数据格式的函数
function convertToTargetFormat(inputData, templateData) {
    console.log('\n开始格式转换...');
    
    // 目标格式: { nodes: [...], links: [...] }
    const result = {
        nodes: [],
        links: []
    };
    
    // 如果输入数据已经是正确格式
    if (inputData.nodes && inputData.links) {
        console.log('输入数据已经是目标格式，进行结构标准化...');
        
        // 转换节点格式
        result.nodes = inputData.nodes.map((node, index) => {
            // 确保节点有正确的结构
            const convertedNode = {
                id: node.id || String(index + 1),
                labels: node.labels || ["Unknown"],
                properties: node.properties || {}
            };
            
            // 如果节点没有labels但有type属性，使用type作为label
            if (!node.labels && node.type) {
                convertedNode.labels = [node.type];
            }
            
            // 如果节点有name属性但properties中没有，添加到properties中
            if (node.name && !convertedNode.properties.name) {
                convertedNode.properties.name = node.name;
            }
            
            return convertedNode;
        });
        
        // 转换连接格式
        result.links = inputData.links.map((link, index) => {
            return {
                source: String(link.source),
                target: String(link.target),
                type: link.type || link.relationship || "关联"
            };
        });
        
    } else if (Array.isArray(inputData)) {
        console.log('输入数据是数组格式，尝试解析...');
        
        // 如果输入是数组，尝试分离节点和连接
        const nodes = [];
        const links = [];
        
        inputData.forEach((item, index) => {
            if (item.source && item.target) {
                // 这是一个连接
                links.push({
                    source: String(item.source),
                    target: String(item.target),
                    type: item.type || item.relationship || "关联"
                });
            } else {
                // 这是一个节点
                nodes.push({
                    id: item.id || String(index + 1),
                    labels: item.labels || [item.type || "Unknown"],
                    properties: item.properties || { name: item.name || `节点${index + 1}` }
                });
            }
        });
        
        result.nodes = nodes;
        result.links = links;
        
    } else {
        console.log('未知的输入数据格式，使用默认转换...');
        
        // 尝试从其他可能的格式转换
        if (inputData.vertices && inputData.edges) {
            // 图数据库格式
            result.nodes = inputData.vertices.map((vertex, index) => ({
                id: vertex.id || String(index + 1),
                labels: [vertex.label || "Unknown"],
                properties: vertex.properties || { name: vertex.name || `节点${index + 1}` }
            }));
            
            result.links = inputData.edges.map(edge => ({
                source: String(edge.from || edge.source),
                target: String(edge.to || edge.target),
                type: edge.label || edge.type || "关联"
            }));
        } else {
            // 创建默认数据
            result.nodes = [
                { id: "1", labels: ["Unknown"], properties: { name: "转换失败的数据" } }
            ];
            result.links = [];
        }
    }
    
    console.log('格式转换完成');
    return result;
}

// 执行转换
convertLargeFile()
    .then((result) => {
        console.log('\n🎉 文件转换成功完成！');
        console.log('输出文件:', outputFile);
    })
    .catch((error) => {
        console.error('\n❌ 转换过程中发生错误:', error.message);
        process.exit(1);
    });