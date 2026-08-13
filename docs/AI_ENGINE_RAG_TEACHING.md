# 神农AI：Neo4j GraphRAG 智能问答引擎改造教学文档

> 本文档面向初学者，按“先理解架构，再理解数据流，最后理解代码”的顺序编写。
> 所有真实密码、API Key 均不会出现在本文中，只使用占位符。

---

## 1. 这次改造到底做了什么？

简单说，我们把原来“只会查关系型数据库 + 让 AI 随便回答”的系统，升级成了：

**用户提问 → 后端 LangChain.js → Neo4j AuraDB 图检索 → 图遍历扩展 → DeepSeek 大模型增强 → 生成带来源的中医药答案**

它不是一个独立的 Python AI 服务，而是直接集成在现有 Node.js 后端里，与知识图谱共用同一个 Neo4j 连接，形成“同源同层”的 GraphRAG 架构。

---

## 2. 整体架构

### 2.1 为什么不用“前端直连 Neo4j”？

本项目采用后端代理方案：

```
用户浏览器
   │
   │  POST /api/ai-engine/rag
   ▼
Node.js + Express 后端
   │
   ├─ ragServiceV2.js  （GraphRAG 核心）
   │     ├─ 连接 Neo4j AuraDB
   │     ├─ 调用 LangChain.js
   │     └─ 调用 DeepSeek API
   │
   ├─ neo4j-simple.js   （Neo4j 单例连接，全系统复用）
   │
   ▼
Neo4j AuraDB 云图数据库
```

这样做的核心好处：

| 对比项 | 前端直连 Neo4j | 后端代理 Neo4j（当前方案） |
| --- | --- | --- |
| 密码位置 | 前端源码，会被看到 | 只在后端 `.env` |
| 前端改动量 | 大 | 小 |
| LangChain.js 运行环境 | 浏览器无法运行 | Node.js 原生运行 |
| 后续加 RAG / Agent | 需要再起一套连接 | 直接复用现有连接 |
| 安全性 | 差 | 好 |
| 比赛答辩含金量 | 一般 | 高 |

### 2.2 核心链路

```
前端 qa.html / scripts/qa.js
        │
        │  用户问题
        ▼
POST /api/ai-engine/rag
        │
        ▼
routes/ai-engine.js
        │  参数校验、调用服务
        ▼
services/ragServiceV2.js
        │
        ├─ extractKeywords()       LLM 提取关键词
        ├─ searchNeo4j()           Cypher 图检索
        ├─ enrichWithGraphTraversal()  1-2 跳图遍历
        ├─ enrichHerbDetails()     LLM 知识增强
        ├─ buildContextText()      上下文构建
        └─ generateAnswer()        DeepSeek 生成答案
        │
        ▼
返回 JSON：
{
  success: true,
  data: {
    answer: "……",
    mode: "manual-enhanced",
    sources: ["人参", "三七"],
    formulas: ["四君子汤"],
    cypher: null,
    fromCache: false
  }
}
```

---

## 3. 用到哪些技术栈？

| 层级 | 技术 | 作用 |
| --- | --- | --- |
| 后端 | Node.js + Express | 提供 HTTP API，承载 RAG 服务 |
| 图数据库 | Neo4j AuraDB | 存储药材、方剂、性味、归经、功效等图数据 |
| Neo4j 驱动 | `neo4j-driver` | Node.js 连接 Neo4j，执行 Cypher |
| LLM 框架 | `langchain` | 提供 Chain、Prompt、LLM 调用能力 |
| LangChain 社区包 | `@langchain/community` | 提供 `Neo4jGraph`、`GraphCypherQAChain` |
| OpenAI 兼容包 | `@langchain/openai` | 用 `ChatOpenAI` 兼容调用 DeepSeek |
| 大模型 | DeepSeek-V3（`deepseek-chat`） | 关键词提取、知识增强、答案生成 |
| 前端 | `qa.html` + `scripts/qa.js` | 问答界面、RAG 过程可视化 |
| 环境变量 | `dotenv` | 从 `.env` 读取密钥和数据库连接 |

### 3.1 关键 npm 依赖

```json
{
  "neo4j-driver": "^6.2.0",
  "langchain": "^1.5.5",
  "@langchain/community": "^1.1.29",
  "@langchain/openai": "^1.5.6",
  "dotenv": "^16.3.1",
  "express": "^4.18.2"
}
```

