# Neo4j AuraDB 迁移文档

## 概述

将知识图谱数据源从 SQLite（通过 API）迁移到 Neo4j AuraDB 云数据库，同时新增「药材管理系统」模块（增删查改）。

## 架构变更

### 旧架构（SQLite）
```
浏览器 → fetch('/api/xxx') → Express.js → SQLite (herb-knowledge.db)
```

### 新架构（Neo4j AuraDB + 后端代理）
```
浏览器 → fetch('/api/xxx') → Express.js → neo4j-driver → Neo4j AuraDB
                                              ├─ /api/knowledge/graph-data  ← 知识图谱数据
                                              ├─ /api/herbs-manage/*        ← 药材管理 CRUD（新增）
                                              └─ /api/qa                    ← RAG 智能问答（预留）
```

### 设计决策：方案 B（后端代理 Neo4j）
- 密码仅存在于后端 `.env`，前端完全看不到
- 原有 API 契约不变，前端 JS 改动最小
- 为后续 RAG（LangChain.js + GraphCypherQAChain + DeepSeek）预留最短集成路径
- `neo4j-driver` 实例单例共享，知识图谱 API 和药材管理 API 复用同一连接

---

## 文件变更清单

### 新增文件（3个）

| 文件 | 说明 |
|------|------|
| `backend/src/routes/herbs-manage.js` | 药材管理 CRUD 路由（6个端点） |
| `styles/herb-manage.css` | 药材管理面板样式 |
| `scripts/herb-manage.js` | 药材管理前端交互逻辑 |

### 修改文件（5个）

| 文件 | 变更内容 |
|------|----------|
| `backend/src/app-simple.js` | ① 引入 `herbs-manage` 路由 ② 挂载到 `/api/herbs-manage` |
| `knowledge-graph.html` | ① 引入 `herb-manage.css` ② 新增 Tab 栏（图谱浏览\|药材管理）③ 新增管理面板 HTML + 模态弹窗 ④ 引入 `herb-manage.js` |
| `scripts/knowledge-graph.js` | 将 `graphData` 暴露到 `window.graphData`（供图表分析使用） |
| `scripts/knowledge-graph-analysis-fixed.js` | ① 数据源从 SQLite `/api/herbs/statistics` 改为 Neo4j `/api/knowledge/graph-data` ② 新增节点类型分布、性味分布、归经分布三个图表 ③ 功效分布改用图谱数据 ④ `preprocessData` 从 links 统计性味/归经/功效 |
| `scripts/world-map-visualization.js` | 省份详情 API 从 SQLite `/api/herbs?region_id=X` 改为 Neo4j `/api/herbs-manage?region=NAME` |

### 未修改文件（保持原样）

| 文件 | 原因 |
|------|------|
| `scripts/knowledge-graph.js`（核心逻辑） | 图谱渲染逻辑不变，仅添加了 `window.graphData` 暴露 |
| `scripts/map-api-integration.js` | 地图 API 集成逻辑不变 |
| `backend/src/routes/knowledge-graph.js` | 图谱数据 API 已经是 Neo4j 版本 |
| `backend/src/config/neo4j-simple.js` | Neo4j 连接管理器不变（药材管理路由复用） |

---

## herbs-manage.js API 端点详情

| 方法 | 路径 | 用途 | Cypher 参数化 |
|------|------|------|:--:|
| GET | `/api/herbs-manage/dropdowns` | 返回所有下拉框数据（分类、产地、性味、归经、功效） | N/A |
| GET | `/api/herbs-manage` | 分页+搜索+筛选药材列表 | ✅ |
| GET | `/api/herbs-manage/:name` | 药材详情（含性味、归经、功效、方剂引用） | ✅ |
| POST | `/api/herbs-manage` | 新增药材（事务 + MERGE 关系节点） | ✅ |
| PUT | `/api/herbs-manage/:name` | 更新药材（删除旧关系 + 重建） | ✅ |
| DELETE | `/api/herbs-manage/:name` | 删除药材（先检查方剂引用） | ✅ |

### 下拉框数据源（来自 Neo4j）
| 下拉框 | Cypher 查询 |
|--------|------------|
| 分类 | `MATCH (c:Category) RETURN c.name` |
| 产地 | `MATCH (r:Region) RETURN r.name` |
| 性味(气) | `MATCH (p:Property {type:'qi'}) RETURN p.name` |
| 性味(味) | `MATCH (p:Property {type:'flavor'}) RETURN p.name` |
| 归经 | `MATCH (m:Meridian) RETURN m.name` |
| 功效 | `MATCH (e:Efficacy) RETURN e.name`（127条，前端搜索过滤） |

### MERGE 语义
- 新增药材时，如果输入了不存在的分类/产地/性味/归经/功效，后端自动 `MERGE` 创建对应节点
- 确保下拉框数据始终反映数据库最新状态

---

## 图谱页面功能变更

### Tab 栏切换
- **图谱浏览**：原有知识图谱可视化（D3.js）+ 中国地图（ECharts）+ 数据分析图表
- **药材管理**：药材列表（表格 + 分页 + 搜索筛选）+ 新增/编辑模态弹窗

### 图表修复
- 药材分类分布（饼图）✓
- 药材性味分布（柱状图）✓ 新增
- 药材归经分布（柱状图）✓ 新增
- 节点类型分布（柱状图）✓ 新增
- 主要功效分布（柱状图）✓ 从图谱数据计算
- 产地药材数量统计（柱状图）✓

### 地图省份详情修复
- 点击省份 → 通过 `/api/herbs-manage?region=NAME` 查询药材
- 药材详情通过 `/api/herbs-manage/:name` 获取
- 显示：药材总数、分类统计、常用药材标签、主要药材详情卡片

---

## Neo4j AuraDB 保活机制

已在 `app-simple.js` 启动时注册定时器：
- 间隔：30 分钟
- 执行：`RETURN 1` ping
- 防止 Free 版 3 天无活动自动休眠

---

## 安全性

- ✅ 所有 Cypher 查询使用 `$param` 参数化，防止注入
- ✅ 密码通过 `.env` 传入，不硬编码
- ✅ 删除操作：前端确认弹窗 + 后端检查方剂引用（被引用则拒绝）
- ✅ 药材名称唯一性检查（新增/改名时）

## 后续扩展：RAG 智能问答

当前架构已预留 RAG 集成路径：
```
用户浏览器 → Express.js → neo4j-driver → Neo4j AuraDB
                          ├─ /api/knowledge/graph-data
                          ├─ /api/herbs-manage/*
                          └─ /api/qa (待新增)
                                  ├─ GraphCypherQAChain (LangChain.js)
                                  └─ DeepSeek API
```
- RAG 模块直接复用 `neo4jManager.getDriver()` 实例
- 无需新建 Neo4j 连接
- 知识图谱 API 和 RAG 共享同一数据源
