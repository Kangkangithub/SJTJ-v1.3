# 神农AI：向量检索（Embedding 语义检索）功能实现详解

> 本文档面向初学者，专讲「向量检索」这一环：为什么要加它、它怎么工作、代码怎么写、怎么持久化、怎么增量更新、怎么接入 RAG 管线。
> 它是 [AI_ENGINE_RAG_TEACHING.md](./AI_ENGINE_RAG_TEACHING.md) 的专项配套，建议先看那一篇建立整体认知，再回来精读这一篇。
> 所有真实密码、API Key 均不会出现，只用占位符。

---

## 1. 为什么需要向量检索？

### 1.1 原有检索方式：CONTAINS 字面匹配

在加入向量检索之前，RAG 管线用 Neo4j 的 `CONTAINS` 做子串匹配，例如：

```cypher
MATCH (h:Herb)
WHERE any(term IN $terms WHERE h.name CONTAINS term)
   OR any(term IN $terms WHERE h.description CONTAINS term)
RETURN h
```

它的本质是「**字符串里有没有包含这个字**」。这带来一个致命问题：

> **用户说的是「证型 / 症状」，而药材库存储的是「功效术语」，两边字面上对不上。**

### 1.2 一个真实案例：肾虚为什么只命中了虫草？

用户问「**肾虚可以吃什么中药调理？**」，系统只检索到 **虫草（冬虫夏草）** 这一味药。

原因：在 275 味药材里，只有虫草的 `description` 字段里**恰好出现了「肾虚」这两个字**。而真正补肾的药材，描述里用的是另一套词：

| 药材 | 实际描述里的词 | 是否含「肾虚」 |
| --- | --- | --- |
| 山药 | 补肾涩精、益肺生津 | ❌ |
| 肉苁蓉 | 补肾阳、益精血 | ❌ |
| 山茱萸 | 补益肝肾、涩精固脱 | ❌ |
| 墨旱莲 | 滋补肝肾、凉血止血 | ❌ |
| 虫草 | （描述中恰有「肾虚」二字） | ✅ |

所以 `CONTAINS "肾虚"` 只能命中虫草，把山药、肉苁蓉这些真正该命中的药全漏掉了。这就是「**证型 ↔ 功效」字面不对齐** 问题。

### 1.3 向量检索怎么解决？

向量检索不比较「字面」，而是比较「**语义**」。它把药材文本和用户问题都映射成高维空间里的一个点（向量），然后用**余弦相似度**衡量两个点在语义上的接近程度。

- 「肾虚」和「补肾阳」虽然字面完全不同，但在语义空间里距离很近；
- 于是「肾虚」能命中「肉苁蓉（补肾阳）」「山茱萸（补益肝肾）」这些字面不含「肾虚」的药。

---

## 2. 技术选型

| 项目 | 选择 | 说明 |
| --- | --- | --- |
| 向量模型 | 阿里云百炼 `text-embedding-v3` | OpenAI 兼容协议，中文效果好 |
| 向量维度 | 1024 维 | 模型固定输出 |
| 相似度 | 余弦相似度 | 对向量长度不敏感，适合文本语义 |
| 存储 | 本地 SQLite `herb_embeddings` 表 | 复用现有 SQLite，零新增依赖 |
| 调用方式 | `axios` 直接 HTTP POST | 走百炼 OpenAI 兼容端点，不引入 SDK |

百炼 OpenAI 兼容端点：

```
https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings
```

请求体（与 OpenAI 一致）：

```json
{
  "model": "text-embedding-v3",
  "input": ["人参有什么功效？", "肉苁蓉。性味：甘、咸、温。功效：补肾阳、益精血"]
}
```

返回体：

```json
{
  "data": [
    { "index": 0, "embedding": [0.023, -0.11, ...1024 个浮点数] },
    { "index": 1, "embedding": [...] }
  ]
}
```

> ⚠️ **单次批量上限 10 条**：百炼 `text-embedding-v3` 一次请求的 `input` 数组不能超过 10 条，否则返回 400。这是本项目 `BATCH_SIZE = 10` 的由来。

---

## 3. 整体架构与数据流