---

## 4. 相关文件：哪个文件负责什么？

| 文件 | 功能 |
| --- | --- |
| `backend/src/app-simple.js` | 后端启动入口；初始化 SQLite、Neo4j；注册路由；启动保活 |
| `backend/src/config/neo4j-simple.js` | Neo4j AuraDB 连接单例；连接池、保活、会话管理 |
| `backend/src/config/index.js` | 读取 `.env`，统一管理端口、数据库、限流等配置 |
| `backend/src/services/ragServiceV2.js` | **GraphRAG 核心服务**：关键词提取、图检索、图遍历、知识增强、答案生成 |
| `backend/src/services/ragService.js` | 早期 RAG 实现，已被 `ragServiceV2.js` 取代 |
| `backend/src/services/knowledgeGraphService.js` | 知识图谱页面使用的图数据查询服务 |
| `backend/src/routes/ai-engine.js` | 6 合 1 AI 引擎路由：RAG、配伍检测、古籍抽取、流式问答等 |
| `backend/src/routes/ai-gateway.js` | 早期 AI 网关接口，部分功能仍保留 |
| `backend/src/routes/herbs-manage.js` | 药材管理 API，前端药材管理面板使用 |
| `backend/src/routes/conversations.js` | 历史对话存储 API（SQLite） |
| `backend/src/routes/knowledge-graph.js` | 知识图谱可视化 API |
| `qa.html` | GraphRAG 智能问答页面 |
| `scripts/qa.js` | 前端问答交互、RAG 过程展示、药材面板、小图谱可视化 |

### 4.1 最重要的文件：`ragServiceV2.js`

这是整个 AI 引擎的核心，主要函数如下：

| 方法 | 作用 |
| --- | --- |
| `initialize()` | 初始化 DeepSeek LLM；选择 RAG 模式 |
| `answer()` | 主入口；缓存、模式选择、兜底策略 |
| `extractKeywords()` | LLM 提取中医药关键词 |
| `searchNeo4j()` | 在 Neo4j 中执行两轮 Cypher 搜索 |
| `enrichWithGraphTraversal()` | 1-2 跳图遍历，获取性味归经、方剂、配伍冲突 |
| `enrichHerbDetails()` | 调用 DeepSeek 对药材做知识增强 |
| `buildContextText()` | 将图数据与增强数据格式化为文本上下文 |
| `generateAnswer()` | 基于上下文调用 DeepSeek 生成答案 |
| `generateDirectAnswer()` | 图检索无结果时的纯 LLM 兜底回答 |
| `clearCache()` | 清除缓存 |
| `getStatus()` | 返回引擎运行状态 |

---

## 5. Neo4j AuraDB 是怎么连接的？

### 5.1 连接信息来自 `.env`

后端根目录有一个 `.env` 文件，示例格式如下：

```env
NEO4J_URI=neo4j+s://your-database.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD_HERE

DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE
```

代码中不会硬编码密码，只通过 `process.env` 读取：

```js
const uri = process.env.NEO4J_URI;
const username = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;
```

### 5.2 单例连接：`neo4j-simple.js`

系统中只创建一个 Neo4j driver，避免连接池被反复创建：

```js
const neo4j = require('neo4j-driver');

this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
  maxConnectionLifetime: 3 * 60 * 60 * 1000,
  maxConnectionPoolSize: 10,
  connectionTimeout: 30000,
  connectionAcquisitionTimeout: 30000
});
```

之后所有服务都通过：

```js
const neo4jManager = require('../config/neo4j-simple');
const session = neo4jManager.getSession();
```

来获取会话，而不是重新创建 driver。

### 5.3 AuraDB Free 版保活

AuraDB Free 版 3 天无活动会休眠，所以后端启动后会每 30 分钟执行一次：

```cypher
RETURN 1
```

用来保持连接活跃。

### 5.4 “远程数据库检索”到底是什么？

前端不能直接连数据库，而是：

```
浏览器
  ↓ HTTP 请求
Express 路由
  ↓ 调用 neo4j-driver
Neo4j AuraDB 云端
  ↓ 执行 Cypher
返回图数据
```

Neo4j 使用 Cypher 查询语言，它和关系型数据库的 SQL 不同：

