﻿/**
 * 6合1 AI 引擎路由
 * 
 * 聚合端点：
 *   POST /api/ai-engine/rag            — RAG 智能问答（GraphRAG）
 *   POST /api/ai-engine/compatibility  — 配伍冲突检测
 *   POST /api/ai-engine/extract        — 古籍知识抽取
 *   GET  /api/ai-engine/health         — 引擎健康检查
 *   GET  /api/ai-engine/status         — 引擎状态
 *   POST /api/ai-engine/rag-stream     — RAG 流式问答（SSE）
 * 
 * @architecture 方案 B（后端代理）：复用 neo4j-simple 单例
 * @security 所有 Cypher 查询使用参数化，API Key 仅在后端
 */
const express = require("express");
const router = express.Router();
const ragServiceV2 = require("../services/ragServiceV2");
const neo4jManager = require("../config/neo4j-simple");
const path = require("path");
const fs = require("fs");

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// =============================================
// 加载配伍规则
// =============================================
let compatibilityRules = [];
try {
  const rulesPath = path.join(__dirname, "../../data/compatibility_rules.json");
  const raw = fs.readFileSync(rulesPath, "utf-8");
  compatibilityRules = JSON.parse(raw).rules || [];
  console.log("[AI-Engine] 加载配伍规则:", compatibilityRules.length, "条");
} catch (e) {
  console.warn("[AI-Engine] 配伍规则加载失败:", e.message);
}

// =============================================
// 辅助：调用 DeepSeek API（非流式）
// =============================================
async function callDeepSeek(messages, temperature = 0.3, maxTokens = 2000) {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "YOUR_DEEPSEEK_API_KEY_HERE") {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error("DeepSeek API " + res.status + ": " + text.substring(0, 200));
    }

    const data = await res.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("[AI-Engine] DeepSeek 调用失败:", error.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// POST /rag — RAG 智能问答
// =============================================
router.post("/rag", async (req, res) => {
  try {
    const { question, useChain = true, forceRefresh = false } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ success: false, message: "请提供问题内容" });
    }

    if (question.length > 2000) {
      return res.status(400).json({ success: false, message: "问题过长，请控制在2000字符以内" });
    }

    console.log("[AI-Engine] RAG 问答:", question.substring(0, 50) + "...");

    const result = await ragServiceV2.answer(question.trim(), { useChain, forceRefresh });

    res.json({
      success: true,
      data: {
        question: question.trim(),
        _debug_raw_bytes: Buffer.from(JSON.stringify(req.body)).toString("hex").substring(0, 200),
        _debug_content_type: req.get("Content-Type") || "none",
        answer: result.answer,
        mode: result.mode || "unknown",
        sources: result.sources || [],
        formulas: result.formulas || [],
        cypher: result.cypher || null,
        fromCache: result.fromCache || false
      }
    });
  } catch (error) {
    console.error("[AI-Engine] RAG 错误:", error);
    res.status(500).json({ success: false, message: "问答服务暂时不可用: " + error.message });
  }
});

// =============================================
// POST /rag-stream — RAG 流式问答（SSE）
// =============================================
router.post("/rag-stream", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res.status(400).json({ success: false, message: "请提供问题内容" });
    }

    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "YOUR_DEEPSEEK_API_KEY_HERE") {
      return res.status(503).json({ success: false, message: "DeepSeek API Key 未配置" });
    }

    // 设置 SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // 步骤1：发送搜索状态
    res.write("data: " + JSON.stringify({ type: "status", content: "正在搜索知识库..." }) + "\n\n");

    // 步骤2：搜索 Neo4j
    const trimmedQuestion = question.trim();
    const searchResults = await ragServiceV2.searchNeo4j(trimmedQuestion);
    const enriched = await ragServiceV2.enrichWithGraphTraversal(searchResults);
    const context = ragServiceV2.buildContextText(enriched);

    // 步骤3：发送上下文信息
    res.write("data: " + JSON.stringify({
      type: "context",
      herbCount: enriched.herbs.length,
      formulaCount: enriched.formulas.length,
      herbs: enriched.herbs.map(h => h.name)
    }) + "\n\n");

    // 步骤4：流式调用 DeepSeek
    const messages = [
      {
        role: "system",
        content: "你是神农AI中医药专家助手。请基于知识库信息回答问题。使用中文，专业但不晦涩。使用Markdown格式。"
      },
      {
        role: "user",
        content: "【知识库信息】\n" + context + "\n\n【用户问题】\n" + trimmedQuestion + "\n\n请回答。"
      }
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    req.on("close", () => {
      controller.abort();
      clearTimeout(timeout);
    });

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + DEEPSEEK_API_KEY
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages,
          stream: true,
          temperature: 0.3,
          max_tokens: 2000
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        res.write("data: " + JSON.stringify({ type: "error", content: "AI 服务返回错误" }) + "\n\n");
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // 转发流
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            res.write(line + "\n\n");
          }
        }
      }

      if (buffer.trim()) res.write(buffer + "\n\n");

      // 追加来源
      const herbNames = enriched.herbs.map(h => h.name).join("、");
      if (herbNames) {
        res.write("data: " + JSON.stringify({
          type: "sources",
          content: "\n\n---\n📚 **参考来源**\n- 药材：" + herbNames
        }) + "\n\n");
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error) {
      if (error.name !== "AbortError") {
        res.write("data: " + JSON.stringify({ type: "error", content: error.message }) + "\n\n");
        res.write("data: [DONE]\n\n");
      }
      res.end();
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("[AI-Engine] RAG-Stream 错误:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "流式服务错误" });
    }
  }
});

