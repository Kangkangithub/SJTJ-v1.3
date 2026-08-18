# SQLite关系型数据库设计

<cite>
**本文档中引用的文件**
- [database-simple.js](file://backend/src/config/database-simple.js)
- [embeddingService.js](file://backend/src/services/embeddingService.js)
- [EMBEDDING_VECTOR_SEARCH.md](file://docs/EMBEDDING_VECTOR_SEARCH.md)
- [init-db.js](file://backend/init-db.js)
- [init-database.js](file://backend/scripts/init-database.js)
- [weapons-simple.js](file://backend/src/routes/weapons-simple.js)
- [weaponService.js](file://backend/src/services/weaponService.js)
- [userService-simple.js](file://backend/src/services/userService-simple.js)
- [database-health-check.js](file://backend/scripts/database-health-check.js)
- [fix-database-integrity.js](file://backend/scripts/fix-database-integrity.js)
- [populate-weapon-manufacturer-relations.js](file://backend/scripts/populate-weapon-manufacturer-relations.js)
- [manufacturer-statistics.js](file://backend/src/routes/manufacturer-statistics.js)
- [index.js](file://backend/src/config/index.js)
</cite>

## 更新摘要
**变更内容**
- 新增herb_embeddings表结构和向量存储功能说明
- 添加语义检索系统的完整实现细节
- 更新数据库表结构设计章节
- 新增向量检索优化策略章节
- 补充Neo4j与SQLite混合架构说明

## 目录
1. [简介](#简介)
2. [项目结构概览](#项目结构概览)
3. [核心表结构设计](#核心表结构设计)
4. [外键约束与数据完整性](#外键约束与数据完整性)
5. [辅助表与关系设计](#辅助表与关系设计)
6. [向量存储与语义检索系统](#向量存储与语义检索系统)
7. [数据库初始化流程](#数据库初始化流程)
8. [内存缓存机制](#内存缓存机制)
9. [SQL查询优化](#sql查询优化)
10. [事务处理模式](#事务处理模式)
11. [SQLite与Neo4j对比](#sqlite与neo4j对比)
12. [故障排除指南](#故障排除指南)
13. [总结](#总结)

## 简介

兵智世界v1.3项目采用SQLite作为核心关系型数据库，配合内存缓存机制和向量存储能力，构建了一个高效的知识管理体系。该数据库设计专注于武器知识和中药知识的结构化存储，支持复杂的查询、关系管理和语义检索，同时通过外键约束确保数据完整性。

## 项目结构概览

```mermaid
graph TB
subgraph "数据库层"
DB[SQLite数据库<br/>military-knowledge.db]
Config[database-simple.js<br/>数据库配置管理]
end
subgraph "核心表"
Weapons[weapons<br/>武器表]
Users[users<br/>用户表]
Manufacturers[manufacturers<br/>制造商表]
Categories[categories<br/>武器类别表]
Countries[countries<br/>国家表]
HerbEmbeddings[herb_embeddings<br/>药材向量表]
end
subgraph "关系表"
WeaponManu[weapon_manufacturers<br/>武器-制造商关系]
UserInterests[user_interests<br/>用户兴趣表]
WeaponSim[weapon_similarities<br/>武器相似关系]
QaRecords[qa_records<br/>问答记录表]
end
subgraph "外部服务"
Neo4j[(Neo4j图数据库)]
DashScope[(百炼API)]
end
Config --> DB
DB --> Weapons
DB --> Users
DB --> Manufacturers
DB --> Categories
DB --> Countries
DB --> HerbEmbeddings
DB --> WeaponManu
DB --> UserInterests
DB --> WeaponSim
DB --> QaRecords
Neo4j -.-> HerbEmbeddings
DashScope -.-> HerbEmbeddings
```

**图表来源**
- [database-simple.js:48-157](file://backend/src/config/database-simple.js#L48-L157)
- [embeddingService.js:1-50](file://backend/src/services/embeddingService.js#L1-L50)

**章节来源**
- [database-simple.js:1-323](file://backend/src/config/database-simple.js#L1-L323)

## 核心表结构设计

### 武器表 (weapons)

武器表是整个数据库的核心实体表，存储所有武器的基本信息。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键，自增ID |
| name | TEXT | NOT NULL | 武器名称 |
| type | TEXT | NOT NULL | 武器类型（步枪、手枪等） |
| country | TEXT | NOT NULL | 生产国家 |
| year | INTEGER | - | 生产年份 |
| description | TEXT | - | 武器描述 |
| specifications | TEXT | DEFAULT '{}' | 规格参数（JSON格式） |
| images | TEXT | DEFAULT '[]' | 图片列表（JSON数组） |
| performance_data | TEXT | DEFAULT '{}' | 性能数据（JSON格式） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 用户表 (users)

用户表管理系统的用户账户信息和权限。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键，自增ID |
| username | TEXT | UNIQUE NOT NULL | 用户名 |
| email | TEXT | UNIQUE NOT NULL | 邮箱地址 |
| password_hash | TEXT | NOT NULL | 密码哈希值 |
| name | TEXT | - | 真实姓名 |
| phone | TEXT | - | 联系电话 |
| bio | TEXT | - | 个人简介 |
| avatar | TEXT | - | 头像URL |
| role | TEXT | DEFAULT 'user' | 用户角色 |
| status | TEXT | DEFAULT 'active' | 账户状态 |
| preferences | TEXT | DEFAULT '{}' | 用户偏好设置 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 注册时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 最后更新 |
| last_login | DATETIME | - | 最后登录时间 |

### 制造商表 (manufacturers)

制造商表存储武器制造企业的基本信息。

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键，自增ID |
| name | TEXT | UNIQUE NOT NULL | 制造商名称 |
| country | TEXT | - | 所属国家 |
| founded | INTEGER | - | 成立年份 |
| description | TEXT | - | 公司描述 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**章节来源**
- [database-simple.js:48-157](file://backend/src/config/database-simple.js#L48-L157)

## 外键约束与数据完整性

### 外键约束启用

SQLite数据库通过PRAGMA语句启用外键约束，这是确保数据完整性的关键机制。

```javascript
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
```

### 级联删除机制

武器-制造商关系表展示了SQLite的级联删除功能：

```sql
CREATE TABLE IF NOT EXISTS weapon_manufacturers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weapon_id INTEGER NOT NULL,
  manufacturer_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (weapon_id) REFERENCES weapons (id) ON DELETE CASCADE,
  FOREIGN KEY (manufacturer_id) REFERENCES manufacturers (id) ON DELETE CASCADE,
  UNIQUE(weapon_id, manufacturer_id)
)
```

当删除武器或制造商时，相关的关联记录会自动被删除，避免了孤立的数据。

### 外键约束验证

系统提供了完整的外键约束验证机制：

```mermaid
flowchart TD
Start([开始完整性检查]) --> CheckFK["检查外键约束状态"]
CheckFK --> FKEnabled{"外键约束<br/>已启用？"}
FKEnabled --> |否| EnableFK["启用外键约束"]
FKEnabled --> |是| CheckRelations["检查关系完整性"]
EnableFK --> CheckRelations
CheckRelations --> ValidateWeapon["验证武器关系"]
ValidateWeapon --> ValidateManufacturer["验证制造商关系"]
ValidateManufacturer --> ReportResults["报告检查结果"]
ReportResults --> End([结束])
```

**图表来源**
- [fix-database-integrity.js:40-129](file://backend/scripts/fix-database-integrity.js#L40-L129)

**章节来源**
- [database-simple.js:48-60](file://backend/src/config/database-simple.js#L48-L60)
- [fix-database-integrity.js:40-129](file://backend/scripts/fix-database-integrity.js#L40-L129)

## 辅助表与关系设计

### 武器类别表 (categories)

武器类别表提供武器分类体系，支持多维度查询。

```sql
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT
)
```

### 国家表 (countries)

国家表存储武器生产国家信息，支持地理相关的查询。

```sql
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  code TEXT
)
```

### 用户兴趣表 (user_interests)

用户兴趣表替代了Neo4j中的关系存储，记录用户的武器浏览和交互行为。

```sql
CREATE TABLE IF NOT EXISTS user_interests (
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
)
```

### 武器相似关系表 (weapon_similarities)

记录武器之间的相似度关系，支持推荐算法。

```sql
CREATE TABLE IF NOT EXISTS weapon_similarities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weapon1_id INTEGER NOT NULL,
  weapon2_id INTEGER NOT NULL,
  similarity_score REAL DEFAULT 0.8,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (weapon1_id) REFERENCES weapons (id),
  FOREIGN KEY (weapon2_id) REFERENCES weapons (id)
)
```

### 问答记录表 (qa_records)

记录用户与系统的问答交互，支持知识管理。

```sql
CREATE TABLE IF NOT EXISTS qa_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  context TEXT,
  feedback INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
)
```

**章节来源**
- [database-simple.js:84-157](file://backend/src/config/database-simple.js#L84-L157)

## 向量存储与语义检索系统

### herb_embeddings表结构

新增的herb_embeddings表为中药知识提供了向量存储能力，支持语义检索功能：

| 字段名 | 数据类型 | 约束 | 说明 |
|--------|----------|------|------|
| name | TEXT | PRIMARY KEY | 药材名，天然唯一，直接当主键 |
| vector | TEXT | NOT NULL | JSON序列化的1024维浮点数组 |
| source_text | TEXT | - | 生成该向量时的源文本（用于增量diff） |
| model | TEXT | - | 向量模型名（如text-embedding-v3） |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### 向量存储设计要点

1. **主键设计**：使用`name`作为主键而不是自增id，因为业务上「一味药 → 一个向量」是天然的一对一关系
2. **向量存储**：`vector`用TEXT存JSON，省去二进制BLOB的处理复杂度（1024个浮点≈21KB，SQLite完全没压力）
3. **增量同步**：`source_text`是增量diff的判据，缺了它就无法判断「字段有没有变」
4. **模型追踪**：`model`字段记录使用的向量模型版本，便于后续模型升级管理

### 语义检索架构

```mermaid
sequenceDiagram
participant User as 用户
participant RAG as RAG服务
participant Embedding as Embedding服务
participant Neo4j as Neo4j数据库
participant SQLite as SQLite数据库
participant DashScope as 百炼API
User->>RAG : 发送查询请求
RAG->>Neo4j : 关键词检索
Neo4j-->>RAG : 返回相关药材
RAG->>Embedding : 语义检索请求
Embedding->>SQLite : 加载向量数据
SQLite-->>Embedding : 返回向量数据
Embedding->>DashScope : 计算查询向量
DashScope-->>Embedding : 返回查询向量
Embedding->>Embedding : 余弦相似度计算
Embedding-->>RAG : 返回语义匹配结果
RAG->>RAG : 合并去重结果
RAG-->>User : 返回最终结果
```

**图表来源**
- [embeddingService.js:1-50](file://backend/src/services/embeddingService.js#L1-L50)
- [EMBEDDING_VECTOR_SEARCH.md:91-111](file://docs/EMBEDDING_VECTOR_SEARCH.md#L91-L111)

### 向量同步机制

系统实现了智能的增量同步机制：

1. **启动预热**：服务器启动后延迟2秒执行全量同步
2. **增量Diff**：对比Neo4j药材清单，只为新增或字段变化的药材重新向量化
3. **单条更新**：CRUD操作时异步调用updateOne/deleteOne，实时同步向量数据
4. **内存缓存**：向量数据加载到内存Map中，避免重复计算

### 性能优化策略

| 优化策略 | 实现方式 | 效果 |
|----------|----------|------|
| 批量处理 | BATCH_SIZE=10，符合百炼API限制 | 减少API调用次数 |
| 增量同步 | 基于source_text对比变化 | 避免全量重算 |
| 内存缓存 | Map存储向量数据 | 零网络开销检索 |
| 异步处理 | CRUD操作不阻塞接口响应 | 提升用户体验 |

**章节来源**
- [database-simple.js:307-315](file://backend/src/config/database-simple.js#L307-L315)
- [embeddingService.js:1-200](file://backend/src/services/embeddingService.js#L1-L200)
- [EMBEDDING_VECTOR_SEARCH.md:353-373](file://docs/EMBEDDING_VECTOR_SEARCH.md#L353-L373)

## 数据库初始化流程

### 初始化步骤

数据库初始化遵循严格的顺序，确保所有表结构正确建立：

```mermaid
sequenceDiagram
participant App as 应用启动
participant DB as 数据库管理器
participant FS as 文件系统
participant Tables as 表结构
App->>DB : connect()
DB->>FS : 检查数据目录
FS-->>DB : 目录状态
DB->>DB : 创建数据库连接
DB->>DB : enableForeignKeys()
DB->>Tables : initializeTables()
loop 创建每个表
Tables->>Tables : 执行CREATE TABLE语句
Tables-->>Tables : 表创建完成
end
Tables->>Tables : insertSampleData()
Tables-->>App : 初始化完成
```

**图表来源**
- [database-simple.js:15-47](file://backend/src/config/database-simple.js#L15-L47)

### 基础数据插入

初始化过程中会插入预定义的基础数据：

```javascript
// 插入武器类别
const categories = [
  '步枪', '手枪', '机枪', '狙击枪', '火箭筒', 
  '坦克', '战斗机', '军舰', '导弹', '火炮'
];

// 插入国家
const countries = [
  '美国', '俄罗斯', '中国', '德国', '法国', 
  '英国', '以色列', '瑞典', '意大利', '日本', '奥地利'
];

// 插入制造商
const manufacturers = [
  { name: '卡拉什尼科夫集团', country: '俄罗斯', founded: 1807, description: '俄罗斯著名军工企业' },
  { name: '柯尔特公司', country: '美国', founded: 1855, description: '美国历史悠久的枪械制造商' },
  // ... 更多制造商
];
```

**章节来源**
- [database-simple.js:159-230](file://backend/src/config/database-simple.js#L159-L230)

## 内存缓存机制

### Map替代Redis

为了简化部署和减少外部依赖，系统使用JavaScript的Map对象实现内存缓存：

```javascript
class SimpleDatabaseManager {
  constructor() {
    this.db = null;
    this.cache = new Map(); // 简单内存缓存替代Redis
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
}
```

### 缓存策略

| 缓存类型 | TTL | 用途 |
|----------|-----|------|
| 默认缓存 | 3600秒 | 一般查询结果 |
| 知识图谱缓存 | 7200秒 | 复杂关系查询 |
| 用户数据缓存 | 1800秒 | 用户信息和偏好 |
| 向量缓存 | 永久 | 药材向量数据 |

### 缓存清理机制

```javascript
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
```

**章节来源**
- [database-simple.js:245-295](file://backend/src/config/database-simple.js#L245-L295)

## SQL查询优化

### 查询性能优化策略

#### 1. 索引设计原则

虽然SQLite自动为主键和唯一约束创建索引，但在复杂查询中仍需注意：

```sql
-- 为频繁查询的字段创建索引
CREATE INDEX idx_weapons_type ON weapons(type);
CREATE INDEX idx_weapons_country ON weapons(country);
CREATE INDEX idx_user_interests_user ON user_interests(user_id);
CREATE INDEX idx_user_interests_weapon ON user_interests(weapon_id);
```

#### 2. 查询优化示例

武器搜索查询的优化：

```sql
-- 优化前：全表扫描
SELECT * FROM weapons 
WHERE name LIKE '%search_term%' 
   OR description LIKE '%search_term%';

-- 优化后：使用全文搜索（如果需要）
CREATE VIRTUAL TABLE weapon_search USING fts5(name, description);
```

#### 3. 连接查询优化

武器列表查询的优化：

```sql
-- 使用LEFT JOIN获取制造商信息
SELECT w.id, w.name, w.type, w.country, w.year, w.description, 
       m.name as manufacturer
FROM weapons w
LEFT JOIN weapon_manufacturers wm ON w.id = wm.weapon_id
LEFT JOIN manufacturers m ON wm.manufacturer_id = m.id
WHERE w.type = ?
ORDER BY w.created_at DESC 
LIMIT ? OFFSET ?
```

### 分页查询优化

```javascript
// 分页查询实现
router.get('/', optionalAuth, async (req, res) => {
  const { category, country, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  // 使用LIMIT和OFFSET进行分页
  const weapons = await new Promise((resolve, reject) => {
    db.all(
      `SELECT w.id, w.name, w.type, w.country, w.year, w.description, m.name as manufacturer
       FROM weapons w
       LEFT JOIN weapon_manufacturers wm ON w.id = wm.weapon_id
       LEFT JOIN manufacturers m ON wm.manufacturer_id = m.id
       ${whereClause} 
       ORDER BY w.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
});
```

**章节来源**
- [weapons-simple.js:15-50](file://backend/src/routes/weapons-simple.js#L15-L50)

## 事务处理模式

### SQLite事务特性

SQLite支持ACID事务，但需要注意以下特性：

1. **自动提交模式**：默认情况下每个SQL语句都是一个独立事务
2. **显式事务控制**：可以通过BEGIN、COMMIT、ROLLBACK控制事务
3. **并发控制**：使用WAL模式提高并发性能

### 事务处理最佳实践

```javascript
// 使用Promise包装事务操作
async function createWeaponWithManufacturer(weaponData) {
  const db = databaseManager.getDatabase();
  
  return new Promise((resolve, reject) => {
    // 开始事务
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) return reject(err);
      
      // 创建武器
      db.run(
        'INSERT INTO weapons (name, type, country, year, description) VALUES (?, ?, ?, ?, ?)',
        [weaponData.name, weaponData.type, weaponData.country, weaponData.year, weaponData.description],
        function(err) {
          if (err) {
            db.run('ROLLBACK', () => reject(err));
            return;
          }
          
          const weaponId = this.lastID;
          
          // 创建制造商
          db.run(
            'INSERT INTO manufacturers (name, country) VALUES (?, ?)',
            [weaponData.manufacturer, weaponData.manufacturerCountry],
            function(err) {
              if (err) {
                db.run('ROLLBACK', () => reject(err));
                return;
              }
              
              const manufacturerId = this.lastID;
              
              // 创建关联关系
              db.run(
                'INSERT INTO weapon_manufacturers (weapon_id, manufacturer_id) VALUES (?, ?)',
                [weaponId, manufacturerId],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK', () => reject(err));
                  } else {
                    // 提交事务
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        db.run('ROLLBACK', () => reject(commitErr));
                      } else {
                        resolve({ weaponId, manufacturerId });
                      }
                    });
                  }
                }
              );
            }
          );
        }
      );
    });
  });
}
```

### 批量操作优化

```javascript
// 批量插入优化
async function batchInsertWeapons(weapons) {
  const db = databaseManager.getDatabase();
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare(
        'INSERT INTO weapons (name, type, country, year, description) VALUES (?, ?, ?, ?, ?)'
      );
      
      for (const weapon of weapons) {
        stmt.run([
          weapon.name,
          weapon.type,
          weapon.country,
          weapon.year,
          weapon.description
        ]);
      }
      
      stmt.finalize();
      db.run('COMMIT', (err) => {
        if (err) {
          db.run('ROLLBACK');
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}
```

## SQLite与Neo4j对比

### 技术架构对比

```mermaid
graph LR
subgraph "SQLite关系型数据库"
SQLiteDB[(SQLite数据库)]
RelationalTables[关系表结构]
ForeignKey[外键约束]
ACID[ACID事务]
VectorStorage[向量存储]
end
subgraph "Neo4j图数据库"
Neo4jDB[(Neo4j数据库)]
Nodes[节点模型]
Relationships[关系边]
GraphAlgorithms[图算法]
end
subgraph "应用场景"
SimpleQueries[简单查询]
DataIntegrity[数据完整性]
BatchOperations[批量操作]
GraphQueries[图查询]
Recommendation[推荐系统]
NetworkAnalysis[网络分析]
SemanticSearch[语义检索]
end
SQLiteDB --> SimpleQueries
SQLiteDB --> DataIntegrity
SQLiteDB --> BatchOperations
SQLiteDB --> VectorStorage
Neo4jDB --> GraphQueries
Neo4jDB --> Recommendation
Neo4jDB --> NetworkAnalysis
VectorStorage --> SemanticSearch
RelationalTables --> SimpleQueries
ForeignKey --> DataIntegrity
ACID --> BatchOperations
Nodes --> GraphQueries
Relationships --> Recommendation
GraphAlgorithms --> NetworkAnalysis
```

### 适用场景对比

| 特性 | SQLite | Neo4j |
|------|--------|-------|
| 数据完整性 | ✅ 外键约束 | ❌ 无内置约束 |
| 查询复杂度 | 中等 | 高效 |
| 性能 | 快速简单查询 | 强大的图遍历 |
| 学习成本 | 低 | 中等 |
| 维护成本 | 低 | 中等 |
| 扩展性 | 有限 | 高 |
| 向量存储 | ✅ 原生支持 | ❌ 需额外插件 |
| 适用场景 | 结构化数据、简单关系、向量检索 | 复杂关系、推荐系统、网络分析 |

### 混合架构优势

项目采用SQLite与Neo4j的混合架构，充分发挥各自优势：

1. **SQLite负责**：
   - 结构化数据存储（武器、用户、制造商等）
   - 向量数据存储（herb_embeddings表）
   - 事务处理和数据完整性保证

2. **Neo4j负责**：
   - 复杂关系查询（药材知识图谱）
   - 推荐算法和网络分析
   - 语义关系挖掘

**章节来源**
- [weaponService.js:1-50](file://backend/src/services/weaponService.js#L1-L50)

## 故障排除指南

### 常见问题及解决方案

#### 1. 外键约束问题

**问题症状：**
```
SQLITE_CONSTRAINT_FOREIGNKEY: FOREIGN KEY constraint failed
```

**解决方案：**
```javascript
// 检查外键约束状态
async function checkForeignKeyStatus() {
  return new Promise((resolve, reject) => {
    this.db.get('PRAGMA foreign_keys', (err, row) => {
      if (err) reject(err);
      else resolve(row.foreign_keys === 1);
    });
  });
}

// 修复外键约束
async function fixForeignKeyConstraint() {
  await this.enableForeignKeys();
  // 重建有问题的表
  await this.recreateProblematicTables();
}
```

#### 2. 数据完整性检查

```javascript
// 完整性检查工具
class DatabaseHealthChecker {
  async checkWeaponManufacturerRelations() {
    const invalidRelations = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT COUNT(*) as count FROM weapon_manufacturers wm 
        LEFT JOIN weapons w ON wm.weapon_id = w.id 
        WHERE w.id IS NULL
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    return invalidRelations === 0;
  }
}
```

#### 3. 向量检索问题

**问题症状：**
- 语义检索不生效
- 向量数据不同步
- 内存溢出

**解决方案：**
```javascript
// 检查向量服务状态
async function checkEmbeddingService() {
  const status = embeddingService.getStatus();
  console.log('向量服务状态:', status);
  
  if (!status.ready) {
    console.log('向量服务未就绪，检查API密钥配置');
  }
  
  if (status.count === 0) {
    console.log('向量数据为空，需要重新同步');
    await embeddingService.syncAll();
  }
}

// 清理损坏的向量数据
async function cleanCorruptedVectors() {
  try {
    await databaseManager.getDatabase().run('DELETE FROM herb_embeddings WHERE vector IS NULL');
    console.log('已清理损坏的向量数据');
  } catch (e) {
    console.error('清理失败:', e.message);
  }
}
```

### 性能问题诊断

**慢查询识别：**
```sql
-- 启用查询日志
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;

-- 分析查询计划
EXPLAIN QUERY PLAN SELECT * FROM weapons WHERE type = '步枪';
```

**索引优化：**
```sql
-- 创建复合索引
CREATE INDEX idx_weapons_type_country ON weapons(type, country);

-- 分析表统计信息
ANALYZE;
```

### 数据恢复策略

#### 1. 备份策略

```javascript
// 自动备份机制
async function backupDatabase() {
  const now = new Date();
  const backupPath = `backup/military-knowledge-${now.toISOString().split('T')[0]}.db`;
  
  // 使用SQLite的备份API
  const backup = new sqlite3.Database(backupPath);
  db.backup(backup, (err) => {
    backup.close();
  });
}
```

#### 2. 数据修复脚本

```javascript
// 自动修复脚本
class DatabaseRepairTool {
  async repairWeaponManufacturerRelations() {
    // 备份数据
    await this.backupInvalidRelations();
    
    // 删除无效关系
    await this.removeInvalidRelations();
    
    // 重新创建有效关系
    await this.recreateValidRelations();
  }
}
```

**章节来源**
- [database-health-check.js:40-132](file://backend/scripts/database-health-check.js#L40-L132)
- [fix-database-integrity.js:40-266](file://backend/scripts/fix-database-integrity.js#L40-L266)

## 总结

兵智世界v1.3项目的SQLite数据库设计体现了关系型数据库在知识管理领域的优势，并成功集成了现代向量检索技术：

### 核心优势

1. **数据完整性**：通过外键约束和级联删除确保数据一致性
2. **性能优化**：合理的设计和索引策略支持高效查询
3. **维护简便**：单文件数据库降低运维复杂度
4. **扩展性强**：支持未来功能扩展和性能优化
5. **语义检索**：集成向量存储，支持智能语义搜索

### 技术亮点

1. **内存缓存**：使用Map对象实现高性能缓存
2. **事务处理**：完整的ACID事务支持
3. **自动化初始化**：完整的数据库初始化流程
4. **完整性检查**：全面的数据完整性验证机制
5. **向量存储**：herb_embeddings表支持语义检索
6. **混合架构**：SQLite与Neo4j协同工作

### 应用价值

该数据库设计为兵智世界提供了稳定可靠的知识管理基础设施，支持复杂的武器知识查询、用户交互记录、推荐系统和语义检索等功能，为军事知识和中药知识的学习和研究提供了强有力的技术支撑。

通过SQLite的简洁性和可靠性，结合精心设计的表结构和关系模型，以及创新的向量存储方案，该项目成功实现了从传统关系型数据库到现代知识管理系统的演进，为类似项目提供了优秀的参考范例。

**更新后的主要改进：**
- 新增herb_embeddings表的详细设计和实现说明
- 添加了语义检索系统的完整架构图和工作流程
- 更新了数据库表结构，包含向量存储能力
- 增强了性能优化策略，包括向量检索优化
- 完善了故障排除指南，涵盖向量检索相关问题
- 改进了SQLite与Neo4j的对比分析，突出混合架构优势