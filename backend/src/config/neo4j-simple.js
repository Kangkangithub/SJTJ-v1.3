/**
 * Neo4j 连接管理（simple app 专用）
 * 为 app-simple.js 提供轻量级 Neo4j 驱动实例
 * 
 * @description 单例模式管理 neo4j-driver 连接，供知识图谱路由和后续 RAG 模块共享
 */
const neo4j = require('neo4j-driver');

class Neo4jSimpleManager {
  constructor() {
    this.driver = null;
  }

  /** 初始化 Neo4j 驱动 */
  async connect() {
    const uri = process.env.NEO4J_URI;
    const username = process.env.NEO4J_USERNAME;
    const password = process.env.NEO4J_PASSWORD;

    if (!uri || !username || !password) {
      console.warn('[Neo4j] 缺少连接凭据，跳过 Neo4j 初始化');
      return null;
    }

    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
        maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 小时
        maxConnectionPoolSize: 10,
        connectionTimeout: 30000,
        connectionAcquisitionTimeout: 30000
      });

      // 验证连接
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();

      console.log('[Neo4j] AuraDB 连接成功');

      // 定时保活（AuraDB Free 版 3 天无活动自动休眠）
      this._startKeepAlive();

      return this.driver;
    } catch (error) {
      console.error('[Neo4j] AuraDB 连接失败:', error.message);
      throw error;
    }
  }

  /** 获取 Neo4j 会话 */
  getSession() {
    if (!this.driver) {
      throw new Error('[Neo4j] 驱动未初始化，请先调用 connect()');
    }
    return this.driver.session();
  }

  /** 获取驱动实例（供 LangChain 等复用） */
  getDriver() {
    return this.driver;
  }


  /** 启动定时保活，防止 AuraDB Free 版休眠 */
  _startKeepAlive() {
    if (this._keepAliveTimer) return; // 避免重复启动
    const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30 分钟
    this._keepAliveTimer = setInterval(async () => {
      try {
        if (!this.driver) return;
        const session = this.driver.session();
        await session.run('RETURN 1');
        await session.close();
        console.log('[Neo4j] KeepAlive ping 成功');
      } catch (e) {
        console.warn('[Neo4j] KeepAlive ping 失败:', e.message);
      }
    }, KEEP_ALIVE_INTERVAL);
    console.log('[Neo4j] KeepAlive 已启动，间隔 ' + (KEEP_ALIVE_INTERVAL / 60000) + ' 分钟');
  }
  /** 关闭连接 */
  async close() {
    if (this._keepAliveTimer) {
      clearInterval(this._keepAliveTimer);
      this._keepAliveTimer = null;
      console.log('[Neo4j] KeepAlive 已停止');
    }
    if (this.driver) {
      await this.driver.close();
      console.log('[Neo4j] 连接已关闭');
    }
  }
}

// 单例导出
module.exports = new Neo4jSimpleManager();