```
                       ┌─────────────────────────────────────────────┐
                       │              embeddingService.js             │
                       │  (单例，内存里维护 name → 向量 的 Map)          │
                       └─────────────────────────────────────────────┘
                                      ▲                │
                        拉取药材字段     │                │ 余弦相似度检索
                          (Cypher)     │                ▼
        ┌──────────────┐         ┌────┴─────────┐   ┌──────────────┐
        │  Neo4j AuraDB │◀───────▶│ 百炼 embedding │   │  ragServiceV2 │
        │  (Herb 节点)  │   REST  │  (DashScope)  │   │   (RAG 管线)  │
        └──────────────┘         └──────────────┘   └──────┬───────┘
                                          ▲                  │
                              向量持久化   │                  │ 增量/单条更新
                                          │                  ▼
                               ┌──────────┴───────────┐  ┌────────────────┐
                               │ SQLite herb_embeddings│  │  herbs-manage.js │
                               │ (name→vector JSON)    │  │  (增删改接口)     │
                               └──────────────────────┘  └────────────────┘
```

一句话总结：**向量存在本地 SQLite（持久化），检索时在内存里跑余弦相似度（快），数据源头是 Neo4j（药材字段），模型用百炼（向量化）。**

---

## 4. 核心模块：embeddingService.js 逐段详解

文件位置：`backend/src/services/embeddingService.js`

### 4.1 类结构与内存态

```js
class EmbeddingService {
  constructor() {
    this.ready = false;             // 是否已加载向量、可用于检索
    this.memory = new Map();        // name -> { vector: number[], sourceText: string }
    this._syncPromise = null;       // 防止并发 syncAll
  }
}
```

- `memory` 是运行时缓存，存「药材名 → 向量 + 生成该向量时的源文本」。
- 之所以额外存 `sourceText`，是为了**增量 diff**（见 4.6）：下次同步时能判断「这味药的字段有没有变」。

单例导出：

```js
module.exports = new EmbeddingService();
```

全系统只存在一个实例，`ragServiceV2.js`、`herbs-manage.js`、`app-simple.js` 引用的都是同一个对象。

### 4.2 embed()：调用百炼接口

```js
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = process.env.EMBEDDING_MODEL || "text-embedding-v3";
const BATCH_SIZE = 10; // 百炼 text-embedding-v3 单次上限 10 条

async embed(inputs) {
  const key = this.getApiKey();
  if (!key) throw new Error("DASHSCOPE_API_KEY 未配置");

  const isArray = Array.isArray(inputs);
  const resp = await axios.post(
    `${BASE_URL}/embeddings`,
    { model: MODEL, input: inputs },
    { headers: { Authorization: `Bearer ${key}` }, timeout: 30000 }
  );

  const data = resp.data.data || [];
  if (data.length === 0) throw new Error("embedding 返回为空");
  data.sort((a, b) => (a.index || 0) - (b.index || 0));   // 按 index 排序，防止顺序错乱
  const vecs = data.map((d) => d.embedding);
  return isArray ? vecs : vecs[0];
}
```

要点：
- 兼容模式按 `index` 返回，代码显式 `sort` 一次，保证「第 i 条输入 → 第 i 条输出」严格对应。
- 传字符串返回单个向量，传数组返回数组。

### 4.3 cosine()：余弦相似度

```js
cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
```

数学含义：

```
cosine(a,b) = (a·b) / (|a|·|b|)
```

- 结果落在 [-1, 1]，越接近 1 语义越相似。
- 用余弦而不是点积：余弦对「向量长度」不敏感，只比较方向，能避免「长文本向量天然数值更大」带来的偏差。

### 4.4 buildSourceText()：把药材拼成一段文本

这是**最关键的设计决策之一** —— 向量化的输入是什么文本。

```js
buildSourceText(herb) {
  const parts = [];
  if (herb.name)        parts.push(herb.name);
  if (herb.pinyin)      parts.push(herb.pinyin);
  if (herb.description) parts.push(herb.description);
  if (herb.properties && herb.properties.length) parts.push("性味：" + herb.properties.join("、"));
  if (herb.meridians  && herb.meridians.length)  parts.push("归经：" + herb.meridians.join("、"));
  if (herb.efficacies && herb.efficacies.length) parts.push("功效：" + herb.efficacies.join("、"));
  return parts.join("。");
}
```

例如肉苁蓉会被拼成：

```
肉苁蓉。roucongrong。补肾阳，益精血，润肠通便。性味：甘、咸、温。归经：肾、大肠。功效：补肾阳、益精血、润肠通便
```

