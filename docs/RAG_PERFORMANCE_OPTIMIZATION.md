# 神农AI：问答变慢原因分析与性能优化详解

> 本文档面向初学者，讲一件事：**为什么问个问题要等将近 40 秒，以及我们是怎么把它压到 15 秒以内的。**
> 配套阅读：[AI_ENGINE_RAG_TEACHING.md](./AI_ENGINE_RAG_TEACHING.md)（RAG 整体流程）、[EMBEDDING_VECTOR_SEARCH.md](./EMBEDDING_VECTOR_SEARCH.md)（向量检索专项）。
> 所有真实密码、API Key 均不会出现，只用占位符。

---

## 1. 先看现象：问个问题怎么这么慢？

用户问「**肾虚可以吃什么中药调理？**」，前端转圈转了约 **37 秒**才出答案。37 秒对聊天体验来说是灾难级的。要优化，第一步不是改代码，而是**先搞清楚时间到底花在哪**。

### 1.1 一次问答的完整流水线

后端回答一次问题，会依次走下面 7 步：

```
① extractKeywords       用 LLM 提取关键词          —— 1 次 LLM 调用
② searchNeo4j           CONTAINS 字面匹配药材      —— 纯图查询
③ 向量检索              语义匹配证型↔功效           —— 纯计算（无 LLM）
④ enrichWithGraphTraversal  图遍历补充关联药材       —— 纯图查询
⑤ enrichHerbDetails     逐味药材做 LLM 知识补全      —— N 次 LLM 调用  ⚠️
⑥ buildContextText      拼接成上下文文本            —— 纯字符串拼接
⑦ generateAnswer        生成最终回答               —— 1 次 LLM 调用
```

### 1.2 逐段计时，找到「元凶」

| 步骤 | 耗时（估算） | 几次 LLM 调用 | 说明 |
| --- | --- | --- | --- |
| ① extractKeywords | ~2 秒 | 1 次 | 让 LLM 抽取关键词 |
| ② searchNeo4j | ~1 秒 | 0 | 图数据库查询，很快 |
| ③ 向量检索 | ~1 秒 | 0 | 纯向量余弦计算，很快 |
| ④ 图遍历 | ~1 秒 | 0 | 图查询，很快 |
| ⑤ enrichHerbDetails | **~24 秒** | **12 次** | ⚠️ 元凶 |
| ⑥ buildContextText | ~0 秒 | 0 | 拼字符串 |
| ⑦ generateAnswer | ~4 秒 | 1 次 | 生成回答 |
| **合计** | **~37 秒** | **14 次** | |

结论很清晰：**第 ⑤ 步 `enrichHerbDetails` 贡献了 24 秒，占了总时长的三分之二。** 其它所有步骤加起来才 13 秒。

### 1.3 为什么第 ⑤ 步这么慢？

看优化前的代码（简化后）：

```js
async enrichHerbDetails(enriched) {
  // 对每一味药材，挨个调 LLM 补全 —— 一次只调一味，等它返回再调下一味
  for (const herb of enriched.herbs) {
    await this.llm.invoke([...]);   // ⚠️ 串行：一味药 ≈ 2 秒
  }
}
```

问题有两个：

1. **串行**：`for ... await` 是一味药调完、等它返回，才调下一味。12 味药 = 12 次「等 2 秒」首尾相接 = 24 秒。
2. **全量**：有多少味药就补全多少味，没有上限。

> 💡 一个直觉比喻：`for ... await` 相当于你去银行办事，只有一个窗口，12 个人排成一队，一个一个办。每人 2 分钟，总共 24 分钟。优化就是「多开几个窗口 + 只让最重要的 5 个人进去办」。

---

## 2. 一个反直觉的现象：越准越慢

这里有个特别值得记住的现象：**我们上一期刚加的「向量检索」，反而让问答更慢了。**

原因是：向量检索让「肾虚」命中了更多真正相关的药材（山药、肉苁蓉、山茱萸……从原来的 1 味虫草，变成 12 味）。而第 ⑤ 步是「命中几味就补全几味」，于是 LLM 调用次数从 1 次暴涨到 12 次。