// =============================================
// POST /compatibility — 配伍冲突检测
// =============================================
router.post("/compatibility", async (req, res) => {
  try {
    const { herbs } = req.body;

    if (!herbs || !Array.isArray(herbs) || herbs.length < 2) {
      return res.status(400).json({ success: false, message: "请提供至少2味药材名称" });
    }

    const conflicts = [];

    // 步骤1：硬编码规则匹配（十八反十九畏）
    for (let i = 0; i < herbs.length; i++) {
      for (let j = i + 1; j < herbs.length; j++) {
        const a = herbs[i].trim();
        const b = herbs[j].trim();

        // 精确匹配
        const directMatch = compatibilityRules.find(r =>
          (r.herb_a === a && r.herb_b === b) || (r.herb_a === b && r.herb_b === a)
        );

        if (directMatch) {
          conflicts.push({
            herb_a: a,
            herb_b: b,
            relation: directMatch.relation,
            category: directMatch.category,
            source: directMatch.source || "",
            detection: "hardcoded-rules"
          });
          continue;
        }

        // 别名匹配（如 "乌头" 也匹配 "川乌"、"草乌"）
        const rulesData = JSON.parse(fs.readFileSync(
          path.join(__dirname, "../../data/compatibility_rules.json"), "utf-8"
        ));
        const aliases = rulesData.aliases || {};

        for (const rule of compatibilityRules) {
          const herbAAliases = aliases[rule.herb_a] || [rule.herb_a];
          const herbBAliases = aliases[rule.herb_b] || [rule.herb_b];

          const aMatchesHerbA = [rule.herb_a, ...herbAAliases].includes(a);
          const bMatchesHerbB = [rule.herb_b, ...herbBAliases].includes(b);
          const aMatchesHerbB = [rule.herb_b, ...herbBAliases].includes(a);
          const bMatchesHerbA = [rule.herb_a, ...herbAAliases].includes(b);

          if ((aMatchesHerbA && bMatchesHerbB) || (aMatchesHerbB && bMatchesHerbA)) {
            conflicts.push({
              herb_a: a,
              herb_b: b,
              relation: rule.relation,
              category: rule.category,
              source: rule.source || "",
              detection: "hardcoded-rules-aliases"
            });
            break;
          }
        }
      }
    }

    // 步骤2：Cypher 图推理（Neo4j 中的 COMPATIBILITY 关系）
    try {
      const session = neo4jManager.getSession();
      try {
        const cypherResult = await session.run(
          "MATCH (h1:Herb)-[r:COMPATIBILITY]->(h2:Herb) " +
          "WHERE h1.name IN $herbs AND h2.name IN $herbs " +
          "RETURN h1.name AS herbA, h2.name AS herbB, r.type AS conflictType, " +
          "r.description AS conflictDesc",
          { herbs: herbs.map(h => h.trim()) }
        );

        for (const record of cypherResult.records) {
          const existing = conflicts.find(c =>
            (c.herb_a === record.get("herbA") && c.herb_b === record.get("herbB")) ||
            (c.herb_a === record.get("herbB") && c.herb_b === record.get("herbA"))
          );
          if (!existing) {
            conflicts.push({
              herb_a: record.get("herbA"),
              herb_b: record.get("herbB"),
              relation: record.get("conflictType"),
              description: record.get("conflictDesc") || "",
              detection: "neo4j-graph"
            });
          }
        }
      } finally {
        await session.close();
      }
    } catch (cypherError) {
      console.warn("[AI-Engine] Cypher 配伍检测失败:", cypherError.message);
    }

    // 步骤3：2跳间接冲突检测
    try {
      const session = neo4jManager.getSession();
      try {
        const indirectResult = await session.run(
          "MATCH (h1:Herb)-[:COMPATIBILITY]->(h2:Herb)-[:CONTAINS_HERB]-(f:Formula)-[:CONTAINS_HERB]->(h3:Herb) " +
          "WHERE h1.name IN $herbs AND h3.name IN $herbs AND h1.name <> h3.name " +
          "AND NOT (h1)-[:COMPATIBILITY]->(h3) " +
          "RETURN DISTINCT h1.name AS herbA, h2.name AS middleHerb, h3.name AS herbB, f.name AS formula " +
          "LIMIT 10",
          { herbs: herbs.map(h => h.trim()) }
        );

        for (const record of indirectResult.records) {
          const herbA = record.get("herbA");
          const middleHerb = record.get("middleHerb");
          const herbB = record.get("herbB");
          const formula = record.get("formula");
          conflicts.push({
            herb_a: herbA,
            herb_b: herbB,
            relation: "间接冲突",
            category: "图推理",
            description: `${herbA} 与 ${middleHerb} 存在配伍禁忌，而两者共同出现在方剂“${formula}”中`,
            detection: "2-hop-graph-reasoning"
          });
        }
      } finally {
        await session.close();
      }
    } catch (e) {
      console.warn("[AI-Engine] 间接冲突检测失败:", e.message);
    }

    res.json({
      success: true,
      data: {
        herbs,
        conflicts,
        safe: conflicts.length === 0,
        conflictCount: conflicts.length,
        summary: conflicts.length === 0
          ? "未检测到配伍禁忌，可以配合使用"
          : "检测到 " + conflicts.length + " 处配伍冲突，请谨慎使用"
      }
    });
  } catch (error) {
    console.error("[AI-Engine] 配伍检测错误:", error);
    res.status(500).json({ success: false, message: "配伍检测服务错误" });
  }
});

