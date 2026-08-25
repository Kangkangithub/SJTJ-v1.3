# Neo4j AuraDB 迁移说明文档

> 📅 迁移日期：2026-08-07  
> 🏗️ 方案：**方案 B — Node.js 后端代理 Neo4j**  
> 📊 数据源：SQLite (herb-knowledge.db) → Neo4j AuraDB 云数据库  
> 🔗 连接：`neo4j+s://YOUR_DATABASE_ID.databases.neo4j.io`

---

## 一、架构变更总览

### 迁移前

```
浏览器 (knowledge-graph.html)
  │
  ├─ fetch('/api/knowledge/graph-data')
  ├─ fetch('/api/herbs/statistics')
  ├─ fetch('/api/knowledge/region-distribution')
  └─ ...
       │
       ▼
Express.js (app-simple.js)
  │
  └─ SQLite (herb-knowledge.db)
       ├─ herbs 表
       ├─ herb_categories 表
       ├─ herb_regions 表
       └─ ... JOIN 查询拼出图结构
```

### 迁移后

```
浏览器 (knowledge-graph.html)          ← 前端代码几乎不变
  │
  ├─ fetch('/api/knowledge/graph-data')       ← 同一 API 端点
  ├─ fetch('/api/herbs/statistics')           ← 同一 API 端点
  ├─ fetch('/api/knowledge/region-distribution')
  └─ ...
       │
       ▼
Express.js (app-simple.js)
  │
  ├─ SQLite (herb-knowledge.db)        ← 保留：用户认证、CRUD 管理
  │
  └─ Neo4j AuraDB (云数据库)            ← 新增：知识图谱、RAG
       │   neo4j-driver
       │
       ├─ Herb 节点 (药材)
       ├─ Category 节点 (分类)
       ├─ Region 节点 (产地)
       ├─ Property 节点 (性味)
       ├─ Meridian 节点 (归经)
       ├─ Efficacy 节点 (功效)
       ├─ Source 节点 (来源)
       └─ 关系：属于、产自、性味、归经、功效、来源...
```

### RAG 预留架构

```
浏览器
  │
  ├─ GET  /api/knowledge/graph-data    ← 知识图谱数据（Neo4j）
  ├─ GET  /api/knowledge/herb-details  ← 药材详情（Neo4j）
  ├─ POST /api/ai-gateway/chat         ← AI 问答（Neo4j + DeepSeek）
  └─ 🆕 POST /api/qa                   ← GraphRAG 问答（预留）
       │
       ▼
Express.js
  │
  ├─ neo4jManager (单例)               ← 共享同一个 neo4j-driver 实例
  │   ├─ knowledge-graph.js 路由
  │   ├─ ragService.js
  │   ├─ ai-gateway.js
  │   └─ 🆕 GraphCypherQAChain (LangChain.js)
  │
  └─ DeepSeek API
```

---

## 二、修改文件清单

### 2.1 新增文件

| 文件 | 说明 |
|------|------|
| `backend/src/config/neo4j-simple.js` | Neo4j 连接管理器（单例模式） |

### 2.2 修改文件

| 文件 | 修改内容 | 影响范围 |
|------|---------|---------|
| `backend/src/app-simple.js` | ① 导入 neo4jManager ② start() 中初始化 Neo4j ③ 添加保活定时器(30分钟) ④ 注册知识图谱路由 | 服务器启动 |
| `backend/src/routes/knowledge-graph.js` | ① SQLite → Neo4j Cypher ② 添加地图端点 ③ 添加内存缓存 | 知识图谱 API |
| `backend/src/routes/herbs.js` | 添加 GET /statistics 端点(Neo4j优先,SQLite降级) | 统计 API |
| `backend/src/routes/ai-gateway.js` | getHerbContext() 改用 Neo4j Cypher | AI 网关 |
| `backend/src/services/ragService.js` | searchKnowledgeBase() 改用 Neo4j Cypher | RAG 服务 |
| `backend/.env` | 添加 Neo4j 连接凭据 | 环境配置 |

### 2.3 未修改文件

