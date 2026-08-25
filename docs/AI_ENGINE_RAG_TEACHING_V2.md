# 神农AI：Neo4j GraphRAG 智能问答引擎（最新版教学文档）

> 本文档是「AI 引擎改造」的**最新版**教学说明，在旧版基础上补齐了：
> 1. **向量语义检索**（text-embedding-v3）
> 2. **性能优化**（关键词本地化、知识增强限流并发、缓存）
> 3. GraphCypherQAChain 的**真实角色**（备用方案，主路径为手动增强检索）
> 4. 准确的七步管线与文件清单
>
> 所有真实密码、API Key 均不会出现，只使用占位符。
>
> 配套阅读：
> - `docs/EMBEDDING_VECTOR_SEARCH.md` —— 向量检索专项详解
> - `docs/RAG_PERFORMANCE_OPTIMIZATION.md` —— 性能优化专项详解

---

## 1. 这次改造到底做了什么？

简单说，我们把原来「查关系型数据库 + 让 AI 随便回答」的系统，升级成：

**用户提问 → 后端 LangChain.js → Neo4j AuraDB 图检索 → 向量语义检索 → 1-2 跳图遍历 → DeepSeek 知识增强 → 生成带来源的中医药答案**

它不是独立的 Python AI 服务，而是直接集成在 Node.js 后端里，与知识图谱共用同一个 Neo4j 连接，形成「同源同层」的 GraphRAG 架构。

相比旧版，最新版主要有三处关键变化：

| 变化 | 旧版 | 最新版 |
| --- | --- | --- |
| 关键词提取 | 调用 LLM 抽取（约 2 秒） | **本地 n-gram 切词，不调 LLM**（省一次网络往返） |
| 语义检索 | 仅 CONTAINS 字面匹配 | **新增向量检索**（text-embedding-v3，解决「证型 ↔ 功效」不对齐） |
| LLM 知识增强 | 串行补全所有命中药材（很慢） | **只补全最相关前 5 味 + 3 并发 + 24 小时缓存** |

---

## 2. 整体架构

### 2.1 为什么不用「前端直连 Neo4j」？

本项目采用**后端代理**方案：

```
用户浏览器
   │
   │  POST /api/ai-engine/rag
   ▼
Node.js + Express 后端
   │
   ├─ ragServiceV2.js    （GraphRAG 核心）
   │     ├─ 本地 n-gram 关键词提取
   │     ├─ Neo4j Cypher 图检索
   │     ├─ 向量语义检索（embeddingService）
   │     ├─ 1-2 跳图遍历
   │     ├─ LLM 知识增强（受控并发）
   │     ├─ 上下文构建
   │     └─ DeepSeek 答案生成
   │
   ├─ embeddingService.js （向量检索 + SQLite 持久化）
   ├─ neo4j-simple.js     （Neo4j 单例连接，全系统复用）
   │
   ▼
Neo4j AuraDB 云图数据库
```

核心好处：

| 对比项 | 前端直连 Neo4j | 后端代理 Neo4j（当前方案） |
| --- | --- | --- |
| 密码位置 | 前端源码，会被看到 | 只在后端 `.env` |
| LangChain.js 运行环境 | 浏览器无法运行 | Node.js 原生运行 |
| 后续加 RAG / Agent | 需要再起一套连接 | 直接复用现有连接 |
| 安全性 | 差 | 好 |

### 2.2 核心链路