> **检索越准 → 命中药越多 → 补全的 LLM 调用越多 → 越慢。** 这就是「越准越慢」悖论。

所以这次优化必须解决：**在检索变准的前提下，不能让 LLM 调用跟着无限膨胀。**

---

## 3. 优化思路：两个杠杆

所有「让 LLM 问答变快」的办法，本质都归结为两个杠杆：

| 杠杆 | 做法 | 本次用在哪 |
| --- | --- | --- |
| **杠杆一：减少 LLM 调用次数** | 能不算的就不算，能本地算的就本地算 | P0 的「上限」、P1 的「去 LLM 化」 |
| **杠杆二：让剩下的 LLM 调用并行** | 把串行改成并发 | P0 的「并发池」 |

> 记住这句话就够了：**LLM 调用是问答里最贵、最慢的东西，优化就是「少调 + 并行」。**

---

## 4. P0 优化一：给补全加「上限」

**文件**：[backend/src/services/ragServiceV2.js](../backend/src/services/ragServiceV2.js)

新增一个常量，限定每次最多补全前 5 味药材：

```js
const ENRICH_HERB_LIMIT = 5;   // 每次最多对前 N 味药材做 LLM 补全
const ENRICH_CONCURRENCY = 3;  // LLM 补全并发度
```

然后补全前截断：

```js
async enrichHerbDetails(enriched) {
  // 只补全最相关的前 5 味，其余直接用 Neo4j 已有的字段（够用）
  const targets = enriched.herbs.slice(0, ENRICH_HERB_LIMIT);
  ...
}
```

为什么可以只补全前 5 味？

- 命中的药材是按**相关度排序**的，前 5 味已经覆盖了用户问题最核心的答案。
- 第 5 味之后的药，用 Neo4j 里已有的 `功效/性味/归经` 字段就足够支撑回答，没必要每味都花 2 秒让 LLM 现编一段。
- **收益**：LLM 补全次数从「命中几味就几味」（本例 12 次）固定到「最多 5 次」。

---

## 5. P0 优化二：把串行改成「并发池」

光有上限还不够：5 味药如果还是串行，也要 10 秒。再把这 5 味**并行**起来。

优化前的核心问题是 `for ... await`（串行）。优化后改成「**受控并发池**」：

```js
async enrichHerbDetails(enriched) {
  const targets = enriched.herbs.slice(0, ENRICH_HERB_LIMIT);

  // 并发池：开 3 个 worker，谁干完谁领下一味药
  let next = 0;
  const workerCount = Math.min(ENRICH_CONCURRENCY, targets.length);
  const workers = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push((async () => {
      while (next < targets.length) {
        const herb = targets[next++];       // 领取下一个任务
        await this._enrichOneHerb(herb);    // 干这一味药
      }
    })());
  }
  await Promise.all(workers);               // 等所有 worker 全部干完
}
```

原来那个「一味一味补全」的大函数，被拆成了一个 `_enrichOneHerb(herb)`（单味药：查缓存 → 调 LLM → 解析 → 写缓存），这样并发池里每个 worker 都能独立地处理一味药。

> 💡 **并发池的比喻**：银行开了 3 个窗口（3 个 worker），5 个人排队。窗口空出来一个，下一个人立刻补上。5 个人 3 个窗口 = 最多 2 轮就能办完，而不是 5 轮。

**为什么是「受控并发」而不是「全部一股脑并发」？**

- 全并发（12 味药同时打 12 个 LLM 请求）会瞬间打爆 DeepSeek 的速率限制（rate limit），还可能被限流导致整体更慢甚至报错。
- 用固定 3 个并发，既快又稳，不会触发限流。

**收益**：5 味药 / 3 并发 ≈ 2 轮 × 2 秒 ≈ **4 秒**，而不是 5 × 2 = 10 秒。

---

## 6. P1 优化三：extractKeywords 去 LLM 化

