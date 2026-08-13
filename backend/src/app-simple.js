const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./config');
const databaseManager = require('./config/database-simple');
const logger = require('./utils/logger');

// 导入简化版服务
const userService = require('./services/userService-simple');

// 通用 API 缓存（参考数据几乎不改，缓存 1 小时）
const apiCache = new Map();
const API_CACHE_TTL = 3600 * 1000;
function cacheMiddleware(key) {
  return (req, res, next) => {
    const cached = apiCache.get(key);
    if (cached && Date.now() < cached.expires) {
      return res.json(cached.data);
    }
    // 拦截 res.json 以缓存响应
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && body.success) {
        apiCache.set(key, { data: body, expires: Date.now() + API_CACHE_TTL });
      }
      return originalJson(body);
    };
    next();
  };
}
function clearApiCache(pattern) {
  if (!pattern) { apiCache.clear(); return; }
  for (const key of apiCache.keys()) {
    if (key.includes(pattern)) apiCache.delete(key);
  }
}

// 导入路由（需要创建简化版）
const authRoutes = require('./routes/auth-simple');
const herbRoutes = require('./routes/herbs');

class SimpleApp {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  // 设置中间件
  setupMiddleware() {
    // 安全中间件（开放 CSP 以允许内联脚本，适配现有 HTML 页面）
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://d3js.org",
            "https://unpkg.com",
            "https://cdnjs.cloudflare.com"
          ],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "http://localhost:3001", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com"],
          fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"]
        }
      }
    }));

    // CORS配置
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['http://localhost:3001'] 
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-admin-user']
    }));

    // 压缩响应
    this.app.use(compression());

    // 请求日志
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    }));

    // 解析JSON和URL编码的请求体
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 静态文件服务
    // 前端页面（项目根目录下的 HTML 文件）
    this.app.use(express.static(path.join(__dirname, '../../')));
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
    this.app.use('/public', express.static(path.join(__dirname, '../public')));

    // API限流
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        message: '请求过于频繁，请稍后再试'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // 健康检查中间件
    this.app.use('/health', (req, res) => {
      res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'SQLite'
      });
    });
    this.app.use('/api/health', (req, res) => {
      res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'SQLite'
      });
    });
  }

  // 设置路由
  setupRoutes() {
    // API根路径
    this.app.get('/api', (req, res) => {
      res.json({
        success: true,
        message: '神农AI - 药材知识库后端API服务',
        version: '2.0.0',
        database: 'SQLite (herb-knowledge.db)',
        endpoints: {
          herbs: '/api/herbs',
          herbDetail: '/api/herbs/:id',
          herbSearch: '/api/herbs/search',
          herbStatistics: '/api/herbs/statistics',
          herbCategories: '/api/herb-categories',
          herbRegions: '/api/herb-regions',
          herbSources: '/api/herb-sources',
          herbImages: '/api/herb-images/:herbId',
          formulas: '/api/formulas',
          formulaDetail: '/api/formulas/:id',
          recommendations: '/api/recommendations',
          quizQuestions: '/api/quiz/questions',
          quizLeaderboard: '/api/quiz/leaderboard',
          herbRecognition: '/api/herb-recognition',
          aiChat: '/api/ai-gateway/chat (需登录)',
          aiAnalyzeHerb: '/api/ai-gateway/analyze-herb (需登录)',
          aiCheckCompatibility: '/api/ai-gateway/check-compatibility (需登录)',
          knowledgeGraph: '/api/knowledge/graph-data',
          herbDetailsAPI: '/api/knowledge/herb-details/:name',
          regionDistribution: '/api/knowledge/region-distribution',
          health: '/api/health',
          auth: '/api/auth/login'
        }
      });
    });

    // 注册路由
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/herbs', herbRoutes);
    this.app.use('/api/herb-categories', cacheMiddleware('herb-categories'), require('./routes/herb-categories'));
    this.app.use('/api/herb-regions', cacheMiddleware('herb-regions'), require('./routes/herb-regions'));
    this.app.use('/api/herb-sources', cacheMiddleware('herb-sources'), require('./routes/herb-sources'));
    this.app.use('/api/herb-images', require('./routes/herb-images'));
    this.app.use('/api/formulas', require('./routes/formulas'));
    this.app.use('/api/recommendations', require('./routes/recommendations'));
    this.app.use('/api/quiz', require('./routes/quiz'));
    this.app.use('/api/herb-recognition', require('./routes/herb-recognition'));
    this.app.use('/api/knowledge', require('./routes/knowledge-graph'));
    this.app.use('/api/ai-gateway', require('./routes/ai-gateway'));

    // 手动清缓存（管理员用）
    this.app.post('/api/cache/clear', (req, res) => {
      apiCache.clear();
      res.json({ success: true, message: 'API 缓存已清空' });
    });


    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: '请求的资源不存在',
        path: req.originalUrl
      });
    });
  }

  // 设置错误处理
  setupErrorHandling() {
    // 全局错误处理中间件
    this.app.use((error, req, res, next) => {
      logger.error('全局错误处理:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
      });

      // SQLite错误
      if (error.code && error.code.startsWith('SQLITE_')) {
        return res.status(503).json({
          success: false,
          message: '数据库操作错误，请稍后重试'
        });
      }

      // JWT错误
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: '身份验证失败'
        });
      }

      // 验证错误
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: '数据验证失败',
          details: error.message
        });
      }

      // 默认错误响应
      res.status(error.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' 
          ? '服务器内部错误' 
          : error.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
      });
    });

    // 未捕获的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝:', reason);
    });

    // 未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
      process.exit(1);
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
      logger.info('收到SIGTERM信号，开始优雅关闭...');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('收到SIGINT信号，开始优雅关闭...');
      this.gracefulShutdown();
    });
  }

  // 优雅关闭
  async gracefulShutdown() {
    try {
      logger.info('正在关闭数据库连接...');
      await databaseManager.close();
      logger.info('数据库连接已关闭');
      process.exit(0);
    } catch (error) {
      logger.error('优雅关闭过程中出错:', error);
      process.exit(1);
    }
  }

  // 启动服务器
  async start() {
    try {
      // 初始化数据库连接
      logger.info('正在初始化SQLite数据库...');
      await databaseManager.connect();

      // 启动HTTP服务器
      const port = config.server.port;
      this.server = this.app.listen(port, () => {
        logger.info(`兵智世界后端服务启动成功 (简化版)`);
        logger.info(`服务器运行在端口: ${port}`);
        logger.info(`环境: ${config.server.env}`);
        logger.info(`数据库: SQLite`);
        logger.info(`健康检查: http://localhost:${port}/health`);
        logger.info(`API文档: http://localhost:${port}/api`);
      });

      return this.server;
    } catch (error) {
      logger.error('服务器启动失败:', error);
      process.exit(1);
    }
  }

  // 获取Express应用实例
  getApp() {
    return this.app;
  }
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  const app = new SimpleApp();
  app.start();
}

module.exports = SimpleApp;