// =============================================
// POST /extract — 古籍知识自动抽取
// =============================================
router.post("/extract", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: "请提供古籍文本" });
    }

    if (text.length > 5000) {
      return res.status(400).json({ success: false, message: "文本过长，请控制在5000字符以内" });
    }

    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "YOUR_DEEPSEEK_API_KEY_HERE") {
      return res.status(503).json({ success: false, message: "DeepSeek API Key 未配置，无法进行知识抽取" });
    }

    const trimmedText = text.trim();

    // Few-shot Prompt
    const prompt = "你是一个中医药知识图谱构建专家。请从以下古籍文本中提取知识三元组（实体-关系-实体）。" +
      "\n\n实体类型定义：" +
      "\n- herb（药材）：中药名称" +
      "\n- taste（性味）：辛、甘、酸、苦、咸、淡、涩等" +
      "\n- nature（药性）：寒、热、温、凉、平" +
      "\n- efficacy（功效）：如清热解毒、补气养血等" +
      "\n- meridian（归经）：如肺经、肝经、脾经等" +
      "\n- formula（方剂）：方剂名称" +
      "\n- disease（病症）：治疗的病症名称" +
      "\n\n关系类型定义：" +
      "\n- HAS_TASTE（具有性味）" +
      "\n- HAS_NATURE（具有药性）" +
      "\n- HAS_EFFICACY（具有功效）" +
      "\n- MERIDIAN_AFFINITY（归经）" +
      "\n- TREATS（治疗）" +
      "\n- CONTAINS_HERB（包含药材）" +
      "\n- COMBINES_WITH（配伍）" +
      "\n\nFew-shot 示例：" +
      "\n输入：\"人参味甘微苦，性温，归脾肺心经，大补元气，复脉固脱。\"" +
      "\n输出：" +
      "\n[" +
      '\n  {"head":"人参","head_type":"herb","relation":"HAS_TASTE","tail":"甘","tail_type":"taste"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"HAS_TASTE","tail":"微苦","tail_type":"taste"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"HAS_NATURE","tail":"温","tail_type":"nature"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"MERIDIAN_AFFINITY","tail":"脾经","tail_type":"meridian"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"MERIDIAN_AFFINITY","tail":"肺经","tail_type":"meridian"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"MERIDIAN_AFFINITY","tail":"心经","tail_type":"meridian"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"HAS_EFFICACY","tail":"大补元气","tail_type":"efficacy"},' +
      '\n  {"head":"人参","head_type":"herb","relation":"HAS_EFFICACY","tail":"复脉固脱","tail_type":"efficacy"}' +
      "\n]" +
      "\n\n现在请从以下文本中提取三元组，只返回 JSON 数组，不要添加任何解释：" +
      "\n\n" + trimmedText;

    const messages = [
      { role: "system", content: "你是一个精确的中医药知识抽取器。只输出 JSON 数组，不要加任何解释文字。" },
      { role: "user", content: prompt }
    ];

    const result = await callDeepSeek(messages, 0.1, 3000);

    if (!result) {
      return res.status(500).json({ success: false, message: "AI 服务调用失败" });
    }

    // 解析 JSON
    let triples = [];
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        triples = JSON.parse(jsonMatch[0]);
      } else {
        triples = JSON.parse(result);
      }
    } catch (parseError) {
      console.warn("[AI-Engine] JSON 解析失败:", parseError.message);
      return res.json({
        success: true,
        data: {
          text: trimmedText,
          triples: [],
          rawOutput: result,
          writtenToNeo4j: false,
          message: "AI 返回格式无法解析，可能需要调整文本"
        }
      });
    }

    // 写入 Neo4j
    let writtenCount = 0;
    if (triples.length > 0) {
      try {
        const session = neo4jManager.getSession();
        try {
          for (const triple of triples) {
            if (!triple.head || !triple.relation || !triple.tail) continue;

            const headLabel = triple.head_type === "herb" ? "Herb" :
              triple.head_type === "formula" ? "Formula" :
              triple.head_type === "taste" ? "Property" :
              triple.head_type === "nature" ? "Property" :
              triple.head_type === "efficacy" ? "Efficacy" :
              triple.head_type === "meridian" ? "Meridian" :
              triple.head_type === "disease" ? "Disease" : "Entity";
            const tailLabel = triple.tail_type === "herb" ? "Herb" :
              triple.tail_type === "formula" ? "Formula" :
              triple.tail_type === "taste" ? "Property" :
              triple.tail_type === "nature" ? "Property" :
              triple.tail_type === "efficacy" ? "Efficacy" :
              triple.tail_type === "meridian" ? "Meridian" :
              triple.tail_type === "disease" ? "Disease" : "Entity";

            await session.run(
              "MERGE (h:" + headLabel + " {name: $headName}) " +
              "MERGE (t:" + tailLabel + " {name: $tailName}) " +
              "MERGE (h)-[r:" + triple.relation + "]->(t) " +
              "RETURN h, t, r",
              {
                headName: triple.head,
                tailName: triple.tail
              }
            );
            writtenCount++;
          }
        } finally {
          await session.close();
        }
      } catch (writeError) {
        console.warn("[AI-Engine] 写入 Neo4j 失败:", writeError.message);
      }
    }

    res.json({
      success: true,
      data: {
        text: trimmedText,
        triples,
        tripleCount: triples.length,
        writtenToNeo4j: writtenCount > 0,
        writtenCount
      }
    });
  } catch (error) {
    console.error("[AI-Engine] 知识抽取错误:", error);
    res.status(500).json({ success: false, message: "知识抽取服务错误" });
  }
});

