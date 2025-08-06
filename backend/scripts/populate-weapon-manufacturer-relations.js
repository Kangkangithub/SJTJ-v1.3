const databaseManager = require('../src/config/database-simple');

/**
 * 武器-制造商关系填充脚本
 * 根据武器名称、国家等信息智能匹配制造商
 */

// 武器名称到制造商的映射规则
const weaponManufacturerMappings = {
  // 美国武器
  'M16': ['柯尔特公司'],
  'M4': ['柯尔特公司'],
  'F-22': ['洛克希德·马丁'],
  'F-35': ['洛克希德·马丁'],
  'F-16': ['洛克希德·马丁'],
  'F-15': ['波音公司'],
  'F/A-18': ['波音公司'],
  'AH-64': ['波音公司'],
  'CH-47': ['波音公司'],
  'B-2': ['诺斯罗普·格鲁曼'],
  'B-21': ['诺斯罗普·格鲁曼'],
  'E-2': ['诺斯罗普·格鲁曼'],
  'Global Hawk': ['诺斯罗普·格鲁曼'],
  'Predator': ['通用原子航空系统'],
  'Reaper': ['通用原子航空系统'],
  'Patriot': ['雷神公司'],
  'Tomahawk': ['雷神公司'],
  'AMRAAM': ['雷神公司'],
  'Sidewinder': ['雷神公司'],
  'Stinger': ['雷神公司'],
  '毒刺': ['雷神公司'],
  'Abrams': ['通用动力'],
  'M1A2': ['通用动力'],
  'Bradley': ['BAE系统公司'],
  'Paladin': ['BAE系统公司'],

  // 俄罗斯武器
  'AK-47': ['卡拉什尼科夫集团'],
  'AK-74': ['卡拉什尼科夫集团'],
  'AK-12': ['卡拉什尼科夫集团'],
  'Su-27': ['苏霍伊设计局'],
  'Su-30': ['苏霍伊设计局'],
  'Su-35': ['苏霍伊设计局'],
  'Su-57': ['苏霍伊设计局'],
  'MiG-29': ['米格设计局'],
  'MiG-31': ['米格设计局'],
  'Tu-95': ['图波列夫设计局'],
  'Tu-160': ['图波列夫设计局'],
  'S-300': ['阿尔马兹-安泰'],
  'S-400': ['阿尔马兹-安泰'],
  'S-500': ['阿尔马兹-安泰'],
  'T-72': ['乌拉尔车辆厂'],
  'T-80': ['列宁格勒基洛夫工厂'],
  'T-90': ['乌拉尔车辆厂'],
  'T-14': ['乌拉尔车辆厂'],

  // 中国武器
  'J-10': ['成都飞机工业集团'],
  'J-20': ['成都飞机工业集团'],
  'J-11': ['沈阳飞机工业集团'],
  'J-15': ['沈阳飞机工业集团'],
  'J-16': ['沈阳飞机工业集团'],
  'H-6': ['西安飞机工业集团'],
  'Y-20': ['西安飞机工业集团'],
  'Z-10': ['昌河飞机工业集团'],
  'Z-19': ['哈尔滨飞机工业集团'],
  '东风-17': ['中国航天科工集团'],
  '东风-21': ['中国航天科工集团'],
  '东风-26': ['中国航天科工集团'],
  '东风-41': ['中国航天科技集团'],
  'DF-17': ['中国航天科工集团'],
  'DF-21': ['中国航天科工集团'],
  'DF-26': ['中国航天科工集团'],
  'DF-41': ['中国航天科技集团'],
  'Type 99': ['中国北方工业公司'],
  'Type 96': ['中国北方工业公司'],
  '99式': ['中国北方工业公司'],
  '96式': ['中国北方工业公司'],

  // 德国武器
  'Leopard 2': ['莱茵金属'],
  'G36': ['Heckler & Koch'],
  'MP5': ['Heckler & Koch'],
  'HK416': ['Heckler & Koch'],
  'HK417': ['Heckler & Koch'],

  // 奥地利武器
  'Glock': ['格洛克公司'],
  'AUG': ['斯太尔-曼利夏'],
  'P90': ['埃斯塔勒国营工厂'],

  // 以色列武器
  'Merkava': ['以色列军事工业'],
  'Iron Dome': ['拉斐尔先进防务系统'],
  'David\'s Sling': ['拉斐尔先进防务系统'],
  'Spike': ['拉斐尔先进防务系统'],
  'Hellfire': ['洛克希德·马丁', '波音公司'],
  '海尔法': ['洛克希德·马丁', '波音公司'],
  'Jericho': ['以色列航空工业'],
  '阿瓦塔': ['以色列军事工业']
};

