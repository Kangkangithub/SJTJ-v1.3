require('dotenv').config();

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development'
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  // 数据库配置
  databases: {
    // SQLite 配置（当前使用）
    sqlite: {
      path: process.env.SQLITE_PATH || 'data/herb-knowledge.db'
    },
    // Neo4j 配置（完整模式使用）
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password'
    },
    // MongoDB 配置（完整模式使用）
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/military-knowledge',
      testUri: process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/military-knowledge-test'
    },
    // Redis 配置（完整模式使用）
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

//在Node.js中，process 是一个全局对象，它提供了关于当前Node.js进程的信息和控制功能。
// 这个对象是Node.js环境的核心部分，允许开发者与操作系统交互、控制应用程序的生命周期以及访问运行时环境数据。
// process.env 是 process 对象的一个属性，它是一个对象，包含了当前进程的所有环境变量。
// 环境变量是操作系统和运行的应用程序之间传递配置信息的一种方式，比如API密钥、数据库URL或者应用运行模式（如开发环境或生产环境）等。

//运行流程描述：
//引入 require('dotenv') 并调用 .config() 方法 -> 
// 该方法读取 .env 文件 -> 
// 文件中的键值对被设置为 Node.js 进程的环境变量 -> 
// 通过 process.env 访问这些环境变量 -> 
// 如需访问特定变量，如 process.env.USER 直接获取该变量的值。

//在我们的JS文件中可以再次对它结构化：
//const config = {
// mysql: {},
//};
//从环境变量中提取值并将它们组织成一个结构化的形式。
// 在应用代码中更方便地管理和使用这些配置项，提高代码的可读性和维护性，既安全又灵活。