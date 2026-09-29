# 神农AI 智能问答助手 — Agent 架构全解析

> 本文档讲解当前 AI 问答的完整技术实现：Agent 编排 + Tool Calling + 三路混合检索（向量 + BM25 + 知识图谱）+ RRF 融合，以及「默认永远走 Agent，经典 RAG 仅后端兜底」的整体逻辑。

## 一、一句话总览

用户提问 → 前端调用 `/api/ai-engine/agent` → 后端 Agent（ReAct）自主决定调用哪些工具 → 工具去查 Neo4j / SQLite / DeepSeek → 多步推理后生成答案 → 前端展示思维链 + 参考药材 + 方剂 + 图片视频。

如果 Agent 没能得到答案（模型输出异常、达到最大轮次等），后端自动回退到经典 RAG 固定管线，保证一定能回答。

---

## 二、整体架构

```
前端 qa.html / qa.js
   │  doSend() 永远走 askAgent()
   ▼
POST /api/ai-engine/agent
   │
   ▼
agentService.js（ReAct 循环）
   │  Thought → Action → 执行工具 → Observation → 迭代
   ├── agentTools.js（5 个工具）
   │     ├─ search_herbs          三路混合检索 + 1-2 跳图遍历
   │     ├─ search_formulas       方剂检索
   │     ├─ enrich_herb           LLM 知识增强
   │     ├─ herb_media            图片 / 视频
   │     └─ check_compatibility   十八反十九畏
   │
   ├── hybridSearchService.js（BM25 + 向量 + 图 + RRF）
   ├── embeddingService.js（text-embedding-v3）
   ├── ragServiceV2.js（经典 RAG，兜底）
   └── neo4j-simple.js（Neo4j 单例）
   │
   ▼
Neo4j AuraDB + SQLite + DeepSeek
```

**关键文件**：

| 文件 | 作用 |
| --- | --- |
| `backend/src/routes/ai-engine.js` | `/agent` 路由，含 agent-fallback 兜底 |
| `backend/src/services/agentService.js` | Agent 编排（ReAct 循环 + 思维链） |
| `backend/src/services/agentTools.js` | 工具集定义（5 个工具） |
| `backend/src/services/hybridSearchService.js` | 三路混合检索 + RRF |
| `backend/src/services/ragServiceV2.js` | 经典 RAG 管线（兜底） |
| `frontend/js/qa.js` | 前端问答 + 思维链 / 多媒体渲染 |

---

## 三、Agent 编排（ReAct + Tool Calling）

### 3.1 什么是 ReAct

ReAct = Reason（推理）+ Act（行动）。Agent 不再走固定流程，而是循环执行：

```
Thought（思考）
  → Action（决定调用哪个工具）
  → Action Input（工具参数）
  → 系统执行工具
  → Observation（工具返回结果）
  → 再次 Thought（基于结果继续思考）
  → ... 直到 Final Answer
```

代码里 `MAX_ITERATIONS = 8`，最多 8 轮，防止死循环。

### 3.2 核心代码路径

`agentService.js`：

1. `buildSystemPrompt()`：告诉模型「有哪些工具 + ReAct 输出格式 + 规则」。
2. `runAgent(question)`：ReAct 主循环。
3. `parseReAct(text)`：解析模型输出里的 `Thought / Action / Action Input / Final Answer`。
4. `answerWithAgent(question)`：入口，Agent 失败时返回空，交给路由兜底。

### 3.3 思维链如何记录

每一步都 push 到 `steps` 数组：

```js
steps = [
  { type: "thought",     content: "需要检索人参" },
  { type: "tool_call",   tool: "search_herbs", args: { question: "人参有什么功效？" } },
  { type: "tool_result", content: "检索到人参：性味甘微苦温..." },
  { type: "answer",      content: "人参是..." }
]
```

前端 `buildAgentStepsHtml()` 把 `steps` 渲染成可折叠思维链（💭思考 / 🔧调用工具 / 📋结果 / ✅答案）。

---

## 四、封装的 5 个工具

工具定义在 `agentTools.js`，每个工具统一返回：

- 纯字符串（给 LLM 当 Observation）
- 或对象 `{ text, herbs?, formulas?, media? }`：`text` 给 LLM，结构化字段给前端渲染。

| 工具 | 触发场景 | 底层实现 | 返回 |
| --- | --- | --- | --- |
| `search_herbs` | 需要检索药材 | 三路混合检索 + 1-2 跳图遍历 | `{ text, herbs, formulas }` |
| `search_formulas` | 需要查方剂 | `ragServiceV2.searchFormulas`（Neo4j） | `{ text, formulas }` |
| `enrich_herb` | 单味药深度增强 | 调 DeepSeek 补全主治/用法/禁忌/药理/临床 | `{ text, herbs:[药名] }` |
| `herb_media` | 单味药图片/视频/外观 | 查 `uploads/herbs`、`uploads/videos` | `{ text, media:[{type,url,name}] }` |
| `check_compatibility` | 多味药配伍禁忌 | 加载 `compatibility_rules.json` | 字符串 |

