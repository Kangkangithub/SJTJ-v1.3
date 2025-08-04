const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 读取JSON数据
const jsonPath = path.join(__dirname, '../../data/graphData.json');
const graphData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// 连接数据库
const db = new Database(path.join(__dirname, '../data/military-knowledge.db'));

console.log('开始导入知识图谱数据...');

try {
    // 开始事务
    db.exec('BEGIN TRANSACTION');
    
    // 清空现有数据（可选，如果需要重新导入）
    console.log('清理现有数据...');
    db.exec('DELETE FROM weapons WHERE id > 10'); // 保留前10条原有数据
    
    // 创建制造商表（如果不存在）
    db.exec(`
        CREATE TABLE IF NOT EXISTS manufacturers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            country TEXT,
            founded TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 创建关系表（如果不存在）
    db.exec(`
        CREATE TABLE IF NOT EXISTS weapon_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_type TEXT NOT NULL,
            source_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            relationship_type TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 准备插入语句
    const insertWeapon = db.prepare(`
        INSERT OR REPLACE INTO weapons (name, type, country, year, description, specifications, performance_data)
        VALUES (?, ?, ?, ?, ?, '{}', '{}')
    `);
    
    const insertCountry = db.prepare(`
        INSERT OR IGNORE INTO countries (name, code)
        VALUES (?, ?)
    `);
    
    const insertCategory = db.prepare(`
        INSERT OR IGNORE INTO categories (name, description)
        VALUES (?, ?)
    `);
    
    const insertManufacturer = db.prepare(`
        INSERT OR REPLACE INTO manufacturers (name, country, founded, description)
        VALUES (?, ?, ?, ?)
    `);
    
    const insertRelationship = db.prepare(`
        INSERT OR REPLACE INTO weapon_relationships (source_type, source_id, target_type, target_id, relationship_type)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    // 用于存储ID映射
    const weaponIdMap = new Map();
    const countryIdMap = new Map();
    const categoryIdMap = new Map();
    const manufacturerIdMap = new Map();
    
    // 处理节点数据
    console.log('导入节点数据...');
    
    for (const node of graphData.nodes) {
        const { id, labels, properties } = node;
        const label = labels[0];
        
        switch (label) {
            case 'Weapon':
                // 推断武器类型和国家
                let weaponType = '未知';
                let weaponCountry = '未知';
                
                // 根据武器名称推断类型
                const name = properties.name;
                if (name.includes('步枪') || name.includes('AK-') || name.includes('M16')) {
                    weaponType = '步枪';
                } else if (name.includes('坦克') || name.includes('T-')) {
                    weaponType = '坦克';
                } else if (name.includes('战斗机') || name.includes('F-') || name.includes('Su-') || name.includes('J-')) {
                    weaponType = '战斗机';
                } else if (name.includes('导弹')) {
                    weaponType = '导弹';
                } else if (name.includes('驱逐舰') || name.includes('巡洋舰')) {
                    weaponType = '军舰';
                } else if (name.includes('轰炸机') || name.includes('B-') || name.includes('Tu-') || name.includes('H-')) {
                    weaponType = '轰炸机';
                } else if (name.includes('直升机') || name.includes('阿帕奇')) {
                    weaponType = '直升机';
                } else if (name.includes('防空系统') || name.includes('PAC-') || name.includes('S-') || name.includes('HQ-')) {
                    weaponType = '防空系统';
                }
                
                // 根据武器名称推断国家
                if (name.includes('AK-') || name.includes('Su-') || name.includes('Tu-') || name.includes('S-400')) {
                    weaponCountry = '俄罗斯';
                } else if (name.includes('M16') || name.includes('F-') || name.includes('B-') || name.includes('阿帕奇') || name.includes('爱国者')) {
                    weaponCountry = '美国';
                } else if (name.includes('J-') || name.includes('东风') || name.includes('HQ-') || name.includes('055型') || name.includes('H-6')) {
                    weaponCountry = '中国';
                } else if (name.includes('阿瓦塔') || name.includes('海尔法')) {
                    weaponCountry = '以色列';
                } else if (name.includes('阵风')) {
                    weaponCountry = '法国';
                } else if (name.includes('台风')) {
                    weaponCountry = '德国';
                }
                
                const result = insertWeapon.run(
                    properties.name,
                    weaponType,
                    weaponCountry,
                    properties.year ? parseInt(properties.year) : null,
                    properties.description || ''
                );
                weaponIdMap.set(id, result.lastInsertRowid);
                console.log(`导入武器: ${properties.name} (ID: ${result.lastInsertRowid})`);
                break;
                
            case 'Country':
                const countryResult = insertCountry.run(properties.name, null);
                // 获取实际的country ID
                const countryId = db.prepare('SELECT id FROM countries WHERE name = ?').get(properties.name)?.id;
                countryIdMap.set(id, countryId);
                console.log(`导入国家: ${properties.name} (ID: ${countryId})`);
                break;
                
            case 'Type':
                const categoryResult = insertCategory.run(properties.name, properties.description || null);
                // 获取实际的category ID
                const categoryId = db.prepare('SELECT id FROM categories WHERE name = ?').get(properties.name)?.id;
                categoryIdMap.set(id, categoryId);
                console.log(`导入类型: ${properties.name} (ID: ${categoryId})`);
                break;
                
            case 'Manufacturer':
                const manufacturerResult = insertManufacturer.run(
                    properties.name,
                    properties.country || null,
                    properties.founded || null,
                    properties.description || null
                );
                manufacturerIdMap.set(id, manufacturerResult.lastInsertRowid);
                console.log(`导入制造商: ${properties.name} (ID: ${manufacturerResult.lastInsertRowid})`);
                break;
        }
    }
    
    // 处理关系数据
    console.log('导入关系数据...');
    
    for (const link of graphData.links) {
        const { source, target, type } = link;
        
        // 确定源和目标的类型和ID
        const sourceNode = graphData.nodes.find(n => n.id === source);
        const targetNode = graphData.nodes.find(n => n.id === target);
        
        if (!sourceNode || !targetNode) continue;
        
        let sourceId, targetId;
        const sourceType = sourceNode.labels[0];
        const targetType = targetNode.labels[0];
        
        // 获取对应的数据库ID
        switch (sourceType) {
            case 'Weapon': sourceId = weaponIdMap.get(source); break;
            case 'Country': sourceId = countryIdMap.get(source); break;
            case 'Type': sourceId = categoryIdMap.get(source); break;
            case 'Manufacturer': sourceId = manufacturerIdMap.get(source); break;
        }
        
        switch (targetType) {
            case 'Weapon': targetId = weaponIdMap.get(target); break;
            case 'Country': targetId = countryIdMap.get(target); break;
            case 'Type': targetId = categoryIdMap.get(target); break;
            case 'Manufacturer': targetId = manufacturerIdMap.get(target); break;
        }
        
        if (sourceId && targetId) {
            insertRelationship.run(sourceType, sourceId, targetType, targetId, type);
            console.log(`导入关系: ${sourceType}(${sourceId}) -> ${type} -> ${targetType}(${targetId})`);
        }
    }
    
    // 提交事务
    db.exec('COMMIT');
    
    console.log('数据导入完成！');
    
    // 显示统计信息
    const weaponCount = db.prepare('SELECT COUNT(*) as count FROM weapons').get().count;
    const countryCount = db.prepare('SELECT COUNT(*) as count FROM countries').get().count;
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const manufacturerCount = db.prepare('SELECT COUNT(*) as count FROM manufacturers').get().count;
    const relationshipCount = db.prepare('SELECT COUNT(*) as count FROM weapon_relationships').get().count;
    
    console.log('\n=== 导入统计 ===');
    console.log(`武器数量: ${weaponCount}`);
    console.log(`国家数量: ${countryCount}`);
    console.log(`类型数量: ${categoryCount}`);
    console.log(`制造商数量: ${manufacturerCount}`);
    console.log(`关系数量: ${relationshipCount}`);
    
} catch (error) {
    console.error('导入失败:', error);
    db.exec('ROLLBACK');
} finally {
    db.close();
}