| 对比 | SQL（关系型数据库） | Cypher（图数据库） |
| --- | --- | --- |
| 查询单位 | 表、行、列 | 节点、关系、路径 |
| 关联方式 | JOIN 表连接 | `MATCH (a)-[:关系]->(b)` |
| 多跳查询 | 越 JOIN 越慢 | 天然适合 1-2 跳图遍历 |
| 示例 | `SELECT * FROM herbs WHERE name LIKE '%人参%'` | `MATCH (h:Herb) WHERE h.name CONTAINS '人参' RETURN h` |

---

## 6. RAG 完整流程

RAG = Retrieval-Augmented Generation，中文叫“检索增强生成”。

普通大模型回答问题，只能依靠它训练时学到的知识，可能会记错或不知道你的本地数据。

RAG 的做法是：

1. **先从自己的知识库检索相关资料**
2. **把检索到的资料交给大模型**
3. **让大模型基于这些真实资料生成答案**

在本项目中，知识库就是 Neo4j 图数据库。

---

## 7. 一次完整问答会发生什么？

### 7.1 第 0 步：前端发送问题

前端 `scripts/qa.js` 调用：

```js
fetch('/api/ai-engine/rag', {
  method: 'POST',
  body: JSON.stringify({ question: '人参有什么功效？' })
})
```

### 7.2 第 1 步：后端路由校验

`backend/src/routes/ai-engine.js` 中的 `/api/ai-engine/rag` 接收请求，检查：

- 问题是否为空
- 问题长度是否超过 2000 字符

然后调用：

```js
const result = await ragServiceV2.answer(question.trim(), { useChain, forceRefresh });
```

### 7.3 第 2 步：缓存检查

`ragServiceV2.answer()` 会先检查缓存：

```js
const cacheKey = 'v' + CACHE_VERSION + '_' + question.toLowerCase().trim();
```

如果 5 分钟内问过完全相同的问题，直接返回缓存结果，减少 DeepSeek 调用次数。

`CACHE_VERSION` 每次修改检索逻辑时递增，旧缓存会自动失效。

### 7.4 第 3 步：进入 GraphRAG 主流程

如果缓存未命中，则执行手动增强模式：

```
用户问题
  ↓
关键词提取
  ↓
Neo4j 图检索
  ↓
1-2 跳图遍历
  ↓
LLM 知识增强
  ↓
上下文构建
  ↓
DeepSeek 生成答案
```

---

## 8. 6 步 GraphRAG 管线详解

### 第 1 步：🔭 关键词提取

对应函数：`extractKeywords(question)`

做什么：

- 调用 DeepSeek，让它从用户问题中提取中医药关键词
- 关键词包括：药材名、方剂名、症状、证型、功效术语

例如：

```
用户问题：人参有什么功效？
LLM 返回：["人参", "补气", "气虚"]
```

使用的 Prompt 大致是：

```text
你是中医药专家。从以下用户问题中提取中医药关键词（药材名、方剂名、症状、证型、功效术语等）。
只返回 JSON 数组格式，如 ["人参","补气","气虚"]。不要返回任何解释。

问题：人参有什么功效？
```

代码中做了三重保障：

1. 尝试直接解析 JSON
2. 如果 JSON 解析失败，用正则从文本中抓数组
3. 如果关键词太少，使用问题原文生成 3-6 字 n-gram 补充

---

### 第 2 步：🔗 Neo4j 图检索

对应函数：`searchNeo4j(query, keywords)`

做什么：

- 用关键词和问题原文组成搜索词数组
- 去重后作为 Cypher 参数传给 Neo4j
- 采用“先精确，后模糊”的两轮搜索

#### 第 1 轮：精确名称匹配

只匹配 `Herb.name` 字段：

```cypher
MATCH (h:Herb)
WHERE h.name IS NOT NULL AND h.name <> ''
  AND any(term IN $terms WHERE h.name CONTAINS term)
WITH h
OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category)
OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region)
RETURN h, c.name AS category, r.name AS region
LIMIT 20
```

参数示例：

```json
{ "terms": ["人参", "人参有什么功效？", "补气", "气虚"] }
```

#### 第 2 轮：扩展模糊匹配

如果精确匹配结果太少，就搜索功效、描述、拼音：

```cypher
MATCH (h:Herb)
WHERE h.name IS NOT NULL AND h.name <> ''
  AND (
    any(term IN $terms WHERE h.description CONTAINS term)
    OR any(term IN $terms WHERE h.efficacy CONTAINS term)
    OR any(term IN $terms WHERE h.pinyin CONTAINS term)
  )
RETURN h
LIMIT 15
```