| 文件 | 原因 |
|------|------|
| `knowledge-graph.html` | 前端页面无需改动，API 端点不变 |
| `scripts/knowledge-graph.js` | 前端 JS 无需改动 |
| `scripts/knowledge-graph-analysis-*.js` | 调用相同的 /api/* 端点 |
| `scripts/map-api-integration.js` | 有 mock fallback，API 不可用时自动降级 |
| `scripts/world-map-visualization.js` | 同上 |
| `backend/src/config/database-simple.js` | SQLite 保留给用户认证和 CRUD |
| `backend/src/routes/auth-simple.js` | 认证逻辑不变 |

---

## 三、API 端点映射表

| 前端调用 | 方法 | 路由文件 | 数据源(改前) | 数据源(改后) | 用途 |
|---------|------|---------|------------|------------|------|
| /api/knowledge/graph-data | GET | knowledge-graph.js | SQLite JOIN | **Neo4j Cypher** | D3.js 图谱节点+边 |
| /api/knowledge/herb-details/:name | GET | knowledge-graph.js | SQLite JOIN | **Neo4j Cypher** | 药材详情面板 |
| /api/knowledge/region-distribution | GET | knowledge-graph.js | SQLite JOIN | **Neo4j Cypher** | 产地分布图 |
| /api/knowledge/country-weapons | GET | knowledge-graph.js | 不存在 | **Neo4j Cypher** | 地图产区数据 |
| /api/knowledge/weapon-countries | GET | knowledge-graph.js | 不存在 | **Neo4j Cypher** | 药材-产区关联 |
| /api/herbs/statistics | GET | herbs.js | 不存在 | **Neo4j Cypher** | 统计图表 |
| /api/herbs | GET | herbs.js | SQLite | SQLite(不变) | 药材列表 |
| /api/herbs/:id | GET | herbs.js | SQLite | SQLite(不变) | 药材详情 |
| /api/ai-gateway/chat | POST | ai-gateway.js | SQLite | **Neo4j Cypher** | AI 对话 |
| /api/auth/* | * | auth-simple.js | SQLite | SQLite(不变) | 用户认证 |

---

## 四、关键 Cypher 查询

### 4.1 知识图谱主数据

```cypher
// 药材 + 分类 + 产地
MATCH (h:Herb)
OPTIONAL MATCH (h)-[:属于]->(c:Category)
OPTIONAL MATCH (h)-[:产自]->(r:Region)
RETURN h, c.name AS category_name, r.name AS region_name

// 关系：药材 → 非药材节点
MATCH (h:Herb)-[r]->(m)
WHERE NOT m:Herb
RETURN id(h) AS source, id(m) AS target, type(r) AS type
```

### 4.2 药材详情

```cypher
MATCH (h:Herb {name: $name})
OPTIONAL MATCH (h)-[:属于]->(c:Category)
OPTIONAL MATCH (h)-[:产自]->(r:Region)
OPTIONAL MATCH (h)-[:来源]->(s:Source)
RETURN h, c.name, r.name, s.name
```

### 4.3 统计

```cypher
// 按分类统计
MATCH (h:Herb)-[:属于]->(c:Category)
RETURN c.name AS name, count(h) AS count ORDER BY count DESC

// 按产地统计
MATCH (h:Herb)-[:产自]->(r:Region)
RETURN r.name AS name, count(h) AS count ORDER BY count DESC

// 按功效统计
MATCH (h:Herb)-[:功效]->(e:Efficacy)
RETURN e.name AS name, count(h) AS count ORDER BY count DESC
```

---

## 五、容错与降级

### Neo4j 连接失败时的行为

- 服务器仍正常启动（SQLite 不受影响）
- 知识图谱 API 返回空数据（前端 D3.js 渲染空图）
- 统计端点降级到 SQLite 查询
- AI 网关降级到 SQLite 查询
- 地图模块使用前端内置 mock 数据

### AuraDB 保活

```javascript
// 每 30 分钟 ping 一次，防 Free 版休眠
setInterval(async () => {
    const session = neo4jManager.getSession();
    await session.run('RETURN 1');
    await session.close();
}, 30 * 60 * 1000);
```

---

## 六、安全措施

| 措施 | 说明 |
|------|------|
| 凭据隔离 | Neo4j 用户名密码仅存在于 backend/.env |
| .gitignore | .env 已加入 .gitignore，不提交版本控制 |
| CSP 策略 | helmet 限制前端可访问的域名和资源 |
| API 限流 | express-rate-limit 限制请求频率 |

---

## 七、环境变量

```env
# Neo4j AuraDB 连接
NEO4J_URI=neo4j+s://YOUR_DATABASE_ID.databases.neo4j.io
NEO4J_USERNAME=YOUR_DATABASE_ID
NEO4J_PASSWORD=YOUR_PASSWORD_HERE

# DeepSeek API（RAG 使用）
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE

# 服务器
PORT=3001
NODE_ENV=development

# SQLite（保留）
SQLITE_PATH=data/herb-knowledge.db
```

---

## 八、启动与验证

```bash
# 启动
cd backend && npm start

# 验证端点
curl http://localhost:3001/health
curl http://localhost:3001/api/knowledge/graph-data?common=1
curl http://localhost:3001/api/herbs/statistics
curl "http://localhost:3001/api/knowledge/herb-details/%E4%BA%BA%E5%8F%82"
curl http://localhost:3001/api/knowledge/region-distribution

# 前端页面
http://localhost:3001/knowledge-graph.html
```

---

## 九、RAG 集成路径

### 已完成的准备

1. neo4jManager 单例 — RAG 可直接复用
2. ragService.js 已使用 Neo4j Cypher 检索
3. ai-gateway.js 已与 Neo4j 集成

### 后续步骤（仅需 3 步）

```bash
# 1. 安装依赖
npm install langchain @langchain/openai @langchain/community

# 2. 创建 backend/src/routes/qa.js
#    复用 neo4jManager.getDriver() 构建 GraphCypherQAChain

# 3. 在 app-simple.js 注册
this.app.use('/api/qa', require('./routes/qa'));
```

### GraphRAG 流程

```
用户问题 → POST /api/qa
  → LLM(DeepSeek) 自动生成 Cypher
  → neo4jManager 执行查询
  → LLM 将结果转为自然语言
  → 返回带引用的回答
```

---

## 十、常见问题

**Q: Neo4j 连不上？**
A: 检查 .env 中凭据是否正确。AuraDB Free 版确保实例处于 Active 状态。

**Q: 前端显示"暂无数据"？**
A: 检查浏览器控制台，确认服务器在 3001 端口运行。

**Q: 统计图表不显示？**
A: 确认 /api/herbs/statistics 返回 by_category/by_region/by_efficacy 数据。

**Q: 如何验证 Neo4j 中有数据？**
A: 登录 Neo4j Aura Console，运行 `MATCH (n) RETURN count(n)`。
---

## 🔧 关系类型修正（2026-08-07 第二次修复）

### 问题根因

Neo4j AuraDB 中实际存储的关系类型为 **英文**，但代码中使用了中文关系类型名称，导致所有 Cypher 查询返回空结果。

### Neo4j 实际图模型

| 关系类型 | 方向 | 说明 | 数量 |
|---|---|---|---|
| BELONGS_TO_CATEGORY | (:Herb)→(:Category) | 药材属于分类 | 275 |
| FROM_REGION | (:Herb)→(:Region) | 药材产自地区 | 275 |
| HAS_EFFICACY | (:Herb)→(:Efficacy) | 药材具有功效 | 561 |
| MERIDIAN_AFFINITY | (:Herb)→(:Meridian) | 药材归经 | 676 |
| HAS_PROPERTY | (:Herb)→(:Property) | 药材具有性味 | 636 |
| CONTAINS_HERB | (:Formula)→(:Herb) | 方剂包含药材 | 130 |
| COMPATIBILITY | (:Herb)-(:Herb) | 配伍关系 | 13 |

### 标签

Herb, Category, Region, Property, Meridian, Efficacy, Source, Formula

### 修改的文件

| 文件 | 修改内容 |
|---|---|
| ackend/src/routes/knowledge-graph.js | 完全重写为 Neo4j Cypher 查询，所有关系类型改为英文 |
| ackend/src/routes/herbs.js | 统计接口新增 Neo4j 优先查询 + SQLite 回退，修复关系类型 |
| ackend/src/routes/ai-gateway.js | getHerbContext() 改为 Neo4j Cypher + SQLite 回退 |
| ackend/src/services/ragService.js | searchKnowledgeBase() 改为 Neo4j Cypher + SQLite 回退 |

### 关键设计决策

1. **单行 Cypher 查询**：所有 Cypher 字符串使用单行形式，避免 JavaScript 多行字符串的转义问题
2. **Neo4j 优先 + SQLite 回退**：所有查询先尝试 Neo4j，失败时自动降级到 SQLite
3. **前端零改动**：knowledge-graph.html 及其所有 JS 脚本保持不变

