# 神农AI 药材知识库 API 文档

**版本**: 2.0.0
**基础地址**: `http://localhost:3001/api`
**认证方式**: JWT Bearer Token（登录接口返回后在 Header 中携带）

---

## 目录

1. [B - 前端开发](#b-前端开发)
   - [药材 API](#1-药材-api)
   - [参考数据 API](#2-参考数据-api)
   - [图片 API](#3-图片-api)
   - [方剂 API](#4-方剂-api)
   - [知识图谱 API](#5-知识图谱-api)
   - [AI 问答 API](#6-ai-问答-api)
   - [Mock 数据](#7-mock-数据)
   - [用户认证](#8-用户认证)
2. [C - Python AI 服务](#c-python-ai-服务)

---

# B - 前端开发

## 1. 药材 API

### 获取药材列表

```
GET /api/herbs?page=1&limit=20&category_id=1&region_id=2
```

**响应**:
```json
{
  "success": true,
  "data": {
    "herbs": [
      {
        "id": 1,
        "name": "人参",
        "pinyin": "renshen",
        "alias": "白参",
        "category_name": "补虚药",
        "region_name": "吉林",
        "description": "大补元气，复脉固脱，补脾益肺，生津养血",
        "usage_dosage": "3-9g,另煎兑服"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 12,
      "total_items": 230,
      "items_per_page": 20
    }
  }
}
```

**过滤参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | int | 页码，默认 1 |
| `limit` | int | 每页条数，默认 20 |
| `category_id` | int | 按分类筛选 |
| `region_id` | int | 按产地筛选 |

---

### 搜索药材

```
GET /api/herbs/search?q=麻黄
```

搜索按匹配度排序：名称精确匹配 > 别名匹配 > 拼音匹配 > 功效/描述匹配。

**响应**:
```json
{
  "success": true,
  "data": {
    "herbs": [
      {
        "id": 1,
        "name": "麻黄",
        "pinyin": "mahuang",
        "alias": "麻黄草",
        "category_name": "解表药",
        "region_name": "山西",
        "description": "发汗解表，宣肺平喘，利水消肿",
        "efficacy": null
      }
    ],
    "total": 1
  }
}
```

---

### 获取药材详情

```
GET /api/herbs/:id
```

**响应**（包含性味、归经、功效完整关联）:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "麻黄",
    "pinyin": "mahuang",
    "description": "发汗解表，宣肺平喘，利水消肿",
    "usage_dosage": "2-10g",
    "caution": "表虚自汗、阴虚盗汗者忌用",
    "category_name": "解表药",
    "region_name": "山西",
    "properties": [
      { "id": 8, "name": "辛", "type": "flavor", "intensity": "normal" },
      { "id": 2, "name": "温", "type": "qi", "intensity": "normal" }
    ],
    "meridians": [
      { "id": 4, "name": "肺", "abbreviation": "LU" },
      { "id": 11, "name": "膀胱", "abbreviation": "BL" }
    ],
    "efficacies": [
      { "id": 1, "name": "发汗解表" },
      { "id": 3, "name": "宣肺平喘" },
      { "id": 44, "name": "利水渗湿" }
    ],
    "images": []
  }
}
```

---

### 获取药材统计

```
GET /api/herbs/statistics
```

```json
{
  "success": true,
  "data": {
    "total_herbs": 230,
    "by_category": [
      { "name": "补虚药", "count": 39 },
      { "name": "清热药", "count": 26 }
    ],
    "by_region": [
      { "name": "甘肃", "count": 12 },
      { "name": "四川", "count": 9 }
    ]
  }
}
```

---

### 创建药材（需管理员登录）

```
POST /api/herbs
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新药材",                    // 必填，唯一
  "pinyin": "xinyaocai",
  "alias": "别名",
  "category_id": 1,
  "region_id": 2,
  "source_id": 1,
  "description": "药材描述",
  "efficacy": "功效说明",
  "usage_dosage": "3-9g",
  "caution": "注意事项",
  "property_ids": [1, 2],            // 性味ID数组
  "meridian_ids": [3, 4],            // 归经ID数组
  "efficacy_ids": [5, 6]            // 功效ID数组
}
```

**验证规则**: name 必填(1-100字)，category_id/region_id/source_id 必须真实存在。

---

### 更新 / 删除药材

```
PUT  /api/herbs/:id      (需管理员登录)
DELETE /api/herbs/:id     (需管理员登录)
```

---

## 2. 参考数据 API

### 分类 / 产地 / 来源

```
GET /api/herb-categories     → [{ id, name, description }]
GET /api/herb-regions        → [{ id, name, description }]
GET /api/herb-sources        → [{ id, name, description }]
```

每个都有 `/:id` 详情（含关联的药材数量统计）、`/check?name=xxx` 查重、POST/PUT/DELETE，结构一致。

**预置数据**:

| 分类 (17) | 产地 (12) | 来源 (3) |
|-----------|-----------|----------|
| 解表药、清热药、泻下药... | 甘肃、四川、云南... | 植物、动物、矿物 |

性味 (12) 和归经 (12) 暂不提供独立 API，但可通过药材详情中的 `properties` 和 `meridians` 字段获取。

---

## 3. 图片 API

需要管理员登录（JWT）。

```
POST   /api/herb-images/:herbId    上传图片（multipart/form-data, image字段）
GET    /api/herb-images/:herbId     获取药材的所有图片
DELETE /api/herb-images/:herbId/:imageId  删除指定图片
PUT    /api/herb-images/:herbId/:imageId  更新图片描述
```

图片上限 5MB，支持 jpg/png/gif/webp。

---

## 4. 方剂 API

```
GET  /api/formulas?page=1&limit=20    方剂列表
GET  /api/formulas/:id                方剂详情（含组成药材+君臣佐使+用量）
POST /api/formulas                    创建方剂（需管理员）
PUT  /api/formulas/:id                更新方剂（需管理员）
DELETE /api/formulas/:id              删除方剂（需管理员）
```

**方剂详情响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "四君子汤",
    "pinyin": "sijunzitang",
    "category": "补益剂",
    "description": "益气健脾。主治脾胃气虚证。",
    "source": "《太平惠民和剂局方》",
    "herbs": [
      { "id": 1, "name": "人参", "dosage": "9g", "role": "君" },
      { "id": 2, "name": "白术", "dosage": "9g", "role": "臣" },
      { "id": 3, "name": "茯苓", "dosage": "9g", "role": "佐" },
      { "id": 4, "name": "甘草", "dosage": "6g", "role": "使" }
    ]
  }
}
```

role: `君 | 臣 | 佐 | 使`

---

## 5. 知识图谱 API

```
GET /api/knowledge/graph-data
```

返回图谱的节点和连线，前端用 D3.js 渲染。

```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "herb_1", "labels": ["Herb"], "properties": {"name":"人参","pinyin":"renshen"} },
      { "id": "category_1", "labels": ["Category"], "properties": {"name":"补虚药"} },
      { "id": "property_1", "labels": ["Property"], "properties": {"name":"甘","type":"flavor"} },
      { "id": "meridian_1", "labels": ["Meridian"], "properties": {"name":"脾","abbreviation":"SP"} },
      { "id": "efficacy_1", "labels": ["Efficacy"], "properties": {"name":"补气"} }
    ],
    "links": [
      { "source": "herb_1", "target": "category_1", "type": "属于" },
      { "source": "herb_1", "target": "property_3", "type": "性" },
      { "source": "herb_1", "target": "meridian_3", "type": "入" },
      { "source": "herb_1", "target": "efficacy_1", "type": "功效" }
    ]
  }
}
```

**节点标签颜色**:

| 标签 | 颜色 | 说明 |
|------|------|------|
| Herb | `#ff6b6b` 🟥 | 药材 |
| Category | `#4ecdc4` 🩵 | 分类 |
| Property | `#ffbe0b` 🟨 | 性味 |
| Meridian | `#a786df` 🟪 | 归经 |
| Efficacy | `#f97316` 🟧 | 功效 |
| Region | `#45b7d1` 🟦 | 产地 |

**其他图谱端点**:
```
GET /api/knowledge/herb-details/:herbName    药材详情（含方剂、配伍）
GET /api/knowledge/region-distribution        地区分布统计
```

---

## 6. AI 问答 API

需要登录。

```
POST /api/ai-gateway/chat
Authorization: Bearer <token>

{ "question": "麻黄有什么功效？" }
```

```json
{
  "success": true,
  "data": {
    "answer": "**麻黄**（mahuang）\n- 性味：辛、温\n- 归经：肺、膀胱\n...",
    "offline": false         // true 表示AI不可用，返回的是数据库内容
  }
}
```

```
POST /api/ai-gateway/analyze-herb
{ "herbName": "麻黄" }

POST /api/ai-gateway/check-compatibility
{ "herbs": ["甘草", "甘遂"] }

GET  /api/ai-gateway/health
```

---

## 7. Mock 数据

供前端开发（B）在不启动后端时使用，返回固定示例数据。

```
GET /api/mock               → 端点列表
GET /api/mock/herbs         → 5 条示例药材
GET /api/mock/herbs/:id     → 药材详情（含性味归经）
GET /api/mock/herb-categories  → 分类示例
GET /api/mock/herb-regions     → 产地示例
GET /api/mock/herb-sources     → 来源示例
GET /api/mock/formulas         → 方剂列表（2 条）
GET /api/mock/formulas/:id     → 方剂详情（含组成）
GET /api/mock/knowledge-graph  → 图谱数据
POST /api/mock/chat            → AI 问答示例
```

---

## 8. 用户认证

```
POST /api/auth/login
{ "username": "JunkangShen", "password": "kk20050318" }
```

```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "username": "JunkangShen", "role": "admin" },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

前端保存 token，后续请求加到 Header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

```
POST   /api/auth/register     用户注册
GET    /api/auth/profile       获取个人资料（需登录）
PUT    /api/auth/profile       更新个人资料（需登录）
PUT    /api/auth/change-password  修改密码（需登录）
```

---

# C - Python AI 服务

## AI 网关代理

后端已预留 `POST /api/ai-gateway/python-proxy`，所有发往该端点的请求会转发到你的 Python 服务。

### 配置

在 `.env` 中设置：

```env
AI_SERVICE_URL=http://localhost:5000
```

### 协议

前端 → Node 后端 → **你的 Python 服务**

```
POST /api/ai-gateway/python-proxy
Authorization: Bearer <token>

{
  "endpoint": "/analyze",     // Python 服务的相对路径
  "data": { "herb": "麻黄" }  // 传给 Python 的参数
}
```

Node 后端会转发为:

```
POST http://localhost:5000/analyze
{ "herb": "麻黄" }
```

### Python 服务需要实现的端点

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查（Node 后端每分钟 ping） |
| `POST /analyze` | 药材分析，输入 `{"herb": "药材名"}` |
| `POST /compatibility` | 配伍分析，输入 `{"herbs": ["甘草","甘遂"]}` |
| `POST /recognize` | 图片识别（武器识别改造为药材识别） |

### 响应格式要求

```json
{
  "success": true,
  "data": {
    "result": "分析结果文本或结构化数据"
  }
}
```

Python 服务不可用时，Node 后端会自动降级返回本地数据库内容，前端不会感知到异常。

---

## Neo4j 知识图谱对接（C 可选）

如果你（C）想用 Neo4j 云托管知识图谱数据替代 SQLite 查询，有以下两种方式：

### 方式一：通过 Python 服务提供图谱 API（推荐）

你的 Python 服务直接连接 Neo4j 云，提供 `/graph-data` 端点：

```
GET /neo4j/graph-data
```

返回格式需与现有 API 一致：

```json
{
  "success": true,
  "data": {
    "nodes": [
      { "id": "herb_1", "labels": ["Herb"], "properties": { "name": "人参", "pinyin": "renshen" } },
      { "id": "category_1", "labels": ["Category"], "properties": { "name": "补虚药" } },
      { "id": "property_3", "labels": ["Property"], "properties": { "name": "甘", "type": "flavor" } },
      { "id": "meridian_3", "labels": ["Meridian"], "properties": { "name": "脾" } },
      { "id": "efficacy_1", "labels": ["Efficacy"], "properties": { "name": "补气" } }
    ],
    "links": [
      { "source": "herb_1", "target": "category_1", "type": "属于" },
      { "source": "herb_1", "target": "property_3", "type": "性" },
      { "source": "herb_1", "target": "meridian_3", "type": "入" },
      { "source": "herb_1", "target": "efficacy_1", "type": "功效" }
    ]
  }
}
```

前端通过 `/api/ai-gateway/python-proxy` 调用：

```json
POST /api/ai-gateway/python-proxy
{ "endpoint": "/neo4j/graph-data", "data": {} }
```

### 方式二：从现有 SQLite 导出数据到 Neo4j

当前 SQLite 数据库位于 `backend/data/herb-knowledge.db`，可用脚本导出为 Cypher 导入命令。

**节点类型**：

| 标签 | 来源表 | 关键属性 |
|------|--------|----------|
| `Herb` | herbs | id, name, pinyin, alias, description, efficacy |
| `Category` | herb_categories | id, name |
| `Region` | herb_regions | id, name |
| `Source` | herb_sources | id, name |
| `Property` | properties | id, name, type (qi/flavor) |
| `Meridian` | meridians | id, name, abbreviation |
| `Efficacy` | efficacies | id, name |

**关系类型**：

| 关系 | 起点 | 终点 | 说明 |
|------|------|------|------|
| `BELONGS_TO` | Herb | Category | 属于某个分类 |
| `FROM_REGION` | Herb | Region | 产自某个产地 |
| `FROM_SOURCE` | Herb | Source | 来源于植物/动物/矿物 |
| `HAS_PROPERTY` | Herb | Property | 具有某种性味 |
| `ENTERS_MERIDIAN` | Herb | Meridian | 归某条经 |
| `HAS_EFFICACY` | Herb | Efficacy | 具有某种功效 |

**导入数据量**：230 味药材，17 个分类，12 个产地，3 个来源，12 种性味，12 条归经，54 种功效，约 1751 条关系。