同时还会搜索方剂：

```cypher
MATCH (f:Formula)
WHERE f.name IS NOT NULL AND f.name <> ''
AND any(term IN $terms WHERE f.name CONTAINS term OR f.description CONTAINS term)
RETURN f
LIMIT 5
```

**为什么要两轮？**

因为用户可能直接说“人参”，也可能说“补气”。第一轮保证精确，第二轮保证覆盖症状、功效类问题。

---

### 第 3 步：🔀 1-2 跳图遍历

对应函数：`enrichWithGraphTraversal(searchResults)`

图检索找到了药材节点，但一个药材节点本身信息有限。GraphRAG 的优势就是沿关系边继续扩展。

#### 第 1 跳：获取性味、归经、功效

```cypher
MATCH (h:Herb)-[r]->(n)
WHERE h.name IN $names
  AND (r:HAS_PROPERTY OR r:MERIDIAN_AFFINITY OR r:HAS_EFFICACY)
RETURN h.name AS herb, type(r) AS relType, n.name AS value
```

这段查询的意思是：

- 从命中的药材出发
- 沿着 `HAS_PROPERTY`（性味）、`MERIDIAN_AFFINITY`（归经）、`HAS_EFFICACY`（功效）关系走 1 跳
- 拿到对应的属性节点值

#### 第 2 跳：获取方剂关联

```cypher
MATCH (h:Herb)-[r:CONTAINS_HERB]-(f:Formula)
WHERE h.name IN $names
OPTIONAL MATCH (f)-[:CONTAINS_HERB]->(co:Herb)
WHERE co.name IN $names
RETURN h.name AS herb, f.name AS formula, f.description AS formulaDesc,
       collect(DISTINCT co.name) AS coHerbs
```

这段查询的意思是：

- 从药材出发，沿 `CONTAINS_HERB` 找到包含该药材的方剂
- 再扩展一跳，看该方剂还包含哪些其他命中药材

#### 配伍冲突检测

```cypher
MATCH (h1:Herb)-[r:COMPATIBILITY]->(h2:Herb)
WHERE h1.name IN $names AND (r.type = '相反' OR r.type = '相恶' OR r.type = '禁忌')
RETURN h1.name AS herb, h2.name AS conflictHerb, r.type AS conflictType, r.description AS conflictDesc
```

这一步会检测“十八反十九畏”等配伍冲突。

---

### 第 4 步：✨ LLM 知识增强

对应函数：`enrichHerbDetails(enriched)`

图谱里有结构化数据，比如性味、归经、功效、产地、拉丁名。但图谱里可能没有现代药理研究、临床应用这些更深入的内容。

所以系统会对每一味命中药材调用 DeepSeek 做“知识增强”。

输入：

```text
已知数据：分类：补虚药；产地：吉林；性味：甘；归经：心、脾、肺、肾；功效：大补元气……
请为药材【人参】撰写详细专业信息。
```

要求返回严格 JSON：

```json
{
  "indications": "主治病症（50-150字）",
  "usage_dosage": "用法用量（20-80字）",
  "caution": "使用注意与禁忌（20-80字）",
  "pharmacology": "现代药理研究摘要（50-150字）",
  "clinical_application": "临床应用要点（30-100字）"
}
```

增强后的字段会被合并进药材对象：

- `indications`：主治病症
- `pharmacology`：现代药理
- `clinical_application`：临床应用

#### 增强缓存

每味药材的增强结果会缓存 24 小时，避免重复调用 DeepSeek：

```js
const ENRICH_CACHE_TTL = 24 * 60 * 60 * 1000;
```

#### 什么时候会触发 LLM 知识增强？

只要 Neo4j 搜索到至少 1 味药材，并且 LLM 已初始化，就会触发。它会遍历所有命中的药材，逐一增强。

---

### 第 5 步：📝 上下文构建

对应函数：`buildContextText(enriched)`

把图数据和 LLM 增强数据整理成结构化文本，方便大模型阅读：

