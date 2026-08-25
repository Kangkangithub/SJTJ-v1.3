/**
 * 药材管理 CRUD 路由（Neo4j AuraDB 版）
 * @description 提供药材的增删查改 API，前端通过本路由操作 Neo4j 图数据库
 * @architecture 方案 B（后端代理）：前端 -> Express API -> neo4j-driver -> Neo4j AuraDB
 */

const express = require("express");
const neo4jManager = require("../config/neo4j-simple");
const neo4j = require("neo4j-driver");
const embeddingService = require("../services/embeddingService");
const router = express.Router();

// ==================== 辅助函数 ====================

/** 将 Neo4j Integer 转为 JS number */
function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = parseInt(val, 10); return isNaN(n) ? null : n; }
  if (typeof val.toNumber === "function") return val.toNumber();
  return Number(val);
}

/** 获取 Neo4j 节点属性（处理 Integer 转换） */
function extractHerbProps(node) {
  return {
    id: node.identity.toString(),
    name: node.properties.name || "",
    pinyin: node.properties.pinyin || "",
    latin_name: node.properties.latin_name || "",
    alias: node.properties.alias || "",
    description: node.properties.description || "",
    efficacy: node.properties.efficacy || "",
    usage_dosage: node.properties.usage_dosage || "",
    caution: node.properties.caution || "",
    is_common: toNumber(node.properties.is_common) || 0,
    quality: node.properties.quality || "{}"
  };
}

// ==================== API 端点 ====================

/**
 * GET /api/herbs-manage/dropdowns
 * @description 一次性返回所有下拉框数据（分类、产地、性味、归经、功效）
 */
