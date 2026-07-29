# 神农AI 药材知识库系统 - 改造清单

---

## 一、已完成修改（A - 全栈工程师）

### 1. 数据库改造

| 文件 | 改动 |
|------|------|
| `backend/src/config/database-simple.js` | 武器 Schema → 药材 Schema（13 张表：herbs, herb_categories, herb_regions, herb_sources, properties, meridians, efficacies, herb_properties, herb_meridians, herb_efficacies, formulas, formula_herbs, compatibility_rules） |
| `backend/data/herb-knowledge.db` | 230 味药材 + 18 首方剂 + 性味归经功效关联（已去重） |
| `backend/scripts/init-herb-data.js` | **新增** 药材初始化脚本（含管理员用户创建） |
| `backend/.env` | 数据库路径改为 herb-knowledge.db，旧配置注释 |
| `backend/src/config/index.js` | 添加 sqlite.path 配置项 |

### 2. API 路由（武器 → 药材）

| 原文件 | 新文件 |
|--------|--------|
| `routes/weapons-simple.js` | `routes/herbs.js`（CRUD + 搜索 + 统计 + 验证） |
| `routes/weapon-types.js` | `routes/herb-categories.js` |
| `routes/weapon-countries.js` | `routes/herb-regions.js` |
| `routes/manufacturers.js` | `routes/herb-sources.js` |
| `routes/weapon-images.js` | `routes/herb-images.js` |
| `routes/knowledge-graph.js` | 查询逻辑武器→药材（337节点，1751连线） |
| — | `routes/formulas.js` **新增** |
| — | `routes/ai-gateway.js` **新增**（Deepseek + Python代理 + 配伍检查） |
| — | `routes/mock.js` **新增**（前端Mock数据） |
| — | `services/ragService.js` **新增**（RAG问答编排） |

### 3. 系统配置

| 文件 | 改动 |
|------|------|
| `backend/src/app-simple.js` | 路由注册改为药材系统 + 缓存中间件 + API根路径更新 |
| `backend/src/app.js` | 同步更新 |
| `start-simple-server.js` | 修复文件检查 + 启动信息更新 |
| `backend/package.json` | 添加 `init-herb-db` 脚本 |
| `backend/src/services/userService-simple.js` | 修复硬编码的旧数据库路径 |

### 4. 清理删除

| 文件/目录 | 说明 |
|-----------|------|
| `backend/src/routes/weapon-*.js` (9个) | 旧武器路由 |
| `backend/src/routes/manufacturer*.js` (2个) | 旧制造商路由 |
| `backend/scripts/init-database.js` 等 (13个) | 旧武器脚本 |
| `backend/app.py`, `api.py`, `config.py` 等 | Python Flask 旧骨架 |
| `backend/models/`, `backend/routes/`, `backend/services/`, `backend/utils/` | Python 旧目录 |
| `api.py`, `best.pt` (根目录) | Python 武器识别 |
| `scripts/* (2).js` (8个) | 编辑器重复文件 |
| `styles/* (2).css` (9个) | 编辑器重复文件 |
| `backend/data/military-knowledge.db` | 旧武器数据库 |

### 5. 安全与版本控制

| 操作 | 说明 |
|------|------|
| 创建 `.gitignore` | 排除 node_modules、.env、*.db、logs、uploads |
| `git rm --cached backend/.env` | 解绑 .env（API key 不再跟踪） |
| `git branch archive/weapon-version` | 存档旧武器版本分支 |

### 6. 优化改进

| 改进 | 说明 |
|------|------|
| 输入验证 | Joi schema + 存在性检查（分类/产地/来源 ID 必须真实存在） |
| 搜索优化 | 加权排序（名称精确匹配 > 别名 > 拼音 > 功效描述） |
| 缓存 | 知识图谱 1h / 统计 10min / 参考数据 1h，写操作自动清缓存 |
| API 文档 | `backend/API.md`，分 B（前端）和 C（Python）两部分 |

### 7. 新增 API 端点一览

```
GET    /api/herbs[/:id]             药材 CRUD + 搜索 + 统计
POST   /api/herbs                    创建药材（需登录）
PUT    /api/herbs/:id                更新药材（需登录）
DELETE /api/herbs/:id                删除药材（需登录）

GET    /api/herb-categories[/:id]   分类管理
GET    /api/herb-regions[/:id]      产地管理
GET    /api/herb-sources[/:id]      基源管理

POST   /api/herb-images/:herbId     图片上传（需登录）
DELETE /api/herb-images/:herbId/:imageId 删除图片（需登录）

GET    /api/formulas[/:id]          方剂管理（含组成药材）
POST   /api/formulas                创建方剂（需登录）

GET    /api/knowledge/graph-data    知识图谱数据
GET    /api/knowledge/herb-details/:name  药材详情
GET    /api/knowledge/region-distribution 地区分布

POST   /api/ai-gateway/chat          AI 问答（需登录）
POST   /api/ai-gateway/analyze-herb  药材分析（需登录）
POST   /api/ai-gateway/check-compatibility 配伍检查（需登录）
POST   /api/ai-gateway/python-proxy  转发到 Python 服务（需登录）
GET    /api/ai-gateway/health        AI 服务状态

GET    /api/mock/*                   前端 Mock 数据

POST   /api/auth/login               登录
POST   /api/cache/clear              清缓存（管理员）
```

---

## 二、待办事项（B / C 负责）

### B - 前端开发

| 优先级 | 任务 | 涉及文件 | 说明 |
|--------|------|----------|------|
| 🔴 | 所有 HTML 页面中的 API 地址替换 | `*.html` | `/api/weapons` → `/api/herbs` 等 |
| 🔴 | 知识图谱交互优化 | `scripts/knowledge-graph.js` | 布局散开、节点颜色、箭头连线目前较乱 |
| 🔴 | 搜索功能适配 | `scripts/knowledge-graph.js` (搜索部分) | 调用 `/api/herbs/search` 而非旧接口 |
| 🟡 | 数据管理面板改造 | `scripts/knowledge-graph.js` (数据管理部分) | 武器CRUD界面 → 药材CRUD界面 |
| 🟡 | 移除武器残留 JS | `scripts/weapon-*.js` (6个) | 不再被引用的旧武器脚本 |
| 🟡 | 移除备份文件 | `scripts/` 和 `styles/` 下重复文件 | 清理干净目录 |
| 🟢 | 页面标题/文字更新 | `*.html` | "武器" → "药材" 等文字替换 |
| 🟢 | 知识图谱前端去重 | `scripts/knowledge-graph-analysis-fixed.js` | 3秒轮询已改30秒，但还可优化 |

### C - Python AI 服务

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 | 实现 AI 服务接口 | `GET /health`, `POST /analyze`, `POST /compatibility` |
| 🔴 | 与后端联调 | 设置 `AI_SERVICE_URL` 指向 C 的服务地址 |
| 🟡 | 药材图片识别 | 改造旧 `best.pt` 模型为药材识别 |
| 🟢 | 部署文档 | 对接入方式文档化 |

### A（可选）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🟢 | 更换 Deepseek API Key | 旧 key 已在 git 历史暴露，需去后台换新 |

---

## 三、启动方式

```bash
# 后端启动
cd backend
npm install
npm run init-herb-db     # 首次初始化数据库
npm run dev              # 开发模式启动（端口 3001）

# 或使用启动脚本
node start-simple-server.js
```

**管理员账号**: `JunkangShen` / `kk20050318`
