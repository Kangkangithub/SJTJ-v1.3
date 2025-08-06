require('dotenv').config();

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // 数据库配置
  databases: {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/military-knowledge',
      testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/military-knowledge-test'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    }
  },

  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || 'uploads/',
    maxFileSize: process.env.MAX_FILE_SIZE || 10485760 // 10MB
  },

  // API限流配置
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15分钟
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 1000 // 提高到1000个请求
  },

  // 缓存配置
  cache: {
    defaultTTL: 3600, // 1小时
    knowledgeGraphTTL: 7200, // 2小时
    userDataTTL: 1800 // 30分钟
  }
};

module.exports = config;