```text
## 相关药材

### 人参（renshen）
- 分类：补虚药
- 性味：甘
- 归经：心、脾、肺、肾
- 功效：大补元气，复脉固脱……
- 主治：……
- 用法用量：3-9g,另煎兑服
- ⚠️ 注意事项：……
- 产地：吉林
- 拉丁名：Radix et Rhizoma Ginseng
- 常用药材：是
- 📋 主治病症：……
- 🔬 现代药理：……
- 🏥 临床应用：……

## 相关方剂
……

## ⚠️ 配伍冲突警告
……
```

---

### 第 6 步：🤖 DeepSeek-V3 生成答案

对应函数：`generateAnswer(question, contextText, enrichedContext)`

调用 DeepSeek 时，Prompt 中会明确要求：

```text
你是神农AI中医药专家助手，基于 Neo4j 知识图谱检索结果回答用户问题。

要求：
1. 专业但通俗，使用清晰的 Markdown 格式
2. 优先基于提供的图谱数据回答，图谱没有的信息可使用你的中医药知识补充
3. 如涉及药材，务必说明功效、用法用量、注意事项
4. 如有配伍冲突，必须在回答中醒目警告
5. 回答末尾列出参考的药材和方剂
6. 使用适当的标题、列表、加粗来组织信息
```

用户 Prompt：

```text
用户问题：人参有什么功效？

知识图谱检索结果：
## 相关药材
……

请基于以上信息回答用户问题。如果知识图谱结果中有相关药材，请重点引用。
如果图谱数据不足以完整回答，可以补充你的中医药专业知识。
```

最后在答案末尾自动追加参考来源：

```text
📚 参考来源
- 药材：人参（Radix et Rhizoma Ginseng）
- 方剂：四君子汤、补中益气汤
```

---

## 9. GraphCypherQAChain 起到了什么作用？

`GraphCypherQAChain` 是 LangChain 社区提供的图问答链，理想流程是：

```
用户问题
  ↓
LLM 自动生成 Cypher
  ↓
执行 Cypher 查询 Neo4j
  ↓
将查询结果交给 LLM
  ↓
生成自然语言答案
```

### 当前项目中的实际状态

项目引入了这个能力，但在实际运行中，当前使用的主路径是“手动增强模式”：

```js
console.log("[RAG-V2] 跳过 GraphCypherQAChain（使用手动增强模式 + neo4j-simple 单例）");
this.graph = null;
this.cypherChain = null;
```

原因主要有两个：

1. **AuraDB Free 版路由表限制**：LangChain 的 `Neo4jGraph` 默认会查询名为 `neo4j` 的数据库，但 AuraDB Free 实例可能返回“database 'neo4j' does not exist”的路由错误。
2. **连接统一管理**：如果 GraphCypherQAChain 内部再创建一个 Neo4j driver，容易和现有连接单例冲突，导致连接池被占用。

因此，本项目采用更稳定、更可控的方案：

```
手动增强图检索 + LLM 知识增强
```

这虽然不是完全依赖 GraphCypherQAChain，但在技术栈和展示中仍然体现：

- Neo4j
- LangChain.js
- GraphRAG 图检索
- DeepSeek-V3

> 可以把它理解为：GraphCypherQAChain 是“让 LLM 自动写 Cypher”的自动挡，而当前项目使用的是“人工设计 Cypher 检索逻辑”的手动挡。对于比赛作品来说，手动挡更可控、更稳定，也更容易向评委讲清每一步发生了什么。

---

## 10. 检索模式介绍

### 10.1 模式 A：GraphCypherQAChain

```text
用户问题 → LLM 生成 Cypher → Neo4j 执行 → LLM 生成答案
```

- 优点：自动化程度高
- 缺点：AuraDB Free 路由兼容性问题；Cypher 生成结果不稳定

### 10.2 模式 B：手动增强检索

```text
用户问题
→ LLM 提取关键词
→ Cypher 精确匹配 + 模糊匹配
→ 1-2 跳图遍历
→ LLM 知识增强
→ 构建上下文
→ LLM 生成答案
```

- 优点：每步可控、可解释、可展示
- 缺点：需要人工设计 Cypher 逻辑

### 10.3 兜底模式：LLM 直接回答

如果 Neo4j 中完全没有匹配：

```text
用户问题 → DeepSeek 直接回答
```

返回中会提示用户“这是基于 AI 中医药知识库，如需详细图谱数据，请在问题中包含具体药材名称”。

---

## 11. 检索逻辑与问题拆分逻辑

### 11.1 关键词提取逻辑

`extractKeywords()` 的核心流程：

