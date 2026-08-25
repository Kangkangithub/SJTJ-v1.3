# 前端接口对接整理

> 面向前端开发使用。整理依据主要是 `backend/package.json`、`backend/src/app-simple.js` 和 `backend/src/routes/*.js`。当前后端启动入口是 `backend/src/app-simple.js`，旧的武器版 `backend/src/app.js` 仍存在，但前端医药方向应优先对接 `app-simple.js` 挂载的医药 API。

## 1. 基础信息

### 基础地址

本地开发默认：

```text
http://localhost:3001/api
```

后端健康检查：

```http
GET http://localhost:3001/health
GET http://localhost:3001/api
```

### 通用响应格式

大多数接口返回：

```json
{
  "success": true,
  "data": {}
}
```

失败时通常返回：

```json
{
  "success": false,
  "message": "错误说明"
}
```

部分校验失败接口会额外返回：

```json
{
  "success": false,
  "message": "数据验证失败",
  "errors": [
    { "field": "name", "message": "字段错误说明" }
  ]
}
```

### 认证方式

登录成功后保存 `data.token`，后续需要登录的接口加请求头：

```http
Authorization: Bearer <token>
```

后端也保留了一个简化管理员模式：

```http
x-admin-user: true
```

注意：`/api/herbs/direct-add`、`/api/herbs/direct-delete/:id`、`/api/herbs/direct-update/:id` 这几个直连管理接口检查的是：

```http
x-admin-user: JunkangShen
```

前端正式开发建议优先使用 JWT 登录后的标准管理接口，不优先使用 direct 系列接口。

## 2. 页面与接口对应关系

| 前端页面 | 主要接口 |
|---|---|
| 首页 / 药材概览 | `GET /api/herbs/statistics`、`GET /api/herbs?limit=...`、`GET /api/herb-categories` |
| 登录页 | `POST /api/auth/login` |
| 注册页 | `POST /api/auth/register` |
| 药材搜索页 | `GET /api/herbs/search?q=...`、`GET /api/herbs`、`GET /api/herb-categories`、`GET /api/herb-regions` |
| 药材详情页 | `GET /api/herbs/:id`、`GET /api/herbs/:id/similar`、`GET /api/herb-images/:herbId` |
| 知识图谱页 | `GET /api/knowledge/graph-data`、`GET /api/knowledge/herb-details/:herbName` |
| 地区分布页 | `GET /api/knowledge/region-distribution` |
| 方剂页 | `GET /api/formulas`、`GET /api/formulas/:id` |
| AI 问答页 | `POST /api/ai-gateway/chat`、`POST /api/ai-gateway/analyze-herb`、`POST /api/ai-gateway/check-compatibility` |
| 管理后台 | `POST/PUT/DELETE /api/herbs`、`POST/PUT/DELETE /api/formulas`、图片上传接口 |
| Mock 开发 | `GET /api/mock/...`、`POST /api/mock/chat` |

## 3. 用户认证接口

### 注册

```http
POST /api/auth/register
Content-Type: application/json
```

请求体：

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456",
  "name": "测试用户"
}
```

字段规则：

| 字段 | 说明 |
|---|---|
| `username` | 必填，字母和数字，3-30 位 |
| `email` | 必填，邮箱格式 |
| `password` | 必填，6-128 位 |
| `name` | 可选，2-50 位 |

成功响应：

```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "name": "测试用户",
      "role": "user"
    },
    "token": "jwt-token"
  }
}
```

### 登录

```http
POST /api/auth/login
Content-Type: application/json
```

请求体：

```json
{
  "username": "JunkangShen",
  "password": "kk20050318"
}
```

成功响应：

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 1,
      "username": "JunkangShen",
      "email": "admin@herb-knowledge.local",
      "name": "管理员",
      "role": "admin"
    },
    "token": "jwt-token"
  }
}
```

### 当前用户资料

```http
GET /api/auth/profile
Authorization: Bearer <token>
```