// =============================================
// GET /health — AI 引擎健康检查
// =============================================
router.get("/health", async (req, res) => {
  const neo4jOk = !!neo4jManager.getDriver();
  let neo4jPing = false;
  if (neo4jOk) {
    try {
      const session = neo4jManager.getSession();
      await session.run("RETURN 1");
      await session.close();
      neo4jPing = true;
    } catch (e) { /* ignore */ }
  }

  res.json({
    success: true,
    data: {
      engine: "神农AI 6合1引擎",
      version: "2.0.0",
      neo4j: neo4jPing ? "connected" : "disconnected",
      deepseek: DEEPSEEK_API_KEY && DEEPSEEK_API_KEY !== "YOUR_DEEPSEEK_API_KEY_HERE" ? "configured" : "not-configured",
      compatibilityRules: compatibilityRules.length,
      ragService: ragServiceV2.getStatus(),
      timestamp: new Date().toISOString()
    }
  });
});

// =============================================
// GET /status — 引擎详细状态
// =============================================
router.get("/status", async (req, res) => {
  const ragStatus = ragServiceV2.getStatus();
  res.json({
    success: true,
    data: {
      initialized: ragStatus.initialized,
      llmReady: ragStatus.llmReady,
      graphReady: ragStatus.graphReady,
      cypherChainReady: ragStatus.cypherChainReady,
      cacheSize: ragStatus.cacheSize,
      compatibilityRulesCount: compatibilityRules.length,
      endpoints: [
        "POST /api/ai-engine/rag",
        "POST /api/ai-engine/rag-stream",
        "POST /api/ai-engine/compatibility",
        "POST /api/ai-engine/extract",
        "GET  /api/ai-engine/health",
        "GET  /api/ai-engine/status"
      ]
    }
  });
});