要点：
- 把 `name + 拼音 + 描述 + 性味 + 归经 + 功效` 全部拼进去，让向量「认识」这味药的各个维度。
- 用「。」分隔，让模型把每段当独立语义单元。
- **这段文本同时也是 `sourceText`**，被存入 SQLite，用于判断是否需要重算（见 4.6）。

### 4.5 持久化：SQLite 读写

复用已有的 `databaseManager`（`database-simple.js` 单例），不新建连接。

```js
async loadFromDb() {
  const rows = await this._dbAll("SELECT name, vector, source_text FROM herb_embeddings");
  for (const row of rows) {
    try {
      this.memory.set(row.name, {
        vector: JSON.parse(row.vector),
        sourceText: row.source_text || ""
      });
    } catch (e) {
      console.warn("[Embedding] 跳过损坏的向量记录:", row.name);
    }
  }
}
```

写入用 `INSERT OR REPLACE`（存在则覆盖，不存在则插入）：

```js
await this._dbRun(
  "INSERT OR REPLACE INTO herb_embeddings (name, vector, source_text, model) VALUES (?,?,?,?)",
  [h.name, JSON.stringify(vec), text, MODEL]
);
```

要点：
- `vector` 是 1024 维浮点数组，用 `JSON.stringify` 序列化成 TEXT 存库，读回时 `JSON.parse`。
- **这就是「持久化」的意义**：重启后 `loadFromDb` 直接把 275 个向量读进内存，不用再调 100 多次百炼接口重算。

### 4.6 增量 diff：syncAll()

```js
async _doSync() {
  await this.loadFromDb();                       // 1. 先读库里已有的向量
  const herbs = await this.loadAllHerbsFromNeo4j();  // 2. 拉 Neo4j 当前全部药材

  const herbMap = new Map();
  const toEmbed = [];
  for (const h of herbs) {
    const text = this.buildSourceText(h);
    herbMap.set(h.name, text);
    const cached = this.memory.get(h.name);
    if (!cached || cached.sourceText !== text) {   // 3. diff：缺了 或 变了才重算
      toEmbed.push(h);
    }
  }
  // 4. 清理 Neo4j 里已删除的药材
  for (const name of Array.from(this.memory.keys())) {
    if (!herbMap.has(name)) this.memory.delete(name);
  }

  if (toEmbed.length === 0) { this.ready = true; return; }  // 全是最新，直接就绪

  // 5. 批量向量化（每次 10 条）
  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const texts = batch.map((h) => this.buildSourceText(h));
    const vecs  = await this.embed(texts);
    for (let j = 0; j < batch.length; j++) {
      this.memory.set(batch[j].name, { vector: vecs[j], sourceText: texts[j] });
      await this._dbRun("INSERT OR REPLACE INTO herb_embeddings ...", [...]);
    }
  }
  this.ready = true;
}
```

这套逻辑就是「**增量同步**」：

- **缺了**（库里没有这味药）→ 重算；
- **变了**（`sourceText` 和库里的不一致，说明 name/描述/性味/归经/功效 被改过）→ 重算；
- **没变** → 直接复用，**不花一分钱**。

实测：275 味药首次全量同步约 5 秒；之后再启动，diff 结果为 0，**秒级就绪、不重算**。将来扩到 1000 味药，也只对「新增/改动」的那几味重算，不用整体推倒重来。

### 4.7 search()：top-K 检索

```js
async search(queryText, k = 10) {
  if (!this.isReady()) return [];
  const qv = await this.embed(queryText);      // 1. 把问题向量化
  const results = [];
  for (const [name, entry] of this.memory) {   // 2. 和内存里每味药算余弦
    results.push({ name, score: this.cosine(qv, entry.vector) });
  }
  results.sort((a, b) => b.score - a.score);   // 3. 降序
  return results.slice(0, k);                  // 4. 取前 k
}
```

一次检索 = 1 次百炼调用 + 275 次纯内存余弦计算（微秒级）。返回形如：

```js
[
  { name: "山药",   score: 0.6807 },
  { name: "仙茅",   score: 0.6792 },
  { name: "肉苁蓉", score: 0.6482 }
]
```

### 4.8 updateOne / deleteOne：单条更新（供 CRUD 调用）