返回字段包括：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "JunkangShen",
    "email": "admin@herb-knowledge.local",
    "name": "管理员",
    "phone": null,
    "bio": null,
    "avatar": null,
    "role": "admin",
    "status": "active",
    "preferences": {
      "theme": "light",
      "language": "zh-cn"
    },
    "created_at": "2026-08-05 18:00:00",
    "updated_at": "2026-08-05 18:00:00",
    "last_login": "2026-08-05 18:00:00"
  }
}
```

### 更新资料 / 修改密码 / 刷新 token / 登出

```http
PUT  /api/auth/profile
PUT  /api/auth/change-password
POST /api/auth/refresh
POST /api/auth/logout
```

这些接口都需要 `Authorization: Bearer <token>`。

## 4. 药材接口

### 获取药材列表

```http
GET /api/herbs?page=1&limit=20&category_id=1&region_id=2
```

查询参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `page` | number | 页码，默认 `1` |
| `limit` | number | 每页数量，默认 `20` |
| `category_id` | number | 可选，按药材分类筛选 |
| `region_id` | number | 可选，按产地筛选 |

响应：

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
        "usage_dosage": "3-9g"
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

前端用途：药材列表页、首页推荐、分页、分类筛选、产地筛选。

### 搜索药材

```http
GET /api/herbs/search?q=麻黄
```

响应：

```json
{
  "success": true,
  "data": {
    "herbs": [
      {
        "id": 5,
        "name": "麻黄",
        "pinyin": "mahuang",
        "alias": "麻黄草",
        "description": "发汗解表，宣肺平喘，利水消肿",
        "efficacy": "发汗解表",
        "category_name": "解表药",
        "region_name": "山西"
      }
    ],
    "total": 1
  }
}
```

搜索范围：`name`、`alias`、`pinyin`、`efficacy`、`description`。最多返回 50 条。

### 获取药材详情

```http
GET /api/herbs/:id
```

响应核心字段：

```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "麻黄",
    "pinyin": "mahuang",
    "latin_name": null,
    "alias": "麻黄草",
    "category_id": 1,
    "region_id": 2,
    "source_id": 1,
    "category_name": "解表药",
    "region_name": "山西",
    "source_name": "植物",
    "description": "发汗解表，宣肺平喘，利水消肿",
    "efficacy": "发汗解表",
    "usage_dosage": "2-10g",
    "caution": "表虚自汗、阴虚盗汗者忌用",
    "quality": {},
    "images": [],
    "properties": [
      { "id": 1, "name": "辛", "type": "flavor", "intensity": "normal" },
      { "id": 2, "name": "温", "type": "qi", "intensity": "normal" }
    ],
    "meridians": [
      { "id": 4, "name": "肺", "abbreviation": "LU" }
    ],
    "efficacies": [
      { "id": 1, "name": "发汗解表" }
    ]
  }
}
```

前端详情页建议展示：基本信息、分类、产地、来源、性味、归经、功效、用法用量、注意事项、图片。

### 相似药材

```http
GET /api/herbs/:id/similar?limit=5
```

响应：

```json
{
  "success": true,
  "data": {
    "similar_herbs": [
      {
        "id": 6,
        "name": "桂枝",
        "pinyin": "guizhi",
        "category_id": 1,
        "region_id": 2
      }
    ]
  }
}
```

### 药材统计

```http
GET /api/herbs/statistics
```

响应：

```json
{
  "success": true,
  "data": {
    "total_herbs": 230,
    "by_category": [
      { "name": "补虚药", "count": 39 }
    ],
    "by_region": [
      { "name": "甘肃", "count": 12 }
    ]
  }
}
```

前端用途：首页统计卡片、分类柱状图、产地分布图。

### 创建药材

```http
POST /api/herbs
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "name": "新药材",
  "pinyin": "xinyaocai",
  "latin_name": "Latin Name",
  "alias": "别名",
  "category_id": 1,
  "region_id": 2,
  "source_id": 1,
  "description": "药材描述",
  "efficacy": "功效说明",
  "usage_dosage": "3-9g",
  "caution": "注意事项",
  "property_ids": [1, 2],
  "meridian_ids": [3, 4],
  "efficacy_ids": [5, 6]
}
```

字段规则：

| 字段 | 说明 |
|---|---|
| `name` | 必填，1-100 字符，唯一 |
| `pinyin` | 可选，最多 50 字符 |
| `latin_name` | 可选，最多 100 字符 |
| `alias` | 可选，最多 100 字符 |
| `category_id` | 可选，必须是真实存在的分类 ID |
| `region_id` | 可选，必须是真实存在的产地 ID |
| `source_id` | 可选，必须是真实存在的来源 ID |
| `description` | 可选，最多 500 字符 |
| `efficacy` | 可选，最多 500 字符 |
| `usage_dosage` | 可选，最多 100 字符 |
| `caution` | 可选，最多 500 字符 |
| `property_ids` | 可选，性味 ID 数组 |
| `meridian_ids` | 可选，归经 ID 数组 |
| `efficacy_ids` | 可选，功效 ID 数组 |

### 更新 / 删除药材

```http
PUT    /api/herbs/:id
DELETE /api/herbs/:id
```

均需要管理员登录。

### 收藏 / 取消收藏药材

```http
POST   /api/herbs/:id/favorite
DELETE /api/herbs/:id/favorite
```

均需要登录。

## 5. 分类、产地、来源接口

### 药材分类

```http
GET /api/herb-categories
GET /api/herb-categories/:id
GET /api/herb-categories/check?name=补虚药
POST /api/herb-categories
PUT /api/herb-categories/:id
DELETE /api/herb-categories/:id
```

列表响应：

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "补虚药", "description": "以补益正气为主要功效" }
  ]
}
```