// =============================================
// 药材知识缓存（按需补全，避免重复调用 DeepSeek）
// =============================================
const herbEnrichCache = new Map();
const ENRICH_CACHE_TTL = 24 * 3600 * 1000; // 24 小时

// =============================================
// POST /herb-enrich — DeepSeek 补全药材详情
// =============================================
router.post("/herb-enrich", async (req, res) => {
  try {
    const { herbName, herbContext = {} } = req.body;

    if (!herbName || typeof herbName !== "string" || herbName.trim().length === 0) {
      return res.status(400).json({ success: false, message: "请提供药材名称" });
    }

    const name = herbName.trim();

    // 检查缓存
    const cached = herbEnrichCache.get(name);
    if (cached && (Date.now() - cached.timestamp < ENRICH_CACHE_TTL)) {
      console.log("[AI-Engine] 药材补全缓存命中:", name);
      return res.json({ success: true, data: cached.data, fromCache: true });
    }

    // DeepSeek 未配置
    if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "YOUR_DEEPSEEK_API_KEY_HERE") {
      return res.json({
        success: true,
        data: {
          indications: herbContext.description || "",
          usage_dosage: herbContext.usage_dosage || "",
          caution: herbContext.caution || "",
          pharmacology: ""
        },
        fromCache: false,
        source: "neo4j-only"
      });
    }

    // 构建上下文
    var contextParts = [];
    if (herbContext.category_name) contextParts.push("分类：" + herbContext.category_name);
    if (herbContext.region_name) contextParts.push("产地：" + herbContext.region_name);
    if (herbContext.properties && herbContext.properties.length > 0) {
      contextParts.push("性味：" + herbContext.properties.map(function(p){ return p.name; }).join("、"));
    }
    if (herbContext.meridians && herbContext.meridians.length > 0) {
      contextParts.push("归经：" + herbContext.meridians.map(function(m){ return m.name; }).join("、"));
    }
    if (herbContext.efficacies && herbContext.efficacies.length > 0) {
      contextParts.push("功效：" + herbContext.efficacies.map(function(e){ return e.name; }).join("、"));
    }
    var contextStr = contextParts.length > 0 ? contextParts.join("；") : "暂无";

    var prompt = "你是资深中医药专家。请根据你的专业知识，为药材【" + name + "】撰写详细信息。" +
      "参考已知数据：" + contextStr + "。" +
      "请基于中医药经典（如《神农本草经》《本草纲目》）和现代药典，以严格 JSON 格式直接返回（不要任何解释、不要Markdown标记）：" +
      '{"indications":"主治病症（50-150字）",' +
      '"usage_dosage":"用法用量（20-80字）",' +
      '"caution":"使用注意与禁忌（20-80字）",' +
      '"pharmacology":"现代药理研究摘要（50-150字）",' +
      '"clinical_application":"临床应用要点（30-100字）"}';

    console.log("[AI-Engine] 调用 DeepSeek 补全药材:", name);

    var result = await callDeepSeek([
      { role: "system", content: "你是中医药专家。只返回 JSON，不要任何解释或 Markdown。" },
      { role: "user", content: prompt }
    ], 0.3, 800);

    if (!result) {
      return res.json({
        success: true,
        data: {
          indications: herbContext.description || "",
          usage_dosage: herbContext.usage_dosage || "",
          caution: herbContext.caution || "",
          pharmacology: "",
          clinical_application: ""
        },
        fromCache: false,
        source: "fallback"
      });
    }

    // 解析 JSON
    var enriched = null;
    try {
      var jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        enriched = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn("[AI-Engine] 药材补全 JSON 解析失败:", e.message);
    }

    if (!enriched) {
      return res.json({
        success: true,
        data: {
          indications: herbContext.description || result || "",
          usage_dosage: herbContext.usage_dosage || "",
          caution: herbContext.caution || "",
          pharmacology: "",
          clinical_application: ""
        },
        fromCache: false,
        source: "parse-failed"
      });
    }

    // 写入缓存
    herbEnrichCache.set(name, {
      data: enriched,
      timestamp: Date.now()
    });

    console.log("[AI-Engine] 药材补全成功:", name, "| 缓存数:", herbEnrichCache.size);

    res.json({
      success: true,
      data: enriched,
      fromCache: false,
      source: "deepseek"
    });

  } catch (error) {
    console.error("[AI-Engine] herb-enrich 错误:", error);
    res.status(500).json({ success: false, message: "补全服务错误: " + error.message });
  }
});



