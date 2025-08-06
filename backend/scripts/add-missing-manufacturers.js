const databaseManager = require('../src/config/database-simple');

/**
 * 为未匹配武器添加制造商脚本
 * 处理T-72、伯克级驱逐舰、提康德罗加级巡洋舰、M9手枪、贝雷塔92等武器
 */

class MissingManufacturerHandler {
  constructor() {
    this.db = null;
  }

  async initialize() {
    await databaseManager.connect();
    this.db = databaseManager.getDatabase();
  }

  // 需要添加的制造商信息
  getManufacturersToAdd() {
    return [
      {
        name: '乌拉尔车辆厂',
        country: '俄罗斯',
        founded: 1936,
        description: '俄罗斯主要坦克制造商，T-72、T-90等坦克的生产厂家'
      },
      {
        name: '通用动力巴斯铁工厂',
        country: '美国',
        founded: 1884,
        description: '美国海军舰艇制造商，伯克级驱逐舰和提康德罗加级巡洋舰的建造商'
      },
      {
        name: '英格尔斯造船厂',
        country: '美国',
        founded: 1938,
        description: '美国主要军舰制造商，隶属于亨廷顿英格尔斯工业公司'
      },
      {
        name: '贝雷塔公司',
        country: '意大利',
        founded: 1526,
        description: '意大利著名枪械制造商，世界上最古老的枪械制造公司之一'
      }
    ];
  }

  // 武器到制造商的映射关系
  getWeaponManufacturerMappings() {
    return [
      {
        weaponName: 'T-72',
        manufacturerNames: ['乌拉尔车辆厂']
      },
      {
        weaponName: '伯克级驱逐舰',
        manufacturerNames: ['通用动力巴斯铁工厂', '英格尔斯造船厂']
      },
      {
        weaponName: '提康德罗加级巡洋舰',
        manufacturerNames: ['通用动力巴斯铁工厂', '英格尔斯造船厂']
      },
      {
        weaponName: 'M9手枪',
        manufacturerNames: ['贝雷塔公司']
      },
      {
        weaponName: '贝雷塔92',
        manufacturerNames: ['贝雷塔公司']
      }
    ];
  }

  // 插入制造商
  async insertManufacturer(manufacturer) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO manufacturers (name, country, founded, description) VALUES (?, ?, ?, ?)',
        [manufacturer.name, manufacturer.country, manufacturer.founded, manufacturer.description],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID || null);
          }
        }
      );
    });
  }

  // 获取制造商ID
  async getManufacturerId(manufacturerName) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM manufacturers WHERE name = ?',
        [manufacturerName],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? row.id : null);
          }
        }
      );
    });
  }

  // 获取武器ID
  async getWeaponId(weaponName) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM weapons WHERE name = ?',
        [weaponName],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row ? row.id : null);
          }
        }
      );
    });
  }

  // 插入武器-制造商关系
  async insertWeaponManufacturerRelation(weaponId, manufacturerId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO weapon_manufacturers (weapon_id, manufacturer_id) VALUES (?, ?)',
        [weaponId, manufacturerId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }

  // 执行主要处理逻辑
  async process() {
    console.log('开始处理缺失的制造商...\n');

    // 1. 添加制造商
    console.log('=== 第一步：添加制造商 ===');
    const manufacturersToAdd = this.getManufacturersToAdd();
    let addedManufacturers = 0;

    for (const manufacturer of manufacturersToAdd) {
      try {
        const existingId = await this.getManufacturerId(manufacturer.name);
        if (existingId) {
          console.log(`✅ 制造商已存在: ${manufacturer.name} (ID: ${existingId})`);
        } else {
          await this.insertManufacturer(manufacturer);
          const newId = await this.getManufacturerId(manufacturer.name);
          console.log(`✅ 新增制造商: ${manufacturer.name} (${manufacturer.country}) - ID: ${newId}`);
          addedManufacturers++;
        }
      } catch (error) {
        console.error(`❌ 添加制造商失败: ${manufacturer.name}`, error.message);
      }
    }

    console.log(`\n制造商添加完成，新增 ${addedManufacturers} 个制造商\n`);

    // 2. 建立武器-制造商关系
    console.log('=== 第二步：建立武器-制造商关系 ===');
    const mappings = this.getWeaponManufacturerMappings();
    let totalRelationsAdded = 0;

    for (const mapping of mappings) {
      try {
        const weaponId = await this.getWeaponId(mapping.weaponName);
        if (!weaponId) {
          console.log(`❌ 未找到武器: ${mapping.weaponName}`);
          continue;
        }

        console.log(`\n处理武器: ${mapping.weaponName} (ID: ${weaponId})`);
        let relationsForWeapon = 0;

        for (const manufacturerName of mapping.manufacturerNames) {
          const manufacturerId = await this.getManufacturerId(manufacturerName);
          if (!manufacturerId) {
            console.log(`  ❌ 未找到制造商: ${manufacturerName}`);
            continue;
          }

          const inserted = await this.insertWeaponManufacturerRelation(weaponId, manufacturerId);
          if (inserted) {
            console.log(`  ✅ 建立关系: ${mapping.weaponName} -> ${manufacturerName}`);
            relationsForWeapon++;
            totalRelationsAdded++;
          } else {
            console.log(`  ⚠️  关系已存在: ${mapping.weaponName} -> ${manufacturerName}`);
          }
        }

        if (relationsForWeapon === 0) {
          console.log(`  ⚠️  ${mapping.weaponName} 没有新增关系`);
        }

      } catch (error) {
        console.error(`❌ 处理武器失败: ${mapping.weaponName}`, error.message);
      }
    }

    console.log(`\n=== 处理完成 ===`);
    console.log(`新增制造商: ${addedManufacturers} 个`);
    console.log(`新增关系: ${totalRelationsAdded} 个`);

    return {
      addedManufacturers,
      totalRelationsAdded
    };
  }

  // 验证结果
  async verifyResults() {
    console.log('\n=== 验证结果 ===');
    
    const mappings = this.getWeaponManufacturerMappings();
    
    for (const mapping of mappings) {
      const weaponId = await this.getWeaponId(mapping.weaponName);
      if (!weaponId) continue;

      console.log(`\n${mapping.weaponName} (ID: ${weaponId}) 的制造商:`);
      
      const relations = await new Promise((resolve, reject) => {
        this.db.all(`
          SELECT m.name as manufacturer_name, m.country as manufacturer_country
          FROM weapon_manufacturers wm
          JOIN manufacturers m ON wm.manufacturer_id = m.id
          WHERE wm.weapon_id = ?
        `, [weaponId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      if (relations.length > 0) {
        relations.forEach(rel => {
          console.log(`  ✅ ${rel.manufacturer_name} (${rel.manufacturer_country})`);
        });
      } else {
        console.log(`  ❌ 未找到制造商关系`);
      }
    }
  }

  async close() {
    await databaseManager.close();
  }
}

// 主执行函数
async function main() {
  const handler = new MissingManufacturerHandler();
  
  try {
    console.log('初始化缺失制造商处理器...');
    await handler.initialize();
    
    const result = await handler.process();
    await handler.verifyResults();
    
    console.log('\n🎉 所有缺失的制造商和关系已成功添加！');
    
  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    await handler.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = MissingManufacturerHandler;