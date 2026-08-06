# 神农AI - 中药药材知识图谱系统

<div align="center">

![神农AI](favicon.svg)

**一个基于知识图谱的现代化中药药材信息管理与可视化系统**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [系统架构](#-系统架构) • [API文档](#-api文档) • [B前端对接](#-b-前端对接) • [C-AI服务对接](#-c-python-ai-服务对接) • [部署指南](#-部署指南)

</div>

---

## 📖 项目简介

神农AI是一个现代化的中药药材知识图谱系统，集成了药材信息管理、知识图谱可视化、性味归经功效分析、产地地图展示等功能。系统采用前后端分离架构，提供直观的可视化界面和强大的数据管理能力，面向中医药学习者、研究者与教育工作者。

### 🎯 核心价值

- **知识图谱可视化**：直观展示药材间的关系网络（分类、性味、归经、功效）
- **性味归经体系**：完整的中药性味、归经、功效数据
- **产地地图**：中国地图展示药材产地分布
- **方剂知识**：经典方剂及其组成药材
- **智能搜索**：支持名称、拼音、别名、功效搜索
- **用户友好**：现代化UI设计，操作简单直观

---

## ✨ 功能特性

### 🗺️ 知识图谱可视化
- **交互式图谱**：基于D3.js的动态知识图谱展示
- **多维关系**：药材-分类-性味-归经-功效多层关系网络
- **常用药优先**：默认展示40+常用药材，点击"展开全部"查看275味全量
- **节点详情**：点击节点查看药材详情（含图片）
- **图谱分析**：分类/性味/归经/功效/产地五大数据分析图表

### 🗺️ 中国地图
- **产地分布**：中国地图展示各省份药材数量
- **省份详情**：点击省份查看该地产药材列表
- **常用药标注**：常用药材用⭐标记

### 🔍 智能搜索系统
- **全文搜索**：支持药材名称、拼音、别名、功效搜索
- **加权排序**：名称精确匹配 > 别名 > 拼音 > 功效描述
- **自动补全**：输入时实时提示匹配药材

### 📊 数据管理
- **药材信息**：275味药材完整数据（性味归经功效产地）
- **分类体系**：17类药材分类管理
- **方剂管理**：18首经典方剂及组成
- **批量导入**：支持药材数据批量导入脚本

### 🖼️ 多媒体管理
- **图片管理**：药材图片上传、展示、管理

### 👤 用户系统
- **用户认证**：登录注册、权限管理
- **角色控制**：管理员和普通用户权限分离

---

## 🚀 快速开始

### 环境要求
- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- SQLite3 数据库（无需单独安装服务）

### 启动方式
```bash
# 进入后端目录
cd backend

# 安装依赖（首次运行）
npm install

# 初始化药材数据库（首次运行，含275味药材+18方剂）
npm run init-herb-db

# 启动开发服务器
npm run dev
```

服务器将在 `http://localhost:3001` 启动，前端页面可通过浏览器访问。

## 👤 管理员账户

**用户名**: `JunkangShen`  
**密码**: `kk20050318`

管理员账户具有以下权限：
- 药材数据的增删改查
- 知识图谱数据管理
- 药材图片的上传与删除
- 方剂数据管理

### 快速验证

```bash
# 检查系统状态
curl http://localhost:3001/health

# 测试药材API
curl http://localhost:3001/api/herbs?limit=5

# 测试知识图谱
curl http://localhost:3001/api/knowledge/graph-data
```

---

## 🏗️ 系统架构

### 技术栈

#### 前端技术
- **HTML5/CSS3**: 现代化网页标准
- **JavaScript ES6+**: 原生JavaScript开发
- **D3.js**: 知识图谱可视化
- **Chart.js**: 数据统计分析图表
- **ECharts**: 中国地图渲染
- **Responsive Design**: 响应式布局

#### 后端技术
- **Node.js**: 服务器运行环境
- **Express.js**: Web应用框架
- **SQLite**: 轻量级数据库
- **Multer**: 文件上传处理
- **Helmet**: 安全中间件
- **JWT**: 用户认证

### 项目结构

```
神农AI/
├── 📁 backend/                    # 后端服务
│   ├── 📁 src/                    # 源代码
│   │   ├── 📁 routes/             # API路由（herbs, herb-categories, herb-regions, herb-sources, herb-images, formulas, knowledge-graph, ai-gateway, mock）
│   │   ├── 📁 services/           # 业务逻辑（userService, ragService）
│   │   ├── 📁 config/             # 配置文件
│   │   └── 📁 utils/              # 工具函数
│   ├── 📁 data/                   # SQLite数据库（herb-knowledge.db）
│   ├── 📁 scripts/                # 数据初始化脚本
│   └── 📁 uploads/                # 上传文件
├── 📁 scripts/                    # 前端脚本
├── 📁 styles/                     # 样式文件
├── 📄 knowledge-graph.html        # 知识图谱页面
├── 📄 login.html                  # 登录页面
├── 📄 index.html                  # 主页面
└── 📄 README.md                   # 项目文档
```

### 数据库设计

#### 核心数据表

| 表名 | 说明 |
|------|------|
| herbs | 药材主表（275味） |
| herb_categories | 药材分类（17类） |
| herb_regions | 产地（27省） |
| herb_sources | 基源（植物/动物/矿物） |
| properties | 性味（寒热温凉平+酸苦甘辛咸淡涩） |
| meridians | 归经（12经） |
| efficacies | 功效标签 |
| herb_properties | 药材-性味关联 |
| herb_meridians | 药材-归经关联 |
| herb_efficacies | 药材-功效关联 |
| formulas | 方剂 |
| formula_herbs | 方剂组成（含君臣佐使） |
| compatibility_rules | 配伍规则（十八反十九畏） |
| users | 用户 |

---

## 🔌 API文档

**Base URL**: `http://localhost:3001/api`
**认证方式**: JWT Bearer Token（登录后获取）
**数据格式**: JSON

### 药材 API

#### 获取药材列表
```
GET /api/herbs?page=1&limit=20&category_id=1&region_id=2
```
返回药材列表 + 分页信息。

#### 搜索药材
```
GET /api/herbs/search?q=麻黄
```
按相关度加权排序，返回完整药材信息（含性味归经功效方剂）。

#### 获取药材详情
```
GET /api/herbs/:id
```
返回药材完整信息：分类、产地、性味、归经、功效、图片。

#### 获取统计
```
GET /api/herbs/statistics
```
返回：药材总数、分类分布、产地分布、功效分布、常用药分类。

#### 创建/更新/删除药材（需管理员）
```
POST   /api/herbs
PUT    /api/herbs/:id
DELETE /api/herbs/:id
```

### 参考数据 API

| 接口 | 说明 |
|------|------|
| `GET /api/herb-categories` | 药材分类列表 |
| `GET /api/herb-regions` | 产地列表 |
| `GET /api/herb-sources` | 基源列表 |

每个都有 `/:id` 详情、`/check` 查重、POST/PUT/DELETE 管理接口。

### 图片 API（需管理员）

| 接口 | 说明 |
|------|------|
| `POST /api/herb-images/:herbId` | 上传药材图片 |
| `GET /api/herb-images/:herbId` | 获取药材图片 |
| `DELETE /api/herb-images/:herbId/:imageId` | 删除图片 |

### 方剂 API

| 接口 | 说明 |
|------|------|
| `GET /api/formulas` | 方剂列表 |
| `GET /api/formulas/:id` | 方剂详情（含组成药材+君臣佐使） |
| `POST /api/formulas` | 创建方剂（需管理员） |

### 知识图谱 API

| 接口 | 说明 |
|------|------|
| `GET /api/knowledge/graph-data?common=1` | 图谱数据（common=1只返回常用药） |
| `GET /api/knowledge/herb-details/:name` | 药材详情（含方剂配伍） |
| `GET /api/knowledge/region-distribution` | 产地分布统计 |

**图谱节点类型与颜色**：

| 类型 | 颜色 |
|------|------|
| Herb 药材 | `#ff6b6b` |
| Category 分类 | `#4ecdc4` |
| Property 性味 | `#ffbe0b` |
| Meridian 归经 | `#a786df` |
| Efficacy 功效 | `#f97316` |
| Region 产地 | `#45b7d1` |

### 用户认证 API

| 接口 | 说明 |
|------|------|
| `POST /api/auth/login` | 登录（获取JWT Token） |
| `POST /api/auth/register` | 注册 |
| `GET /api/auth/profile` | 获取个人资料（需登录） |
| `PUT /api/auth/profile` | 更新个人资料（需登录） |

---

## 👨‍💻 B 前端对接指南

**你负责**：前端页面（HTML/CSS/JS）、知识图谱可视化、地图展示。

### 需要对接的核心接口

| 功能 | 接口 | 说明 |
|------|------|------|
| 药材列表 | `GET /api/herbs` | 分页获取药材 |
| 药材搜索 | `GET /api/herbs/search?q=` | 带自动补全 |
| 药材详情 | `GET /api/herbs/:id` | 含性味归经功效图片 |
| 知识图谱 | `GET /api/knowledge/graph-data?common=1` | D3.js渲染 |
| 地图 | `GET /api/knowledge/region-distribution` | ECharts中国地图 |
| 登录 | `POST /api/auth/login` | 获取token |
| Mock数据 | `GET /api/mock/*` | 开发用固定数据 |

### 关键说明

1. **知识图谱**：前端用D3.js，节点用 `labels[0]` 区分类型，颜色对照上表。
2. **地图**：前端用ECharts，`registerMap('china', geoJson)` 从 `/public/china.json` 加载，产地数据用 `region-distribution`。
3. **常用药优先**：图谱默认 `?common=1`（40+常用药），点击"展开全部"用 `?common=0`（275味）。
4. **图片展示**：药材详情中的 `images[].path` 拼接 `http://localhost:3001` 为完整URL。
5. **完整对接文档**：见 `backend/API.md`，包含所有接口的请求/响应示例。

### 当前遗留的前端武器残留（需替换为药材）

| 文件 | 需替换内容 |
|------|-----------|
| 各 HTML 页面 | "武器"文字 → "药材"，API地址 `/api/weapons` → `/api/herbs` |
| `scripts/weapon-*.js` | 旧武器脚本 → 药材脚本 |
| 页面标题/描述 | 改为药材主题 |

---

## 🐍 C Python AI 服务对接指南

**你负责**：AI服务（对接DeepSeek或自有模型）、Neo4j知识图谱云端部署。

### AI 服务对接

后端已预留网关接口 `POST /api/ai-gateway/python-proxy`，所有请求转发到你的Python服务。

**配置**（backend/.env）：
```env
AI_SERVICE_URL=http://localhost:5000
```

**转发协议**：
```
前端 → Node后端 → Python服务
POST /api/ai-gateway/python-proxy
{ "endpoint": "/analyze", "data": { "herb": "麻黄" } }

Node后端转发为：
POST http://localhost:5000/analyze
{ "herb": "麻黄" }
```

**Python服务需实现端点**：

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `POST /analyze` | 药材分析，输入 `{"herb": "药材名"}` |
| `POST /compatibility` | 配伍分析，输入 `{"herbs": ["甘草","甘遂"]}` |
| `POST /recognize` | 图片识别 |

**响应格式**：
```json
{ "success": true, "data": { "result": "分析结果" } }
```

服务不可用时，后端自动降级返回本地数据库内容。

### Neo4j 知识图谱对接（可选）

若想用Neo4j云端托管图谱，后端 `/api/knowledge/graph-data` 支持替换数据源。当前SQLite数据在 `backend/data/herb-knowledge.db`。

**节点类型**：Herb、Category、Region、Source、Property、Meridian、Efficacy
**关系类型**：BELONGS_TO、FROM_REGION、FROM_SOURCE、HAS_PROPERTY、ENTERS_MERIDIAN、HAS_EFFICACY
**数据量**：275药材、17分类、27产地、12性味、12归经、200+功效

详细对接规范见 `backend/API.md` 的 C 部分。

---

## 📦 部署指南

### 开发环境部署

```bash
# 进入后端目录
cd backend
npm install
npm run init-herb-db
npm run dev
```

### 一键部署

```bash
# 后端
cd backend
bash scripts/deploy.sh
```

### 生产环境部署

```bash
# 使用PM2
npm install -g pm2
pm2 start src/app-simple.js --name "herb-knowledge"
pm2 status
```

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给我们一个Star！⭐**

[⬆ 回到顶部](#神农ai---中药药材知识图谱系统)

</div>
