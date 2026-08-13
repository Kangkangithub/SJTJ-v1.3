# 神农AI — 中医药知识图谱与 GraphRAG 智能问答系统

<div align="center">

![神农AI](favicon.svg)

**基于 Neo4j AuraDB 知识图谱的中医药数据可视化、药材管理与 GraphRAG 智能问答系统**

[项目简介](#-项目简介) · [核心功能](#-核心功能) · [AI 引擎](#-ai-引擎) · [快速开始](#-快速开始) · [环境变量](#-环境变量) · [API 接口](#-api-接口) · [项目结构](#-项目结构) · [Neo4j 数据模型](#-neo4j-数据模型) · [文档索引](#-文档索引)

</div>

---

## 📖 项目简介

神农AI是一个以 **Neo4j AuraDB 云图数据库**为知识底座的中医药系统。它在传统“知识图谱可视化”的基础上，新增了：

- 药材管理系统（增删查改）
- 药材详情与关联图谱展示
- GraphRAG 智能问答
- 配伍冲突检测
- 古籍知识自动抽取
- 对话历史记录

系统采用 **Node.js + Express** 后端统一代理数据，前端不直接连接 Neo4j，也不暴露任何密钥。

> 一句话理解：前端负责“看和问”，后端负责“查图 + 调 AI”，Neo4j 负责“真实知识”，DeepSeek 负责“自然语言理解与生成”。

---

## ✨ 核心功能

### 1. 知识图谱可视化

- 基于 D3.js 的中医药知识图谱
- 展示药材、分类、性味、归经、功效、产地等多维关系
- 节点点击查看详情
- 分类分布、归经分布、产地药材数量统计
- 中国地图视图：点击省份查看当地药材

### 2. 药材管理

- 顶部 Tab 切换：图谱浏览 / 药材管理
- 搜索、分页、新增、编辑、删除药材
- 表单下拉框数据全部来自 Neo4j
- 新增药材时，不存在的分类/产地等会通过 `MERGE` 自动创建
- 删除前有软确认，并检查是否被方剂引用

### 3. GraphRAG 智能问答

- 页面：`qa.html`
- 技术链：Neo4j → LangChain.js → GraphCypherQAChain/手动图检索 → DeepSeek-V3
- 支持药材功效、产地、用法、注意事项、方剂组成等问题
- 答案附带引用来源、可点击药材节点、D3 迷你知识图谱
- 展示完整 GraphRAG 检索过程

### 4. AI 引擎模块

在 `backend/src/routes/ai-engine.js` 中聚合了多个 AI 能力：

| 模块 | 说明 |
| --- | --- |
| RAG 智能问答 | GraphRAG 核心能力 |
| 流式问答 | SSE 流式返回答案 |
| 配伍冲突检测 | 十八反十九畏 + Neo4j 图推理 |
| 古籍知识抽取 | 从古籍文本中抽取三元组并写入 Neo4j |
| 药材知识增强 | 调用 DeepSeek 补全现代药理、临床应用等 |
| 药材详情图谱 | 返回单味药材及其 1-2 跳图关系 |

### 5. 对话历史

- 对话记录存储在 SQLite
- 支持创建、切换、删除会话
- 一条会话对应一组问答消息

---

## 🧠 AI 引擎

### 整体架构

```
浏览器前端
   │
   │  HTTP /api/ai-engine/rag
   ▼
Node.js + Express 后端
   │
   ├── ragServiceV2.js（GraphRAG 核心）
   │     ├── DeepSeek 关键词提取
   │     ├── Neo4j Cypher 图检索
   │     ├── 1-2 跳图遍历
   │     ├── LLM 知识增强
   │     ├── 上下文构建
   │     └── DeepSeek 答案生成
   │
   ├── neo4j-simple.js（Neo4j 单例连接）
   │
   ▼
Neo4j AuraDB 云图数据库
```

### GraphRAG 六步管线

```
用户问题
   ↓
① 关键词提取：LLM 分析问题，提取药材名、功效、症状、方剂等
   ↓
② Neo4j 图检索：Cypher 精确名称匹配，必要时扩展功效/描述/拼音
   ↓
③ 1-2 跳图遍历：沿关系边获取性味归经、功效、方剂、配伍禁忌
   ↓
④ LLM 知识增强：DeepSeek 补全现代药理、临床应用等深度知识
   ↓
⑤ 上下文构建：将图谱数据与增强知识格式化为结构化提示
   ↓
⑥ DeepSeek-V3 生成：基于增强上下文生成带引用来源的答案
```

详细教学请阅读：

- `docs/AI_ENGINE_RAG_TEACHING.md`

### GraphCypherQAChain 的角色

项目引入了 LangChain.js 的 `GraphCypherQAChain`，但由于 AuraDB Free 实例的路由表限制以及连接池统一管理需要，当前生产主路径使用更稳定的“手动增强图检索 + LLM 知识增强”模式。

两种模式分别是：

| 模式 | 流程 | 当前状态 |
| --- | --- | --- |
| GraphCypherQAChain | LLM 自动生成 Cypher → 执行 → LLM 回答 | 备用/技术展示 |
| 手动增强检索 | 关键词 → Cypher → 图遍历 → 知识增强 → 生成答案 | 当前主路径 |

---

## 🚀 快速开始

### 环境要求

- Node.js 18 或更高版本
- npm
- Neo4j AuraDB 云数据库
- DeepSeek API Key

### 1. 配置环境变量

进入 `backend` 目录，复制 `.env.example` 为 `.env`，并填写：

```env
NEO4J_URI=neo4j+s://your-database.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD_HERE

DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE

PORT=3001
NODE_ENV=development
```

> 注意：`.env` 不应提交到 Git，也不要在 README 或前端代码中写真实密码。

### 2. 安装依赖

```bash
cd backend
npm install
```

### 3. 启动后端

```bash
npm run dev
```

或：

```bash
npm start
```

服务默认运行在：

```
http://localhost:3001
```

### 4. 打开页面

| 页面 | 地址 |
| --- | --- |
| 知识图谱可视化 | `http://localhost:3001/knowledge-graph.html` |
| GraphRAG 智能问答 | `http://localhost:3001/qa.html` |
| 系统首页 | `http://localhost:3001/index.html` |

---

## 🤝 给同学运行（多人协作）

如果你要把项目分享给同学，让她在另一台电脑运行，请使用下面的方式，**不要**把真实密钥提交到 Git。

### 正确做法：私聊发送 `.env`

1. 你把本机这个文件通过微信、QQ、飞书、钉钉或加密邮件发给对方：

```text
backend\.env
```

2. 对方 `git pull` 或拿到项目后，把这个文件放进她本机的：

```text
D:\K3\SJTJ-v1.3\backend\.env
```

3. 然后运行：

```bash
cd backend
npm install
npm run dev
```

4. 浏览器访问：

```text
http://localhost:3001
```

### 注意

- `backend/.env` 已被 Git 忽略，正常情况下不会提交到仓库
- 如果只是临时共用一个 Neo4j AuraDB，发送 `.env` 是最简单的方式
- 不要把 `.env` 发到公开仓库、群里或截图到公网
- 如果 `.env` 中包含 DeepSeek API Key，建议让对方优先换成自己的 Key

---

## 🔐 环境变量

后端从 `backend/.env` 读取配置：

| 变量 | 说明 |
| --- | --- |
| `NEO4J_URI` | Neo4j AuraDB 连接地址 |
| `NEO4J_USERNAME` | Neo4j 用户名 |
| `NEO4J_PASSWORD` | Neo4j 密码 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key |
| `PORT` | 后端端口，默认 3001 |
| `NODE_ENV` | 运行环境，`development` 或 `production` |
| `SQLITE_PATH` | SQLite 数据库路径 |

---

## 📡 API 接口

### 核心 API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api` | API 总览 |
| `POST` | `/api/auth/login` | 用户登录 |
| `POST` | `/api/auth/register` | 用户注册 |
| `GET` | `/api/auth/profile` | 获取个人资料 |
| `GET` | `/api/herbs` | 获取药材列表 |
| `GET` | `/api/herbs/search?q=` | 搜索药材 |
| `GET` | `/api/herbs/:id` | 获取药材详情 |
| `GET` | `/api/herb-categories` | 药材分类 |
| `GET` | `/api/herb-regions` | 药材产地 |
| `GET` | `/api/herb-sources` | 药材来源 |
| `GET` | `/api/formulas` | 方剂列表 |
| `GET` | `/api/formulas/:id` | 方剂详情 |

### 药材管理 API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/api/herbs-manage/dropdowns` | 获取下拉框动态选项 |
| `GET` | `/api/herbs-manage` | 药材分页列表 |
| `GET` | `/api/herbs-manage/:name` | 获取单个药材 |
| `POST` | `/api/herbs-manage` | 新增药材 |
| `PUT` | `/api/herbs-manage/:name` | 修改药材 |
| `DELETE` | `/api/herbs-manage/:name` | 删除药材 |
| `GET` | `/api/herbs-manage/:name/graph` | 获取药材关联图谱 |

### 知识图谱 API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/api/knowledge/graph-data` | 图谱节点和边数据 |
| `GET` | `/api/knowledge/herb-details/:name` | 单味药材详情 |
| `GET` | `/api/knowledge/region-distribution` | 产地药材数量分布 |

### AI 引擎 API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `POST` | `/api/ai-engine/rag` | GraphRAG 智能问答 |
| `POST` | `/api/ai-engine/rag-stream` | RAG 流式问答 |
| `POST` | `/api/ai-engine/compatibility` | 配伍冲突检测 |
| `POST` | `/api/ai-engine/extract` | 古籍知识抽取 |
| `POST` | `/api/ai-engine/herb-enrich` | 单味药材知识增强 |
| `GET` | `/api/ai-engine/herb-detail/:name` | 药材详情 + 关联图谱 |
| `GET` | `/api/ai-engine/health` | AI 引擎健康检查 |
| `GET` | `/api/ai-engine/status` | AI 引擎状态 |

### 对话历史 API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/api/conversations` | 获取会话列表 |
| `POST` | `/api/conversations` | 创建会话 |
| `GET` | `/api/conversations/:id` | 获取单个会话 |
| `POST` | `/api/conversations/:id/messages` | 向会话添加消息 |
| `PUT` | `/api/conversations/:id` | 修改会话 |
| `DELETE` | `/api/conversations/:id` | 删除会话 |

---

## 🗂️ 项目结构

```text
D:\K3\SJTJ-v1.3
├─ knowledge-graph.html        # 知识图谱可视化 + 药材管理 Tab
├─ qa.html                     # GraphRAG 智能问答页面
├─ index.html                  # 系统首页
├─ login.html                  # 登录页面
├─ register.html               # 注册页面
├─ profile.html                # 个人中心
│
├─ scripts
│  ├─ knowledge-graph.js       # 知识图谱前端逻辑
│  ├─ knowledge-graph-analysis-fixed.js
│  ├─ herb-manage.js           # 药材管理前端逻辑
│  ├─ qa.js                    # GraphRAG 问答前端逻辑
│  └─ ...
│
├─ styles
│  └─ ...
│
├─ backend
│  ├─ .env                     # 密钥和数据库连接配置（不提交）
│  ├─ package.json
│  └─ src
│     ├─ app-simple.js         # 后端启动入口
│     ├─ config
│     │  ├─ index.js           # 环境配置
│     │  ├─ neo4j-simple.js    # Neo4j 单例连接
│     │  └─ database-simple.js # SQLite 连接
│     ├─ routes
│     │  ├─ ai-engine.js       # AI 引擎路由
│     │  ├─ ai-gateway.js      # AI 网关路由
│     │  ├─ knowledge-graph.js # 知识图谱 API
│     │  ├─ herbs.js           # 药材 API
│     │  ├─ herbs-manage.js    # 药材管理 API
│     │  ├─ conversations.js   # 对话历史 API
│     │  └─ ...
│     └─ services
│        ├─ ragServiceV2.js    # GraphRAG 核心服务
│        ├─ ragService.js      # 早期 RAG 服务
│        ├─ knowledgeGraphService.js
│        └─ ...
│
├─ docs
│  ├─ AI_ENGINE_RAG_TEACHING.md # AI 引擎改造教学文档
│  └─ ...
│
├─ data
│  └─ compatibility_rules.json  # 十八反十九畏规则
│
└─ README.md                   # 本文档
```

---

## 🧩 Neo4j 数据模型

### 节点类型

| 节点 Label | 说明 |
| --- | --- |
| `Herb` | 药材 |
| `Category` | 分类 |
| `Region` | 产地 |
| `Property` | 性味 |
| `Meridian` | 归经 |
| `Efficacy` | 功效 |
| `Formula` | 方剂 |

### 关系类型

| 关系 | 说明 |
| --- | --- |
| `BELONGS_TO_CATEGORY` | 药材 → 分类 |
| `FROM_REGION` | 药材 → 产地 |
| `HAS_PROPERTY` | 药材 → 性味 |
| `MERIDIAN_AFFINITY` | 药材 → 归经 |
| `HAS_EFFICACY` | 药材 → 功效 |
| `CONTAINS_HERB` | 方剂 → 药材 |
| `COMPATIBILITY` | 药材 → 药材（配伍冲突） |

### 药材节点常用属性

```text
name           药材名
pinyin         拼音
latin_name     拉丁名
description    描述
efficacy       功效
usage_dosage   用法用量
caution        注意事项
is_common      是否常用
alias          别名
quality        品质
```

---

## 🧠 AI 问答示例

### 输入

```json
{
  "question": "人参有什么功效？"
}
```

### 后端处理

1. DeepSeek 提取关键词：`["人参", "补气", "气虚"]`
2. Neo4j 精确匹配到 `人参` 节点
3. 图遍历获取性味、归经、功效、相关方剂
4. DeepSeek 对人参进行知识增强
5. 构建上下文
6. DeepSeek 生成带参考来源的答案

### 返回结构

```json
{
  "success": true,
  "data": {
    "question": "人参有什么功效？",
    "answer": "……",
    "mode": "manual-enhanced",
    "sources": ["人参"],
    "formulas": ["四君子汤"],
    "cypher": null,
    "fromCache": false
  }
}
```

---

## 🔒 安全设计

- Neo4j 密码、DeepSeek API Key 只存在于 `backend/.env`
- 前端只通过 Express API 访问数据
- 所有 Cypher 查询均使用参数化，防止注入
- 删除药材前进行前端确认和后端引用检查
- AuraDB Free 版每 30 分钟自动 ping，防止 3 天无活动休眠

---

## 📚 文档索引

| 文档 | 说明 |
| --- | --- |
| `README.md` | 项目总览 |
| `docs/AI_ENGINE_RAG_TEACHING.md` | GraphRAG 智能问答改造教学 |
| `backend/API.md` | 后端 API 详细说明 |
| `NEO4J_MIGRATION.md` | Neo4j AuraDB 迁移说明 |
| `NEO4J_AURADB_MIGRATION.md` | AuraDB 迁移补充说明 |
| `AI-ENGINE-ARCHITECTURE.md` | AI 引擎架构说明 |
| `CHANGELOG.md` | 更新日志 |

---

## 📝 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | HTML、CSS、JavaScript、D3.js、ECharts |
| 后端 | Node.js、Express |
| 图数据库 | Neo4j AuraDB |
| 图驱动 | `neo4j-driver` |
| AI 框架 | LangChain.js |
| LLM | DeepSeek-V3（`deepseek-chat`） |
| 关系型数据库 | SQLite（用户、认证、对话历史） |

---

## ✅ 常见问题

### 1. 为什么前端不直接连接 Neo4j？

直连会把数据库密码暴露在浏览器里。当前采用后端代理，密码只保存在 `.env`。

### 2. GraphRAG 和普通大模型问答有什么区别？

GraphRAG 会先从 Neo4j 检索真实图数据，再交给 DeepSeek 生成答案，答案可溯源、更可靠。

### 3. 问症状类问题能查图吗？

可以。系统会先用 DeepSeek 提取关键词，再执行 Cypher 精确/模糊匹配；如果图中无匹配，则降级为 DeepSeek 直接回答。

### 4. 为什么重复提问返回很快？

系统有 5 分钟答案缓存。修改检索逻辑后需要更新 `CACHE_VERSION` 或清除缓存。

---

<div align="center">

**神农AI — 让中医药知识可看、可查、可问、可推理**

</div>