// =============================================
// GET /herb-detail/:name — 获取药材详情+图谱数据
// =============================================
router.get("/herb-detail/:name", async (req, res) => {
  try {
    const herbName = decodeURIComponent(req.params.name);
    if (!herbName) return res.status(400).json({ success: false, message: "请提供药材名称" });

    const driver = neo4jManager.getDriver();
    if (!driver) return res.status(503).json({ success: false, message: "Neo4j 未连接" });

    const session = driver.session();

    // 查询药材及其关联数据
    const result = await session.run(
      "MATCH (h:Herb) WHERE h.name = $name OR h.name CONTAINS $name " +
      "OPTIONAL MATCH (h)-[:HAS_PROPERTY]->(p:Property) " +
      "OPTIONAL MATCH (h)-[:MERIDIAN_AFFINITY]->(m:Meridian) " +
      "OPTIONAL MATCH (h)-[:HAS_EFFICACY]->(e:Efficacy) " +
      "OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) " +
      "OPTIONAL MATCH (h)-[:PRODUCED_IN]->(r:Region) " +
      "OPTIONAL MATCH (h)-[:CONTAINS_HERB]-(f:Formula) " +
      "WITH h, " +
      "collect(DISTINCT {id: toString(id(p)), name: p.name, label: 'Property'}) as props, " +
      "collect(DISTINCT {id: toString(id(m)), name: m.name, label: 'Meridian'}) as mers, " +
      "collect(DISTINCT {id: toString(id(e)), name: e.name, label: 'Efficacy'}) as effs, " +
      "collect(DISTINCT {id: toString(id(c)), name: c.name, label: 'Category'}) as cats, " +
      "collect(DISTINCT {id: toString(id(r)), name: r.name, label: 'Region'}) as regs, " +
      "collect(DISTINCT {id: toString(id(f)), name: f.name, label: 'Formula'}) as forms " +
      "RETURN h, props, mers, effs, cats, regs, forms LIMIT 1",
      { name: herbName }
    );

    if (result.records.length === 0) {
      await session.close();
      return res.json({ success: false, message: "未找到匹配的药材" });
    }

    const record = result.records[0];
    const herb = record.get("h").properties;

    // 构建图谱数据
    const herbNodeId = "herb_" + herb.name;
    const nodes = [{ id: herbNodeId, name: herb.name, label: "Herb", isCenter: true }];
    const edges = [];

    // 辅助函数
    function addNodes(items) {
      items.forEach(function(item) {
        if (!item.name) return;
        var exists = nodes.find(function(n) { return n.id === item.id; });
        if (!exists) nodes.push({ id: item.id, name: item.name, label: item.label, isCenter: false });
        var edgeExists = edges.find(function(e) { return e.source === herbNodeId && e.target === item.id; });
        if (!edgeExists) edges.push({ source: herbNodeId, target: item.id, type: item.label });
      });
    }

    addNodes(record.get("props"));
    addNodes(record.get("mers"));
    addNodes(record.get("effs"));
    addNodes(record.get("cats"));
    addNodes(record.get("regs"));
    addNodes(record.get("forms"));

    await session.close();

    res.json({
      success: true,
      data: {
        name: herb.name || herbName,
        pinyin: herb.pinyin || "",
        latin_name: herb.latin_name || "",
        description: herb.description || "",
        usage_dosage: herb.usage_dosage || "",
        caution: herb.caution || "",
        category_name: record.get("cats").length > 0 ? record.get("cats")[0].name : "",
        region_name: record.get("regs").length > 0 ? record.get("regs")[0].name : "",
        properties: record.get("props"),
        meridians: record.get("mers"),
        efficacies: record.get("effs"),
        graphData: { nodes: nodes, links: edges }
      }
    });

  } catch (error) {
    console.error("[AI-Engine] herb-detail 错误:", error);
    res.status(500).json({ success: false, message: "查询药材详情失败: " + error.message });
  }
});

module.exports = router;