详情响应会多一个 `herb_count` 字段：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "补虚药",
    "description": "以补益正气为主要功效",
    "herb_count": 39
  }
}
```

### 产地

```http
GET /api/herb-regions
GET /api/herb-regions/:id
GET /api/herb-regions/check?name=甘肃
POST /api/herb-regions
PUT /api/herb-regions/:id
DELETE /api/herb-regions/:id
```

返回结构与分类一致。

### 来源

```http
GET /api/herb-sources
GET /api/herb-sources/:id
GET /api/herb-sources/check?name=植物
POST /api/herb-sources
PUT /api/herb-sources/:id
DELETE /api/herb-sources/:id
```

列表比分类/产地多一个 `created_at` 字段：

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "植物", "description": "来源于植物", "created_at": "2026-08-05 18:00:00" }
  ]
}
```

注意：`herb-categories` 和 `herb-regions` 的新增、更新、删除路由目前没有强制 JWT 管理员校验；`herb-sources` 的更新、删除需要管理员。前端管理后台仍建议统一要求管理员登录后再展示这些操作。

## 6. 药材图片接口

### 获取药材图片

```http
GET /api/herb-images/:herbId
```

响应：

```json
{
  "success": true,
  "data": {
    "herbId": 1,
    "herbName": "人参",
    "images": [
      {
        "id": 1720000000000,
        "filename": "herb-1720000000000-123456.png",
        "originalName": "renshen.png",
        "path": "/uploads/herbs/herb-1720000000000-123456.png",
        "size": 12345,
        "description": "图片说明",
        "uploadedAt": "2026-08-05T10:00:00.000Z"
      }
    ]
  }
}
```

前端显示图片时，完整地址一般拼：

```js
const imageUrl = `http://localhost:3001${image.path}`;
```

### 上传图片

```http
POST /api/herb-images/:herbId
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 说明 |
|---|---|
| `image` | 必填，图片文件 |
| `description` | 可选，图片说明 |

限制：最大 5MB，支持 `jpeg/jpg/png/gif/webp/svg`。

### 删除图片 / 更新图片说明

```http
DELETE /api/herb-images/:herbId/:imageId
PUT    /api/herb-images/:herbId/:imageId
```

`PUT` 请求体：

```json
{
  "description": "新的图片说明"
}
```

均需要管理员登录。

## 7. 方剂接口

### 获取方剂列表

```http
GET /api/formulas?page=1&limit=20
```

响应：

```json
{
  "success": true,
  "data": {
    "formulas": [
      {
        "id": 1,
        "name": "四君子汤",
        "pinyin": "sijunzitang",
        "category": "补益剂",
        "description": "益气健脾",
        "source": "《太平惠民和剂局方》"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 1,
      "total_items": 2,
      "items_per_page": 20
    }
  }
}
```

### 获取方剂详情

```http
GET /api/formulas/:id
```

