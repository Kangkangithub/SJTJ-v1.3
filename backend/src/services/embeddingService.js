/**
 * Embedding 语义检索服务
 *
 * @description 基于阿里云百炼（DashScope）text-embedding-v3 为药材做向量化，
 *   提供「语义检索」能力，弥补现有 CONTAINS 字面匹配无法处理
 *   「证型 ↔ 功效」不对齐的问题（如"肾虚"应命中"补肾阳/益精填髓"的药材）。
 *
 * 设计要点：
 *   1. 持久化：向量存 SQLite herb_embeddings 表，重启直接加载，不重复计算
 *   2. 增量 diff：启动时对比 Neo4j 药材清单，只为「新增/字段变化」的药材重新向量化
 *   3. 单条更新：herbs-manage 的增删改接口调用 updateOne/deleteOne，实时同步
 *
 * @note 只读依赖 neo4jManager（取药材字段）与 databaseManager（持久化），
 *   复用现有单例，不新建数据库连接。
 */

const axios = require("axios");
const neo4jManager = require("../config/neo4j-simple");
const databaseManager = require("../config/database-simple");

// 百炼 OpenAI 兼容端点（已验证可用，返回 1024 维）
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const MODEL = process.env.EMBEDDING_MODEL || "text-embedding-v3";
const BATCH_SIZE = 10; // 批量向量化（百炼 text-embedding-v3 单次上限 10 条）

class EmbeddingService {
  constructor() {
    this.ready = false;
    this.memory = new Map(); // name -> { vector: number[], sourceText: string }
    this._syncPromise = null;
  }

  getApiKey() {
    return process.env.DASHSCOPE_API_KEY;
  }

  /** 是否可用于语义检索 */
  isReady() {
    return this.ready && this.memory.size > 0;
  }

  // =============================================
  // 核心：调用百炼 embedding 接口
  // =============================================
  async embed(inputs) {
    const key = this.getApiKey();
    if (!key) throw new Error("DASHSCOPE_API_KEY 未配置");

    const isArray = Array.isArray(inputs);
    const resp = await axios.post(
      `${BASE_URL}/embeddings`,
      { model: MODEL, input: inputs },
      {
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        timeout: 30000
      }
    );

    const data = resp.data && resp.data.data ? resp.data.data : [];
    if (data.length === 0) throw new Error("embedding 返回为空");
    // 兼容模式下多输入按 index 排序
    data.sort((a, b) => (a.index || 0) - (b.index || 0));
    const vecs = data.map((d) => d.embedding);
    return isArray ? vecs : vecs[0];
  }

