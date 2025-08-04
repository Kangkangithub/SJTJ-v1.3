# 兵智世界后端系统 (简化版)

基于Node.js + SQLite的军事知识图谱与武器识别系统后端API服务。

## 系统架构

### 技术栈
- **后端框架**: Node.js + Express.js
- **数据库**: SQLite (轻量级关系数据库)
- **缓存**: 内存缓存 (替代Redis)
- **身份验证**: JWT
- **数据验证**: Joi
- **日志管理**: Winston

### 核心模块
```
├── 用户认证模块 (Authentication)
│   ├── 用户注册/登录
│   ├── JWT令牌管理
│   └── 权限控制
├── 武器数据模块 (Weapons)
│   ├── 武器CRUD操作
│   ├── 武器搜索
│   └── 相似武器推荐
├── 数据存储模块 (Data Storage)
│   ├── SQLite数据库操作
│   ├── 用户兴趣记录
│   └── 武器关系管理
└── 性能优化模块 (Performance)
    ├── 内存缓存
    ├── 查询优化
    └── 数据索引
```

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- 无需额外数据库安装 (使用SQLite)

### 安装依赖
```bash
cd backend
npm install
```

### 环境配置
1. 查看环境配置文件：
```bash
# 查看 .env 文件内容
cat .env
```

2. **无需修改数据库连接信息** - SQLite会自动创建本地数据库文件

### 启动服务
```bash
# 开发模式 (推荐)
npm run dev

# 生产模式
npm start
```

服务启动后访问：
- **API服务**: http://localhost:3001/api
- **健康检查**: http://localhost:3001/health
- **测试页面**: http://localhost:3001/public/test.html

## 环境配置说明

### .env 文件内容
```bash
# 服务器配置
NODE_ENV=development
PORT=3001
HOST=localhost

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# 数据库配置 (SQLite - 无需修改)
DB_PATH=./data/military-knowledge.db

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# API限流配置
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 重要说明
- **数据库**: 使用SQLite，数据文件自动创建在 `backend/data/` 目录
- **无需安装**: 不需要安装Neo4j、MongoDB或Redis
- **即开即用**: 运行 `npm run dev` 即可启动完整服务

## API接口文档

### 用户认证 (/api/auth)
- `POST /register` - 用户注册
- `POST /login` - 用户登录
- `GET /profile` - 获取用户信息
- `PUT /profile` - 更新用户资料
- `PUT /change-password` - 修改密码
- `POST /refresh` - 刷新令牌
- `POST /logout` - 退出登录

### 武器数据 (/api/weapons)
- `GET /` - 获取武器列表
- `GET /search` - 搜索武器
- `GET /statistics` - 获取武器统计
- `GET /:id` - 获取武器详情
- `GET /:id/similar` - 获取相似武器

## 数据库设计 (SQLite)

### 数据表结构
```sql
-- 用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 武器表
CREATE TABLE weapons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  country TEXT NOT NULL,
  year INTEGER,
  description TEXT,
  specifications TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户兴趣表 (替代图数据库关系)
CREATE TABLE user_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  weapon_id INTEGER NOT NULL,
  interaction_type TEXT DEFAULT 'view',
  count INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (weapon_id) REFERENCES weapons (id)
);
```

### 示例数据
系统启动时会自动插入以下示例数据：
- **武器**: AK-47突击步枪、M16突击步枪、Glock 17手枪
- **类别**: 步枪、手枪、机枪、狙击枪等
- **国家**: 美国、俄罗斯、中国、德国等

## 测试功能

### 1. 命令行测试
```bash
# 运行API测试脚本
cd backend
node test-api.js
```

### 2. 浏览器测试
访问 http://localhost:3001/public/test.html 进行可视化测试

### 3. API测试示例
```bash
# 健康检查
curl http://localhost:3001/health

# 获取武器列表
curl http://localhost:3001/api/weapons

# 用户注册
# Windows PowerShell:
Invoke-WebRequest -Uri "http://localhost:3001/api/auth/register" -Method POST -ContentType "application/json" -Body '{"username":"test","email":"test@example.com","password":"123456"}'

# Linux/Mac (bash):
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"123456"}'
```

## 性能特点

### 优势
- **轻量级**: 无需安装复杂数据库
- **快速启动**: 几秒钟即可启动完整服务
- **易于部署**: 单个可执行文件即可部署
- **开发友好**: 数据库文件可直接查看和备份

### 缓存策略
- **内存缓存**: 热点查询结果缓存1小时
- **查询优化**: SQLite索引优化查询性能
- **数据预加载**: 启动时预加载常用数据

## 部署说明

### 本地开发
```bash
cd backend
npm install
npm run dev
```

### 生产部署
```bash
# 1. 安装依赖
npm install --production

# 2. 启动服务
npm start

# 3. 使用PM2管理进程 (可选)
npm install -g pm2
pm2 start src/app-simple.js --name "military-backend"
```

### Docker部署 (可选)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 扩展升级

如需升级到完整版本 (Neo4j + MongoDB + Redis)：
1. 安装对应数据库服务
2. 修改 `src/app.js` 入口文件
3. 使用完整版配置文件
4. 运行数据迁移脚本

## 故障排除

### 常见问题
1. **端口占用**: 修改 `.env` 中的 `PORT` 配置
2. **权限问题**: 确保 `data/` 和 `logs/` 目录有写入权限
3. **依赖问题**: 删除 `node_modules` 重新安装

### 日志查看
```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

## 许可证
MIT License

---

**注意**: 这是简化版实现，适合快速开发和测试。生产环境建议使用完整版架构。