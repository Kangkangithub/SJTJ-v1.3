/**
 * 三路混合检索服务（BM25 + 向量 + 知识图谱）+ RRF 融合
 *
 * @description 将原「图检索为主 + 向量可选补充」升级为三路并行检索，
 *   并用 RRF（Reciprocal Rank Fusion）统一重排，兼顾字面精确、语义泛化与关系推理。
 * @architecture 复用 neo4j-simple.js 单例连接 + embeddingService 向量检索
 */

const neo4jManager = require("../config/neo4j-simple");
const embeddingService = require("./embeddingService");

const LIMIT = 20;          // 每路检索返回条数
const RRF_K = 60;          // RRF 平滑参数（业界常用 60）

// Lucene 查询特殊字符转义，防止用户输入破坏查询语法
function escapeLucene(str) {
  return String(str || "").replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, "\\$1");
}

class HybridSearchService {
  constructor() {
    this.indexName = "herb_fulltext";
    this.indexReady = false;
  }

  // =============================================
  // 确保全文索引存在（幂等，cjk 分析器处理中文）
  // =============================================
  async ensureFulltextIndex() {
    if (this.indexReady) return true;
    const session = neo4jManager.getSession();
    try {
      const cypher = [
        "CREATE FULLTEXT INDEX herb_fulltext IF NOT EXISTS",
        "FOR (h:Herb) ON EACH [h.name, h.pinyin, h.description, h.efficacy]",
        "OPTIONS { indexConfig: { `fulltext.analyzer`: 'cjk' } }"
      ].join(" ");
      await session.run(cypher);
      this.indexReady = true;
      console.log("[Hybrid] Neo4j 全文索引就绪（cjk analyzer）");
      return true;
    } catch (e) {
      console.warn("[Hybrid] 全文索引初始化失败:", e.message);
      return false;
    } finally {
      if (session) await session.close();
    }
  }

  // =============================================
  // 路1：BM25 全文检索（字段加权：name^3 > pinyin^2 > efficacy/description）
  // =============================================
  async searchBM25(query, keywords = []) {
    const ok = await this.ensureFulltextIndex();
    if (!ok) return [];
    const session = neo4jManager.getSession();
    try {
      const terms = [query, ...(keywords || [])].filter(t => t && t.length >= 2);
      const uniqueTerms = [...new Set(terms)].slice(0, 5);
      if (uniqueTerms.length === 0) return [];

      // Lucene 加权查询：名称命中权重最高，其次是拼音、功效、描述
      const luceneQuery = uniqueTerms.map(t => {
        const q = escapeLucene(t);
        return `name:${q}^3 OR pinyin:${q}^2 OR efficacy:${q} OR description:${q}`;
      }).join(" OR ");

      const cypher = "CALL db.index.fulltext.queryNodes($indexName, $query) " +
        "YIELD node, score RETURN node.name AS name, score LIMIT " + LIMIT;
      const result = await session.run(cypher, { indexName: this.indexName, query: luceneQuery });
      return result.records.map(r => ({
        name: r.get("name"),
        score: r.get("score"),
        source: "bm25"
      }));
    } catch (e) {
      console.warn("[Hybrid] BM25 检索失败:", e.message);
      return [];
    } finally {
      if (session) await session.close();
    }
  }

  // =============================================
  // 路2：向量语义检索（复用 embeddingService，无 key 时返回空）
  // =============================================
  async searchVector(query) {
    if (!embeddingService.isReady()) return [];
    try {
      const hits = await embeddingService.search(query, LIMIT);
      return hits.map(h => ({ name: h.name, score: h.score, source: "vector" }));
    } catch (e) {
      console.warn("[Hybrid] 向量检索失败:", e.message);
      return [];
    }
  }

  // =============================================
  // 路3：知识图谱检索（CONTAINS，按字段优先级给分）
  // =============================================
  async searchGraph(query, keywords = []) {
    const session = neo4jManager.getSession();
    try {
      const terms = [query, ...(keywords || [])].filter(t => t && t.length >= 2);
      const uniqueTerms = [...new Set(terms)].slice(0, 8);
      if (uniqueTerms.length === 0) return [];
      const results = [];
      const seen = new Set();

      // 第1轮：名称精确匹配（图分 3.0）
      const nameCypher = [
        "MATCH (h:Herb)",
        "WHERE h.name IS NOT NULL AND h.name <> ''",
        "  AND any(term IN $terms WHERE h.name CONTAINS term)",
        "RETURN h.name AS name",
        "LIMIT " + LIMIT
      ].join("\n");
      const nameResult = await session.run(nameCypher, { terms: uniqueTerms });
      for (const r of nameResult.records) {
        const name = r.get("name");
        if (!name || seen.has(name)) continue;
        seen.add(name);
        results.push({ name, score: 3.0, source: "graph" });
      }

      // 第2轮：功效/描述/拼音匹配（图分 2.0）
      if (results.length < LIMIT) {
        const fuzzyCypher = [
          "MATCH (h:Herb)",
          "WHERE h.name IS NOT NULL AND h.name <> ''",
          "  AND (any(term IN $terms WHERE h.description CONTAINS term)",
          "    OR any(term IN $terms WHERE h.efficacy CONTAINS term)",
          "    OR any(term IN $terms WHERE h.pinyin CONTAINS term))",
          "RETURN h.name AS name",
          "LIMIT " + LIMIT
        ].join("\n");
        const fuzzyResult = await session.run(fuzzyCypher, { terms: uniqueTerms });
        for (const r of fuzzyResult.records) {
          const name = r.get("name");
          if (!name || seen.has(name)) continue;
          seen.add(name);
          results.push({ name, score: 2.0, source: "graph" });
        }
      }

      return results.slice(0, LIMIT);
    } catch (e) {
      console.warn("[Hybrid] 图检索失败:", e.message);
      return [];
    } finally {
      if (session) await session.close();
    }
  }

  // =============================================
  // RRF 融合：各路结果按排名取倒数求和，总分重排
  // =============================================
  rrfFusion(resultsList, k = RRF_K) {
    const fused = new Map();
    for (const results of resultsList) {
      if (!Array.isArray(results)) continue;
      results.forEach((item, rank) => {
        if (!item || !item.name) return;
        const rrf = 1 / (k + rank + 1);
        if (!fused.has(item.name)) {
          fused.set(item.name, { name: item.name, rrfScore: 0, sources: new Set() });
        }
        const entry = fused.get(item.name);
        entry.rrfScore += rrf;
        entry.sources.add(item.source);
      });
    }
    return Array.from(fused.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(e => ({ name: e.name, rrfScore: e.rrfScore, sources: [...e.sources] }));
  }

  // =============================================
  // 三路并行检索 + RRF 融合（对外主入口）
  // =============================================
  async hybridSearch(question, keywords = []) {
    const [bm25Results, vectorResults, graphResults] = await Promise.all([
      this.searchBM25(question, keywords),
      this.searchVector(question),
      this.searchGraph(question, keywords)
    ]);

    const ranked = this.rrfFusion([bm25Results, vectorResults, graphResults]);

    return {
      ranked,            // [{ name, rrfScore, sources }] 按融合分降序
      bm25Results,       // 路1 结果
      vectorResults,     // 路2 结果
      graphResults,      // 路3 结果
      vectorReady: embeddingService.isReady()
    };
  }
}

module.exports = new HybridSearchService();