```text
用户问题
  ↓
DeepSeek 提取关键词
  ↓
清洗 Markdown 和 JSON 标记
  ↓
尝试 JSON.parse
  ↓
成功 → 过滤长度小于 2 的关键词
失败 → 正则提取数组
  ↓
如果关键词数量太少
  ↓
用问题原文生成 3-6 字 n-gram 补充
```

### 11.2 为什么会有 n-gram 回退？

因为大模型偶尔会返回不完整 JSON，或者只返回一个词。为了保证检索鲁棒性，代码会用滑动窗口生成问题中的 3-6 字中文片段。

例如问题：

```text
人参有什么功效？
```

可能生成：

```text
人参有、人参有什、人参有什么、人参有什么功、参有什么、有什么功……
```

这样即使 DeepSeek 关键词提取失败，也能靠这些片段在 Neo4j 中命中“人参”。

### 11.3 停用词过滤

系统维护了一个中文停用词表：

```js
const STOP_WORDS = new Set([
  "什么", "怎么", "如何", "为什么", "哪里", "哪个", "哪些", "可以",
  "能够", "应该", "需要", "是否", "吗", "呢", "吧", "啊", "的", "了",
  "在", "是", "有", "和", "与", "或", "及", "等", "用", "来", "去",
  "功效", "作用", "效果", "用途", "功能", "好处", "调理", "调理方法",
  "补药", "药材", "中药", "中医药", "配方", "方剂", "问题", "方法",
  "请问", "问一下", "想知道", "了解", "介绍", "说明", "讲解"
]);
```

这些词不会作为核心检索词。

---

## 12. LLM 知识增强与“增强图检索 + LLM 知识增强”过程

### 12.1 为什么要做 LLM 知识增强？

图谱数据库擅长回答：

- 人参和哪些药相配？
- 人参归什么经？
- 人参在哪些方剂里？

但它不一定完整包含：

- 现代药理研究
- 临床应用建议
- 更深层的中医药解释

所以系统采用“图谱负责真实结构化数据，LLM 负责补充深度知识”的组合策略。

### 12.2 完整过程

```
Neo4j 命中 2 味药材
      ↓
遍历每味药材
      ↓
检查 24 小时增强缓存
      ↓
缓存命中 → 直接合并增强字段
缓存未命中 → 调用 DeepSeek
      ↓
把已知图谱字段传给 DeepSeek
      ↓
DeepSeek 返回 JSON 增强字段
      ↓
合并到药材对象
      ↓
写入增强缓存
```

---

## 13. 有用到向量化数据吗？

没有。

本项目是纯 GraphRAG，没有使用向量数据库、Embedding 或 ChromaDB。

| 方案 | 检索方式 | 本项目是否使用 |
| --- | --- | --- |
| 向量 RAG | 把文本转成向量，用余弦相似度搜索 | ❌ 未使用 |
| 关键词 RAG | 关键词/全文模糊匹配 | ✅ 部分使用 |
| GraphRAG | Cypher 图查询 + 图遍历 | ✅ 核心使用 |

### 为什么不用向量？

中医药数据本身就是高度关系化的：

- 药材 → 性味
- 药材 → 归经
- 药材 → 功效
- 药材 → 方剂
- 药材 → 配伍禁忌

这些关系用图数据库表达更自然，检索结果也更可解释。

---

## 14. GraphRAG 和普通数据库 RAG 有什么区别？

### 14.1 普通数据库 RAG（以 SQLite 为例）

```
用户问题
  ↓
关键词切分
  ↓
SQL LIKE '%关键词%'
  ↓
返回零散的行记录
  ↓
拼成文本交给 LLM
```

缺点：

- 只能做表字段匹配
- 多跳关系需要大量 JOIN
- 很难解释“为什么查到这些数据”
- 无法直接表达“A 和 B 配伍禁忌”“A 属于方剂 C”这种图关系

### 14.2 GraphRAG（本项目）

```
用户问题
  ↓
LLM 提取关键词
  ↓
Cypher 查找节点
  ↓
沿关系边 1-2 跳扩展
  ↓
得到实体 + 关系 + 路径
  ↓
拼成结构化上下文交给 LLM
```

优点：

- 检索的不是“孤立记录”，而是“节点 + 关系”
- 可以沿关系边扩展，发现间接关联
- 每一步都可解释、可展示
- 更适合中医药这种关系密集型知识