```
前端 qa.html / scripts/qa.js
        │  用户问题
        ▼
POST /api/ai-engine/rag
        ▼
routes/ai-engine.js       参数校验、调用服务
        ▼
services/ragServiceV2.js
        ├─ extractKeywords()         本地 n-gram 关键词提取（不调 LLM）
        ├─ searchNeo4j()             Cypher 图检索
        ├─ embeddingService.search()  向量语义检索补充
        ├─ enrichWithGraphTraversal() 1-2 跳图遍历
        ├─ enrichHerbDetails()        LLM 知识增强（前 5 味 + 3 并发）
        ├─ buildContextText()         上下文构建
        └─ generateAnswer()           DeepSeek 生成答案
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

## 3. 技术栈

| 层级 | 技术 | 作用 |
| --- | --- | --- |
| 后端 | Node.js + Express | 提供 HTTP API，承载 RAG 服务 |
| 图数据库 | Neo4j AuraDB | 存储药材、方剂、性味、归经、功效等图数据 |
| Neo4j 驱动 | `neo4j-driver` | Node.js 连接 Neo4j，执行 Cypher |
| LLM 框架 | `langchain` | 提供 Chain、Prompt、LLM 调用能力 |
| LangChain 社区包 | `@langchain/community` | 提供 `Neo4jGraph`、`GraphCypherQAChain` |
| OpenAI 兼容包 | `@langchain/openai` | 用 `ChatOpenAI` 兼容调用 DeepSeek |
| 大模型 | DeepSeek（`deepseek-chat`） | 知识增强、答案生成 |
| 向量模型 | 阿里云百炼 `text-embedding-v3` | 1024 维，语义检索 |
| 关系库 | SQLite | 用户、认证、对话历史、向量持久化 |
| 前端 | `qa.html` + `scripts/qa.js` | 问答界面、RAG 过程可视化 |

### 3.1 关键 npm 依赖

```json
{
  "neo4j-driver": "^6.2.0",
  "langchain": "^1.5.5",
  "@langchain/community": "^1.1.29",
  "@langchain/openai": "^1.5.6",
  "axios": "^1.6.2",
  "dotenv": "^16.3.1",
  "express": "^4.18.2"
}
```

---

## 4. 相关文件：哪个文件负责什么？

| 文件 | 功能 |
| --- | --- |
| `backend/src/app-simple.js` | 后端启动入口；初始化 SQLite、Neo4j；注册路由；启动保活与向量预热 |
| `backend/src/config/neo4j-simple.js` | Neo4j AuraDB 连接单例；连接池、保活、会话管理 |
| `backend/src/services/ragServiceV2.js` | **GraphRAG 核心服务**：关键词提取、图检索、向量补充、图遍历、知识增强、答案生成 |
| `backend/src/services/embeddingService.js` | **向量检索服务**：text-embedding-v3 向量化、余弦相似度、SQLite 持久化、增量同步 |
| `backend/src/services/ragService.js` | 早期 RAG 实现，已被 `ragServiceV2.js` 取代 |
| `backend/src/services/knowledgeGraphService.js` | 知识图谱页面使用的图数据查询服务 |
| `backend/src/routes/ai-engine.js` | 6 合 1 AI 引擎路由：RAG、配伍检测、古籍抽取、流式问答、知识增强、药材详情图谱 |
| `backend/src/routes/herbs-manage.js` | 药材管理 API，增删改时同步更新向量 |
| `backend/src/routes/conversations.js` | 历史对话存储 API（SQLite） |
| `backend/src/routes/knowledge-graph.js` | 知识图谱可视化 API |
| `qa.html` | GraphRAG 智能问答页面 |
| `scripts/qa.js` | 问答前端逻辑、RAG 过程可视化、药材节点跳转 |

---

## 5. Neo4j 连接与保活

### 5.1 单例连接

`backend/src/config/neo4j-simple.js` 用**单例模式**管理 `neo4j-driver`：

- 全系统只有一个 driver 实例
- 知识图谱 API、药材管理、RAG、向量检索**共用**这个连接
- 避免重复创建 driver 导致连接池耗尽

### 5.2 保活机制

Neo4j AuraDB Free 版 3 天无活动会休眠，因此后端每 **30 分钟** ping 一次：

```js
const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30 分钟
setInterval(async () => {
  const session = neo4jManager.getSession();
  await session.run('RETURN 1');
  await session.close();
}, KEEP_ALIVE_INTERVAL);
```

---

## 6. RAG 完整流程（七步管线）

一次问答按以下顺序执行：

```
用户问题
   ↓
① 关键词提取     本地 n-gram 切词（不调 LLM），提取药材名 / 功效 / 症状等字面词
   ↓
② Neo4j 图检索   Cypher 精确名称匹配 + CONTAINS 扩展（功效 / 描述 / 拼音）
   ↓
③ 向量语义检索   text-embedding-v3 语义匹配「证型 ↔ 功效」，弥补字面缺口
   ↓
④ 1-2 跳图遍历   沿关系边获取性味归经、功效、方剂、配伍禁忌
   ↓