前面两步已经解决了「元凶」。这一步步更激进：**把流水线里另一处 LLM 调用（① extractKeywords）整个去掉，换成本地计算。**

### 6.1 为什么能去掉 LLM？

`extractKeywords` 原来的职责是「让 LLM 从问题里抽出关键词（药名、证型、功效术语）」。但仔细想想：

- **药名/方剂名的字面匹配** → 用 `n-gram` 本地切词就够了（下面解释）；
- **证型 ↔ 功效的语义匹配** → 上一期已经交给**向量检索**（第 ③ 步）了，不靠 extractKeywords。

也就是说，extractKeywords 里「让 LLM 理解语义」的那部分活，已经有人（向量检索）接管了。剩下需要的只是「把问题里的中文词切出来」，这根本不需要 LLM。

### 6.2 n-gram 是什么？

n-gram 就是「**滑动窗口切词**」：用 2 到 6 字宽的窗口，在句子上从左往右滑，把每个窗口里的片段都当成一个候选词。

问题「人参有什么功效」，宽度为 2 的窗口会切出：

```
人参 | 参有 | 有什 | 什么 | 么功 | 功效
```

宽度 3 切出：`人参有 | 参有什 | 有什么 | 什么功 | 么功效`……以此类推。再过滤掉非中文、停用词（的、是、什么等），就得到一篮子候选词。

### 6.3 优化后的代码

```js
async extractKeywords(question) {
  // 本地 n-gram 提取（不再调用 LLM，省一次网络往返）
  if (!question) return [];
  const keywords = new Set();
  for (let i = 0; i < question.length; i++) {
    for (let len = 2; len <= Math.min(6, question.length - i); len++) {
      const frag = question.substring(i, i + len);
      // 只保留纯中文且非停用词的片段
      if (/^[一-鿿]+$/.test(frag) && !STOP_WORDS.has(frag)) {
        keywords.add(frag);
      }
    }
  }
  return [...keywords].slice(0, 40);   // 限制数量，避免超长问题生成过多搜索词
}
```

> 💡 为什么从 2 字开始？因为很多常见药名是 2 个字（人参、黄芪、当归、山药……），从 3 字开始会漏掉它们。这就是「**包含 2 字药名**」这个细节的意义。

**收益**：每次问答省掉 1 次 LLM 调用（~2 秒），而且结果是**确定的**（同样的输入永远得到同样的输出），不再有 LLM 返回格式不稳、需要 `JSON.parse` 容错的问题。

---

## 7. P1 优化四：流式端点也接入向量检索

**文件**：[backend/src/routes/ai-engine.js](../backend/src/routes/ai-engine.js)

系统有两个问答端点：

- `/rag`（非流式）：完整走 7 步，慢，但检索最全；
- `/rag-stream`（流式）：为了快，**跳过**了 `extractKeywords` 和 `enrichHerbDetails`，只调 1 次 LLM，但之前**没接向量检索**，导致它漏掉「肾虚 → 补肾阳」这类语义命中。

这次把向量检索补进流式端点，让它「又快又准」：

```js
// 步骤2.5：向量检索补充（与非流式 /rag 一致，弥补 CONTAINS 字面匹配的语义缺口）
if (embeddingService.isReady()) {
  try {
    const semHits = await embeddingService.search(trimmedQuestion, 10);
    const existingNames = new Set(searchResults.herbs.map(h => h.name));
    const newNames = semHits.map(s => s.name).filter(n => n && !existingNames.has(n));
    if (newNames.length > 0) {
      const semanticHerbs = await ragServiceV2.searchNeo4jByNames(newNames);
      const semNames = new Set(semanticHerbs.map(h => h.name));
      searchResults.herbs = semanticHerbs.concat(searchResults.herbs.filter(h => !semNames.has(h.name)));
    }
  } catch (e) {
    console.warn("[AI-Engine] 流式向量检索补充失败:", e.message);
  }
}
```

要点：

