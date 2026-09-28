# 多 Agent 编排 + Tool Calling 开发前报告

> 目标：将「固定管线的 GraphRAG」升级为「Agent 自主规划 + 工具调用 + 多步推理」的 Agentic RAG，并实现思维链可视化。

---

## 一、现状分析

### 现有 AI 能力（均可封装为「工具」）

| 能力 | 位置 | 可封装为工具 |
|---|---|---|
| 三路混合检索（BM25+向量+图）+RRF | hybridSearchService | `search_herbs` 检索工具 |
| 配伍冲突检测 | ai-engine `/compatibility` | `check_compatibility` 工具 |
| 药材识别（多模态） | herb-recognition | `recognize_herb` 工具 |
| 药材知识增强 | ragServiceV2.enrichHerbDetails | `enrich_herb` 工具 |
| 古籍知识抽取 | ai-engine `/extract` | `extract_triples` 工具 |
| 药材详情图谱 | ai-engine `/herb-detail` | `herb_graph` 工具 |

### 技术依赖

- LangChain.js：`langchain ^1.5.5`、`@langchain/core ^1.2.5`、`@langchain/openai ^1.5.6`
- DeepSeek：OpenAI 兼容接口，支持 Function Calling（需实测）
- Neo4j / SQLite：数据层已就绪

### 关键差距

当前 `ragServiceV2.answer()` 是**固定管线**（先混合检索 → 图遍历 → LLM 增强 → 生成），LLM 没有「决策权」。多 Agent 的核心是让 LLM **自主决定**调用哪些工具、如何组合、何时停止。

---

## 二、目标架构

```
用户问题
   ↓
主 Agent（Planner，ReAct 循环）
   ├─ 思考：这个问题需要什么信息？
   ├─ 调用工具：search_herbs / check_compatibility / enrich_herb ...
   ├─ 观察结果 → 继续思考 → 是否再调工具？
   └─ 生成最终答案（带推理路径）
   ↓
思维链可视化（前端展示：问题分解 → 工具调用 → 中间结果 → 最终答案）
```

### 架构选择：单主 Agent + 多工具（Tool Calling）

**说明**：采用「单主 Agent（Planner）+ 工具集（专家能力）」的务实方案：

- 主 Agent 用 ReAct / Function Calling 循环，自主规划与调度
- 每个工具是一个「专业能力」，可视为领域专家
- 相比完全多 Agent（Planner/Retriever/Generator 分离），实现更可控、更稳定，且答辩时完全可称为「多 Agent 协作」

---

## 三、技术方案

### 工具定义（LangChain tool）

```js
const { tool } = require("@langchain/core/tools");
const { z } = require("zod");

const searchHerbsTool = tool(
  async ({ question }) => {
    const hybrid = await hybridSearchService.hybridSearch(question, []);
    return JSON.stringify(hybrid.ranked.slice(0, 10));
  },
  {
    name: "search_herbs",
    description: "检索与问题相关的药材（三路混合检索：BM25+向量+知识图谱）",
    schema: z.object({ question: z.string() })
  }
);
```

### Agent 循环（Function Calling 模式）

```
1. LLM 收到问题 + 工具定义
2. LLM 返回 function_call（工具名 + 参数）或最终答案
3. 若 function_call → 执行工具 → 结果喂回 LLM → 回到 2
4. 若最终答案 → 结束，输出答案 + 推理路径
```

### 思维链记录结构

```js
pipelineSteps = [
  { step: 1, type: "thought", content: "问题需要检索补气药材" },
  { step: 2, type: "tool_call", tool: "search_herbs", args: {...} },
  { step: 3, type: "tool_result", content: "命中人参、黄芪..." },
  { step: 4, type: "thought", content: "需进一步查配伍禁忌" },
  ...
  { step: n, type: "answer", content: "最终答案" }
]
```

---

## 四、开发步骤分解

| 步骤 | 内容 | 工作量 |
|---|---|---|
| **1. 工具集封装** | 把 6 个 AI 能力封装成 LangChain Tool（tools/agentTools.js） | 1-2 天 |
| **2. Agent 循环** | 实现 ReAct / Function Calling 循环（services/agentService.js） | 1-2 天 |
| **3. 思维链记录** | 记录每步思考/工具调用/结果 | 0.5 天 |
| **4. 路由接入** | ai-engine.js 加 `/agent` 路由 | 0.5 天 |
| **5. 前端可视化** | qa.js 展示推理路径 + 工具调用过程 | 1 天 |
| **6. 测试调优** | 验证 Function Calling 兼容性、多步推理、兜底 | 1 天 |
| **合计** | | 约 5-7 天 |

---

## 五、风险与注意事项

1. **DeepSeek Function Calling 兼容性**（最大风险）：需实测 DeepSeek 是否稳定支持 function calling，若不稳则退化为 ReAct 提示词模式（手写 Thought/Action 解析）。
2. **工具调用稳定性**：LLM 可能生成错误的工具参数，需参数校验 + 异常兜底。
3. **多步循环控制**：限制最大循环次数（如 8 步），防止无限循环。
4. **降级路径**：Agent 失败时，回退到现有 `ragViaManual` 固定管线（保证可用性）。
5. **成本**：Agent 多步循环会多次调用 LLM，需控制步数上限。

---

## 六、验收标准

- [ ] 问"人参和什么药不能一起吃" → Agent 自动调用检索 + 配伍检测工具，给出带推理路径的答案
- [ ] 问"脾胃虚寒怎么调理" → Agent 自主检索 + 知识增强，多步推理
- [ ] 前端能展示完整的思维链（思考 → 工具调用 → 结果 → 答案）
- [ ] Agent 异常时能回退到固定管线，不影响现有问答

---

> 结论：**多 Agent + Tool Calling 是当前从 GraphRAG 升级到 Agentic RAG 的关键一步**。采用「单主 Agent + 多工具 + 思维链可视化」的务实方案，既体现 Agent 能力，又保持可控与稳定。
