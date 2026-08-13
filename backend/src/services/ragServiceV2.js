/**
 * RAG 智能问答服务 V2（LangChain.js + Neo4j GraphRAG）
 * 
 * @description 基于 LangChain.js 实现 GraphRAG 管道，支持两种检索模式：
 *   模式A - GraphCypherQAChain：LLM 自动生成 Cypher 查询
 *   模式B - 手动增强检索：关键词提取 → 图遍历 → 上下文构建 → LLM 生成
 * 
 * @architecture 方案 B（后端代理）：复用 neo4j-simple.js 单例连接
 * @security API Key 仅从 process.env 读取，不暴露
 */
const { ChatOpenAI } = require("@langchain/openai");
const { Neo4jGraph } = require("@langchain/community/graphs/neo4j_graph");
const { GraphCypherQAChain } = require("@langchain/community/chains/graph_qa/cypher");
const neo4jManager = require("../config/neo4j-simple");
const path = require("path");
const fs = require("fs");

// =============================================
// 缓存配置
// =============================================
const answerCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;           // 答案缓存 5 分钟
const CACHE_VERSION = 4;                    // 每次修改搜索逻辑时递增，强制刷新旧缓存
const herbEnrichCache = new Map();
const ENRICH_CACHE_TTL = 24 * 60 * 60 * 1000; // LLM 知识增强缓存 24 小时

// =============================================
// 中文停用词：这些词即使出现在问题中也不作为搜索关键词
// =============================================
const STOP_WORDS = new Set([
  "什么", "怎么", "如何", "为什么", "哪里", "哪个", "哪些", "可以",
  "能够", "应该", "需要", "是否", "吗", "呢", "吧", "啊", "的", "了",
  "在", "是", "有", "和", "与", "或", "及", "等", "用", "来", "去",
  "功效", "作用", "效果", "用途", "功能", "好处", "调理", "调理方法",
  "补药", "药材", "中药", "中医药", "配方", "方剂", "问题", "方法",
  "请问", "问一下", "想知道", "了解", "介绍", "说明", "讲解"
]);

class RAGServiceV2 {
  constructor() {
    this.llm = null;
    this.graph = null;
    this.cypherChain = null;
    this.initialized = false;
  }

  // =============================================
  // 初始化 LangChain 组件（惰性，首次调用时）
  // =============================================
  async initialize() {
    if (this.initialized) return;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === "YOUR_DEEPSEEK_API_KEY_HERE") {
      console.warn("[RAG-V2] DeepSeek API Key 未配置，GraphRAG 不可用");
      return;
    }

    // 第1步：初始化 LLM（DeepSeek）—— 核心组件，必须成功
    try {
      this.llm = new ChatOpenAI({
        modelName: "deepseek-chat",
        apiKey: apiKey,
        temperature: 0.3,
        configuration: { baseURL: "https://api.deepseek.com" }
      });
      console.log("[RAG-V2] LLM (DeepSeek) 初始化成功");
    } catch (error) {
      console.error("[RAG-V2] LLM 初始化失败:", error.message);
      return;
    }

    // 第2步：跳过 LangChain Neo4jGraph（避免重复创建 driver 导致连接池耗尽）
    // 所有 Neo4j 操作统一使用 neo4j-simple.js 单例
    console.log("[RAG-V2] 跳过 GraphCypherQAChain（使用手动增强模式 + neo4j-simple 单例）");
    this.graph = null;
    this.cypherChain = null;