```js
async updateOne(name) {
  const herb = await this.loadHerbFromNeo4j(name);   // 只拉这一味
  if (!herb) return;
  const text = this.buildSourceText(herb);
  const vec  = await this.embed(text);               // 只算这一条
  this.memory.set(name, { vector: vec, sourceText: text });
  await this._dbRun("INSERT OR REPLACE INTO herb_embeddings ...", [...]);
}

async deleteOne(name) {
  this.memory.delete(name);
  await this._dbRun("DELETE FROM herb_embeddings WHERE name = ?", [name]);
}
```

这就是「**单条更新**」：新增/修改/删除一味药时，只动这一味，不触发全量 diff。实时性和准确性都比「靠启动 diff 兜底」更好。

---

## 5. 数据库表设计：herb_embeddings

在 `database-simple.js` 的表清单里新增（`CREATE TABLE IF NOT EXISTS`，幂等）：

```sql
CREATE TABLE IF NOT EXISTS herb_embeddings (
  name        TEXT PRIMARY KEY,          -- 药材名，天然唯一，直接当主键
  vector      TEXT NOT NULL,             -- JSON 序列化的 1024 维浮点数组
  source_text TEXT,                      -- 生成该向量时的源文本（用于增量 diff）
  model       TEXT,                      -- 向量模型名（如 text-embedding-v3）
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

设计要点：

- 用 `name` 做主键而不是自增 id，因为业务上「一味药 → 一个向量」是天然的一对一关系。
- `vector` 用 TEXT 存 JSON，省去二进制 BLOB 的处理复杂度（1024 个浮点 ≈ 21KB，SQLite 完全没压力）。
- `source_text` 是**增量 diff 的判据**，缺了它就无法判断「字段有没有变」。

---

## 6. 接入 RAG 管线：ragServiceV2.js 的「步骤 1.5」

在 `ragViaManual` 里，关键词 + CONTAINS 检索（步骤 1）之后，插入「步骤 1.5 向量检索补充」：

```js
// 步骤1.5：向量检索补充
if (finalResults && embeddingService.isReady()) {
  const semHits = await embeddingService.search(question, 10);   // 语义 top-10
  const existingNames = new Set(finalResults.herbs.map(h => h.name));
  const newNames = semHits.map(s => s.name).filter(n => n && !existingNames.has(n));

  if (newNames.length > 0) {
    const semanticHerbs = await this.searchNeo4jByNames(newNames);  // 按名补齐字段
    const semNames = new Set(semanticHerbs.map(h => h.name));
    // 语义命中优先，CONTAINS 命中去重后追加
    finalResults.herbs = semanticHerbs.concat(
      finalResults.herbs.filter(h => !semNames.has(h.name))
    );
  }
}
```

合并策略：

1. 向量检索返回 top-10 相关药材（带相似度分数，天然已按相关度排序）；
2. 过滤掉「已经被 CONTAINS 命中」的药（去重）；
3. 剩下的「语义新命中的药」排在最前面（因为它更贴合用户问题语义），CONTAINS 的结果跟在后面。

> `searchNeo4jByNames` 是新增的辅助方法，形状和 `searchNeo4j` 一致，专门按药材名数组补齐详情字段（分类、产地、性味等），因为向量检索只返回了「名字 + 分数」。

---

## 7. 接入 CRUD：herbs-manage.js

在药材管理接口里，事务提交后**异步**调用单条更新（不阻塞接口响应）：

```js
// POST 新增
await tx.commit();
embeddingService.updateOne(trimmedName);

// PUT 更新（改名需删旧补新）
await tx.commit();
if (targetName !== oldName) {
  embeddingService.deleteOne(oldName);
  embeddingService.updateOne(targetName);
} else {
  embeddingService.updateOne(targetName);
}

// DELETE 删除
await session.run("MATCH (h:Herb {name: $name}) DETACH DELETE h", { name: herbName });
embeddingService.deleteOne(herbName);
```

要点：

- 放在 `tx.commit()` / 删除**之后**，保证「数据已写入 Neo4j，再更新向量」。
- 是**异步**调用（`updateOne` 返回 Promise 但不 await），接口响应速度不受向量化影响。
- 改名的场景要 `deleteOne(旧名) + updateOne(新名)`，因为主键是 name。

---

## 8. 启动预热：app-simple.js

```js
// 服务器 listen 成功后
this.warmupKnowledgeGraphCache();
this.warmupEmbeddings();

