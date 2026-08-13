# 神农AI — 6合1 AI 引擎架构升级文档

> **版本**: 2.0.0 | **日期**: 2026-08-10 | **架构**: 方案 B（后端代理 Neo4j）

## 一、架构全景

用户浏览器 → Express.js(:3001) → Neo4j AuraDB / DeepSeek API

### 已实现功能 (6合1引擎)

| # | 端点 | 功能 | 状态 |
|---|------|------|:--:|
| 1 | GET /api/ai-engine/health | 引擎健康检查 | ✅ |
| 2 | GET /api/ai-engine/status | 引擎详细状态 | ✅ |
| 3 | POST /api/ai-engine/rag | GraphRAG 智能问答 | ✅ |
| 4 | POST /api/ai-engine/rag-stream | RAG 流式问答(SSE) | ✅ |
| 5 | POST /api/ai-engine/compatibility | 配伍冲突检测 | ✅ |
| 6 | POST /api/ai-engine/extract | 古籍知识抽取 | ✅ |

### AI Gateway

| 端点 | 功能 | 状态 |
|------|------|:--:|
| POST /api/ai-gateway/qa-chat | 公共智能问答(SSE流式) | ✅ |
| POST /api/ai-gateway/chat | 登录用户问答 | ✅ |

## 二、RAG 智能问答 (P0 系统亮点)

技术栈: LangChain.js + Neo4j GraphRAG + DeepSeek-V3

双重检索模式:
1. GraphCypherQAChain: LLM 自动将自然语言转为 Cypher
2. 手动增强检索: 关键词提取 -> Cypher 全文检索 -> 1-2跳图遍历 -> 上下文构建 -> LLM生成

检索流程:
  用户问题 -> Neo4j 模糊搜索药材/方剂
           -> 命中节点做 1-2 跳图遍历(HAS_PROPERTY, MERIDIAN_AFFINITY, CONTAINS_HERB)
           -> 构建结构化上下文
           -> DeepSeek-V3 生成答案(含引用来源)

关键文件:
  backend/src/services/ragServiceV2.js — RAG 核心服务
  backend/src/routes/ai-engine.js      — API 路由

## 三、配伍冲突检测 (P1 图推理)

双重检测:
1. 硬编码规则: data/compatibility_rules.json (27条十八反十九畏+别名映射)
2. 图推理: Neo4j 2跳查询检测间接冲突
   例: A反B, B与C同在一方剂中 -> A与C间接冲突

## 四、古籍知识抽取 (P2)

流程: 古籍文本 -> DeepSeek-V3 + Few-shot Prompt -> 三元组JSON -> Cypher写入Neo4j
支持实体: herb, formula, taste, nature, efficacy, meridian, disease

## 五、安全架构

- API Key: 仅在后端 .env，前端不可见
- Cypher 注入防护: 所有查询使用 $param 参数化
- Neo4j 凭据: 仅在 .env
- 请求限流: express-rate-limit
- Neo4j 保活: Free版每30分钟ping一次

## 六、Neo4j Schema

Labels: Herb, Formula, Category, Property, Meridian, Region, Efficacy
Relationships: BELONGS_TO_CATEGORY, HAS_PROPERTY, MERIDIAN_AFFINITY, FROM_REGION, HAS_EFFICACY, CONTAINS_HERB, COMPATIBILITY

## 七、依赖包

- langchain: ^1.5.5
- @langchain/openai: ^1.5.6
- @langchain/community: ^1.1.29
- neo4j-driver: ^6.2.0

## 八、项目文件结构

backend/
  .env                          # 环境变量
  data/compatibility_rules.json # 配伍规则
  src/
    app-simple.js               # Express 主入口
    config/neo4j-simple.js      # Neo4j 单例连接
    services/ragServiceV2.js    # RAG 服务
    routes/ai-engine.js         # 6合1 AI 引擎
    routes/ai-gateway.js        # AI 网关
    routes/knowledge-graph.js   # 知识图谱 API
    routes/herbs-manage.js      # 药材管理 API

---

> 文档撰写: Codex AI Agent | 最后更新: 2026-08-10
