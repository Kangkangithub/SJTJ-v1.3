const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

class SimpleDatabaseManager {
  constructor() {
    this.db = null;
    this.cache = new Map(); // 简单内存缓存
  }

  // 初始化SQLite数据库
  async connect() {
    try {
      // 优先使用环境变量 SQLITE_PATH，否则使用默认相对路径
      const dbPath = process.env.SQLITE_PATH
        ? path.resolve(process.env.SQLITE_PATH)
        : path.join(__dirname, '../../data/herb-knowledge.db');

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

      // 启用外键约束
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
          logger.info('✅ 外键约束已启用');
          resolve();
        }
      });
    });
  }

  // 初始化数据表
  async initializeTables() {
    return new Promise((resolve, reject) => {
      const tables = [
        // ===== 用户系统（保持不变） =====
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

        // ===== 药材分类（原 categories） =====
        `CREATE TABLE IF NOT EXISTS herb_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`,

        // ===== 产地/道地产区（原 countries） =====
        `CREATE TABLE IF NOT EXISTS herb_regions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`,

        // ===== 药材来源/基源（原 manufacturers） =====
        `CREATE TABLE IF NOT EXISTS herb_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // ===== 性味表 =====
        // type: 'qi'（寒热温凉平）| 'flavor'（酸苦甘辛咸淡涩）
        `CREATE TABLE IF NOT EXISTS properties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('qi','flavor')),
          description TEXT
        )`,

        // ===== 归经表 =====
        `CREATE TABLE IF NOT EXISTS meridians (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          abbreviation TEXT,
          description TEXT
        )`,

        // ===== 功效标签表 =====
        `CREATE TABLE IF NOT EXISTS efficacies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          description TEXT
        )`,

        // ===== 药材主表（原 weapons） =====
        `CREATE TABLE IF NOT EXISTS herbs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          pinyin TEXT,
          latin_name TEXT,
          alias TEXT,
          category_id INTEGER,
          region_id INTEGER,
          source_id INTEGER,
          description TEXT,
          efficacy TEXT,
          usage_dosage TEXT,
          caution TEXT,
          quality TEXT DEFAULT '{}',
          images TEXT DEFAULT '[]',
          is_common INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES herb_categories(id),
          FOREIGN KEY (region_id) REFERENCES herb_regions(id),
          FOREIGN KEY (source_id) REFERENCES herb_sources(id)
        )`,

        // ===== 药材-性味关联（多对多） =====
        `CREATE TABLE IF NOT EXISTS herb_properties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          herb_id INTEGER NOT NULL,
          property_id INTEGER NOT NULL,
          intensity TEXT DEFAULT 'normal' CHECK(intensity IN ('slight','normal','strong')),
          FOREIGN KEY (herb_id) REFERENCES herbs(id) ON DELETE CASCADE,
          FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
          UNIQUE(herb_id, property_id)
        )`,

        // ===== 药材-归经关联（多对多） =====
        `CREATE TABLE IF NOT EXISTS herb_meridians (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          herb_id INTEGER NOT NULL,
          meridian_id INTEGER NOT NULL,
          FOREIGN KEY (herb_id) REFERENCES herbs(id) ON DELETE CASCADE,
          FOREIGN KEY (meridian_id) REFERENCES meridians(id) ON DELETE CASCADE,
          UNIQUE(herb_id, meridian_id)
        )`,

        // ===== 药材-功效关联（多对多） =====
        `CREATE TABLE IF NOT EXISTS herb_efficacies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          herb_id INTEGER NOT NULL,
          efficacy_id INTEGER NOT NULL,
          FOREIGN KEY (herb_id) REFERENCES herbs(id) ON DELETE CASCADE,
          FOREIGN KEY (efficacy_id) REFERENCES efficacies(id) ON DELETE CASCADE,
          UNIQUE(herb_id, efficacy_id)
        )`,

        // ===== 方剂表 =====
        `CREATE TABLE IF NOT EXISTS formulas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          pinyin TEXT,
          category TEXT,
          description TEXT,
          usage TEXT,
          caution TEXT,
          source TEXT,
          images TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // ===== 方剂-药材关联（组成） =====
        `CREATE TABLE IF NOT EXISTS formula_herbs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          formula_id INTEGER NOT NULL,
          herb_id INTEGER NOT NULL,
          dosage TEXT,
          role TEXT CHECK(role IN ('君','臣','佐','使',NULL)),
          note TEXT,
          FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE,
          FOREIGN KEY (herb_id) REFERENCES herbs(id) ON DELETE CASCADE,
          UNIQUE(formula_id, herb_id)
        )`,

        // ===== 药材配伍规则 =====
        // relation_type: 相须(相须/相使/相畏/相杀/相恶/相反
        `CREATE TABLE IF NOT EXISTS compatibility_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          herb1_id INTEGER NOT NULL,
          herb2_id INTEGER NOT NULL,
          relation_type TEXT NOT NULL CHECK(relation_type IN ('相须','相使','相畏','相杀','相恶','相反')),
          description TEXT,
          source TEXT,
          FOREIGN KEY (herb1_id) REFERENCES herbs(id) ON DELETE CASCADE,
          FOREIGN KEY (herb2_id) REFERENCES herbs(id) ON DELETE CASCADE,
          UNIQUE(herb1_id, herb2_id)
        )`,

        // ===== 药材图片表（原 weapon_images） =====
        `CREATE TABLE IF NOT EXISTS herb_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          herb_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          is_primary INTEGER DEFAULT 0,
          upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (herb_id) REFERENCES herbs(id) ON DELETE CASCADE
        )`,

        // ===== 药材相似度（原 weapon_similarities） =====
        `CREATE TABLE IF NOT EXISTS herb_similarities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          herb1_id INTEGER NOT NULL,
          herb2_id INTEGER NOT NULL,
          similarity_score REAL DEFAULT 0.8,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (herb1_id) REFERENCES herbs(id),
          FOREIGN KEY (herb2_id) REFERENCES herbs(id)
        )`,

        // ===== 用户收藏（原 user_interests） =====
        `CREATE TABLE IF NOT EXISTS user_favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          target_type TEXT NOT NULL CHECK(target_type IN ('herb','formula')),
          target_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          UNIQUE(user_id, target_type, target_id)
        )`,

        // ===== 问答记录（保持不变） =====
        `CREATE TABLE IF NOT EXISTS qa_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          context TEXT,
          feedback INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,

        // ===== 知识图谱缓存表 =====
        `CREATE TABLE IF NOT EXISTS knowledge_graph_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cache_key TEXT UNIQUE NOT NULL,
          cache_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // ===== 对话表（用户隔离，每个用户多个对话） =====
        `CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`,

        // ===== 消息表（每条消息属于一个对话） =====
        `CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user','assistant')),
          content TEXT NOT NULL,
          sources TEXT DEFAULT '[]',
          mode TEXT DEFAULT '',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
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
            this.migrateDatabase().then(() => this.insertReferenceData()).then(resolve).catch(reject);
          }
        });
      });
    });
  }

  // 数据库迁移：给旧版本 schema 补齐缺失的列（如 is_common）
  async migrateDatabase() {
    return new Promise((resolve, reject) => {
      this.db.all(`PRAGMA table_info(herbs)`, (err, columns) => {
        if (err) { reject(err); return; }
        const hasIsCommon = columns.some(c => c.name === 'is_common');
        if (!hasIsCommon) {
          this.db.run(`ALTER TABLE herbs ADD COLUMN is_common INTEGER DEFAULT 0`, (alterErr) => {
            if (alterErr) {
              logger.error('迁移 is_common 列失败:', alterErr);
              reject(alterErr);
            } else {
              logger.info('✅ 已自动迁移：herbs 表新增 is_common 列');
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  }

  // 插入参考数据（性味归经、分类、产地等基础数据）
  async insertReferenceData() {
    return new Promise((resolve, reject) => {
      try {
        // 1. 性味 - 气（寒热温凉平）
        const qiProperties = [
          { name: '寒', type: 'qi', description: '能清热泻火、凉血解毒' },
          { name: '热', type: 'qi', description: '能温里散寒、助阳通脉' },
          { name: '温', type: 'qi', description: '能温中散寒、补火助阳' },
          { name: '凉', type: 'qi', description: '能清热除烦、解暑' },
          { name: '平', type: 'qi', description: '药性平和，寒热偏向不显著' }
        ];

        // 2. 性味 - 味（酸苦甘辛咸淡涩）
        const flavorProperties = [
          { name: '酸', type: 'flavor', description: '能收能涩，有收敛固涩作用' },
          { name: '苦', type: 'flavor', description: '能泄能燥能坚，有清热泻火作用' },
          { name: '甘', type: 'flavor', description: '能补能和能缓，有补益和中作用' },
          { name: '辛', type: 'flavor', description: '能散能行，有发散行气作用' },
          { name: '咸', type: 'flavor', description: '能下能软，有软坚散结作用' },
          { name: '淡', type: 'flavor', description: '能渗能利，有利水渗湿作用' },
          { name: '涩', type: 'flavor', description: '能收敛固涩，与酸味相似' }
        ];

        // 3. 归经
        const meridianData = [
          { name: '肝', abbreviation: 'LR', description: '足厥阴肝经' },
          { name: '心', abbreviation: 'HT', description: '手少阴心经' },
          { name: '脾', abbreviation: 'SP', description: '足太阴脾经' },
          { name: '肺', abbreviation: 'LU', description: '手太阴肺经' },
          { name: '肾', abbreviation: 'KI', description: '足少阴肾经' },
          { name: '心包', abbreviation: 'PC', description: '手厥阴心包经' },
          { name: '胆', abbreviation: 'GB', description: '足少阳胆经' },
          { name: '小肠', abbreviation: 'SI', description: '手太阳小肠经' },
          { name: '胃', abbreviation: 'ST', description: '足阳明胃经' },
          { name: '大肠', abbreviation: 'LI', description: '手阳明大肠经' },
          { name: '膀胱', abbreviation: 'BL', description: '足太阳膀胱经' },
          { name: '三焦', abbreviation: 'SJ', description: '手少阳三焦经' }
        ];

        // 4. 药材分类
        const categoryData = [
          { name: '解表药', description: '以发散表邪为主要功效' },
          { name: '清热药', description: '以清解里热为主要功效' },
          { name: '泻下药', description: '以通利大便为主要功效' },
          { name: '祛风湿药', description: '以祛除风湿为主要功效' },
          { name: '化湿药', description: '以化湿醒脾为主要功效' },
          { name: '利水渗湿药', description: '以通利水道为主要功效' },
          { name: '温里药', description: '以温里散寒为主要功效' },
          { name: '理气药', description: '以疏理气机为主要功效' },
          { name: '消食药', description: '以消食导滞为主要功效' },
          { name: '止血药', description: '以制止出血为主要功效' },
          { name: '活血化瘀药', description: '以通畅血行为主要功效' },
          { name: '化痰止咳平喘药', description: '以化痰止咳为主要功效' },
          { name: '安神药', description: '以安定神志为主要功效' },
          { name: '平肝息风药', description: '以平肝潜阳为主要功效' },
          { name: '开窍药', description: '以开窍醒神为主要功效' },
          { name: '补虚药', description: '以补益正气为主要功效' },
          { name: '收涩药', description: '以收敛固涩为主要功效' }
        ];

        // 5. 产地
        const regionData = [
          { name: '甘肃', description: '西北道地产区' },
          { name: '四川', description: '西南道地产区' },
          { name: '云南', description: '西南道地产区' },
          { name: '广东', description: '华南道地产区' },
          { name: '河南', description: '华中道地产区' },
          { name: '安徽', description: '华东道地产区' },
          { name: '浙江', description: '华东道地产区' },
          { name: '吉林', description: '东北道地产区' },
          { name: '山西', description: '北方道地产区' },
          { name: '宁夏', description: '西北道地产区' },
          { name: '贵州', description: '西南道地产区' },
          { name: '广西', description: '华南道地产区' }
        ];

        // 6. 来源/基源
        const sourceData = [
          { name: '植物', description: '来源于植物的根、茎、叶、花、果实、种子等' },
          { name: '动物', description: '来源于动物全体或部分组织' },
          { name: '矿物', description: '来源于天然矿物或化石' }
        ];

        const allPromises = [];

        const insert = (table, data) => {
          const keys = Object.keys(data[0]);
          const placeholders = keys.map(() => '?').join(', ');
          const cols = keys.join(', ');
          data.forEach(row => {
            allPromises.push(new Promise((res, rej) => {
              this.db.run(
                `INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${placeholders})`,
                Object.values(row),
                (err) => err ? rej(err) : res()
              );
            }));
          });
        };

        insert('properties', [...qiProperties, ...flavorProperties]);
        insert('meridians', meridianData);
        insert('herb_categories', categoryData);
        insert('herb_regions', regionData);
        insert('herb_sources', sourceData);

        Promise.all(allPromises)
          .then(() => {
            logger.info('参考数据初始化完成（性味归经/分类/产地/来源）');
            resolve();
          })
          .catch(reject);

      } catch (error) {
        reject(error);
      }
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