### 4.1 search_herbs（核心工具）

这是最关键的检索工具，内部复刻了经典 RAG 的检索链路：

```
hybridSearchService.hybridSearch(q)   // ① 三路混合检索
  → searchNeo4jByNames(names)         // ② 按名取图谱详情
  → enrichWithGraphTraversal(...)     // ③ 1-2 跳图遍历（性味/归经/功效/方剂/配伍）
  → buildContextText(enriched)        // ④ 构建立体上下文
  → 返回 { text: 完整图谱上下文, herbs, formulas }
```

这样 Agent 的回答和经典 RAG 一样「可溯源、有图谱证据」。

### 4.2 herb_media（多媒体）

只针对单一药材返回图片 / 视频；文件命名规则是「药材名 + 扩展名」，例如：

- `uploads/herbs/人参.png`
- `uploads/videos/人参.mp4`

前端收到 `media` 数组后渲染 `<img>` / `<video>`，图片可点击放大。

---

## 五、三路混合检索 + RRF

### 5.1 三路检索

| 路 | 技术 | 解决什么 |
| --- | --- | --- |
| BM25 全文 | Neo4j `cjk` 全文索引，字段加权 `name^3 > pinyin^2 > 功效/描述` | 字面精确匹配 |
| 向量语义 | `text-embedding-v3`（1024 维），余弦相似度 | 解决「证型 ↔ 功效」语义错位，如「肾虚 → 补肾阳」 |
| 知识图谱 | Cypher `CONTAINS` | 图谱节点属性字面匹配 |

### 5.2 RRF 融合

RRF（Reciprocal Rank Fusion，倒数排名融合）把三路结果合并重排：

```
score(doc) = Σ 1 / (k + rank_i(doc))
```

- `rank_i` 是文档在第 i 路检索中的排名
- `k` 是常数（通常取 60）

多路都命中的药材会得到更高总分、排更前，所以比单路检索更准。

---

## 六、默认走 Agent、经典 RAG 仅兜底

### 6.1 前端

`qa.js` 的 `doSend()` 里，已经去掉了「流式回答 / Agent 思维链」两个开关，**统一永远调用 Agent**：

```js
result = await askAgent(input);   // POST /api/ai-engine/agent
```

### 6.2 后端路由

`/api/ai-engine/agent`：

```js
const result = await agentService.answerWithAgent(question);

if (result.answer) {
  return { mode: "agent", answer, steps, sources, formulas, media };
}

// Agent 没答出来 → 回退经典 RAG
const fallback = await ragServiceV2.answer(question);
return { mode: "agent-fallback", answer: fallback.answer, pipelineSteps: fallback.pipelineSteps, ... };
```

### 6.3 前端渲染

`buildAnswerHtml(result)` 根据 `mode` 分支：

- `agent` → 渲染 Agent 思维链
- `agent-fallback` → 渲染思维链 + 经典 RAG 管线
- 其他 → 经典 RAG 管线

回答下方统一显示：参考药材 chip、关联方剂 chip、多媒体（图片/视频）。

---

## 七、端到端完整链路

以「人参有什么功效？」为例：

1. 用户在 `qa.html` 输入问题，点发送。
2. `doSend()` → `askAgent()` → `POST /api/ai-engine/agent`。
3. 后端 `agentService.runAgent()` 启动 ReAct 循环。
4. 模型第一步输出 `Thought: 需要检索人参` + `Action: search_herbs` + 参数。
5. `search_herbs` 执行三路混合检索 + 图遍历，返回完整图谱上下文。
6. 模型看到 Observation 后，可能再调 `enrich_herb` / `herb_media`。
7. 模型输出 `Final Answer`。
8. 后端把 `answer + steps + sources + formulas + media` 返回前端。
9. 前端渲染：可折叠思维链 + 回答正文 + 参考药材 + 方剂 + 人参图片/视频。

---

## 八、历史对话持久化

`messages` 表新增 `formulas / media / steps` 列，保存时把这三类数据写入 SQLite，加载历史时完整还原，因此思维链、参考药材、图片视频在历史里都不会丢。

---

## 九、关键文件索引

- 前端：`frontend/js/qa.js`（`doSend / askAgent / buildAgentStepsHtml / formatMedia`）
- 后端路由：`backend/src/routes/ai-engine.js`（`/agent`）
- Agent 编排：`backend/src/services/agentService.js`
- 工具集：`backend/src/services/agentTools.js`
- 三路混合检索：`backend/src/services/hybridSearchService.js`
- 经典 RAG 兜底：`backend/src/services/ragServiceV2.js`
- 向量检索：`backend/src/services/embeddingService.js`
