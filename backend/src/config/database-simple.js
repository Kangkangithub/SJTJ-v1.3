const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

class SimpleDatabaseManager {
  constructor() {
    this.db = null;
    this.cache = new Map(); // 简单内存缓存替代Redis
  }

  // 初始化SQLite数据库
  async connect() {
    try {
      const dbPath = path.join(__dirname, '../../data/military-knowledge.db');
      
      // 确保数据目录存在
      const fs = require('fs');
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('SQLite连接失败:', err);
          throw err;
        }
        logger.info('SQLite数据库连接成功');
      });

      // 启用外键约束（重要！防止数据完整性问题）
      await this.enableForeignKeys();

      // 初始化数据表
      await this.initializeTables();
      
      return this.db;
    } catch (error) {
      logger.error('数据库连接失败:', error);
      throw error;
    }
  }

  // 启用外键约束
  async enableForeignKeys() {
    return new Promise((resolve, reject) => {
      this.db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          logger.error('启用外键约束失败:', err);
          reject(err);
        } else {
          logger.info('✅ 外键约束已启用，数据完整性得到保障');
          resolve();
        }
      });
    });
  }

  // 初始化数据表
  async initializeTables() {
    return new Promise((resolve, reject) => {
      const tables = [
        // 用户表
        `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT,
          phone TEXT,
          bio TEXT,
          avatar TEXT,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'active',
          preferences TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )`,
        
        // 武器表
        `CREATE TABLE IF NOT EXISTS weapons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          country TEXT NOT NULL,
          year INTEGER,
          description TEXT,
          specifications TEXT DEFAULT '{}',
          images TEXT DEFAULT '[]',
          performance_data TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 武器类别表
        `CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`,
        
        // 国家表
        `CREATE TABLE IF NOT EXISTS countries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          code TEXT
        )`,
        
        // 用户兴趣表（替代Neo4j关系）
        `CREATE TABLE IF NOT EXISTS user_interests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          weapon_id INTEGER NOT NULL,
          interaction_type TEXT DEFAULT 'view',
          count INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (weapon_id) REFERENCES weapons (id),
          UNIQUE(user_id, weapon_id)
        )`,
        
        // 武器相似关系表
        `CREATE TABLE IF NOT EXISTS weapon_similarities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          weapon1_id INTEGER NOT NULL,
          weapon2_id INTEGER NOT NULL,
          similarity_score REAL DEFAULT 0.8,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (weapon1_id) REFERENCES weapons (id),
          FOREIGN KEY (weapon2_id) REFERENCES weapons (id)
        )`,
        
        // 问答记录表
        `CREATE TABLE IF NOT EXISTS qa_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          context TEXT,
          feedback INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`,
        
        // 制造商表
        `CREATE TABLE IF NOT EXISTS manufacturers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          country TEXT,
          founded INTEGER,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // 武器-制造商关联表
        `CREATE TABLE IF NOT EXISTS weapon_manufacturers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          weapon_id INTEGER NOT NULL,
          manufacturer_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (weapon_id) REFERENCES weapons (id) ON DELETE CASCADE,
          FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id) ON DELETE CASCADE,
          UNIQUE(weapon_id, manufacturer_id)
        )`
      ];

      let completed = 0;
      const total = tables.length;

      tables.forEach((sql, index) => {
        this.db.run(sql, (err) => {
          if (err) {
            logger.error(`创建表失败 (${index}):`, err);
            reject(err);
            return;
          }
          
          completed++;
          if (completed === total) {
            logger.info('所有数据表初始化完成');
            this.insertSampleData().then(resolve).catch(reject);
          }
        });
      });
    });
  }

  // 插入基础数据（不包含示例武器）
  async insertSampleData() {
    return new Promise((resolve, reject) => {
      // 插入武器类别
      const categories = [
        '步枪', '手枪', '机枪', '狙击枪', '火箭筒', 
        '坦克', '战斗机', '军舰', '导弹', '火炮'
      ];

      const categoryPromises = categories.map(category => {
        return new Promise((res, rej) => {
          this.db.run(
            'INSERT OR IGNORE INTO categories (name) VALUES (?)',
            [category],
            (err) => err ? rej(err) : res()
          );
        });
      });

      // 插入国家
      const countries = [
        '美国', '俄罗斯', '中国', '德国', '法国', 
        '英国', '以色列', '瑞典', '意大利', '日本', '奥地利'
      ];

      const countryPromises = countries.map(country => {
        return new Promise((res, rej) => {
          this.db.run(
            'INSERT OR IGNORE INTO countries (name) VALUES (?)',
            [country],
            (err) => err ? rej(err) : res()
          );
        });
      });

      // 插入基础制造商（保留制造商数据，因为可能被现有武器引用）
      const manufacturers = [
        { name: '卡拉什尼科夫集团', country: '俄罗斯', founded: 1807, description: '俄罗斯著名军工企业，AK系列步枪制造商' },
        { name: '柯尔特公司', country: '美国', founded: 1855, description: '美国历史悠久的枪械制造商，M16步枪制造商之一' },
        { name: '格洛克公司', country: '奥地利', founded: 1963, description: '奥地利手枪制造商，以Glock系列手枪闻名' },
        { name: '中国北方工业公司', country: '中国', founded: 1980, description: '中国大型军工企业集团' },
        { name: '洛克希德·马丁', country: '美国', founded: 1995, description: '美国航空航天、军火、军工技术公司' },
        { name: '波音公司', country: '美国', founded: 1916, description: '美国跨国航空航天公司和国防承包商' },
        { name: '雷神公司', country: '美国', founded: 1922, description: '美国主要国防承包商和工业公司' },
        { name: '莱茵金属', country: '德国', founded: 1889, description: '德国汽车零部件和军工企业' },
        { name: '泰雷兹集团', country: '法国', founded: 2000, description: '法国跨国公司，专门从事航空航天、国防、运输和安全市场' },
        { name: 'BAE系统公司', country: '英国', founded: 1999, description: '英国跨国国防、安全和航空航天公司' }
      ];

      const manufacturerPromises = manufacturers.map(manufacturer => {
        return new Promise((res, rej) => {
          this.db.run(
            'INSERT OR IGNORE INTO manufacturers (name, country, founded, description) VALUES (?, ?, ?, ?)',
            [manufacturer.name, manufacturer.country, manufacturer.founded, manufacturer.description],
            (err) => err ? rej(err) : res()
          );
        });
      });

      // 只插入基础数据，不插入示例武器
      Promise.all([...categoryPromises, ...countryPromises, ...manufacturerPromises])
        .then(() => {
          logger.info('基础数据插入完成（不包含示例武器）');
          resolve();
        })
        .catch(reject);
    });
  }

  // 获取数据库实例
  getDatabase() {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }
    return this.db;
  }

  // 缓存操作
  setCache(key, value, ttl = 3600) {
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
  }

  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clearCache(pattern) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // 关闭连接
  async close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('关闭数据库连接失败:', err);
          } else {
            logger.info('数据库连接已关闭');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// 创建单例实例
const simpleDatabaseManager = new SimpleDatabaseManager();

module.exports = simpleDatabaseManager;