  // =============================================
  // 余弦相似度
  // =============================================
  cosine(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // =============================================
  // 构建向量化文本（name + description + 性味 + 归经 + 功效）
  // =============================================
  buildSourceText(herb) {
    const parts = [];
    if (herb.name) parts.push(herb.name);
    if (herb.pinyin) parts.push(herb.pinyin);
    if (herb.description) parts.push(herb.description);
    if (herb.properties && herb.properties.length) parts.push("性味：" + herb.properties.join("、"));
    if (herb.meridians && herb.meridians.length) parts.push("归经：" + herb.meridians.join("、"));
    if (herb.efficacies && herb.efficacies.length) parts.push("功效：" + herb.efficacies.join("、"));
    return parts.join("。");
  }

  // =============================================
  // 从 Neo4j 拉取全部药材的字段（含关系标签）
  // =============================================
  async loadAllHerbsFromNeo4j() {
    const session = neo4jManager.getSession();
    try {
      const r = await session.run(
        "MATCH (h:Herb) " +
          "OPTIONAL MATCH (h)-[:HAS_PROPERTY]->(p:Property) " +
          "OPTIONAL MATCH (h)-[:MERIDIAN_AFFINITY]->(m:Meridian) " +
          "OPTIONAL MATCH (h)-[:HAS_EFFICACY]->(e:Efficacy) " +
          "RETURN h.name AS name, h.pinyin AS pinyin, h.description AS description, " +
          "collect(DISTINCT p.name) AS props, collect(DISTINCT m.name) AS mers, collect(DISTINCT e.name) AS effs"
      );
      return r.records.map((rec) => ({
        name: rec.get("name"),
        pinyin: rec.get("pinyin") || "",
        description: rec.get("description") || "",
        properties: rec.get("props") || [],
        meridians: rec.get("mers") || [],
        efficacies: rec.get("effs") || []
      }));
    } finally {
      await session.close();
    }
  }

  /** 按名查询单味药材字段（供 updateOne 使用） */
  async loadHerbFromNeo4j(name) {
    const session = neo4jManager.getSession();
    try {
      const r = await session.run(
        "MATCH (h:Herb {name: $name}) " +
          "OPTIONAL MATCH (h)-[:HAS_PROPERTY]->(p:Property) " +
          "OPTIONAL MATCH (h)-[:MERIDIAN_AFFINITY]->(m:Meridian) " +
          "OPTIONAL MATCH (h)-[:HAS_EFFICACY]->(e:Efficacy) " +
          "RETURN h.name AS name, h.pinyin AS pinyin, h.description AS description, " +
          "collect(DISTINCT p.name) AS props, collect(DISTINCT m.name) AS mers, collect(DISTINCT e.name) AS effs",
        { name }
      );
      if (r.records.length === 0) return null;
      const rec = r.records[0];
      return {
        name: rec.get("name"),
        pinyin: rec.get("pinyin") || "",
        description: rec.get("description") || "",
        properties: rec.get("props") || [],
        meridians: rec.get("mers") || [],
        efficacies: rec.get("effs") || []
      };
    } finally {
      await session.close();
    }
  }

  // =============================================
  // SQLite 持久化（复用 database-simple 单例）
  // =============================================
  _db() {
    return databaseManager.getDatabase();
  }

  _dbAll(sql, params) {
    return new Promise((resolve, reject) => {
      this._db().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
  }

  _dbRun(sql, params) {
    return new Promise((resolve, reject) => {
      this._db().run(sql, params, function (err) {
        err ? reject(err) : resolve(this);
      });
    });
  }

  async loadFromDb() {
    const rows = await this._dbAll("SELECT name, vector, source_text FROM herb_embeddings");
    for (const row of rows) {
      try {
        this.memory.set(row.name, {
          vector: JSON.parse(row.vector),
          sourceText: row.source_text || ""
        });
      } catch (e) {
        console.warn("[Embedding] 跳过损坏的向量记录:", row.name);
      }
    }
  }

  // =============================================
  // 增量同步：对比 Neo4j 清单，只算缺失/变化的药材
  // =============================================
  syncAll() {
    if (this._syncPromise) return this._syncPromise;
    this._syncPromise = this._doSync().finally(() => {
      this._syncPromise = null;
    });
    return this._syncPromise;
  }

  async _doSync() {
    if (!this.getApiKey()) {
      console.warn("[Embedding] DASHSCOPE_API_KEY 未配置，跳过语义检索初始化");
      return;
    }
    try {
      await this.loadFromDb();
      const herbs = await this.loadAllHerbsFromNeo4j();

      // diff：找出缺失或 source_text 变化的药材
      const herbMap = new Map();
      const toEmbed = [];
      for (const h of herbs) {
        const text = this.buildSourceText(h);
        herbMap.set(h.name, text);
        const cached = this.memory.get(h.name);
        if (!cached || cached.sourceText !== text) {
          toEmbed.push(h);
        }
      }
      // 清理 Neo4j 中已删除的药材
      for (const name of Array.from(this.memory.keys())) {
        if (!herbMap.has(name)) this.memory.delete(name);
      }

      if (toEmbed.length === 0) {
        this.ready = true;
        console.log(`[Embedding] 语义检索就绪，无增量（内存 ${this.memory.size} 个向量）`);
        return;
      }

      console.log(`[Embedding] 增量同步：共 ${herbs.length} 味，需计算 ${toEmbed.length} 味`);
      for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
        const batch = toEmbed.slice(i, i + BATCH_SIZE);
        const texts = batch.map((h) => this.buildSourceText(h));
        const vecs = await this.embed(texts);
        for (let j = 0; j < batch.length; j++) {
          const h = batch[j];
          const text = texts[j];
          const vec = vecs[j];
          this.memory.set(h.name, { vector: vec, sourceText: text });
          await this._dbRun(
            "INSERT OR REPLACE INTO herb_embeddings (name, vector, source_text, model) VALUES (?,?,?,?)",
            [h.name, JSON.stringify(vec), text, MODEL]
          );
        }
        console.log(`[Embedding] 已向量化 ${Math.min(i + BATCH_SIZE, toEmbed.length)}/${toEmbed.length}`);
      }
      this.ready = true;
      console.log(`[Embedding] 语义检索就绪，内存 ${this.memory.size} 个向量`);
    } catch (e) {
      console.error("[Embedding] 同步失败:", e.message);
    }
  }

  // =============================================
  // 语义检索：返回 top-K 相关药材（按余弦相似度降序）
  // =============================================
  async search(queryText, k = 10) {
    if (!this.isReady()) return [];
    try {
      const qv = await this.embed(queryText);
      const results = [];
      for (const [name, entry] of this.memory) {
        results.push({ name, score: this.cosine(qv, entry.vector) });
      }
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, k);
    } catch (e) {
      console.warn("[Embedding] 语义检索失败:", e.message);
      return [];
    }
  }

  // =============================================
  // 单条更新 / 删除（供 herbs-manage CRUD 调用）
  // =============================================
  async updateOne(name) {
    if (!this.getApiKey()) return;
    try {
      const herb = await this.loadHerbFromNeo4j(name);
      if (!herb) return;
      const text = this.buildSourceText(herb);
      const vec = await this.embed(text);
      this.memory.set(name, { vector: vec, sourceText: text });
      await this._dbRun(
        "INSERT OR REPLACE INTO herb_embeddings (name, vector, source_text, model) VALUES (?,?,?,?)",
        [name, JSON.stringify(vec), text, MODEL]
      );
      console.log(`[Embedding] 已更新药材向量: ${name}`);
    } catch (e) {
      console.warn(`[Embedding] 更新 ${name} 向量失败:`, e.message);
    }
  }

  async deleteOne(name) {
    this.memory.delete(name);
    try {
      await this._dbRun("DELETE FROM herb_embeddings WHERE name = ?", [name]);
      console.log(`[Embedding] 已删除药材向量: ${name}`);
    } catch (e) {
      console.warn(`[Embedding] 删除 ${name} 向量失败:`, e.message);
    }
  }

  getStatus() {
    return {
      ready: this.ready,
      model: MODEL,
      count: this.memory.size
    };
  }
}

// 单例导出
module.exports = new EmbeddingService();