响应：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "四君子汤",
    "pinyin": "sijunzitang",
    "category": "补益剂",
    "description": "益气健脾",
    "usage": "用法",
    "caution": "禁忌",
    "source": "《太平惠民和剂局方》",
    "images": "[]",
    "herbs": [
      {
        "id": 1,
        "name": "人参",
        "pinyin": "renshen",
        "dosage": "9g",
        "role": "君",
        "note": null
      }
    ]
  }
}
```

### 创建 / 更新 / 删除方剂

```http
POST   /api/formulas
PUT    /api/formulas/:id
DELETE /api/formulas/:id
```

均需要管理员登录。

创建 / 更新请求体：

```json
{
  "name": "四君子汤",
  "pinyin": "sijunzitang",
  "category": "补益剂",
  "description": "益气健脾",
  "usage": "水煎服",
  "caution": "实热证慎用",
  "source": "《太平惠民和剂局方》",
  "herbs": [
    { "herb_id": 1, "dosage": "9g", "role": "君", "note": "主药" },
    { "herbName": "白术", "dosage": "9g", "role": "臣" }
  ]
}
```

`herbs` 里的药材可以用 `herb_id` 或 `herbName` 匹配。

## 8. 知识图谱接口

### 获取知识图谱数据

```http
GET /api/knowledge/graph-data
```

响应：

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "herb_1",
        "labels": ["Herb"],
        "properties": {
          "name": "人参",
          "pinyin": "renshen",
          "description": "大补元气",
          "category": "补虚药",
          "region": "吉林"
        }
      },
      {
        "id": "category_1",
        "labels": ["Category"],
        "properties": {
          "name": "补虚药",
          "description": "分类说明"
        }
      }
    ],
    "links": [
      { "source": "herb_1", "target": "category_1", "type": "属于" },
      { "source": "herb_1", "target": "region_1", "type": "产自" },
      { "source": "herb_1", "target": "property_1", "type": "性" },
      { "source": "herb_1", "target": "meridian_1", "type": "归" },
      { "source": "herb_1", "target": "efficacy_1", "type": "功效" }
    ]
  }
}
```

节点类型：

| `labels[0]` | 前端含义 | 建议颜色 |
|---|---|---|
| `Herb` | 药材 | 红色系 |
| `Category` | 分类 | 青绿色系 |
| `Region` | 产地 | 蓝色系 |
| `Source` | 来源 | 绿色系 |
| `Property` | 性味 | 黄色系 |
| `Meridian` | 归经 | 紫色系 |
| `Efficacy` | 功效 | 橙色系 |

前端 D3 渲染时，节点显示名称取：

```js
node.properties?.name || node.id
```

连线显示名称取：

```js
link.type
```

### 图谱节点药材详情

```http
GET /api/knowledge/herb-details/:herbName
```

响应：

```json
{
  "success": true,
  "data": {
    "basicInfo": {
      "id": 1,
      "name": "人参",
      "pinyin": "renshen",
      "category_name": "补虚药",
      "region_name": "吉林",
      "source_name": "植物",
      "description": "大补元气"
    },
    "properties": [
      { "name": "甘", "type": "flavor", "intensity": "normal" }
    ],
    "meridians": [
      { "name": "脾", "abbreviation": "SP" }
    ],
    "efficacies": [
      { "name": "补气" }
    ],
    "formulas": [
      { "id": 1, "name": "四君子汤", "dosage": "9g", "role": "君" }
    ],
    "incompatibilities": [
      {
        "herb2_name": "藜芦",
        "relation_type": "相反",
        "description": "配伍禁忌说明"
      }
    ]
  }
}
```

这个接口适合知识图谱节点点击后打开侧边栏。

### 地区分布

```http
GET /api/knowledge/region-distribution
```

响应：

```json
{
  "success": true,
  "data": {
    "regions": [
      { "id": 1, "name": "甘肃", "description": "道地产区", "herb_count": 12 }
    ],
    "regionHerbs": {
      "甘肃": [
        { "id": 1, "name": "当归", "category": "补虚药" }
      ]
    },
    "statistics": {
      "totalRegions": 12,
      "totalHerbs": 230
    }
  }
}
```

## 9. AI 网关接口

以下接口除健康检查外，都需要登录。

### AI 问答

