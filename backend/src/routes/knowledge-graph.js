/**
 * 药材知识图谱路由（Neo4j AuraDB 版）
 * @migration SQLite -> Neo4j AuraDB (neo4j-driver + Cypher)
 */
const express = require("express");
const neo4jManager = require("../config/neo4j-simple");
const router = express.Router();

const cache = new Map();
const CACHE_TTL = 3600 * 1000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { cache.delete(key); return null; }
  return item.value;
}

function setCache(key, value, ttl = CACHE_TTL) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

// 辅助：将 Neo4j Integer 转为 JS number
function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = parseInt(val, 10); return isNaN(n) ? null : n; }
  if (typeof val.toNumber === "function") return val.toNumber();
  return Number(val);
}

// ==================== 知识图谱图数据 ====================
router.get('/graph-data', async (req, res) => {
  try {
    const commonOnly = req.query.common === '1';
    const cacheKey = commonOnly ? 'graph-data-common' : 'graph-data';
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const session = neo4jManager.getSession();
    const nodes = [];
    const links = [];
    const nodeIdMap = new Map();

    try {
      // ---------- 1. 药材节点 ----------
      const herbCypher = commonOnly
        ? "MATCH (h:Herb {is_common: 1}) OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region) RETURN h, c.name AS category_name, r.name AS region_name"
        : "MATCH (h:Herb) OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region) RETURN h, c.name AS category_name, r.name AS region_name";

      const herbResult = await session.run(herbCypher);
      herbResult.records.forEach(record => {
        const node = record.get('h');
        const nodeId = 'herb_' + node.identity.toString();
        if (!nodeIdMap.has(nodeId)) {
          nodeIdMap.set(nodeId, true);
          nodes.push({
            id: nodeId, labels: ['Herb'],
            properties: {
              name: node.properties.name,
              pinyin: node.properties.pinyin || '',
              description: node.properties.description || '',
              category: record.get('category_name') || '',
              region: record.get('region_name') || ''
            }
          });
        }
      });

      // ---------- 2. 分类节点 ----------
      const catResult = await session.run("MATCH (c:Category) RETURN c ORDER BY c.name");
      catResult.records.forEach(record => {
        const node = record.get('c');
        const nodeId = 'category_' + node.identity.toString();
        if (!nodeIdMap.has(nodeId)) {
          nodeIdMap.set(nodeId, true);
          nodes.push({ id: nodeId, labels: ['Category'], properties: { name: node.properties.name, description: node.properties.description || '' } });
        }
      });

      // ---------- 3. 产地节点 ----------
      const regResult = await session.run("MATCH (r:Region) RETURN r ORDER BY r.name");
      regResult.records.forEach(record => {
        const node = record.get('r');
        const nodeId = 'region_' + node.identity.toString();
        if (!nodeIdMap.has(nodeId)) {
          nodeIdMap.set(nodeId, true);
          nodes.push({ id: nodeId, labels: ['Region'], properties: { name: node.properties.name, description: node.properties.description || '' } });
        }
      });

      // ---------- 4. 来源节点 ----------
      try {
        const srcResult = await session.run("MATCH (s:Source) RETURN s ORDER BY s.name");
        srcResult.records.forEach(record => {
          const node = record.get('s');
          const nodeId = 'source_' + node.identity.toString();
          if (!nodeIdMap.has(nodeId)) {
            nodeIdMap.set(nodeId, true);
            nodes.push({ id: nodeId, labels: ['Source'], properties: { name: node.properties.name } });
          }
        });
      } catch (e) {}

      // ---------- 5. 性味节点 ----------
      const propResult = await session.run("MATCH (p:Property) RETURN p ORDER BY p.name");
      propResult.records.forEach(record => {
        const node = record.get('p');
        const nodeId = 'property_' + node.identity.toString();
        if (!nodeIdMap.has(nodeId)) {
          nodeIdMap.set(nodeId, true);
          nodes.push({ id: nodeId, labels: ['Property'], properties: { name: node.properties.name, type: node.properties.type || '' } });
        }
      });

      // ---------- 6. 归经节点 ----------
      const merResult = await session.run("MATCH (m:Meridian) RETURN m ORDER BY m.name");
      merResult.records.forEach(record => {
        const node = record.get('m');
        const nodeId = 'meridian_' + node.identity.toString();
        if (!nodeIdMap.has(nodeId)) {
          nodeIdMap.set(nodeId, true);
          nodes.push({ id: nodeId, labels: ['Meridian'], properties: { name: node.properties.name } });
        }
      });

      // ---------- 7. 功效节点 ----------
      const effResult = await session.run("MATCH (e:Efficacy) RETURN e ORDER BY e.name");
      effResult.records.forEach(record => {
        const node = record.get('e');
        const nodeId = 'efficacy_' + node.identity.toString();
        if (!nodeIdMap.has(nodeId)) {
          nodeIdMap.set(nodeId, true);
          nodes.push({ id: nodeId, labels: ['Efficacy'], properties: { name: node.properties.name } });
        }
      });

      // ========== 关系边 ==========
      // Herb -> Category
      const hcRes = await session.run(
        "MATCH (h:Herb)-[:BELONGS_TO_CATEGORY]->(c:Category) RETURN h, c"
      );
      hcRes.records.forEach(r => {
        const h = r.get('h'); const c = r.get('c');
        links.push({ source: 'herb_' + h.identity.toString(), target: 'category_' + c.identity.toString(), type: 'BELONGS_TO_CATEGORY' });
      });

      // Herb -> Region
      const hrRes = await session.run(
        "MATCH (h:Herb)-[:FROM_REGION]->(r:Region) RETURN h, r"
      );
      hrRes.records.forEach(r => {
        const h = r.get('h'); const rg = r.get('r');
        links.push({ source: 'herb_' + h.identity.toString(), target: 'region_' + rg.identity.toString(), type: 'FROM_REGION' });
      });

      // Herb -> Property
      const hpRes = await session.run(
        "MATCH (h:Herb)-[:HAS_PROPERTY]->(p:Property) RETURN h, p"
      );
      hpRes.records.forEach(r => {
        const h = r.get('h'); const p = r.get('p');
        links.push({ source: 'herb_' + h.identity.toString(), target: 'property_' + p.identity.toString(), type: 'HAS_PROPERTY' });
      });

      // Herb -> Meridian
      const hmRes = await session.run(
        "MATCH (h:Herb)-[:MERIDIAN_AFFINITY]->(m:Meridian) RETURN h, m"
      );
      hmRes.records.forEach(r => {
        const h = r.get('h'); const m = r.get('m');
        links.push({ source: 'herb_' + h.identity.toString(), target: 'meridian_' + m.identity.toString(), type: 'MERIDIAN_AFFINITY' });
      });

      // Herb -> Efficacy
      const heRes = await session.run(
        "MATCH (h:Herb)-[:HAS_EFFICACY]->(e:Efficacy) RETURN h, e"
      );
      heRes.records.forEach(r => {
        const h = r.get('h'); const e = r.get('e');
        links.push({ source: 'herb_' + h.identity.toString(), target: 'efficacy_' + e.identity.toString(), type: 'HAS_EFFICACY' });
      });

      // Compatibility (Herb-Herb)
      try {
        const compRes = await session.run(
          "MATCH (h1:Herb)-[rel:COMPATIBILITY]->(h2:Herb) RETURN h1, h2, rel"
        );
        compRes.records.forEach(r => {
          const h1 = r.get('h1'); const h2 = r.get('h2'); const rel = r.get('rel');
          links.push({ source: 'herb_' + h1.identity.toString(), target: 'herb_' + h2.identity.toString(), type: rel.properties.relation_type || 'COMPATIBILITY' });
        });
      } catch (e) {}

      // Formula -> Herb
      try {
        const fhRes = await session.run(
          "MATCH (f:Formula)-[rel:CONTAINS_HERB]->(h:Herb) RETURN f, h, rel"
        );
        fhRes.records.forEach(r => {
          const f = r.get('f'); const h = r.get('h'); const rel = r.get('rel');
          links.push({
            source: 'formula_' + f.identity.toString(), target: 'herb_' + h.identity.toString(), type: 'CONTAINS_HERB',
            properties: { dosage: rel.properties.dosage || '', role: rel.properties.role || '' }
          });
        });
        // 添加 Formula 节点
        const fNodesRes = await session.run("MATCH (f:Formula) RETURN f");
        fNodesRes.records.forEach(record => {
          const node = record.get('f');
          const nodeId = 'formula_' + node.identity.toString();
          if (!nodeIdMap.has(nodeId)) {
            nodeIdMap.set(nodeId, true);
            nodes.push({ id: nodeId, labels: ['Formula'], properties: { name: node.properties.name, description: node.properties.description || '' } });
          }
        });
      } catch (e) {}

      setCache(cacheKey, { nodes, links });
      res.json({ success: true, data: { nodes, links } });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('[knowledge-graph] graph-data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 药材详情（Neo4j 版） ====================
router.get('/herb-details/:name', async (req, res) => {
  try {
    const herbName = decodeURIComponent(req.params.name);
    const session = neo4jManager.getSession();
    try {
      const result = await session.run(
        "MATCH (h:Herb {name: }) OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region) RETURN h, c.name AS category_name, r.name AS region_name",
        { name: herbName }
      );

      if (result.records.length === 0) {
        return res.status(404).json({ success: false, message: '药材不存在' });
      }

      const record = result.records[0];
      const herb = record.get('h');
      const basicInfo = {
        id: herb.identity.toString(),
        name: herb.properties.name,
        pinyin: herb.properties.pinyin || '',
        latin_name: herb.properties.latin_name || '',
        alias: herb.properties.alias || '',
        description: herb.properties.description || '',
        efficacy: herb.properties.efficacy || '',
        usage_dosage: herb.properties.usage_dosage || '',
        caution: herb.properties.caution || '',
        is_common: herb.properties.is_common || 0,
        category_name: record.get('category_name') || '',
        region_name: record.get('region_name') || ''
      };

      // 性味
      const pRes = await session.run(
        "MATCH (h:Herb {name: })-[:HAS_PROPERTY]->(p:Property) RETURN p.name AS name, p.type AS type",
        { name: herbName }
      );
      const properties = pRes.records.map(r => ({ name: r.get('name'), type: r.get('type') }));

      // 归经
      const mRes = await session.run(
        "MATCH (h:Herb {name: })-[:MERIDIAN_AFFINITY]->(m:Meridian) RETURN m.name AS name, m.abbreviation AS abbreviation",
        { name: herbName }
      );
      const meridians = mRes.records.map(r => ({ name: r.get('name'), abbreviation: r.get('abbreviation') }));

      // 功效
      const eRes = await session.run(
        "MATCH (h:Herb {name: })-[:HAS_EFFICACY]->(e:Efficacy) RETURN e.name AS name",
        { name: herbName }
      );
      const efficacies = eRes.records.map(r => ({ name: r.get('name') }));

      // 方剂
      let formulas = [];
      try {
        const fRes = await session.run(
          "MATCH (h:Herb {name: })<-[r:CONTAINS_HERB]-(f:Formula) RETURN f.name AS name, r.dosage AS dosage, r.role AS role",
          { name: herbName }
        );
        formulas = fRes.records.map(r => ({ name: r.get('name'), dosage: r.get('dosage'), role: r.get('role') }));
      } catch (e) {}

      // 配伍禁忌
      let incompatibilities = [];
      try {
        const iRes = await session.run(
          "MATCH (h1:Herb {name: })-[cr:COMPATIBILITY]-(h2:Herb) WHERE cr.relation_type IN ['相反','相恶'] RETURN h2.name AS herb2_name, cr.relation_type AS relation_type, cr.description AS description",
          { name: herbName }
        );
        incompatibilities = iRes.records.map(r => ({ herb2_name: r.get('herb2_name'), relation_type: r.get('relation_type'), description: r.get('description') }));
      } catch (e) {}

      res.json({ success: true, data: { basicInfo, properties, meridians, efficacies, formulas, incompatibilities } });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('[knowledge-graph] herb-details error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 产地分布（优化版：单次查询） ====================
router.get('/region-distribution', async (req, res) => {
  try {
    const session = neo4jManager.getSession();
    try {
      const result = await session.run(
        "MATCH (r:Region) OPTIONAL MATCH (r)<-[:FROM_REGION]-(h:Herb) RETURN r, count(h) AS herb_count ORDER BY herb_count DESC"
      );

      const regions = [];
      for (const record of result.records) {
        const r = record.get('r');
        const hCount = toNumber(record.get('herb_count'));
        // 用 Neo4j Region 节点上存储的 SQLite 原始 id，确保与 /api/herbs?region_id=X 兼容
        const sqliteId = toNumber(r.properties.id) || r.identity.toNumber();
        regions.push({
          id: sqliteId,
          name: r.properties.name,
          description: r.properties.description || '',
          herb_count: hCount
        });
      }

      res.json({
        success: true,
        data: {
          regions,
          statistics: {
            totalRegions: regions.length,
            totalHerbs: regions.reduce((s, r) => s + r.herb_count, 0)
          }
        }
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('[knowledge-graph] region-distribution error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;