⑤ LLM 知识增强   DeepSeek 补全最相关前 5 味药材（3 并发，24h 缓存）
   ↓
⑥ 上下文构建     将图谱数据与增强知识格式化为结构化提示
   ↓
⑦ DeepSeek 生成   基于增强上下文生成带引用来源的答案
```

### 6.1 条件步骤与兜底

- **回退检索**：如果关键词检索没有命中，会用「问题原文」再检索一次。
- **向量检索兜底**：如果 `DASHSCOPE_API_KEY` 未配置或向量索引未就绪，会跳过向量检索，不影响主流程。
- **完全无匹配兜底**：如果 Neo4j 图检索 + 向量检索都没有命中任何药材/方剂，就**降级为 DeepSeek 直接回答**（用模型自身的中医药知识），保证任何问题都有响应。

### 6.2 步骤一：本地 n-gram 关键词提取

最新版**不再调用 LLM 提取关键词**，改用本地 n-gram 切词：

```js
async extractKeywords(question) {
  // 本地 n-gram 提取（不再调用 LLM，省一次网络往返）
  // 向量检索已承担「证型 ↔ 功效」语义匹配，
  // 这里只负责捞药材名 / 方剂名等字面词
}
```

为什么可以去掉 LLM？

- 原来让 LLM 提取「肾虚」是证型、「补肾阳」是功效，但这类语义词最终还是要回图里做字面匹配，效果有限。
- 现在「证型 ↔ 功效」的语义匹配**完全交给向量检索**，字面词用本地 n-gram 即可。
- 省掉一次 LLM 调用，约快 2 秒。

### 6.3 步骤三：向量语义检索

`embeddingService.js` 基于阿里云百炼 `text-embedding-v3`（1024 维）：

- 把每味药材的「名称 + 拼音 + 描述 + 性味 + 归经 + 功效」拼成源文本并向量化
- 用**余弦相似度**找语义最接近的 Top-K 药材
- 结果与 CONTAINS 命中**去重合并**，语义命中排在前面

典型效果：问「肾虚可以吃什么中药调理？」，原来 CONTAINS 只能命中「虫草」1 味，向量检索后可命中山药、肉苁蓉、山茱萸等多味真正补肾的药材。

> 详细实现见 `docs/EMBEDDING_VECTOR_SEARCH.md`

### 6.4 步骤五：LLM 知识增强（性能优化）

最新版对知识增强做了三项优化：

| 优化 | 旧版 | 新版 |
| --- | --- | --- |
| 补全上限 | 命中几味补几味 | 只补全最相关前 **5** 味 |
| 并发 | 串行 `for await` | **3 并发** |
| 缓存 | 无 | **24 小时**内存缓存 |

```js
const ENRICH_HERB_LIMIT = 5;   // 每次最多补全前 5 味
const ENRICH_CONCURRENCY = 3;  // LLM 补全并发度
const ENRICH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小时
```

效果：问答耗时从约 **37 秒**降到 **12~15 秒**。

> 详细分析见 `docs/RAG_PERFORMANCE_OPTIMIZATION.md`

---

## 7. GraphCypherQAChain 的真实角色

项目引入了 LangChain.js 的 `GraphCypherQAChain`，但**它不是当前生产主路径**。

两种模式：

| 模式 | 流程 | 当前状态 |
| --- | --- | --- |
| GraphCypherQAChain | LLM 自动生成 Cypher → 执行 → LLM 回答 | **备用 / 技术展示** |
| 手动增强检索 | 关键词 → Cypher → 向量检索 → 图遍历 → 知识增强 → 生成 | **当前主路径** |

为什么主路径不用 GraphCypherQAChain？

1. AuraDB Free 实例存在路由表限制，`Neo4jGraph.initialize()` 可能报「database 'neo4j' does not exist」。
2. 手动模式**复用 `neo4j-simple.js` 单例**，避免 LangChain 再建一个 driver 导致连接池耗尽。
3. 手动模式每一步都可控、可展示、可解释，更符合比赛答辩需要。

---

## 8. 检索模式介绍

### 8.1 CONTAINS 字面匹配

适合「精确药名 / 方剂名」匹配，例如「人参有什么功效」。

### 8.2 向量语义检索

适合「证型 / 症状 ↔ 功效」对齐，例如「肾虚怎么调理」→ 命中「补肾阳」的药材。

### 8.3 两者关系

**互补，不是替代**：CONTAINS 负责精确字面匹配，向量检索负责语义对齐，结果合并去重。

---

## 9. 完整技术管线总结

```text
用户问题
   ↓