```http
POST /api/ai-gateway/chat
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "question": "麻黄有什么功效？"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "answer": "回答文本，可能包含 Markdown",
    "offline": false,
    "context": []
  }
}
```

说明：如果没有配置 Deepseek API key，后端会降级返回数据库检索内容，`offline` 为 `true`。

### 单味药材分析

```http
POST /api/ai-gateway/analyze-herb
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "herbName": "麻黄"
}
```

响应：

```json
{
  "success": true,
  "data": {
    "analysis": "分析文本，可能包含 Markdown",
    "herb": {},
    "offline": true
  }
}
```

### 配伍禁忌检查

```http
POST /api/ai-gateway/check-compatibility
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "herbs": ["甘草", "甘遂"]
}
```

响应：

```json
{
  "success": true,
  "data": {
    "compatible": false,
    "rules": [
      {
        "relation_type": "相反",
        "description": "配伍禁忌说明",
        "h1": "甘草",
        "h2": "甘遂"
      }
    ],
    "warning": "存在配伍禁忌，请谨慎使用"
  }
}
```

### Python AI 服务代理

```http
POST /api/ai-gateway/python-proxy
Authorization: Bearer <token>
Content-Type: application/json
```

请求体：

```json
{
  "endpoint": "/analyze",
  "data": {
    "herb": "麻黄"
  }
}
```

Node 后端会转发到 `AI_SERVICE_URL + endpoint`，默认 `AI_SERVICE_URL=http://localhost:5000`。

### AI 网关健康检查

```http
GET /api/ai-gateway/health
```

返回 Deepseek 和 Python 服务连接状态。

## 10. Mock 接口

如果后端数据库或 AI 服务暂时不可用，前端可以先对接 mock 接口开发页面交互。

```http
GET  /api/mock
GET  /api/mock/herbs?page=1&limit=10
GET  /api/mock/herbs/:id
GET  /api/mock/herb-categories
GET  /api/mock/herb-regions
GET  /api/mock/herb-sources
GET  /api/mock/formulas
GET  /api/mock/formulas/:id
GET  /api/mock/knowledge-graph
POST /api/mock/chat
```

Mock 药材列表、详情、分类、产地、来源、方剂、知识图谱和聊天接口的结构基本模拟真实接口，适合你先替换旧武器页面字段和交互。

## 11. 旧武器接口兼容情况

`app-simple.js` 里保留了旧武器 API 到新药材 API 的临时重定向：

| 旧路径 | 处理方式 |
|---|---|
| `/api/weapons` | 301 重定向到 `/api/herbs` |
| `/api/weapon-types` | 301 重定向到 `/api/herb-categories` |
| `/api/weapon-countries` | 301 重定向到 `/api/herb-regions` |
| `/api/manufacturers` | 301 重定向到 `/api/herb-sources` |
| `/api/weapon-images` | 301 重定向到 `/api/herb-images` |
| `/api/weapon-models*` | 返回 410，3D 模型功能已迁移 |
| `/api/weapon-videos*` | 返回 410，视频功能已迁移 |

前端改造时不要继续写旧的 weapon 路径，应直接替换为 herb/formula/knowledge/ai-gateway 路径。

## 12. 前端开发优先级建议

1. 先封装基础请求函数：`baseURL=http://localhost:3001/api`，统一处理 `success/message/data` 和 token。
2. 先改药材搜索、药材列表、药材详情三页：这三块接口最稳定。
3. 再改知识图谱页：把旧节点类型从武器相关改为 `Herb/Category/Region/Source/Property/Meridian/Efficacy`。
4. AI 问答页可以先对接 `/api/mock/chat`，登录流程通后再改 `/api/ai-gateway/chat`。
5. 管理后台最后做，涉及管理员权限、表单校验和图片上传。

## 13. 前端可直接使用的 API 封装示例

```js
const API_BASE = 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

export const herbApi = {
  list: (params = {}) => request(`/herbs?${new URLSearchParams(params)}`),
  search: (q) => request(`/herbs/search?q=${encodeURIComponent(q)}`),
  detail: (id) => request(`/herbs/${id}`),
  similar: (id, limit = 5) => request(`/herbs/${id}/similar?limit=${limit}`),
  statistics: () => request('/herbs/statistics')
};

export const authApi = {
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  profile: () => request('/auth/profile')
};
```