// 国家到主要制造商的映射
const countryManufacturerMappings = {
  '美国': ['洛克希德·马丁', '波音公司', '诺斯罗普·格鲁曼', '雷神公司', '通用动力', '柯尔特公司'],
  '俄罗斯': ['苏霍伊设计局', '米格设计局', '图波列夫设计局', '卡拉什尼科夫集团', '阿尔马兹-安泰'],
  '中国': ['成都飞机工业集团', '沈阳飞机工业集团', '西安飞机工业集团', '中国航天科工集团', '中国北方工业公司'],
  '德国': ['莱茵金属', 'Heckler & Koch'],
  '奥地利': ['格洛克公司', '埃斯塔勒国营工厂'],
  '以色列': ['以色列军事工业', '拉斐尔先进防务系统', '以色列航空工业'],
  '法国': ['达索航空', '泰雷兹集团'],
  '英国': ['BAE系统公司'],
  '欧洲': ['空中客车防务与航天']
};

class WeaponManufacturerMatcher {
  constructor() {
    this.db = null;
    this.weapons = [];
    this.manufacturers = [];
    this.existingRelations = new Set();
  }

  async initialize() {
    await databaseManager.connect();
    this.db = databaseManager.getDatabase();
    
    // 加载现有数据
    await this.loadWeapons();
    await this.loadManufacturers();
    await this.loadExistingRelations();
  }