- 向量检索返回的药材名，先和已有结果**去重**，只补新的，避免重复；
- 新药材用 `searchNeo4jByNames` 补全 Neo4j 字段后，**插到列表最前面**（相关度高的在前）；
- 整个块包在 `try/catch` 里，向量检索挂了也不影响主流程（**降级兜底**）。

---

## 8. 优化前后对比

以「肾虚可以吃什么中药调理？」（命中约 12 味药材）为例：

| 指标 | 优化前 | 优化后 | 变化 |
| --- | --- | --- | --- |
| LLM 调用总次数 | 14 次 | 3 次（5 补全 + 1 回答） | ↓ 79% |
| extractKeywords | 1 次 LLM（~2s） | 0 次（本地 n-gram） | 省 1 次 |
| enrichHerbDetails | 12 次串行（~24s） | 5 次 / 3 并发（~4s） | ↓ 20s |
| 总耗时 | **~37 秒** | **~12-15 秒** | **↓ 60%+** |

> 数字是估算值，真实耗时受网络、DeepSeek 响应速度影响，但量级是准的：**最大头的 24 秒被砍掉了。**

---

## 9. 怎么上线验证

改动都在**后端 Node 服务**里（`ragServiceV2.js`、`ai-engine.js`），不会热更新，必须**重启后端**才生效。

验证清单：

1. 重启后端；
2. 问一次「肾虚可以吃什么中药调理？」—— 观察耗时是否明显下降；
3. 后端日志里应能看到新日志：`补全 5 / 12 味（并发 3）`（数字按实际命中数变）；
4. 问几个简单问题（「人参有什么功效？」）确认原有功能正常、没报错；
5. 前端清一下浏览器缓存（`qa.js` 版本号已升到 `?v=20260817ai`）。

---

## 10. 一个需要留意的行为变化

`extractKeywords` 从「LLM 抽取」改成「n-gram 本地切词」后，有一个**可预期的行为差异**：

- 以前 LLM 能识别「肾虚」是「证型」、「补肾阳」是「功效」，并把这类**语义词**也放进关键词列表去 `searchNeo4j` 做字面匹配；
- 现在 n-gram 只负责切「字面词」，**「证型 ↔ 功效」的语义匹配完全交给向量检索**。

所以「肾虚 → 虫草/山药/肉苁蓉」这类语义命中的效果**不受影响**（靠向量检索），只是那部分语义词不再进入 `searchNeo4j` 的字面匹配。若后续发现某个场景确实需要「证型词也走字面匹配」，可以再加一层小的证型词典，属于增量增强，不影响现有逻辑。

---

## 11. 还能继续优化吗？（下一阶段方向）

如果还要更快，按优先级可以继续：

1. **向量检索结果也复用缓存**：目前向量检索每次现算，可以对相同 query 缓存结果（与 `CACHE_VERSION` 同样的失效策略）。
2. **enrichHerbDetails 结果预热**：275 味常用药材的补全结果可以离线跑一遍、存进 SQLite，运行时直接读，把 LLM 补全彻底移出请求链路。
3. **流式端点作为默认**：把前端默认切成流式（`/rag-stream`），第一段回答几秒内就能先到，剩余慢慢补。
4. **DeepSeek 参数调优**：降低 `max_tokens`、用更短的补全 prompt，进一步压缩单次 LLM 耗时。

---

## 12. 本文核心结论

1. **先测后改**：37 秒里有 24 秒在 `enrichHerbDetails`，其它步骤都是小头，别一上来乱优化。
2. **两个杠杆**：优化 LLM 问答 = 「少调 LLM」+「并行调 LLM」。
3. **上限 + 并发**：P0 用 `ENRICH_HERB_LIMIT=5` 和 `ENRICH_CONCURRENCY=3` 把元凶从 24 秒砍到 4 秒。
4. **去 LLM 化**：能本地算的（关键词切词）就别让 LLM 算，语义匹配交给向量检索。
5. **兜底降级**：所有新增的向量检索都包在 `try/catch` 里，挂了不影响原有功能。
