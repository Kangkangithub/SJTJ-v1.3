const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const router = express.Router();

// 获取知识图谱数据
router.get('/graph-data', (req, res) => {
    try {
        const db = new Database(path.join(__dirname, '../../data/military-knowledge.db'));
        
        // 获取所有武器数据
        const weapons = db.prepare(`
            SELECT id, name, type, country, year, description 
            FROM weapons 
            ORDER BY id
        `).all();
        
        // 获取所有国家数据
        const countries = db.prepare(`
            SELECT id, name 
            FROM countries 
            ORDER BY id
        `).all();
        
        // 获取所有分类数据
        const categories = db.prepare(`
            SELECT id, name, description 
            FROM categories 
            ORDER BY id
        `).all();
        
        // 获取所有制造商数据
        const manufacturers = db.prepare(`
            SELECT id, name, country, founded, description 
            FROM manufacturers 
            ORDER BY id
        `).all();
        
        db.close();
        
        // 构建节点数据
        const nodes = [];
        const links = [];
        
        // 添加武器节点
        weapons.forEach(weapon => {
            nodes.push({
                id: `weapon_${weapon.id}`,
                labels: ["Weapon"],
                properties: {
                    name: weapon.name,
                    description: weapon.description || '',
                    year: weapon.year ? weapon.year.toString() : '',
                    type: weapon.type,
                    country: weapon.country
                }
            });
        });
        
        // 添加国家节点
        countries.forEach(country => {
            nodes.push({
                id: `country_${country.id}`,
                labels: ["Country"],
                properties: {
                    name: country.name,
                    region: getRegionByCountry(country.name)
                }
            });
        });
        
        // 添加分类节点
        categories.forEach(category => {
            nodes.push({
                id: `type_${category.id}`,
                labels: ["Type"],
                properties: {
                    name: category.name,
                    description: category.description || ''
                }
            });
        });
        
        // 添加制造商节点
        manufacturers.forEach(manufacturer => {
            nodes.push({
                id: `manufacturer_${manufacturer.id}`,
                labels: ["Manufacturer"],
                properties: {
                    name: manufacturer.name,
                    description: manufacturer.description || '',
                    country: manufacturer.country,
                    founded: manufacturer.founded || ''
                }
            });
        });
        
        // 创建关系链接
        weapons.forEach(weapon => {
            const weaponNodeId = `weapon_${weapon.id}`;
            
            // 武器 -> 国家 关系
            const countryNode = countries.find(c => c.name === weapon.country);
            if (countryNode) {
                links.push({
                    source: weaponNodeId,
                    target: `country_${countryNode.id}`,
                    type: "使用"
                });
            }
            
            // 武器 -> 类型 关系 (使用模糊匹配)
            const typeNode = findMatchingType(weapon.type, categories);
            if (typeNode) {
                links.push({
                    source: weaponNodeId,
                    target: `type_${typeNode.id}`,
                    type: "类型"
                });
            }
            
            // 武器 -> 制造商 关系 (基于武器名称和制造商推断)
            const manufacturerNode = findMatchingManufacturer(weapon, manufacturers);
            if (manufacturerNode) {
                links.push({
                    source: weaponNodeId,
                    target: `manufacturer_${manufacturerNode.id}`,
                    type: "制造"
                });
            }
        });
        
        // 制造商 -> 国家 关系
        manufacturers.forEach(manufacturer => {
            const countryNode = countries.find(c => c.name === manufacturer.country);
            if (countryNode) {
                links.push({
                    source: `manufacturer_${manufacturer.id}`,
                    target: `country_${countryNode.id}`,
                    type: "属于"
                });
            }
        });
        
        res.json({
            success: true,
            data: {
                nodes,
                links
            }
        });
        
    } catch (error) {
        console.error('获取知识图谱数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取知识图谱数据失败',
            error: error.message
        });
    }
});

// 根据国家名称获取地区
function getRegionByCountry(countryName) {
    const regionMap = {
        '美国': '北美洲',
        '俄罗斯': '欧亚大陆',
        '中国': '亚洲',
        '德国': '欧洲',
        '法国': '欧洲',
        '英国': '欧洲',
        '以色列': '中东',
        '瑞典': '欧洲',
        '意大利': '欧洲',
        '日本': '亚洲',
        '奥地利': '欧洲',
        '西班牙': '欧洲'
    };
    return regionMap[countryName] || '未知';
}

// 查找匹配的类型（支持模糊匹配）
function findMatchingType(weaponType, categories) {
    // 直接匹配
    let match = categories.find(c => c.name === weaponType);
    if (match) return match;
    
    // 模糊匹配映射
    const typeMapping = {
        '步枪': ['自动步枪', '突击步枪', '步枪'],
        '手枪': ['手枪', 'pistol'],
        '坦克': ['坦克', '主战坦克'],
        '战斗机': ['战斗机', '战机'],
        '导弹': ['导弹', '火箭'],
        '直升机': ['直升机', '武装直升机'],
        '驱逐舰': ['驱逐舰', '军舰'],
        '巡洋舰': ['巡洋舰', '军舰'],
        '轰炸机': ['轰炸机', '战略轰炸机'],
        '防空系统': ['防空系统', '防空导弹']
    };
    
    for (const [key, values] of Object.entries(typeMapping)) {
        if (values.includes(weaponType)) {
            match = categories.find(c => values.includes(c.name));
            if (match) return match;
        }
    }
    
    return null;
}

// 查找匹配的制造商
function findMatchingManufacturer(weapon, manufacturers) {
    const weaponName = weapon.name.toLowerCase();
    
    // 基于武器名称的制造商映射
    const manufacturerMapping = {
        'ak-47': '卡拉什尼科夫公司',
        'ak47': '卡拉什尼科夫公司',
        'm16': '柯尔特公司',
        'glock': '格洛克公司',
        'f-22': '洛克希德·马丁',
        'f22': '洛克希德·马丁',
        'su-57': '苏霍伊设计局',
        'j-20': '成都飞机工业集团',
        '东风': '中国航天科工集团',
        '阿帕奇': '波音公司',
        'apache': '波音公司',
        'b-2': '诺斯罗普·格鲁曼',
        'tu-160': '图波列夫设计局',
        'h-6': '西安飞机工业集团',
        'f-35': '洛克希德·马丁',
        '台风': '空中客车防务与航天',
        '阵风': '达索航空',
        '055': '江南造船厂',
        '伯克': '通用动力',
        's-400': '阿尔马兹-安泰',
        '爱国者': '雷神公司',
        'hq-9': '中国航天科工集团'
    };
    
    for (const [key, manufacturerName] of Object.entries(manufacturerMapping)) {
        if (weaponName.includes(key)) {
            const manufacturer = manufacturers.find(m => m.name === manufacturerName);
            if (manufacturer) return manufacturer;
        }
    }
    
    return null;
}

module.exports = router;