  async loadWeapons() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id, name, country, type FROM weapons', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          this.weapons = rows;
          console.log(`加载了 ${rows.length} 个武器`);
          resolve();
        }
      });
    });
  }

  async loadManufacturers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id, name, country FROM manufacturers', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          this.manufacturers = rows;
          console.log(`加载了 ${rows.length} 个制造商`);
          resolve();
        }
      });
    });
  }

  async loadExistingRelations() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT weapon_id, manufacturer_id FROM weapon_manufacturers', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          rows.forEach(row => {
            this.existingRelations.add(`${row.weapon_id}-${row.manufacturer_id}`);
          });
          console.log(`加载了 ${rows.length} 个现有关系`);
          resolve();
        }
      });
    });
  }

  // 根据武器名称匹配制造商
  matchByWeaponName(weaponName) {
    const matches = [];
    
    // 精确匹配
    for (const [pattern, manufacturerNames] of Object.entries(weaponManufacturerMappings)) {
      if (weaponName.includes(pattern)) {
        manufacturerNames.forEach(manufacturerName => {
          const manufacturer = this.manufacturers.find(m => 
            m.name.includes(manufacturerName) || manufacturerName.includes(m.name)
          );
          if (manufacturer) {
            matches.push(manufacturer);
          }
        });
      }
    }
    
    return matches;
  }

  // 根据国家匹配制造商
  matchByCountry(country) {
    const matches = [];
    const manufacturerNames = countryManufacturerMappings[country] || [];
    
    manufacturerNames.forEach(manufacturerName => {
      const manufacturer = this.manufacturers.find(m => 
        m.name.includes(manufacturerName) || manufacturerName.includes(m.name)
      );
      if (manufacturer) {
        matches.push(manufacturer);
      }
    });
    
    // 如果没有找到特定制造商，尝试匹配同国家的制造商
    if (matches.length === 0) {
      const countryManufacturers = this.manufacturers.filter(m => m.country === country);
      matches.push(...countryManufacturers);
    }
    
    return matches;
  }

  // 为单个武器匹配制造商
  matchWeaponToManufacturers(weapon) {
    let matches = [];
    
    // 首先尝试按武器名称匹配
    matches = this.matchByWeaponName(weapon.name);
    
    // 如果没有找到，尝试按国家匹配
    if (matches.length === 0 && weapon.country && weapon.country !== '未知') {
      matches = this.matchByCountry(weapon.country);
    }
    
    // 去重
    const uniqueMatches = [];
    const seenIds = new Set();
    matches.forEach(manufacturer => {
      if (!seenIds.has(manufacturer.id)) {
        seenIds.add(manufacturer.id);
        uniqueMatches.push(manufacturer);
      }
    });
    
    return uniqueMatches;
  }

  // 插入武器-制造商关系
  async insertRelation(weaponId, manufacturerId) {
    const relationKey = `${weaponId}-${manufacturerId}`;
    
    // 检查是否已存在
    if (this.existingRelations.has(relationKey)) {
      return false;
    }
    
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO weapon_manufacturers (weapon_id, manufacturer_id) VALUES (?, ?)',
        [weaponId, manufacturerId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  // 执行匹配和插入
  async processAllWeapons() {
    let totalInserted = 0;
    let totalProcessed = 0;
    const results = [];

    console.log('\n开始处理武器-制造商关系匹配...\n');

    for (const weapon of this.weapons) {
      totalProcessed++;
      const matches = this.matchWeaponToManufacturers(weapon);
      
      let insertedForWeapon = 0;
      
      for (const manufacturer of matches) {
        try {
          const inserted = await this.insertRelation(weapon.id, manufacturer.id);
          if (inserted) {
            insertedForWeapon++;
            totalInserted++;
            this.existingRelations.add(`${weapon.id}-${manufacturer.id}`);
          }
        } catch (error) {
          console.error(`插入关系失败 (武器: ${weapon.name}, 制造商: ${manufacturer.name}):`, error.message);
        }
      }
      
      if (insertedForWeapon > 0) {
        results.push({
          weapon: weapon.name,
          country: weapon.country,
          manufacturers: matches.map(m => m.name),
          inserted: insertedForWeapon
        });
        
        console.log(`✅ ${weapon.name} (${weapon.country}) -> ${matches.map(m => m.name).join(', ')} (${insertedForWeapon}个关系)`);
      } else if (matches.length > 0) {
        console.log(`⚠️  ${weapon.name} (${weapon.country}) -> ${matches.map(m => m.name).join(', ')} (已存在)`);
      } else {
        console.log(`❌ ${weapon.name} (${weapon.country}) -> 未找到匹配的制造商`);
      }
    }

    console.log(`\n=== 处理完成 ===`);
    console.log(`处理武器数量: ${totalProcessed}`);
    console.log(`新增关系数量: ${totalInserted}`);
    console.log(`成功匹配武器: ${results.length}`);

    return {
      totalProcessed,
      totalInserted,
      results
    };
  }

  async close() {
    await databaseManager.close();
  }
}

// 主执行函数
async function main() {
  const matcher = new WeaponManufacturerMatcher();
  
  try {
    console.log('初始化武器-制造商关系匹配器...');
    await matcher.initialize();
    
    console.log('开始匹配和插入关系...');
    const result = await matcher.processAllWeapons();
    
    console.log('\n=== 最终统计 ===');
    console.log(`总共处理: ${result.totalProcessed} 个武器`);
    console.log(`新增关系: ${result.totalInserted} 个`);
    console.log(`匹配成功: ${result.results.length} 个武器`);
    
    if (result.results.length > 0) {
      console.log('\n=== 详细结果 ===');
      result.results.forEach(item => {
        console.log(`${item.weapon} -> ${item.manufacturers.join(', ')} (${item.inserted}个关系)`);
      });
    }
    
  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    await matcher.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = WeaponManufacturerMatcher;