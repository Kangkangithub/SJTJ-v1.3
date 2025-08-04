# 兵智世界后端配置说明

## 环境配置文件 (.env)

### 当前配置内容
```bash
# 服务器配置
NODE_ENV=development          # 运行环境: development(开发) / production(生产)
PORT=3000                    # 服务器端口号
HOST=localhost               # 服务器主机地址

# JWT身份验证配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h           # JWT令牌过期时间

# 数据库配置 (SQLite)
DB_PATH=./data/military-knowledge.db    # SQLite数据库文件路径

# 日志配置
LOG_LEVEL=info               # 日志级别: error, warn, info, debug
LOG_FILE=./logs/app.log      # 日志文件路径

# API限流配置
RATE_LIMIT_WINDOW_MS=900000  # 限流时间窗口 (15分钟)
RATE_LIMIT_MAX_REQUESTS=100  # 时间窗口内最大请求数
```

## 配置项详细说明

### 1. 服务器配置
- **NODE_ENV**: 
  - `development`: 开发模式，显示详细错误信息
  - `production`: 生产模式，隐藏敏感错误信息
- **PORT**: 服务器监听端口，默认3000
- **HOST**: 服务器绑定地址，默认localhost

### 2. JWT配置
- **JWT_SECRET**: 
  - 用于签名JWT令牌的密钥
  - **重要**: 生产环境必须修改为复杂密钥
  - 建议使用32位以上随机字符串
- **JWT_EXPIRES_IN**: JWT令牌有效期
  - 格式: `1h`(1小时), `24h`(24小时), `7d`(7天)

### 3. 数据库配置
- **DB_PATH**: SQLite数据库文件存储路径
  - 相对路径: `./data/military-knowledge.db`
  - 绝对路径: `/path/to/database.db`
  - 系统会自动创建目录和文件

### 4. 日志配置
- **LOG_LEVEL**: 日志记录级别
  - `error`: 只记录错误
  - `warn`: 记录警告和错误
  - `info`: 记录信息、警告和错误 (推荐)
  - `debug`: 记录所有信息 (开发调试用)
- **LOG_FILE**: 日志文件保存路径

### 5. API限流配置
- **RATE_LIMIT_WINDOW_MS**: 限流时间窗口 (毫秒)
  - 900000 = 15分钟
- **RATE_LIMIT_MAX_REQUESTS**: 时间窗口内最大请求数
  - 防止API被恶意调用

## 如何修改配置

### 方法1: 直接编辑文件
```bash
# 使用文本编辑器打开
notepad backend/.env        # Windows
nano backend/.env           # Linux/Mac
```

### 方法2: 命令行修改
```bash
# 修改端口号
echo "PORT=8080" >> backend/.env

# 修改JWT密钥
echo "JWT_SECRET=my-new-super-secret-key-2024" >> backend/.env
```

## 生产环境配置建议

### 安全配置
```bash
# 生产环境配置示例
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 使用强密钥 (32位以上随机字符)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
JWT_EXPIRES_IN=2h

# 生产数据库路径
DB_PATH=/var/lib/military-backend/database.db

# 生产日志配置
LOG_LEVEL=warn
LOG_FILE=/var/log/military-backend/app.log

# 严格限流
RATE_LIMIT_WINDOW_MS=600000   # 10分钟
RATE_LIMIT_MAX_REQUESTS=50    # 50次请求
```

### 密钥生成方法
```bash
# 方法1: 使用Node.js生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法2: 使用在线工具
# 访问: https://www.uuidgenerator.net/

# 方法3: 使用OpenSSL
openssl rand -hex 32
```

## 配置验证

启动服务时，系统会自动验证配置：
```bash
npm run dev
```

查看启动日志确认配置是否正确：
```
info: 兵智世界后端服务启动成功 (简化版)
info: 服务器运行在端口: 3000
info: 环境: development
info: 数据库: SQLite
```

## 常见配置问题

### 1. 端口被占用
```bash
# 错误信息: EADDRINUSE: address already in use
# 解决方法: 修改PORT配置或关闭占用端口的程序
PORT=8080
```

### 2. 数据库权限问题
```bash
# 错误信息: EACCES: permission denied
# 解决方法: 确保数据目录有写入权限
mkdir -p backend/data
chmod 755 backend/data
```

### 3. JWT密钥过短
```bash
# 警告信息: JWT secret should be at least 32 characters
# 解决方法: 使用更长的密钥
JWT_SECRET=your-very-long-and-secure-secret-key-at-least-32-characters
```

## 配置文件模板

### 开发环境 (.env.development)
```bash
NODE_ENV=development
PORT=3000
HOST=localhost
JWT_SECRET=dev-secret-key-not-for-production-use-only
JWT_EXPIRES_IN=24h
DB_PATH=./data/dev-database.db
LOG_LEVEL=debug
LOG_FILE=./logs/dev.log
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### 生产环境 (.env.production)
```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
JWT_SECRET=production-super-secret-key-change-this
JWT_EXPIRES_IN=2h
DB_PATH=/var/lib/app/database.db
LOG_LEVEL=warn
LOG_FILE=/var/log/app/app.log
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_MAX_REQUESTS=100
```

---

**重要提醒**: 
- 生产环境务必修改JWT_SECRET
- 定期备份数据库文件
- 监控日志文件大小，定期清理