warmupEmbeddings() {
  setTimeout(async () => {
    await embeddingService.syncAll();   // 增量 diff，只算缺失/变化
  }, 2000);                             // 延迟 2 秒，避免阻塞启动
}
```

- 延迟 2 秒再跑，让 HTTP 服务先起来响应请求；
- 因为做了持久化 + 增量 diff，预热通常「0 增量、秒级就绪」。

---

## 9. 关键设计权衡与坑

### 9.1 为什么持久化而不是每次现算？

- 275 味药 = 28 次批量请求（275 / 10）。每次都现算，重启就要重打 28 次百炼接口，慢且费钱。
- 持久化后，重启直接 `loadFromDb` 读内存，零网络开销。

### 9.2 为什么用 sourceText 做增量判据？

- 直接对比「向量变没变」成本高（1024 维逐项比），且向量是模型算出来的，无法表达「哪个字段变了」。
- 存下 `sourceText`，下次用 `cached.sourceText !== newText` 就能秒判「这味药有没有被改过」。
- 代价是：如果将来**改了 buildSourceText 的拼接逻辑**（比如加了「别名」字段），所有药的 sourceText 都会变，会触发一次全量重算 —— 这是**正确行为**，不算 bug。

### 9.3 BATCH_SIZE 为什么是 10？

百炼 `text-embedding-v3` 兼容端点单次 `input` 上限是 10 条，超过返回 400「batch size is invalid, it should not be larger than 10」。实测踩过这个坑（最初写 20，直接报错），改成 10 后正常。

### 9.4 为什么用余弦相似度而不是点积？

点积 = `a·b`，会受到向量长度影响：文本越长、嵌入值越大，点积天然偏大，容易把「长文本」误判为「更相似」。余弦把结果归一化到 [-1,1]，只比方向，更适合文本语义比较。

### 9.5 同步 vs 异步

- 启动预热、CRUD 单条更新都是**异步**的（不 await），避免阻塞服务启动/接口响应。
- `syncAll` 内部用 `_syncPromise` 做了防重入：并发调用只执行一次。

### 9.6 将来扩到 1000 味药怎么办？

- **不需要**重新生成现有 275 味药的向量（持久化 + 增量 diff 已覆盖）。
- 新增的药走 `herbs-manage` 接口时 `updateOne` 实时向量化；或启动时 diff 发现「库里没有」自动补算。
- 唯一要留意的是内存占用：1000 味 × 1024 维 × 8 字节 ≈ 8MB，完全可接受。

---

## 10. 实测效果

对「肾虚可以吃什么中药调理？」：

| 检索方式 | 结果 |
| --- | --- |
| 原 CONTAINS | 只有「虫草」1 味 |
| 加入向量检索后 | 山药(0.68)、仙茅(0.68)、益智仁(0.67)、人参(0.67)、桑螵蛸(0.67)、虫草(0.67)、莲子(0.66)、红参(0.66)、五味子(0.66)、肉苁蓉(0.65)、山茱萸(0.65)、墨旱莲(0.65) —— **全是补肾药** |

对「脾胃虚寒怎么调理？」：苍术、砂仁、白术、白扁豆、陈皮、党参 —— 健脾温中药。

---

## 11. 常见问题

**Q1：为什么向量检索有时没生效？**
看两点：`embeddingService.isReady()` 是否为 true（需要 DASHSCOPE_API_KEY 配置且已完成首次同步）；以及是否命中「新药材」（若 CONTAINS 已覆盖，向量结果会被去重，但管线步骤里仍会显示「向量检索」这一步）。

**Q2：向量存在哪？**
本地 SQLite `backend/data/herb-knowledge.db` 的 `herb_embeddings` 表。删掉这个表/库，重启会自动重算（但会慢一次）。

**Q3：改了药材的描述，向量会自动更新吗？**
会。改字段 → 该药 `sourceText` 变 → 下次 `syncAll` diff 发现变化 → 重算这一味；或通过 `herbs-manage` 改的话，`updateOne` 会立即重算。

**Q4：换向量模型怎么办？**
改 `.env` 里的 `EMBEDDING_MODEL`（默认 `text-embedding-v3`），再清空 `herb_embeddings` 表重启即可全量重算。模型不同维度可能不同，务必清表避免新旧向量混用。

**Q5：向量检索和 CONTAINS 是什么关系？**
互补，不是替代。CONTAINS 擅长「精确药名/方剂名」匹配，向量检索擅长「证型↔功效」语义对齐。两者结果合并去重，语义命中排前。
