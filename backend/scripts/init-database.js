const databaseManager = require('../src/config/database');
const logger = require('../src/utils/logger');

class DatabaseInitializer {
  async initializeNeo4j() {
    logger.info('开始初始化Neo4j数据库...');
    
    const session = databaseManager.getNeo4jSession();
    
    try {
      // 创建索引
      await session.run('CREATE INDEX weapon_id_index IF NOT EXISTS FOR (w:Weapon) ON (w.id)');
      await session.run('CREATE INDEX weapon_name_index IF NOT EXISTS FOR (w:Weapon) ON (w.name)');
      await session.run('CREATE INDEX weapon_type_index IF NOT EXISTS FOR (w:Weapon) ON (w.type)');
      await session.run('CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id)');
      await session.run('CREATE INDEX category_name_index IF NOT EXISTS FOR (c:Category) ON (c.name)');
      await session.run('CREATE INDEX country_name_index IF NOT EXISTS FOR (c:Country) ON (c.name)');
      
      logger.info('Neo4j索引创建完成');

      // 创建示例数据
      await this.createSampleData(session);
      
      logger.info('Neo4j数据库初始化完成');
    } catch (error) {
      logger.error('Neo4j初始化失败:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createSampleData(session) {
    logger.info('创建示例数据...');

    // 创建武器类别
    const categories = [
      '步枪', '手枪', '机枪', '狙击枪', '火箭筒', 
      '坦克', '战斗机', '军舰', '导弹', '火炮'
    ];

    for (const category of categories) {
      await session.run(
        'MERGE (c:Category {name: $name})',
        { name: category }
      );
    }

    // 创建国家
    const countries = [
      '美国', '俄罗斯', '中国', '德国', '法国', 
      '英国', '以色列', '瑞典', '意大利', '日本'
    ];

    for (const country of countries) {
      await session.run(
        'MERGE (c:Country {name: $name})',
        { name: country }
      );
    }

    // 创建示例武器
    const sampleWeapons = [
      {
        id: 'ak47-001',
        name: 'AK-47突击步枪',
        type: '步枪',
        country: '俄罗斯',
        year: 1947
      },
      {
        id: 'm16-001',
        name: 'M16突击步枪',
        type: '步枪',
        country: '美国',
        year: 1964
      },
      {
        id: 'glock17-001',
        name: 'Glock 17手枪',
        type: '手枪',
        country: '奥地利',
        year: 1982
      },
      {
        id: 'barrett-001',
        name: 'Barrett M82狙击枪',
        type: '狙击枪',
        country: '美国',
        year: 1982
      },
      {
        id: 'rpg7-001',
        name: 'RPG-7火箭筒',
        type: '火箭筒',
        country: '俄罗斯',
        year: 1961
      }
    ];

    for (const weapon of sampleWeapons) {
      // 创建武器节点
      await session.run(`
        CREATE (w:Weapon {
          id: $id,
          name: $name,
          type: $type,
          country: $country,
          year: $year,
          created_at: datetime()
        })
      `, weapon);

      // 创建武器与类别的关系
      await session.run(`
        MATCH (w:Weapon {id: $weaponId})
        MATCH (c:Category {name: $type})
        CREATE (w)-[:BELONGS_TO]->(c)
      `, {
        weaponId: weapon.id,
        type: weapon.type
      });

      // 创建武器与国家的关系
      await session.run(`
        MATCH (w:Weapon {id: $weaponId})
        MATCH (c:Country {name: $country})
        CREATE (w)-[:MANUFACTURED_BY]->(c)
      `, {
        weaponId: weapon.id,
        country: weapon.country
      });
    }

    // 创建武器之间的相似关系
    await session.run(`
      MATCH (w1:Weapon {id: 'ak47-001'})
      MATCH (w2:Weapon {id: 'm16-001'})
      CREATE (w1)-[:SIMILAR_TO {similarity_score: 0.8, reason: '同为突击步枪'}]->(w2)
    `);

    logger.info('示例数据创建完成');
  }

  async initializeMongoDB() {
    logger.info('开始初始化MongoDB数据库...');
    
    const db = databaseManager.getMongoDatabase();
    
    try {
      // 创建集合和索引
      const collections = [
        {
          name: 'users',
          indexes: [
            { key: { username: 1 }, unique: true },
            { key: { email: 1 }, unique: true },
            { key: { created_at: 1 } }
          ]
        },
        {
          name: 'weapon_details',
          indexes: [
            { key: { name: 1 } },
            { key: { type: 1 } },
            { key: { country: 1 } },
            { key: { created_at: 1 } },
            { key: { name: 'text', description: 'text' } }
          ]
        },
        {
          name: 'qa_records',
          indexes: [
            { key: { user_id: 1 } },
            { key: { timestamp: 1 } },
            { key: { question: 'text', answer: 'text' } }
          ]
        }
      ];

      for (const collection of collections) {
        // 创建集合
        await db.createCollection(collection.name);
        
        // 创建索引
        for (const index of collection.indexes) {
          await db.collection(collection.name).createIndex(index.key, {
            unique: index.unique || false,
            background: true
          });
        }
        
        logger.info(`MongoDB集合 ${collection.name} 初始化完成`);
      }

      // 插入示例武器详细数据
      await this.insertSampleWeaponDetails(db);
      
      logger.info('MongoDB数据库初始化完成');
    } catch (error) {
      logger.error('MongoDB初始化失败:', error);
      throw error;
    }
  }

  async insertSampleWeaponDetails(db) {
    const weaponDetails = [
      {
        name: 'AK-47突击步枪',
        type: '步枪',
        country: '俄罗斯',
        year: 1947,
        description: 'AK-47是由苏联枪械设计师米哈伊尔·卡拉什尼科夫设计的自动步枪，是世界上最著名和使用最广泛的突击步枪之一。',
        specifications: {
          caliber: '7.62×39mm',
          length: '870mm',
          weight: '4.3kg',
          rate_of_fire: '600发/分钟',
          effective_range: '400m'
        },
        images: [],
        documents: [],
        performance_data: {
          reliability: 9.5,
          accuracy: 7.0,
          durability: 9.8
        },
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'M16突击步枪',
        type: '步枪',
        country: '美国',
        year: 1964,
        description: 'M16是美国军队的制式突击步枪，以其轻量化和高精度著称。',
        specifications: {
          caliber: '5.56×45mm NATO',
          length: '1006mm',
          weight: '3.26kg',
          rate_of_fire: '700-950发/分钟',
          effective_range: '550m'
        },
        images: [],
        documents: [],
        performance_data: {
          reliability: 8.0,
          accuracy: 9.0,
          durability: 7.5
        },
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'Glock 17手枪',
        type: '手枪',
        country: '奥地利',
        year: 1982,
        description: 'Glock 17是奥地利格洛克公司生产的半自动手枪，以其可靠性和简洁设计闻名。',
        specifications: {
          caliber: '9×19mm',
          length: '186mm',
          weight: '0.625kg',
          magazine_capacity: '17发',
          effective_range: '50m'
        },
        images: [],
        documents: [],
        performance_data: {
          reliability: 9.2,
          accuracy: 8.5,
          durability: 9.0
        },
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await db.collection('weapon_details').insertMany(weaponDetails);
    logger.info('示例武器详细数据插入完成');
  }

  async initializeRedis() {
    logger.info('开始初始化Redis缓存...');
    
    const redis = databaseManager.getRedisClient();
    
    try {
      // 测试Redis连接
      await redis.ping();
      
      // 设置一些初始缓存配置
      await redis.set('cache:initialized', 'true');
      await redis.expire('cache:initialized', 3600);
      
      logger.info('Redis缓存初始化完成');
    } catch (error) {
      logger.error('Redis初始化失败:', error);
      throw error;
    }
  }

  async run() {
    try {
      logger.info('开始数据库初始化...');
      
      // 连接所有数据库
      await databaseManager.connectAll();
      
      // 初始化各个数据库
      await this.initializeNeo4j();
      await this.initializeMongoDB();
      await this.initializeRedis();
      
      logger.info('所有数据库初始化完成！');
      
    } catch (error) {
      logger.error('数据库初始化失败:', error);
      process.exit(1);
    } finally {
      // 关闭数据库连接
      await databaseManager.closeAll();
      process.exit(0);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const initializer = new DatabaseInitializer();
  initializer.run();
}

module.exports = DatabaseInitializer;