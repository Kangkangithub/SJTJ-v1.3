// 知识图谱可视化脚本
document.addEventListener('DOMContentLoaded', function() {
    // Neo4j连接配置（实际使用时请使用后端API隐藏凭据）
    const NEO4J_URI = "neo4j+s://demo.neo4jlabs.com"; // 请替换为您的Neo4j实例地址
    const NEO4J_USER = ""; // 请替换为您的Neo4j用户名
    const NEO4J_PASSWORD = ""; // 请替换为您的Neo4j密码
    const NEO4J_DATABASE = "neo4j"; // 请替换为您的Neo4j数据库名称

    // 图谱可视化配置
    const width = document.getElementById('graph-visualization').clientWidth;
    const height = document.getElementById('graph-visualization').clientHeight;
    
    // 节点颜色映射
    const nodeColors = {
        'Weapon': '#ff6b6b',
        'Country': '#4ecdc4',
        'Manufacturer': '#ffbe0b',
        'Type': '#a786df',
        'default': '#999999'
    };
    
    // 创建D3.js力导向图
    const svg = d3.select('#graph-visualization')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g');
    
    // 创建缩放功能
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            svg.attr('transform', event.transform);
        });
    
    d3.select('#graph-visualization svg').call(zoom);
    
    // 初始化力导向仿真
    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    // 创建箭头标记
    svg.append('defs').selectAll('marker')
        .data(['end'])
        .enter().append('marker')
        .attr('id', d => d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', 'rgba(255, 255, 255, 0.3)')
        .attr('d', 'M0,-5L10,0L0,5');
    
    // 全局变量存储图数据
    let graphData = {
        nodes: [],
        links: []
    };
    
    // 当前选择的节点
    let selectedNode = null;
    
    // 绘制图谱
    function renderGraph(data) {
        // 清除现有图形
        svg.selectAll('*').remove();
        
        // 重新创建箭头标记
        svg.append('defs').selectAll('marker')
            .data(['end'])
            .enter().append('marker')
            .attr('id', d => d)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('fill', 'rgba(255, 255, 255, 0.3)')
            .attr('d', 'M0,-5L10,0L0,5');
        
        // 创建连接线
        const link = svg.append('g')
            .selectAll('line')
            .data(data.links)
            .enter().append('line')
            .attr('class', 'link')
            .attr('marker-end', 'url(#end)');
        
        // 创建连接标签
        const linkLabel = svg.append('g')
            .selectAll('text')
            .data(data.links)
            .enter().append('text')
            .attr('class', 'link-label')
            .text(d => d.type);
        
        // 创建节点容器组
        const node = svg.append('g')
            .selectAll('.node-group')
            .data(data.nodes)
            .enter().append('g')
            .attr('class', 'node-group');
        
        // 添加节点圆形
        node.append('circle')
            .attr('class', 'node')
            .attr('r', 15)
            .attr('fill', d => nodeColors[d.labels[0]] || nodeColors.default)
            .call(d3.drag()
                .on('start', dragStarted)
                .on('drag', dragged)
                .on('end', dragEnded));
        
        // 添加节点标签
        node.append('text')
            .attr('class', 'node-label')
            .attr('dy', 25)
            .text(d => d.properties.name);
        
        // 节点点击事件，显示详情
        node.on('click', function(event, d) {
            event.stopPropagation();
            
            // 取消之前选中的节点
            if (selectedNode) {
                d3.select(selectedNode)
                    .select('circle')
                    .classed('selected', false);
            }
            
            // 选中当前节点
            selectedNode = this;
            d3.select(this)
                .select('circle')
                .classed('selected', true);
            
            // 显示节点详情
            displayNodeDetails(d);
        });
        
        // 点击背景取消选择
        svg.on('click', function() {
            if (selectedNode) {
                d3.select(selectedNode)
                    .select('circle')
                    .classed('selected', false);
                selectedNode = null;
                
                // 清除详情
                document.getElementById('nodeDetails').innerHTML = '<p>点击节点查看详细信息</p>';
            }
        });
        
        // 更新仿真
        simulation.nodes(data.nodes)
            .on('tick', () => {
                // 更新连接线位置
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                
                // 更新连接标签位置
                linkLabel
                    .attr('x', d => (d.source.x + d.target.x) / 2)
                    .attr('y', d => (d.source.y + d.target.y) / 2);
                
                // 更新节点组位置
                node
                    .attr('transform', d => `translate(${d.x}, ${d.y})`);
            });
        
        simulation.force('link').links(data.links);
        simulation.alpha(1).restart();
    }
    
    // 拖拽相关函数
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    // 显示节点详情
    function displayNodeDetails(node) {
        const detailsContainer = document.getElementById('nodeDetails');
        
        // 创建详情HTML
        let html = '<div class="detail-group">';
        html += `<div class="detail-label">类型</div>`;
        html += `<div class="detail-value">${node.labels.join(', ')}</div>`;
        html += '</div>';
        
        html += '<div class="detail-group">';
        html += `<div class="detail-label">名称</div>`;
        html += `<div class="detail-value">${node.properties.name}</div>`;
        html += '</div>';
        
        // 根据节点类型显示不同属性
        switch(node.labels[0]) {
            case 'Weapon':
                if (node.properties.description) {
                    html += '<div class="detail-group">';
                    html += `<div class="detail-label">描述</div>`;
                    html += `<div class="detail-value">${node.properties.description}</div>`;
                    html += '</div>';
                }
                
                if (node.properties.year) {
                    html += '<div class="detail-group">';
                    html += `<div class="detail-label">年份</div>`;
                    html += `<div class="detail-value">${node.properties.year}</div>`;
                    html += '</div>';
                }
                break;
                
            case 'Country':
                if (node.properties.region) {
                    html += '<div class="detail-group">';
                    html += `<div class="detail-label">地区</div>`;
                    html += `<div class="detail-value">${node.properties.region}</div>`;
                    html += '</div>';
                }
                break;
                
            case 'Manufacturer':
                if (node.properties.country) {
                    html += '<div class="detail-group">';
                    html += `<div class="detail-label">所属国家</div>`;
                    html += `<div class="detail-value">${node.properties.country}</div>`;
                    html += '</div>';
                }
                
                if (node.properties.founded) {
                    html += '<div class="detail-group">';
                    html += `<div class="detail-label">成立时间</div>`;
                    html += `<div class="detail-value">${node.properties.founded}</div>`;
                    html += '</div>';
                }
                break;
        }
        
        // 显示详情
        detailsContainer.innerHTML = html;
    }
    
    // 查询Neo4j数据
    async function queryNeo4j() {
        try {
            // 实际应用中，应通过后端API查询数据，避免将敏感凭据暴露给前端
            // 这里使用模拟数据进行演示
            setTimeout(() => {
                const mockData = getMockData();
                graphData = mockData;
                renderGraph(mockData);
            }, 1000);
            
            /* 
            // 以下是Neo4j数据库直连方式，仅供参考，实际应通过后端API
            const driver = neo4j.driver(
                NEO4J_URI,
                neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
            );
            
            const session = driver.session({
                database: NEO4J_DATABASE
            });
            
            try {
                const query = `
                    MATCH (n)-[r]->(m)
                    RETURN n, r, m LIMIT 100
                `;
                
                const result = await session.run(query);
                
                // 转换Neo4j结果为D3.js格式
                const nodes = new Map();
                const links = [];
                
                result.records.forEach(record => {
                    const source = record.get('n');
                    const target = record.get('m');
                    const relationship = record.get('r');
                    
                    // 添加源节点
                    if (!nodes.has(source.identity.toString())) {
                        nodes.set(source.identity.toString(), {
                            id: source.identity.toString(),
                            labels: source.labels,
                            properties: source.properties
                        });
                    }
                    
                    // 添加目标节点
                    if (!nodes.has(target.identity.toString())) {
                        nodes.set(target.identity.toString(), {
                            id: target.identity.toString(),
                            labels: target.labels,
                            properties: target.properties
                        });
                    }
                    
                    // 添加关系
                    links.push({
                        source: source.identity.toString(),
                        target: target.identity.toString(),
                        type: relationship.type,
                        properties: relationship.properties
                    });
                });
                
                graphData = {
                    nodes: Array.from(nodes.values()),
                    links: links
                };
                
                renderGraph(graphData);
            } finally {
                await session.close();
            }
            
            await driver.close();
            */
        } catch (error) {
            console.error('Error querying Neo4j:', error);
            document.getElementById('graph-visualization').innerHTML = `
                <div class="error-message">
                    <p>加载知识图谱时出错：${error.message}</p>
                </div>
            `;
        }
    }
    
    // 搜索功能
    document.getElementById('searchButton').addEventListener('click', function() {
        const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
        
        if (!searchTerm) {
            renderGraph(graphData);
            return;
        }
        
        // 过滤节点
        const filteredNodes = graphData.nodes.filter(node => 
            node.properties.name.toLowerCase().includes(searchTerm)
        );
        
        const nodeIds = new Set(filteredNodes.map(node => node.id));
        
        // 过滤连接，仅保留与过滤后节点相关的连接
        const filteredLinks = graphData.links.filter(link => 
            nodeIds.has(link.source.id || link.source) && nodeIds.has(link.target.id || link.target)
        );
        
        renderGraph({
            nodes: filteredNodes,
            links: filteredLinks
        });
    });
    
    // 过滤器功能
    document.getElementById('nodeTypeFilter').addEventListener('change', applyFilters);
    document.getElementById('relationTypeFilter').addEventListener('change', applyFilters);
    
    function applyFilters() {
        const nodeTypeFilter = document.getElementById('nodeTypeFilter').value;
        const relationTypeFilter = document.getElementById('relationTypeFilter').value;
        
        // 过滤节点
        let filteredNodes = graphData.nodes;
        if (nodeTypeFilter !== 'all') {
            filteredNodes = graphData.nodes.filter(node => 
                node.labels.includes(nodeTypeFilter)
            );
        }
        
        const nodeIds = new Set(filteredNodes.map(node => node.id));
        
        // 过滤连接
        let filteredLinks = graphData.links;
        if (relationTypeFilter !== 'all') {
            filteredLinks = graphData.links.filter(link => 
                link.type === relationTypeFilter
            );
        }
        
        // 进一步过滤连接，确保连接的节点在过滤后的节点中
        filteredLinks = filteredLinks.filter(link => 
            nodeIds.has(link.source.id || link.source) && nodeIds.has(link.target.id || link.target)
        );
        
        // 再次过滤节点，确保只包含有连接的节点
        const linkedNodeIds = new Set();
        filteredLinks.forEach(link => {
            linkedNodeIds.add(link.source.id || link.source);
            linkedNodeIds.add(link.target.id || link.target);
        });
        
        filteredNodes = filteredNodes.filter(node => linkedNodeIds.has(node.id));
        
        renderGraph({
            nodes: filteredNodes,
            links: filteredLinks
        });
    }
    
    // 缩放控制
    document.getElementById('zoomInBtn').addEventListener('click', function() {
        d3.select('#graph-visualization svg').transition().call(
            zoom.scaleBy, 1.5
        );
    });
    
    document.getElementById('zoomOutBtn').addEventListener('click', function() {
        d3.select('#graph-visualization svg').transition().call(
            zoom.scaleBy, 0.5
        );
    });
    
    document.getElementById('resetBtn').addEventListener('click', function() {
        d3.select('#graph-visualization svg').transition().call(
            zoom.transform, d3.zoomIdentity
        );
    });
    
    // 导出功能
    document.getElementById('exportBtn').addEventListener('click', function() {
        const svgElement = document.querySelector('#graph-visualization svg');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = svgUrl;
        downloadLink.download = '武器装备知识图谱.svg';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    });
    
    // 生成模拟数据
    function getMockData() {
        return {
            nodes: [
                // 武器节点
                { id: '1', labels: ['Weapon'], properties: { name: 'AK-47', description: '卡拉什尼科夫自动步枪', year: '1947' } },
                { id: '2', labels: ['Weapon'], properties: { name: 'M16', description: '美国制式自动步枪', year: '1964' } },
                { id: '3', labels: ['Weapon'], properties: { name: 'T-72', description: '苏联主战坦克', year: '1971' } },
                { id: '4', labels: ['Manufacturer'], properties: { name: '卡拉什尼科夫公司', country: '俄罗斯', founded: '1948' } },
                { id: '5', labels: ['Manufacturer'], properties: { name: '柯尔特公司', country: '美国', founded: '1855' } },
                { id: '6', labels: ['Country'], properties: { name: '俄罗斯', region: '欧亚大陆' } },
                { id: '7', labels: ['Country'], properties: { name: '美国', region: '北美洲' } },
                { id: '8', labels: ['Type'], properties: { name: '自动步枪' } },
                { id: '9', labels: ['Type'], properties: { name: '坦克' } },
                
                // 新增武器节点
                { id: '10', labels: ['Weapon'], properties: { name: 'F-22猛禽', description: '美国第五代隐形战斗机', year: '2005' } },
                { id: '11', labels: ['Weapon'], properties: { name: 'Su-57', description: '俄罗斯第五代隐形战斗机', year: '2020' } },
                { id: '12', labels: ['Weapon'], properties: { name: 'J-20', description: '中国第五代隐形战斗机', year: '2017' } },
                { id: '13', labels: ['Weapon'], properties: { name: '东风-17', description: '中国高超音速导弹', year: '2019' } },
                { id: '14', labels: ['Weapon'], properties: { name: '阿瓦塔', description: '以色列先进坦克', year: '2020' } },
                { id: '15', labels: ['Weapon'], properties: { name: '毒刺导弹', description: '美国便携式防空导弹', year: '1981' } },
                { id: '16', labels: ['Weapon'], properties: { name: '海尔法', description: '以色列反坦克导弹', year: '1997' } },
                { id: '17', labels: ['Weapon'], properties: { name: '阿帕奇', description: '美国攻击直升机', year: '1986' } },
                
                // 新增制造商节点
                { id: '18', labels: ['Manufacturer'], properties: { name: '洛克希德·马丁', country: '美国', founded: '1995' } },
                { id: '19', labels: ['Manufacturer'], properties: { name: '苏霍伊设计局', country: '俄罗斯', founded: '1939' } },
                { id: '20', labels: ['Manufacturer'], properties: { name: '成都飞机工业集团', country: '中国', founded: '1958' } },
                { id: '21', labels: ['Manufacturer'], properties: { name: '中国航天科工集团', country: '中国', founded: '1956' } },
                { id: '22', labels: ['Manufacturer'], properties: { name: '以色列军事工业', country: '以色列', founded: '1933' } },
                { id: '23', labels: ['Manufacturer'], properties: { name: '波音公司', country: '美国', founded: '1916' } },
                
                // 新增国家节点
                { id: '24', labels: ['Country'], properties: { name: '中国', region: '亚洲' } },
                { id: '25', labels: ['Country'], properties: { name: '以色列', region: '中东' } },
                
                // 新增类型节点
                { id: '26', labels: ['Type'], properties: { name: '战斗机' } },
                { id: '27', labels: ['Type'], properties: { name: '导弹' } },
                { id: '28', labels: ['Type'], properties: { name: '直升机' } },
                
                // 增加更多的武器节点
                { id: '29', labels: ['Weapon'], properties: { name: '伯克级驱逐舰', description: '美国海军导弹驱逐舰', year: '1991' } },
                { id: '30', labels: ['Weapon'], properties: { name: '提康德罗加级巡洋舰', description: '美国导弹巡洋舰', year: '1983' } },
                { id: '31', labels: ['Weapon'], properties: { name: '055型驱逐舰', description: '中国大型驱逐舰', year: '2017' } },
                { id: '32', labels: ['Weapon'], properties: { name: 'S-400防空系统', description: '俄罗斯远程防空导弹系统', year: '2007' } },
                { id: '33', labels: ['Weapon'], properties: { name: '爱国者PAC-3', description: '美国中高空防空导弹系统', year: '1995' } },
                { id: '34', labels: ['Weapon'], properties: { name: 'HQ-9', description: '中国远程防空导弹系统', year: '2001' } },
                { id: '35', labels: ['Weapon'], properties: { name: 'B-2幽灵', description: '美国隐形战略轰炸机', year: '1989' } },
                { id: '36', labels: ['Weapon'], properties: { name: 'Tu-160', description: '俄罗斯超音速战略轰炸机', year: '1987' } },
                { id: '37', labels: ['Weapon'], properties: { name: 'H-6K', description: '中国轰炸机', year: '2009' } },
                { id: '38', labels: ['Weapon'], properties: { name: 'F-35闪电II', description: '美国联合攻击战斗机', year: '2015' } },
                { id: '39', labels: ['Weapon'], properties: { name: '欧洲台风', description: '欧洲多用途战斗机', year: '2003' } },
                { id: '40', labels: ['Weapon'], properties: { name: '阵风', description: '法国多用途战斗机', year: '2001' } },
                
                // 增加更多的制造商
                { id: '41', labels: ['Manufacturer'], properties: { name: '诺斯罗普·格鲁曼', country: '美国', founded: '1994' } },
                { id: '42', labels: ['Manufacturer'], properties: { name: '图波列夫设计局', country: '俄罗斯', founded: '1922' } },
                { id: '43', labels: ['Manufacturer'], properties: { name: '西安飞机工业集团', country: '中国', founded: '1958' } },
                { id: '44', labels: ['Manufacturer'], properties: { name: '空中客车防务与航天', country: '欧洲', founded: '2014' } },
                { id: '45', labels: ['Manufacturer'], properties: { name: '达索航空', country: '法国', founded: '1929' } },
                { id: '46', labels: ['Manufacturer'], properties: { name: '江南造船厂', country: '中国', founded: '1865' } },
                { id: '47', labels: ['Manufacturer'], properties: { name: '通用动力', country: '美国', founded: '1952' } },
                { id: '48', labels: ['Manufacturer'], properties: { name: '阿尔马兹-安泰', country: '俄罗斯', founded: '2002' } },
                { id: '49', labels: ['Manufacturer'], properties: { name: '雷神公司', country: '美国', founded: '1922' } },
                
                // 增加更多的国家节点
                { id: '50', labels: ['Country'], properties: { name: '法国', region: '欧洲' } },
                { id: '51', labels: ['Country'], properties: { name: '德国', region: '欧洲' } },
                { id: '52', labels: ['Country'], properties: { name: '英国', region: '欧洲' } },
                { id: '53', labels: ['Country'], properties: { name: '意大利', region: '欧洲' } },
                { id: '54', labels: ['Country'], properties: { name: '西班牙', region: '欧洲' } },
                
                // 增加更多的类型节点
                { id: '55', labels: ['Type'], properties: { name: '战列舰' } },
                { id: '56', labels: ['Type'], properties: { name: '驱逐舰' } },
                { id: '57', labels: ['Type'], properties: { name: '巡洋舰' } },
                { id: '58', labels: ['Type'], properties: { name: '防空系统' } },
                { id: '59', labels: ['Type'], properties: { name: '轰炸机' } }
            ],
            links: [
                // 原有连接
                { source: '1', target: '4', type: '制造' },
                { source: '2', target: '5', type: '制造' },
                { source: '1', target: '6', type: '使用' },
                { source: '2', target: '7', type: '使用' },
                { source: '3', target: '6', type: '属于' },
                { source: '1', target: '8', type: '类型' },
                { source: '2', target: '8', type: '类型' },
                { source: '3', target: '9', type: '类型' },
                
                // 制造关系
                { source: '10', target: '18', type: '制造' },
                { source: '11', target: '19', type: '制造' },
                { source: '12', target: '20', type: '制造' },
                { source: '13', target: '21', type: '制造' },
                { source: '14', target: '22', type: '制造' },
                { source: '15', target: '18', type: '制造' },
                { source: '16', target: '22', type: '制造' },
                { source: '17', target: '23', type: '制造' },
                
                // 使用关系
                { source: '10', target: '7', type: '使用' },
                { source: '11', target: '6', type: '使用' },
                { source: '12', target: '24', type: '使用' },
                { source: '13', target: '24', type: '使用' },
                { source: '14', target: '25', type: '使用' },
                { source: '15', target: '7', type: '使用' },
                { source: '16', target: '25', type: '使用' },
                { source: '17', target: '7', type: '使用' },
                
                // 类型关系
                { source: '10', target: '26', type: '类型' },
                { source: '11', target: '26', type: '类型' },
                { source: '12', target: '26', type: '类型' },
                { source: '13', target: '27', type: '类型' },
                { source: '14', target: '9', type: '类型' },
                { source: '15', target: '27', type: '类型' },
                { source: '16', target: '27', type: '类型' },
                { source: '17', target: '28', type: '类型' },
                
                // 制造商与国家的关系
                { source: '18', target: '7', type: '属于' },
                { source: '19', target: '6', type: '属于' },
                { source: '20', target: '24', type: '属于' },
                { source: '21', target: '24', type: '属于' },
                { source: '22', target: '25', type: '属于' },
                { source: '23', target: '7', type: '属于' },
                
                // 新增武器制造关系
                { source: '29', target: '47', type: '制造' },
                { source: '30', target: '18', type: '制造' },
                { source: '31', target: '46', type: '制造' },
                { source: '32', target: '48', type: '制造' },
                { source: '33', target: '49', type: '制造' },
                { source: '34', target: '21', type: '制造' },
                { source: '35', target: '41', type: '制造' },
                { source: '36', target: '42', type: '制造' },
                { source: '37', target: '43', type: '制造' },
                { source: '38', target: '18', type: '制造' },
                { source: '39', target: '44', type: '制造' },
                { source: '40', target: '45', type: '制造' },
                
                // 新增武器使用关系
                { source: '29', target: '7', type: '使用' },
                { source: '30', target: '7', type: '使用' },
                { source: '31', target: '24', type: '使用' },
                { source: '32', target: '6', type: '使用' },
                { source: '33', target: '7', type: '使用' },
                { source: '34', target: '24', type: '使用' },
                { source: '35', target: '7', type: '使用' },
                { source: '36', target: '6', type: '使用' },
                { source: '37', target: '24', type: '使用' },
                { source: '38', target: '7', type: '使用' },
                { source: '39', target: '51', type: '使用' },
                { source: '39', target: '52', type: '使用' },
                { source: '39', target: '53', type: '使用' },
                { source: '39', target: '54', type: '使用' },
                { source: '40', target: '50', type: '使用' },
                
                // 新增武器类型关系
                { source: '29', target: '56', type: '类型' },
                { source: '30', target: '57', type: '类型' },
                { source: '31', target: '56', type: '类型' },
                { source: '32', target: '58', type: '类型' },
                { source: '33', target: '58', type: '类型' },
                { source: '34', target: '58', type: '类型' },
                { source: '35', target: '59', type: '类型' },
                { source: '36', target: '59', type: '类型' },
                { source: '37', target: '59', type: '类型' },
                { source: '38', target: '26', type: '类型' },
                { source: '39', target: '26', type: '类型' },
                { source: '40', target: '26', type: '类型' },
                
                // 新增制造商属于关系
                { source: '41', target: '7', type: '属于' },
                { source: '42', target: '6', type: '属于' },
                { source: '43', target: '24', type: '属于' },
                { source: '44', target: '51', type: '属于' },
                { source: '44', target: '52', type: '属于' },
                { source: '44', target: '53', type: '属于' },
                { source: '44', target: '54', type: '属于' },
                { source: '45', target: '50', type: '属于' },
                { source: '46', target: '24', type: '属于' },
                { source: '47', target: '7', type: '属于' },
                { source: '48', target: '6', type: '属于' },
                { source: '49', target: '7', type: '属于' }
            ]
        };
    }
    
    // 初始化
    queryNeo4j();
    
    // 检查URL参数是否需要高亮显示特定武器
    function checkForHighlightedWeapon() {
        const urlParams = new URLSearchParams(window.location.search);
        const highlightId = urlParams.get('highlight');
        
        if (highlightId) {
            // 等待图谱加载完成后高亮显示
            setTimeout(() => {
                const nodes = d3.selectAll('.node-group');
                nodes.each(function(d) {
                    if (d.id === highlightId) {
                        // 选中此节点
                        d3.select(this).select('circle')
                            .classed('selected', true)
                            .attr('r', 20)
                            .style('stroke', 'white')
                            .style('stroke-width', '2px');
                        
                        // 显示节点详情
                        displayNodeDetails(d);
                        
                        // 滚动到该节点
                        const transform = d3.zoomIdentity.translate(width/2 - d.x, height/2 - d.y).scale(1.2);
                        d3.select('#graph-visualization svg').transition().duration(750).call(zoom.transform, transform);
                        
                        selectedNode = this;
                    }
                });
            }, 2000); // 给图谱加载一些时间
        }
    }
    
    // 在初始化后检查高亮显示
    setTimeout(checkForHighlightedWeapon, 1000);
}); 