router.get("/dropdowns", async (req, res) => {
  const session = neo4jManager.getSession();
  try {
    // 顺序执行（Neo4j 同一 session 不支持并发查询，否则报 "ongoing work" 错误）
    const catRes = await session.run("MATCH (c:Category) RETURN c.name AS name ORDER BY c.name");
    const regRes = await session.run("MATCH (r:Region) RETURN r.name AS name ORDER BY r.name");
    const qiRes = await session.run("MATCH (p:Property {type: 'qi'}) RETURN p.name AS name ORDER BY p.name");
    const flaRes = await session.run("MATCH (p:Property {type: 'flavor'}) RETURN p.name AS name ORDER BY p.name");
    const merRes = await session.run("MATCH (m:Meridian) RETURN m.name AS name ORDER BY m.name");
    const effRes = await session.run("MATCH (e:Efficacy) RETURN e.name AS name ORDER BY e.name");

    res.json({
      success: true,
      data: {
        categories: catRes.records.map(r => r.get("name")),
        regions: regRes.records.map(r => r.get("name")),
        properties_qi: qiRes.records.map(r => r.get("name")),
        properties_flavor: flaRes.records.map(r => r.get("name")),
        meridians: merRes.records.map(r => r.get("name")),
        efficacies: effRes.records.map(r => r.get("name"))
      }
    });
  } catch (error) {
    console.error("[herbs-manage] dropdowns error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/herbs-manage
 * @description 分页 + 搜索 + 筛选药材列表
 */
router.get("/", async (req, res) => {
  const session = neo4jManager.getSession();
  try {
    const { search, category, region, is_common, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = {};

    if (search && search.trim()) {
      conditions.push("(h.name CONTAINS $search OR h.pinyin CONTAINS $search OR h.alias CONTAINS $search)");
      params.search = search.trim();
    }
    if (category) {
      conditions.push("EXISTS { MATCH (h)-[:BELONGS_TO_CATEGORY]->(cat:Category {name: $category}) }");
      params.category = category;
    }
    if (region) {
      conditions.push("EXISTS { MATCH (h)-[:FROM_REGION]->(reg:Region {name: $region}) }");
      params.region = region;
    }
    if (is_common === "1") {
      conditions.push("h.is_common = 1");
    } else if (is_common === "0") {
      conditions.push("(h.is_common IS NULL OR h.is_common = 0)");
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const countCypher = "MATCH (h:Herb) " + whereClause + " RETURN count(h) AS total";
    const countResult = await session.run(countCypher, params);
    const total = toNumber(countResult.records[0].get("total"));

    const listCypher = [
      "MATCH (h:Herb)", whereClause,
      "OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category)",
      "OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region)",
      "RETURN h, c.name AS category_name, r.name AS region_name",
      "ORDER BY h.name",
      "SKIP $skip LIMIT $limit"
    ].filter(Boolean).join(" ");

    // 使用 neo4j.int() 确保 SKIP/LIMIT 参数为整数类型（Neo4j 驱动严格要求）
    const listResult = await session.run(listCypher, { ...params, skip: neo4j.int(skip), limit: neo4j.int(limitNum) });

    const herbs = listResult.records.map(record => {
      const herb = record.get("h");
      return {
        ...extractHerbProps(herb),
        category_name: record.get("category_name") || "",
        region_name: record.get("region_name") || ""
      };
    });

    res.json({
      success: true,
      data: {
        herbs,
        pagination: {
          page: pageNum, limit: limitNum, total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error("[herbs-manage] list error:", error.message);
    console.error("[herbs-manage] list error stack:", error.stack);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});

/**
 * GET /api/herbs-manage/:name
 * @description 获取单个药材的完整详情
 */
router.get("/:name", async (req, res) => {
  const session = neo4jManager.getSession();
  try {
    const herbName = decodeURIComponent(req.params.name);

    const herbResult = await session.run(
      "MATCH (h:Herb {name: $name}) OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region) RETURN h, c.name AS category_name, r.name AS region_name",
      { name: herbName }
    );

    if (herbResult.records.length === 0) {
      return res.status(404).json({ success: false, message: "药材不存在" });
    }

    const record = herbResult.records[0];
    const herb = extractHerbProps(record.get("h"));
    herb.category_name = record.get("category_name") || "";
    herb.region_name = record.get("region_name") || "";

    // 顺序执行（避免同一 session 并发冲突）
    const propRes = await session.run("MATCH (h:Herb {name: $name})-[:HAS_PROPERTY]->(p:Property) RETURN p.name AS name, p.type AS type", { name: herbName });
    const merRes = await session.run("MATCH (h:Herb {name: $name})-[:MERIDIAN_AFFINITY]->(m:Meridian) RETURN m.name AS name, m.abbreviation AS abbr", { name: herbName });
    const effRes = await session.run("MATCH (h:Herb {name: $name})-[:HAS_EFFICACY]->(e:Efficacy) RETURN e.name AS name", { name: herbName });
    const formulaRes = await session.run("MATCH (h:Herb {name: $name})<-[rel:CONTAINS_HERB]-(f:Formula) RETURN f.name AS name, rel.dosage AS dosage, rel.role AS role", { name: herbName });

    herb.properties = propRes.records.map(r => ({ name: r.get("name"), type: r.get("type") }));
    herb.meridians = merRes.records.map(r => ({ name: r.get("name"), abbreviation: r.get("abbr") }));
    herb.efficacies = effRes.records.map(r => ({ name: r.get("name") }));
    herb.formulas = formulaRes.records.map(r => ({ name: r.get("name"), dosage: r.get("dosage"), role: r.get("role") }));

    res.json({ success: true, data: herb });
  } catch (error) {
    console.error("[herbs-manage] detail error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});

/**
 * POST /api/herbs-manage
 * @description 新增药材（事务内 MERGE 关系节点）
 */
router.post("/", async (req, res) => {
  const session = neo4jManager.getSession();
  const tx = session.beginTransaction();
  try {
    const {
      name, pinyin, latin_name, alias, description,
      usage_dosage, caution, is_common,
      category, region,
      properties_qi = [], properties_flavor = [], meridians = [], efficacies = []
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "药材名称不能为空" });
    }

    const trimmedName = name.trim();

    // 检查名称是否已存在
    const existResult = await tx.run(
      "MATCH (h:Herb {name: $name}) RETURN h",
      { name: trimmedName }
    );
    if (existResult.records.length > 0) {
      await tx.rollback();
      return res.status(409).json({ success: false, message: "药材名称已存在" });
    }

    // 创建 Herb 节点
    await tx.run(
      "CREATE (h:Herb { name: $name, pinyin: $pinyin, latin_name: $latin_name, alias: $alias, description: $description, usage_dosage: $usage_dosage, caution: $caution, is_common: $is_common, quality: '{}' })",
      {
        name: trimmedName, pinyin: pinyin || "", latin_name: latin_name || "",
        alias: alias || "", description: description || "", usage_dosage: usage_dosage || "",
        caution: caution || "", is_common: is_common ? 1 : 0
      }
    );

    // 辅助：MERGE 关系节点
    async function mergeRel(targetName, mergeCypher, mergeParams) {
      await tx.run(mergeCypher, { ...mergeParams, herbName: targetName });
    }

    // MERGE 分类
    if (category && category.trim()) {
      await mergeRel(trimmedName,
        "MERGE (c:Category {name: $catName}) ON CREATE SET c.description = $catDesc WITH c MATCH (h:Herb {name: $herbName}) MERGE (h)-[:BELONGS_TO_CATEGORY]->(c)",
        { catName: category.trim(), catDesc: category.trim() }
      );
    }

    // MERGE 产地
    if (region && region.trim()) {
      await mergeRel(trimmedName,
        "MERGE (r:Region {name: $regName}) ON CREATE SET r.description = $regDesc WITH r MATCH (h:Herb {name: $herbName}) MERGE (h)-[:FROM_REGION]->(r)",
        { regName: region.trim(), regDesc: region.trim() + "道地产区" }
      );
    }

    // MERGE 性味-气
    for (const qi of properties_qi) {
      if (qi && qi.trim()) {
        await mergeRel(trimmedName,
          "MERGE (p:Property {name: $pName, type: 'qi'}) WITH p MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_PROPERTY]->(p)",
          { pName: qi.trim() }
        );
      }
    }

    // MERGE 性味-味
    for (const flavor of properties_flavor) {
      if (flavor && flavor.trim()) {
        await mergeRel(trimmedName,
          "MERGE (p:Property {name: $pName, type: 'flavor'}) WITH p MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_PROPERTY]->(p)",
          { pName: flavor.trim() }
        );
      }
    }

    // MERGE 归经
    for (const mer of meridians) {
      if (mer && mer.trim()) {
        await mergeRel(trimmedName,
          "MERGE (m:Meridian {name: $mName}) ON CREATE SET m.description = $mDesc WITH m MATCH (h:Herb {name: $herbName}) MERGE (h)-[:MERIDIAN_AFFINITY]->(m)",
          { mName: mer.trim(), mDesc: mer.trim() + "经" }
        );
      }
    }

    // MERGE 功效
    for (const eff of efficacies) {
      if (eff && eff.trim()) {
        await mergeRel(trimmedName,
          "MERGE (e:Efficacy {name: $eName}) WITH e MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_EFFICACY]->(e)",
          { eName: eff.trim() }
        );
      }
    }

    await tx.commit();
    // 异步更新语义检索向量（不阻塞响应）
    embeddingService.updateOne(trimmedName);
    res.status(201).json({ success: true, data: { name: trimmedName }, message: "药材创建成功" });
  } catch (error) {
    await tx.rollback();
    console.error("[herbs-manage] create error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});

/**
 * PUT /api/herbs-manage/:name
 * @description 更新药材（事务：删除旧关系 + 更新属性 + 重建关系）
 */
router.put("/:name", async (req, res) => {
  const session = neo4jManager.getSession();
  const tx = session.beginTransaction();
  try {
    const oldName = decodeURIComponent(req.params.name);
    const {
      name: newName, pinyin, latin_name, alias, description,
      usage_dosage, caution, is_common,
      category, region,
      properties_qi = [], properties_flavor = [], meridians = [], efficacies = []
    } = req.body;

    const targetName = (newName && newName.trim()) ? newName.trim() : oldName;

    // 如果改名，检查新名称是否冲突
    if (targetName !== oldName) {
      const conflict = await tx.run("MATCH (h:Herb {name: $name}) RETURN h", { name: targetName });
      if (conflict.records.length > 0) {
        await tx.rollback();
        return res.status(409).json({ success: false, message: "药材名称已存在" });
      }
    }

    // 检查药材是否存在
    const existResult = await tx.run("MATCH (h:Herb {name: $name}) RETURN h", { name: oldName });
    if (existResult.records.length === 0) {
      await tx.rollback();
      return res.status(404).json({ success: false, message: "药材不存在" });
    }

    // 更新基本属性
    await tx.run(
      "MATCH (h:Herb {name: $oldName}) SET h.name = $newName, h.pinyin = $pinyin, h.latin_name = $latin_name, h.alias = $alias, h.description = $description, h.usage_dosage = $usage_dosage, h.caution = $caution, h.is_common = $is_common",
      {
        oldName, newName: targetName,
        pinyin: pinyin || "", latin_name: latin_name || "", alias: alias || "",
        description: description || "", usage_dosage: usage_dosage || "",
        caution: caution || "", is_common: is_common ? 1 : 0
      }
    );

    // 删除旧关系
    const relTypes = ["BELONGS_TO_CATEGORY", "FROM_REGION", "HAS_PROPERTY", "MERIDIAN_AFFINITY", "HAS_EFFICACY"];
    for (const relType of relTypes) {
      await tx.run("MATCH (h:Herb {name: $name})-[r:" + relType + "]->() DELETE r", { name: targetName });
    }

    // 重建关系的辅助函数
    async function mergeRel(mergeCypher, mergeParams) {
      await tx.run(mergeCypher, { ...mergeParams, herbName: targetName });
    }

    // 重建分类关系
    if (category && category.trim()) {
      await mergeRel(
        "MERGE (c:Category {name: $catName}) ON CREATE SET c.description = $catDesc WITH c MATCH (h:Herb {name: $herbName}) MERGE (h)-[:BELONGS_TO_CATEGORY]->(c)",
        { catName: category.trim(), catDesc: category.trim() }
      );
    }

    // 重建产地关系
    if (region && region.trim()) {
      await mergeRel(
        "MERGE (r:Region {name: $regName}) ON CREATE SET r.description = $regDesc WITH r MATCH (h:Herb {name: $herbName}) MERGE (h)-[:FROM_REGION]->(r)",
        { regName: region.trim(), regDesc: region.trim() + "道地产区" }
      );
    }

    // 重建性味-气
    for (const qi of properties_qi) {
      if (qi && qi.trim()) {
        await mergeRel(
          "MERGE (p:Property {name: $pName, type: 'qi'}) WITH p MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_PROPERTY]->(p)",
          { pName: qi.trim() }
        );
      }
    }

    // 重建性味-味
    for (const flavor of properties_flavor) {
      if (flavor && flavor.trim()) {
        await mergeRel(
          "MERGE (p:Property {name: $pName, type: 'flavor'}) WITH p MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_PROPERTY]->(p)",
          { pName: flavor.trim() }
        );
      }
    }

    // 重建归经
    for (const mer of meridians) {
      if (mer && mer.trim()) {
        await mergeRel(
          "MERGE (m:Meridian {name: $mName}) ON CREATE SET m.description = $mDesc WITH m MATCH (h:Herb {name: $herbName}) MERGE (h)-[:MERIDIAN_AFFINITY]->(m)",
          { mName: mer.trim(), mDesc: mer.trim() + "经" }
        );
      }
    }

    // 重建功效
    for (const eff of efficacies) {
      if (eff && eff.trim()) {
        await mergeRel(
          "MERGE (e:Efficacy {name: $eName}) WITH e MATCH (h:Herb {name: $herbName}) MERGE (h)-[:HAS_EFFICACY]->(e)",
          { eName: eff.trim() }
        );
      }
    }

    await tx.commit();
    // 异步更新语义检索向量（改名需删旧补新）
    if (targetName !== oldName) {
      embeddingService.deleteOne(oldName);
      embeddingService.updateOne(targetName);
    } else {
      embeddingService.updateOne(targetName);
    }
    res.json({ success: true, data: { name: targetName }, message: "药材更新成功" });
  } catch (error) {
    await tx.rollback();
    console.error("[herbs-manage] update error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});

/**
 * DELETE /api/herbs-manage/:name
 * @description 删除药材（先检查是否被方剂引用）
 */
router.delete("/:name", async (req, res) => {
  const session = neo4jManager.getSession();
  try {
    const herbName = decodeURIComponent(req.params.name);

    // 检查药材是否存在
    const existResult = await session.run(
      "MATCH (h:Herb {name: $name}) RETURN h",
      { name: herbName }
    );
    if (existResult.records.length === 0) {
      return res.status(404).json({ success: false, message: "药材不存在" });
    }

    // 检查是否被方剂引用
    const formulaResult = await session.run(
      "MATCH (h:Herb {name: $name})<-[rel:CONTAINS_HERB]-(f:Formula) RETURN f.name AS formula_name, rel.role AS role",
      { name: herbName }
    );

    if (formulaResult.records.length > 0) {
      const formulas = formulaResult.records.map(r =>
        r.get("formula_name") + (r.get("role") ? "（" + r.get("role") + "）" : "")
      ).join("、");
      return res.status(409).json({
        success: false,
        message: "该药材被以下方剂引用，无法删除：" + formulas,
        referencedFormulas: formulaResult.records.map(r => ({
          name: r.get("formula_name"), role: r.get("role")
        }))
      });
    }

    // 删除药材及所有关联关系
    await session.run(
      "MATCH (h:Herb {name: $name}) DETACH DELETE h",
      { name: herbName }
    );

    // 异步删除语义检索向量
    embeddingService.deleteOne(herbName);

    res.json({ success: true, message: "药材删除成功" });
  } catch (error) {
    console.error("[herbs-manage] delete error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});


/**
 * GET /api/herbs-manage/:name/graph
 * @description 获取药材的知识图谱子图（D3力导向图所需节点和边数据）
 */
router.get("/:name/graph", async (req, res) => {
  const session = neo4jManager.getSession();
  try {
    const herbName = decodeURIComponent(req.params.name);

    // 检查药材是否存在
    const existResult = await session.run(
      "MATCH (h:Herb {name: $name}) RETURN h",
      { name: herbName }
    );
    if (existResult.records.length === 0) {
      return res.status(404).json({ success: false, message: "药材不存在" });
    }

    // 获取该药材的所有直接关系（1跳），返回节点和边
    const graphResult = await session.run(
      "MATCH (h:Herb {name: $name})-[r]-(other) " +
      "RETURN h, r, other, labels(other) AS otherLabels, type(r) AS relType",
      { name: herbName }
    );

    var nodesMap = {};
    var links = [];
    var nodeId = 0;

    // 中心节点
    var herbNode = graphResult.records[0].get("h");
    var centerId = "n" + (nodeId++);
    nodesMap[herbName] = {
      id: centerId,
      name: herbNode.properties.name || herbName,
      label: "herb",
      pinyin: herbNode.properties.pinyin || "",
      isCenter: true,
      group: 1
    };

    graphResult.records.forEach(function(record) {
      var other = record.get("other");
      var r = record.get("r");
      var otherLabels = record.get("otherLabels") || [];
      var relType = record.get("relType") || "";

      if (!other || !other.properties || !other.properties.name) return;

      var otherName = other.properties.name;
      var otherId;
      if (nodesMap[otherName]) {
        otherId = nodesMap[otherName].id;
      } else {
        otherId = "n" + (nodeId++);
        // 确定节点类型
        var label = "entity";
        var group = 3;
        if (otherLabels.includes("Herb")) { label = "herb"; group = 1; }
        else if (otherLabels.includes("Formula")) { label = "formula"; group = 2; }
        else if (otherLabels.includes("Category")) { label = "category"; group = 4; }
        else if (otherLabels.includes("Property")) { label = "property"; group = 5; }
        else if (otherLabels.includes("Meridian")) { label = "meridian"; group = 6; }
        else if (otherLabels.includes("Efficacy")) { label = "efficacy"; group = 7; }
        else if (otherLabels.includes("Region")) { label = "region"; group = 8; }

        nodesMap[otherName] = {
          id: otherId,
          name: otherName,
          label: label,
          group: group,
          isCenter: false
        };
      }

      // 边（去重）
      var linkKey = centerId + "-" + otherId;
      var reverseKey = otherId + "-" + centerId;
      var exists = links.some(function(l) {
        return (l.source === centerId && l.target === otherId) ||
               (l.source === otherId && l.target === centerId);
      });
      if (!exists) {
        // 判断方向
        var sourceId = centerId;
        var targetId = otherId;
        // 如果关系是从 other 指向 herb（如 CONTAINS_HERB），反向
        if (relType === "CONTAINS_HERB") {
          sourceId = otherId;
          targetId = centerId;
        }

        links.push({
          source: sourceId,
          target: targetId,
          type: relType,
          label: formatRelType(relType)
        });
      }
    });

    var nodes = Object.values(nodesMap);

    res.json({
      success: true,
      data: {
        herbName: herbName,
        nodes: nodes,
        links: links,
        nodeCount: nodes.length,
        linkCount: links.length
      }
    });
  } catch (error) {
    console.error("[herbs-manage] graph error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await session.close();
  }
});

// 关系类型中文映射
function formatRelType(type) {
  var map = {
    "CONTAINS_HERB": "包含药材",
    "HAS_PROPERTY": "性味",
    "MERIDIAN_AFFINITY": "归经",
    "HAS_EFFICACY": "功效",
    "BELONGS_TO_CATEGORY": "分类",
    "FROM_REGION": "产地",
    "INCOMPATIBLE_WITH": "配伍禁忌",
    "COMPATIBLE_WITH": "配伍相宜",
    "COMPATIBILITY": "配伍关联",
    "INCOMPATIBLE_WITH": "配伍禁忌"
  };
  return map[type] || type;
}

module.exports = router;