    this.initialized = true;
    console.log("[RAG-V2] 初始化完成: LLM=" + (!!this.llm) + " CypherChain=" + (!!this.cypherChain));
  }

  // =============================================
  // 模式A：GraphCypherQAChain（LLM 自动生成 Cypher）
  // =============================================
  async ragViaChain(question) {
    if (!this.cypherChain) {
      console.warn("[RAG-V2] GraphCypherQAChain 未初始化，回退到手动模式");
      return null;
    }

    try {
      const result = await this.cypherChain.invoke({ query: question });
      return {
        answer: result.result || result.text || "",
        mode: "cypher-chain",
        cypher: result.intermediateSteps?.[0]?.action?.toolInput || null
      };
    } catch (error) {
      console.warn("[RAG-V2] GraphCypherQAChain 失败:", error.message);
      return null;
    }
  }

  // =============================================
  // 模式B：手动增强检索（关键词 → Cypher → 图遍历 → LLM）
  // =============================================
  async ragViaManual(question) {
    // 步骤0：LLM 提取中医药关键词（药材名、症状、功效等）
    console.log("[RAG-V2] 提取关键词...");
    const keywords = await this.extractKeywords(question);
    console.log("[RAG-V2] 关键词:", keywords);

    // 步骤1：在 Neo4j 中搜索（使用 LLM 关键词 + 问题原文双路匹配）
    const searchResults = await this.searchNeo4j(question, keywords);
    
    // 如果 LLM 关键词匹配没有结果，尝试只用问题原文搜索
    let finalResults = searchResults;
    if ((!searchResults || (searchResults.herbs.length === 0 && searchResults.formulas.length === 0)) && keywords.length > 0) {
      console.log("[RAG-V2] 关键词搜索无结果，尝试纯文本搜索...");
      finalResults = await this.searchNeo4j(question, []);
    }

    // 如果 Neo4j 完全没有任何匹配，返回 null，由 answer 层处理 LLM 直接回答
    if (!finalResults || (finalResults.herbs.length === 0 && finalResults.formulas.length === 0)) {
      console.log("[RAG-V2] Neo4j 无匹配药材，上升到 LLM 直接回答");
      return null;
    }

    console.log("[RAG-V2] 找到药材:", finalResults.herbs.map(h=>h.name).join(","), "方剂:", finalResults.formulas.map(f=>f.name).join(","));

    // 步骤2：对命中的药材做 1-2 跳图遍历，获取丰富上下文
    const enrichedContext = await this.enrichWithGraphTraversal(finalResults);
    
    // 步骤2.5：LLM 知识增强 —— 调用 DeepSeek 补全每味药材的详细信息
    await this.enrichHerbDetails(enrichedContext);

    // 步骤3：构建结构化上下文文本（含 LLM 增强数据）
    const contextText = this.buildContextText(enrichedContext);

    // 步骤4：调用 LLM 生成答案
    const answer = await this.generateAnswer(question, contextText, enrichedContext);

    // 检测 LLM 是否返回了 "未找到" 风格的答案
    const notFoundPatterns = [/抱歉.*未找到/i, /未找到相关/, /没有匹配/, /请尝试其他关键词/];
    const isNotFoundAnswer = notFoundPatterns.some(function(p) { return p.test(answer); });
    if (isNotFoundAnswer) {
      console.log("[RAG-V2] 答案检测为未找到，返回 null 触发 fallback");
      return null;
    }

    return {
      answer,
      mode: "manual-enhanced",
      sources: enrichedContext.herbs.map(h => h.name),
      formulas: enrichedContext.formulas.map(f => f.name),
      keywords: keywords
    };
  }

  // =============================================
  // LLM 提取问题中的中医药关键词
  // =============================================
  async extractKeywords(question) {
    if (!this.llm) return [];

    try {
      const prompt = "你是中医药专家。从以下用户问题中提取中医药关键词（药材名、方剂名、症状、证型、功效术语等）。" +
        '只返回 JSON 数组格式，如 ["人参","补气","气虚"]。不要返回任何解释。' +
        "\n\n问题：" + question;

      const response = await this.llm.invoke([
        { role: "system", content: "你是中医药专家。只返回 JSON 数组，不要任何解释。" },
        { role: "user", content: prompt }
      ]);

      const text = typeof response === "string" ? response : (response.content || response.text || "");
      console.log("[RAG-V2] LLM关键词原始返回:", text.substring(0, 200));
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      console.log("[RAG-V2] LLM关键词清洗后:", cleaned.substring(0, 200));

      let keywords = [];
      try {
        keywords = JSON.parse(cleaned);
      } catch (e) {
        // JSON 解析失败，尝试从文本中匹配数组
        const match = cleaned.match(/\[([^\]]+)\]/);
        if (match) {
          keywords = match[1].split(",").map(k => k.trim().replace(/^["']|["']$/g, ""));
        }
      }

      // 不过滤 LLM 关键词（LLM 足够智能，返回的都是相关中医药术语）
      // 停用词过滤仅用于 n-gram 回退
      keywords = Array.isArray(keywords)
        ? keywords.filter(k => k && k.length >= 2)
        : [];

      // 如果 LLM 提取的关键词太少（<2个），用问题原文做 n-gram 补充
      // n-gram 只取 3-6 字片段，且必须包含中文、非停用词
      if (keywords.length < 2 && question && question.length >= 2) {
        const ngramSet = new Set(keywords);
        for (let i = 0; i <= question.length - 2; i++) {
          for (let len = 3; len <= Math.min(6, question.length - i); len++) {
            const frag = question.substring(i, i + len);
            if (/[\u4e00-\u9fff]/.test(frag) && !STOP_WORDS.has(frag) && frag.length >= 2) {
              ngramSet.add(frag);
            }
          }
        }
        keywords = [...ngramSet];
      }

      return keywords.filter(k => k && k.length >= 2);
    } catch (error) {
      console.warn("[RAG-V2] 关键词提取失败:", error.message);
      // 回退：从问题中取 3-6 字 n-gram，过滤停用词
      const fallback = [];
      if (question) {
        const seen = new Set();
        for (let i = 0; i <= question.length - 2; i++) {
          for (let len = 3; len <= Math.min(6, question.length - i); len++) {
            const frag = question.substring(i, i + len);
            if (!seen.has(frag) && /[\u4e00-\u9fff]/.test(frag) && !STOP_WORDS.has(frag)) {
              seen.add(frag);
              fallback.push(frag);
            }
          }
        }
      }
      return fallback;
    }
  }

  // =============================================
  // Neo4j 搜索：两轮策略 —— 先精确名称匹配，不够再扩展功效匹配
  // =============================================
  async searchNeo4j(query, keywords = []) {
    let session;
    try {
      session = neo4jManager.getSession();
      const herbs = [];
      const formulas = [];
      const seenHerbIds = new Set();

      // 构建搜索词（去重）
      const rawTerms = [query, ...(keywords || [])];
      const searchTerms = [...new Set(rawTerms.filter(t => t && t.length >= 2))];

      console.log("[RAG-V2] searchNeo4j: 搜索词数量=" + searchTerms.length);

      // ---- 第1轮：精确名称匹配（只匹配 h.name）----
      const exactCypher = [
        "MATCH (h:Herb)",
        "WHERE h.name IS NOT NULL AND h.name <> ''",
        "  AND any(term IN $terms WHERE h.name CONTAINS term)",
        "WITH h",
        "OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category)",
        "OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region)",
        "RETURN h, c.name AS category, r.name AS region",
        "LIMIT 20"
      ].join("\n");

      console.log("[RAG-V2] 第1轮：精确名称匹配...");
      const exactResult = await session.run(exactCypher, { terms: searchTerms });

      for (const record of exactResult.records) {
        const h = record.get("h");
        const id = h.identity.toString();
        if (seenHerbIds.has(id)) continue;
        seenHerbIds.add(id);
        herbs.push({
          id: id,
          name: h.properties.name,
          pinyin: h.properties.pinyin || "",
          latin_name: h.properties.latin_name || "",
          description: h.properties.description || "",
          efficacy: h.properties.efficacy || "",
          usage_dosage: h.properties.usage_dosage || "",
          caution: h.properties.caution || "",
          is_common: h.properties.is_common || 0,
          category: record.get("category") || "",
          region: record.get("region") || ""
        });
      }
      console.log("[RAG-V2] 第1轮精确匹配: " + herbs.length + " 味药材");

      // ---- 第2轮：如果精确匹配结果太少（<3），扩展搜索功效/描述/拼音 ----
      if (herbs.length < 2) {
        console.log("[RAG-V2] 第2轮：扩展功效/描述/拼音搜索...");
        const fuzzyCypher = [
          "MATCH (h:Herb)",
          "WHERE h.name IS NOT NULL AND h.name <> ''",
          "  AND (",
          "    any(term IN $terms WHERE h.description CONTAINS term)",
          "    OR any(term IN $terms WHERE h.efficacy CONTAINS term)",
          "    OR any(term IN $terms WHERE h.pinyin CONTAINS term)",
          "  )",
          "WITH h",
          "OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category)",
          "OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region)",
          "RETURN h, c.name AS category, r.name AS region",
          "LIMIT 15"
        ].join("\n");

        const fuzzyResult = await session.run(fuzzyCypher, { terms: searchTerms });

        for (const record of fuzzyResult.records) {
          const h = record.get("h");
          const id = h.identity.toString();
          if (seenHerbIds.has(id)) continue;
          seenHerbIds.add(id);
          herbs.push({
            id: id,
            name: h.properties.name,
            pinyin: h.properties.pinyin || "",
            latin_name: h.properties.latin_name || "",
            description: h.properties.description || "",
            efficacy: h.properties.efficacy || "",
            usage_dosage: h.properties.usage_dosage || "",
            caution: h.properties.caution || "",
            is_common: h.properties.is_common || 0,
            category: record.get("category") || "",
            region: record.get("region") || ""
          });
        }
        console.log("[RAG-V2] 第2轮扩展匹配: " + herbs.length + " 味药材（含第1轮）");
      }

      // ---- 方剂搜索 ----
      const formulaResult = await session.run(
        "MATCH (f:Formula) WHERE f.name IS NOT NULL AND f.name <> '' " +
        "AND any(term IN $terms WHERE f.name CONTAINS term OR f.description CONTAINS term) " +
        "RETURN f LIMIT 5",
        { terms: searchTerms }
      );

      for (const record of formulaResult.records) {
        const f = record.get("f");
        formulas.push({
          id: f.identity.toString(),
          name: f.properties.name,
          pinyin: f.properties.pinyin || "",
          category: f.properties.category || "",
          description: f.properties.description || ""
        });
      }

      console.log("[RAG-V2] 总计: " + herbs.length + " 味药材, " + formulas.length + " 首方剂");
      return { herbs, formulas };

    } catch (error) {
      console.warn("[RAG-V2] Neo4j 搜索失败:", error.message);
      return { herbs: [], formulas: [], searchError: true };
    } finally {
      if (session) await session.close();
    }
  }

  // =============================================
  // 图遍历：获取药材的性味、归经、功效、方剂关联、配伍冲突
  // =============================================
  async enrichWithGraphTraversal(searchResults) {
    const herbs = [...searchResults.herbs];
    const formulas = [...searchResults.formulas];

    if (herbs.length === 0) return { herbs, formulas };

    const session = neo4jManager.getSession();
    try {
      const herbNames = herbs.map(h => h.name);

      // 第1跳：性味、归经、功效
      const propCypher = [
        "MATCH (h:Herb)-[r]->(n)",
        "WHERE h.name IN $names",
        "  AND (r:HAS_PROPERTY OR r:MERIDIAN_AFFINITY OR r:HAS_EFFICACY)",
        "RETURN h.name AS herb, type(r) AS relType, n.name AS value"
      ].join("\n");

      const propResult = await session.run(propCypher, { names: herbNames });

      for (const record of propResult.records) {
        const herbName = record.get("herb");
        const relType = record.get("relType");
        const value = record.get("value");
        const herb = herbs.find(h => h.name === herbName);
        if (!herb) continue;

        if (relType === "HAS_PROPERTY") {
          if (!herb.properties) herb.properties = [];
          herb.properties.push(value);
        } else if (relType === "MERIDIAN_AFFINITY") {
          if (!herb.meridians) herb.meridians = [];
          herb.meridians.push(value);
        } else if (relType === "HAS_EFFICACY") {
          if (!herb.efficacies) herb.efficacies = [];
          herb.efficacies.push(value);
        }
      }

      // 第2跳：方剂关联
      const relCypher = [
        "MATCH (h:Herb)-[r:CONTAINS_HERB]-(f:Formula)",
        "WHERE h.name IN $names",
        "OPTIONAL MATCH (f)-[:CONTAINS_HERB]->(co:Herb)",
        "WHERE co.name IN $names",
        "RETURN h.name AS herb, f.name AS formula, f.description AS formulaDesc,",
        "       collect(DISTINCT co.name) AS coHerbs"
      ].join("\n");

      const relResult = await session.run(relCypher, { names: herbNames });

      const formulaSet = new Map();
      for (const record of relResult.records) {
        const fName = record.get("formula");
        if (!formulaSet.has(fName)) {
          formulaSet.set(fName, {
            name: fName,
            description: record.get("formulaDesc") || "",
            herbAssociations: []
          });
        }
        formulaSet.get(fName).herbAssociations.push({
          herb: record.get("herb"),
          coHerbs: (record.get("coHerbs") || []).filter(h => h !== record.get("herb"))
        });
      }
      formulas.push(...formulaSet.values());

      // 配伍冲突检测
      const compatResult = await session.run(
        "MATCH (h1:Herb)-[r:COMPATIBILITY]->(h2:Herb) " +
        "WHERE h1.name IN $names AND (r.type = '相反' OR r.type = '相恶' OR r.type = '禁忌') " +
        "RETURN h1.name AS herb, h2.name AS conflictHerb, r.type AS conflictType, r.description AS conflictDesc",
        { names: herbNames }
      );

      const conflicts = [];
      for (const record of compatResult.records) {
        conflicts.push({
          herb: record.get("herb"),
          conflictHerb: record.get("conflictHerb"),
          type: record.get("conflictType"),
          description: record.get("conflictDesc") || ""
        });
      }

      return { herbs, formulas: [...formulas], conflicts };
    } finally {
      await session.close();
    }
  }

  // =============================================
  // LLM 知识增强：调用 DeepSeek 补全药材详细信息
  // =============================================
  async enrichHerbDetails(enriched) {
    if (!this.llm || !enriched.herbs || enriched.herbs.length === 0) return;

    console.log("[RAG-V2] 开始LLM知识增强，共 " + enriched.herbs.length + " 味药材...");

    for (const herb of enriched.herbs) {
      // 检查缓存
      const cacheKey = "enrich_" + herb.name;
      const cached = herbEnrichCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ENRICH_CACHE_TTL) {
        Object.assign(herb, cached.data);
        continue;
      }

      try {
        const knownInfo = [];
        if (herb.category) knownInfo.push("分类：" + herb.category);
        if (herb.region) knownInfo.push("产地：" + herb.region);
        if (herb.properties && herb.properties.length) knownInfo.push("性味：" + herb.properties.join("、"));
        if (herb.meridians && herb.meridians.length) knownInfo.push("归经：" + herb.meridians.join("、"));
        if (herb.efficacy) knownInfo.push("功效：" + herb.efficacy);
        if (herb.description) knownInfo.push("描述：" + herb.description);
        const knownStr = knownInfo.length > 0 ? knownInfo.join("；") : "暂无数据库信息";

        const prompt = "你是资深中医药专家。请根据中医药经典和现代药典，为药材【" + herb.name + "】撰写详细专业信息。" +
          "已知数据：" + knownStr + "。" +
          "请以严格 JSON 格式返回（不要任何解释、不要 Markdown 标记）：" +
          '{"indications":"主治病症（50-150字）",' +
          '"usage_dosage":"用法用量（20-80字）",' +
          '"caution":"使用注意与禁忌（20-80字）",' +
          '"pharmacology":"现代药理研究摘要（50-150字）",' +
          '"clinical_application":"临床应用要点（30-100字）"}';

        const response = await this.llm.invoke([
          { role: "system", content: "你是中医药专家。只返回 JSON，不要任何解释或 Markdown。" },
          { role: "user", content: prompt }
        ]);

        const text = typeof response === "string" ? response : (response.content || response.text || "");

        let enrichedData = null;
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            enrichedData = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.warn("[RAG-V2] 药材 " + herb.name + " 补全 JSON 解析失败");
        }

        if (enrichedData) {
          Object.assign(herb, enrichedData);
          herbEnrichCache.set(cacheKey, { data: enrichedData, timestamp: Date.now() });
          console.log("[RAG-V2] 药材补全成功: " + herb.name);
        }
      } catch (error) {
        console.warn("[RAG-V2] 药材 " + herb.name + " 补全失败:", error.message);
      }
    }

    console.log("[RAG-V2] LLM知识增强完成: " + enriched.herbs.length + " / " + enriched.herbs.length);
  }

  // =============================================
  // 构建上下文文本（供 LLM 使用）
  // =============================================
  buildContextText(enriched) {
    const parts = [];

    if (enriched.herbs.length > 0) {
      parts.push("## 相关药材");
      enriched.herbs.forEach(h => {
        parts.push("### " + h.name + (h.pinyin ? "（" + h.pinyin + "）" : ""));
        if (h.category) parts.push("- 分类：" + h.category);
        if (h.properties && h.properties.length) parts.push("- 性味：" + h.properties.join("、"));
        if (h.meridians && h.meridians.length) parts.push("- 归经：" + h.meridians.join("、"));
        if (h.efficacy) parts.push("- 功效：" + h.efficacy);
        if (h.description) parts.push("- 主治：" + h.description);
        if (h.usage_dosage) parts.push("- 用法用量：" + h.usage_dosage);
        if (h.caution) parts.push("- ⚠️ 注意事项：" + h.caution);
        if (h.region) parts.push("- 产地：" + h.region);
        if (h.latin_name) parts.push("- 拉丁名：" + h.latin_name);
        if (h.is_common) parts.push("- 常用药材：是");
        // LLM 知识增强字段（DeepSeek 补全）
        if (h.indications) parts.push("- 📋 主治病症：" + h.indications);
        if (h.pharmacology) parts.push("- 🔬 现代药理：" + h.pharmacology);
        if (h.clinical_application) parts.push("- 🏥 临床应用：" + h.clinical_application);
      });
    }

    if (enriched.formulas.length > 0) {
      parts.push("\n## 相关方剂");
      enriched.formulas.forEach(f => {
        parts.push("### " + f.name);
        if (f.description) parts.push("- 说明：" + f.description);
        if (f.herbAssociations && f.herbAssociations.length) {
          f.herbAssociations.forEach(assoc => {
            parts.push("  - 关联药材：" + assoc.herb + (assoc.coHerbs.length ? "（配伍：" + assoc.coHerbs.join("、") + "）" : ""));
          });
        }
      });
    }

    if (enriched.conflicts && enriched.conflicts.length > 0) {
      parts.push("\n## ⚠️ 配伍冲突警告");
      enriched.conflicts.forEach(c => {
        parts.push("- " + c.herb + " 与 " + c.conflictHerb + "：" + c.type + (c.description ? "（" + c.description + "）" : ""));
      });
    }

    return parts.join("\n");
  }

  // =============================================
  // LLM 生成答案（基于检索上下文）
  // =============================================
  async generateAnswer(question, contextText, enrichedContext) {
    if (!this.llm) return contextText || "AI 服务未初始化";

    try {
      const systemPrompt = [
        "你是神农AI中医药专家助手，基于 Neo4j 知识图谱检索结果回答用户问题。",
        "",
        "要求：",
        "1. 专业但通俗，使用清晰的 Markdown 格式",
        "2. 优先基于提供的图谱数据回答，图谱没有的信息可使用你的中医药知识补充",
        "3. 如涉及药材，务必说明功效、用法用量、注意事项",
        "4. 如有配伍冲突，必须在回答中醒目警告",
        "5. 回答末尾列出参考的药材和方剂",
        "6. 使用适当的标题、列表、加粗来组织信息"
      ].join("\n");

      const userPrompt = "用户问题：" + question + "\n\n知识图谱检索结果：\n" + contextText +
        "\n\n请基于以上信息回答用户问题。如果知识图谱结果中有相关药材，请重点引用。" +
        "如果图谱数据不足以完整回答，可以补充你的中医药专业知识。";

      const response = await this.llm.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);

      let answer = typeof response === "string" ? response : (response.content || response.text || "");

      // 添加参考来源
      if (enrichedContext.herbs.length > 0 || enrichedContext.formulas.length > 0) {
        answer += "\n\n---\n📚 **参考来源**";
        if (enrichedContext.herbs.length > 0) {
          answer += "\n- 药材：" + enrichedContext.herbs.map(h => h.name + (h.latin_name ? "（" + h.latin_name + "）" : "")).join("、");
        }
        if (enrichedContext.formulas.length > 0) {
          answer += "\n- 方剂：" + enrichedContext.formulas.map(f => f.name).join("、");
        }
      }

      return answer;
    } catch (error) {
      console.warn("[RAG-V2] LLM 生成答案失败:", error.message);
      return contextText || "AI 服务暂时不可用，请稍后重试";
    }
  }

  // =============================================
  // 主入口：RAG 智能问答
  // =============================================
  async answer(question, options = {}) {
    const { useChain = true, forceRefresh = false } = options;

    // 检查缓存（CACHE_VERSION 变更时自动失效旧缓存）
    const cacheKey = "v" + CACHE_VERSION + "_" + question.toLowerCase().trim();
    if (!forceRefresh) {
      const cached = answerCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log("[RAG-V2] 缓存命中");
        return { ...cached.result, fromCache: true };
      }
    }

    // 确保已初始化
    await this.initialize();

    let result = null;

    // 优先使用手动增强模式（关键词提取 + LLM 知识增强）
    console.log("[RAG-V2] 启用手动增强模式...");
    result = await this.ragViaManual(question);

    // GraphCypherQAChain 作为备用方案
    if (!result && useChain && this.cypherChain) {
      console.log("[RAG-V2] 手动模式无结果，回退到 GraphCypherQAChain");
      result = await this.ragViaChain(question);
    }

    // 如果所有检索模式都无结果，使用 LLM 直接回答（纯知识模式）
    if (!result) {
      console.log("[RAG-V2] 知识库无匹配，使用 LLM 中医药知识直接回答");
      const directAnswer = await this.generateDirectAnswer(question);
      result = {
        answer: directAnswer,
        mode: "llm-direct",
        sources: [],
        formulas: []
      };
    }

    // 安全兜底：如果答案仍然看起来像"未找到"，强制使用 LLM 直接回答
    if (result && result.answer) {
      const looksLikeNotFound = /抱歉.*未找到/i.test(result.answer) ||
        /未找到相关/i.test(result.answer) ||
        /请尝试其他关键词/i.test(result.answer) ||
        /sorry.*not found/i.test(result.answer);
      if (looksLikeNotFound) {
        console.log("[RAG-V2] 顶层检测到未找到答案，强制 LLM 直接回答");
        const directAnswer = await this.generateDirectAnswer(question);
        result = {
          answer: directAnswer,
          mode: "llm-direct-fallback",
          sources: [],
          formulas: []
        };
      }
    }

    // 写入缓存
    answerCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }

  // =============================================
  // LLM 直接回答（不依赖知识图谱，纯 LLM 知识）
  // =============================================
  async generateDirectAnswer(question) {
    if (!this.llm) {
      return "抱歉，AI 引擎尚未初始化。请检查 DeepSeek API Key 配置。";
    }

    try {
      const response = await this.llm.invoke([
        {
          role: "system",
          content: [
            "你是神农AI中医药专家助手，拥有丰富的中医药知识。",
            "请基于你的专业知识回答用户问题。",
            "",
            "要求：",
            "1. 专业但不晦涩，使用通俗语言",
            "2. 使用 Markdown 格式，适当使用标题、列表、加粗",
            "3. 如涉及药材或方剂，请说明其功效、用法、注意事项",
            "4. 如有不确定的内容，请诚实说明",
            "5. 回答末尾可以建议用户进一步查询具体药材"
          ].join("\n")
        },
        {
          role: "user",
          content: question
        }
      ]);

      let answer = typeof response === "string" ? response : (response.content || response.text || "");

      // 添加提示
      answer += "\n\n---\n💡 *以上回答基于 AI 中医药知识库。如需获取更详细的 Neo4j 图谱数据（药材关联、方剂组成等），请尝试在问题中包含具体药材名称。*";

      return answer;
    } catch (error) {
      console.warn("[RAG-V2] LLM 直接回答失败:", error.message);
      return "抱歉，AI 引擎暂时不可用，请稍后再试。";
    }
  }

  // =============================================
  // 清除缓存
  // =============================================
  clearCache() {
    answerCache.clear();
    herbEnrichCache.clear();
    console.log("[RAG-V2] 缓存已清除");
  }

  // =============================================
  // 获取服务状态
  // =============================================
  getStatus() {
    return {
      initialized: this.initialized,
      llmReady: !!this.llm,
      graphReady: !!this.graph,
      cypherChainReady: !!this.cypherChain,
      cacheSize: answerCache.size
    };
  }
}

// 单例导出
module.exports = new RAGServiceV2();