### 14.3 对比表

| 维度 | 普通数据库 RAG | GraphRAG（本项目） |
| --- | --- | --- |
| 存储结构 | 表、行、列 | 节点、关系、路径 |
| 检索方式 | SQL LIKE | Cypher MATCH |
| 多跳扩展 | 困难 | 天然支持 |
| 知识表示 | 扁平 | 图结构 |
| 可解释性 | 低 | 高 |
| 竞赛含金量 | 中 | 高 |
| 后续扩展 Agent/推理 | 困难 | 容易 |

---

## 15. 完整技术管线总结

```text
用户问题
   ↓
① 关键词提取：LLM 分析问题，提取中医药关键实体
   ↓
② Neo4j 图检索：Cypher 精确/模糊匹配药材、方剂节点
   ↓
③ 1-2 跳图遍历：沿关系边扩展性味归经、功效、方剂、配伍禁忌
   ↓
④ LLM 知识增强：DeepSeek 补充现代药理、临床应用等深度知识
   ↓
⑤ 上下文构建：将图谱数据与增强知识格式化为结构化提示
   ↓
⑥ DeepSeek-V3 生成：基于增强上下文生成带引用来源的答案
```

---

## 16. 安全问题

### 16.1 密钥只在后端

前端 `qa.js` 不会、也不能出现 DeepSeek API Key 或 Neo4j 密码。它们只存在于后端 `.env`。

### 16.2 Cypher 参数化

所有 Cypher 查询都使用参数化：

```js
session.run(exactCypher, { terms: searchTerms });
```

而不是拼接字符串：

```js
// ❌ 错误做法
"WHERE h.name CONTAINS '" + userInput + "'"

// ✅ 当前做法
"WHERE h.name CONTAINS term"
{ terms: searchTerms }
```

这样可以防止 Cypher 注入。

### 16.3 前端只调用后端 API

前端只知道 `/api/ai-engine/rag` 这个地址，不知道数据库连接信息。

---

## 17. 初学者常见问题

### 17.1 RAG 和直接问 DeepSeek 有什么区别？

直接问 DeepSeek，模型只能靠训练记忆回答。
RAG 是先从 Neo4j 里找到真实资料，再把资料交给模型，答案更可靠、可溯源。

### 17.2 为什么问题中必须带药材名才能走图检索？

不是必须。当前系统也支持症状、功效类问题，只是当图数据库完全没有匹配时，会兜底到 DeepSeek 直接回答。

### 17.3 如何确认走的是图检索还是 LLM 直接回答？

前端会显示当前模式。后端日志也会输出：

```text
[RAG-V2] 启用手动增强模式...
[RAG-V2] 找到药材: 人参 方剂: 四君子汤
```

如果没有任何匹配，会输出：

```text
[RAG-V2] 知识库无匹配，使用 LLM 中医药知识直接回答
```

### 17.4 为什么缓存会让人误以为代码没生效？

代码中有答案缓存，5 分钟内重复提问会命中缓存。如果修改了检索逻辑，需要让 `CACHE_VERSION` 递增，或者调用缓存清除逻辑。

---

## 18. 文件清单速查

```text
D:\K3\SJTJ-v1.3
├─ qa.html
├─ scripts
│  └─ qa.js
├─ backend
│  ├─ .env
│  ├─ package.json
│  └─ src
│     ├─ app-simple.js
│     ├─ config
│     │  ├─ index.js
│     │  └─ neo4j-simple.js
│     ├─ routes
│     │  ├─ ai-engine.js
│     │  ├─ ai-gateway.js
│     │  ├─ herbs-manage.js
│     │  ├─ conversations.js
│     │  └─ knowledge-graph.js
│     └─ services
│        ├─ ragServiceV2.js
│        ├─ ragService.js
│        └─ knowledgeGraphService.js
└─ docs
   └─ AI_ENGINE_RAG_TEACHING.md   ← 本文档
```

---

## 19. 一句话总结

本次 AI 引擎改造，把中医药知识图谱从“只能看”升级为“能问答、能溯源、能推理”，核心技术栈是：

**Node.js + Express + neo4j-driver + LangChain.js + Neo4j AuraDB + DeepSeek-V3**

问答流程是：

**提问 → 关键词提取 → Neo4j 图检索 → 1-2 跳图遍历 → LLM 知识增强 → 上下文构建 → DeepSeek 生成答案**