① 关键词提取：本地 n-gram 切词（不调 LLM）
   ↓
② Neo4j 图检索：Cypher 精确 / CONTAINS 匹配药材、方剂
   ↓
③ 向量语义检索：text-embedding-v3 语义匹配「证型 ↔ 功效」
   ↓
④ 1-2 跳图遍历：沿关系边扩展性味归经、功效、方剂、配伍禁忌
   ↓
⑤ LLM 知识增强：DeepSeek 补全前 5 味（3 并发 + 24h 缓存）
   ↓
⑥ 上下文构建：将图谱数据与增强知识格式化为结构化提示
   ↓
⑦ DeepSeek 生成：基于增强上下文生成带引用来源的答案

兜底：图谱完全无匹配 → DeepSeek 直接回答
```

---

## 10. 安全设计

1. **密钥只在后端**：前端 `qa.js` 不出现 DeepSeek API Key、DashScope Key、Neo4j 密码，它们只存在 `backend/.env`。
2. **Cypher 参数化**：

```js
// ✅ 当前做法
session.run("WHERE h.name CONTAINS term", { terms: searchTerms });

// ❌ 错误做法（禁止拼接）
"WHERE h.name CONTAINS '" + userInput + "'"
```

3. **前端只调 API**：前端只知道 `/api/ai-engine/rag`，不知道数据库连接信息。

---

## 11. 常见问题

**Q1：RAG 和直接问 DeepSeek 有什么区别？**
直接问 DeepSeek，模型只能靠训练记忆回答；RAG 是先从 Neo4j 找到真实资料，再把资料交给模型，答案更可靠、可溯源。

**Q2：问症状类问题能查图吗？**
能。本地 n-gram 先取字面词、向量检索做「证型 ↔ 功效」语义匹配；若图中无匹配，则降级为 DeepSeek 直接回答。

**Q3：为什么重复提问很快？**
系统有答案缓存，`CACHE_VERSION` 控制失效；修改检索逻辑后需递增 `CACHE_VERSION` 或清缓存。

**Q4：为什么问答比之前快了？**
关键词提取去 LLM 化、知识增强只补全前 5 味、串行改 3 并发。详情见 `docs/RAG_PERFORMANCE_OPTIMIZATION.md`。

**Q5：向量存在哪？**
SQLite 的 `herb_embeddings` 表，启动增量同步，药材增删改实时更新。

---

## 12. 文件清单速查

```text
D:\K5\Herb-v1.3
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
│     │  ├─ neo4j-simple.js
│     │  └─ database-simple.js
│     ├─ routes
│     │  ├─ ai-engine.js
│     │  ├─ ai-gateway.js
│     │  ├─ herbs-manage.js
│     │  ├─ conversations.js
│     │  └─ knowledge-graph.js
│     └─ services
│        ├─ ragServiceV2.js      ← GraphRAG 核心
│        ├─ embeddingService.js  ← 向量检索
│        ├─ ragService.js        ← 早期 RAG（已废弃）
│        └─ knowledgeGraphService.js
└─ docs
   ├─ AI_ENGINE_RAG_TEACHING_V2.md   ← 本文档（最新版）
   ├─ AI_ENGINE_RAG_TEACHING.md      ← 旧版教学文档
   ├─ EMBEDDING_VECTOR_SEARCH.md     ← 向量检索专项
   └─ RAG_PERFORMANCE_OPTIMIZATION.md ← 性能优化专项
```

---

## 13. 一句话总结

最新版 AI 引擎把中医药知识图谱从「只能看」升级为「能问答、能溯源、能推理」，核心链路：

**提问 → 本地关键词提取 → Neo4j 图检索 → 向量语义检索 → 1-2 跳图遍历 → LLM 知识增强 → 上下文构建 → DeepSeek 生成**

技术栈：

**Node.js + Express + neo4j-driver + LangChain.js + Neo4j AuraDB + text-embedding-v3 + DeepSeek（deepseek-chat）**
