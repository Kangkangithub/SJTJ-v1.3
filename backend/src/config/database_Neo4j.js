const neo4j = require('neo4j-driver');
const { MongoClient } = require('mongodb');
const redis = require('redis');
const logger = require('../utils/logger');

class DatabaseManager {
  constructor() {
    this.neo4jDriver = null;
    this.mongoClient = null;
    this.redisClient = null;
  }

  // Neo4j连接
  async connectNeo4j() {
    try {
      this.neo4jDriver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
      );
      
      // 测试连接
      const session = this.neo4jDriver.session();
      await session.run('RETURN 1');
      await session.close();
      
      logger.info('Neo4j数据库连接成功');
      return this.neo4jDriver;
    } catch (error) {
      logger.error('Neo4j数据库连接失败:', error);
      throw error;
    }
  }

  // MongoDB连接
  async connectMongoDB() {
    try {
      this.mongoClient = new MongoClient(process.env.MONGODB_URI);
      await this.mongoClient.connect();
      
      // 测试连接
      await this.mongoClient.db().admin().ping();
      
      logger.info('MongoDB数据库连接成功');
      return this.mongoClient;
    } catch (error) {
      logger.error('MongoDB数据库连接失败:', error);
      throw error;
    }
  }

  // Redis连接
  async connectRedis() {
    try {
      this.redisClient = redis.createClient({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD || undefined
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis连接错误:', err);
      });

      await this.redisClient.connect();
      
      logger.info('Redis缓存连接成功');
      return this.redisClient;
    } catch (error) {
      logger.error('Redis缓存连接失败:', error);
      throw error;
    }
  }

  // 初始化所有数据库连接
  async connectAll() {
    try {
      await Promise.all([
        this.connectNeo4j(),
        this.connectMongoDB(),
        this.connectRedis()
      ]);
      logger.info('所有数据库连接初始化完成');
    } catch (error) {
      logger.error('数据库连接初始化失败:', error);
      throw error;
    }
  }

  // 获取Neo4j会话
  getNeo4jSession() {
    if (!this.neo4jDriver) {
      throw new Error('Neo4j驱动未初始化');
    }
    return this.neo4jDriver.session();
  }

  // 获取MongoDB数据库实例
  getMongoDatabase(dbName = 'military-knowledge') {
    if (!this.mongoClient) {
      throw new Error('MongoDB客户端未初始化');
    }
    return this.mongoClient.db(dbName);
  }

  // 获取Redis客户端
  getRedisClient() {
    if (!this.redisClient) {
      throw new Error('Redis客户端未初始化');
    }
    return this.redisClient;
  }

  // 关闭所有连接
  async closeAll() {
    try {
      const promises = [];
      
      if (this.neo4jDriver) {
        promises.push(this.neo4jDriver.close());
      }
      
      if (this.mongoClient) {
        promises.push(this.mongoClient.close());
      }
      
      if (this.redisClient) {
        promises.push(this.redisClient.quit());
      }

      await Promise.all(promises);
      logger.info('所有数据库连接已关闭');
    } catch (error) {
      logger.error('关闭数据库连接时出错:', error);
    }
  }
}

// 创建单例实例
const databaseManager = new DatabaseManager();

module.exports = databaseManager;