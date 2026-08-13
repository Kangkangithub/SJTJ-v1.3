const express = require('express');
const databaseManager = require('../config/database-simple');

const router = express.Router();

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1小时

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value, ttl = CACHE_TTL) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

function all(sql, params = []) {
  const db = databaseManager.getDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function get(sql, params = []) {
  const db = databaseManager.getDatabase();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

// =============================================
// 药材知识图谱数据
// =============================================
router.get('/graph-data', async (req, res) => {
  try {
    const commonOnly = req.query.common === '1';
    const cacheKey = commonOnly ? 'graph-data-common' : 'graph-data';
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const commonWhere = commonOnly ? 'WHERE h.is_common = 1' : '';

    const [herbs, categories, regions, sources, properties, meridians, herbProperties, herbMeridians, herbEfficacies, efficacies] = await Promise.all([
      all(`
        SELECT h.id, h.name, h.pinyin, h.description, h.source_id, hc.name as category, hr.name as region
        FROM herbs h
        LEFT JOIN herb_categories hc ON h.category_id = hc.id
        LEFT JOIN herb_regions hr ON h.region_id = hr.id
        ${commonWhere}
        ORDER BY h.id
      `),
      all('SELECT id, name, description FROM herb_categories ORDER BY id'),
      all('SELECT id, name, description FROM herb_regions ORDER BY id'),
      all('SELECT id, name FROM herb_sources ORDER BY id'),
      all('SELECT id, name, type FROM properties ORDER BY id'),
      all('SELECT id, name FROM meridians ORDER BY id'),
      all(`
        SELECT hp.herb_id, hp.property_id, h.name as herb_name
        FROM herb_properties hp
        JOIN herbs h ON hp.herb_id = h.id
        ${commonWhere}
      `),
      all(`
        SELECT hm.herb_id, hm.meridian_id
        FROM herb_meridians hm
        JOIN herbs h ON hm.herb_id = h.id
        ${commonWhere}
      `),
      all(`
        SELECT he.herb_id, he.efficacy_id, e.name as efficacy_name
        FROM herb_efficacies he
        JOIN efficacies e ON he.efficacy_id = e.id
        JOIN herbs h ON he.herb_id = h.id
        ${commonWhere}
      `),
      all('SELECT id, name FROM efficacies ORDER BY id')
    ]);

    const nodes = [];
    const links = [];

    herbs.forEach((h) => {
      nodes.push({
        id: `herb_${h.id}`,
        labels: ['Herb'],
        properties: {
          name: h.name,
          pinyin: h.pinyin || '',
          description: h.description || '',
          category: h.category || '',
          region: h.region || ''
        }
      });
    });

    categories.forEach((c) => {
      nodes.push({ id: `category_${c.id}`, labels: ['Category'], properties: { name: c.name, description: c.description || '' } });
    });

    regions.forEach((r) => {
      nodes.push({ id: `region_${r.id}`, labels: ['Region'], properties: { name: r.name, description: r.description || '' } });
    });

    sources.forEach((s) => {
      nodes.push({ id: `source_${s.id}`, labels: ['Source'], properties: { name: s.name } });
    });

    properties.forEach((p) => {
      nodes.push({ id: `property_${p.id}`, labels: ['Property'], properties: { name: p.name, type: p.type } });
    });

    meridians.forEach((m) => {
      nodes.push({ id: `meridian_${m.id}`, labels: ['Meridian'], properties: { name: m.name } });
    });

    efficacies.forEach((e) => {
      nodes.push({ id: `efficacy_${e.id}`, labels: ['Efficacy'], properties: { name: e.name } });
    });

    herbs.forEach((h) => {
      const cat = categories.find((c) => c.name === h.category);
      if (cat) links.push({ source: `herb_${h.id}`, target: `category_${cat.id}`, type: '属于' });

      const region = regions.find((r) => r.name === h.region);
      if (region) links.push({ source: `herb_${h.id}`, target: `region_${region.id}`, type: '产自' });

      if (h.source_id) links.push({ source: `herb_${h.id}`, target: `source_${h.source_id}`, type: '来源' });
    });

    herbProperties.forEach((hp) => {
      links.push({ source: `herb_${hp.herb_id}`, target: `property_${hp.property_id}`, type: '性味' });
    });

    herbMeridians.forEach((hm) => {
      links.push({ source: `herb_${hm.herb_id}`, target: `meridian_${hm.meridian_id}`, type: '归经' });
    });

    herbEfficacies.forEach((he) => {
      links.push({ source: `herb_${he.herb_id}`, target: `efficacy_${he.efficacy_id}`, type: '功效' });
    });

    const result = { nodes, links };
    setCache(cacheKey, result);
    res.json({ success: true, data: result, common: commonOnly });
  } catch (error) {
    console.error('获取知识图谱数据失败:', error);
    res.status(500).json({ success: false, message: '获取知识图谱数据失败', error: error.message });
  }
});

// =============================================
// 获取药材详情（替代原 country-details）
// =============================================
router.get('/herb-details/:herbName', async (req, res) => {
  try {
    const herbName = decodeURIComponent(req.params.herbName);

    const herb = await get(`
      SELECT h.*, hc.name as category_name, hr.name as region_name, hs.name as source_name
      FROM herbs h
      LEFT JOIN herb_categories hc ON h.category_id = hc.id
      LEFT JOIN herb_regions hr ON h.region_id = hr.id
      LEFT JOIN herb_sources hs ON h.source_id = hs.id
      WHERE h.name = ?
    `, [herbName]);

    if (!herb) {
      return res.status(404).json({ success: false, message: '药材不存在' });
    }

    const [properties, meridians, efficacies, formulas, incompatibilities] = await Promise.all([
      all(`
        SELECT p.name, p.type, hp.intensity
        FROM herb_properties hp
        JOIN properties p ON hp.property_id = p.id
        WHERE hp.herb_id = ?
      `, [herb.id]),
      all(`
        SELECT m.name, m.abbreviation
        FROM herb_meridians hm
        JOIN meridians m ON hm.meridian_id = m.id
        WHERE hm.herb_id = ?
      `, [herb.id]),
      all(`
        SELECT e.name
        FROM herb_efficacies he
        JOIN efficacies e ON he.efficacy_id = e.id
        WHERE he.herb_id = ?
      `, [herb.id]),
      all(`
        SELECT f.id, f.name, fh.dosage, fh.role
        FROM formula_herbs fh
        JOIN formulas f ON fh.formula_id = f.id
        WHERE fh.herb_id = ?
        ORDER BY f.name
      `, [herb.id]),
      all(`
        SELECT h2.name as herb2_name, cr.relation_type, cr.description
        FROM compatibility_rules cr
        JOIN herbs h2 ON cr.herb2_id = h2.id
        WHERE cr.herb1_id = ? AND cr.relation_type IN ('相反','相恶')
      `, [herb.id])
    ]);

    res.json({
      success: true,
      data: {
        basicInfo: herb,
        properties,
        meridians,
        efficacies,
        formulas,
        incompatibilities
      }
    });
  } catch (error) {
    console.error('获取药材详情失败:', error);
    res.status(500).json({ success: false, message: '获取药材详情失败', error: error.message });
  }
});

// =============================================
// 地区药材分布数据（替代原 world-map-data）
// =============================================
router.get('/region-distribution', async (req, res) => {
  try {
    const regions = await all(`
      SELECT hr.id, hr.name, hr.description, COUNT(h.id) as herb_count
      FROM herb_regions hr
      LEFT JOIN herbs h ON hr.id = h.region_id
      GROUP BY hr.id, hr.name
      ORDER BY herb_count DESC
    `);

    const regionHerbs = {};
    await Promise.all(regions.map(async (r) => {
      regionHerbs[r.name] = await all(`
        SELECT h.id, h.name, hc.name as category
        FROM herbs h
        LEFT JOIN herb_categories hc ON h.category_id = hc.id
        WHERE h.region_id = ?
        ORDER BY h.name
        LIMIT 20
      `, [r.id]);
    }));

    res.json({
      success: true,
      data: {
        regions,
        regionHerbs,
        statistics: {
          totalRegions: regions.length,
          totalHerbs: regions.reduce((sum, r) => sum + Number(r.herb_count || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('获取地区分布数据失败:', error);
    res.status(500).json({ success: false, message: '获取地区分布数据失败', error: error.message });
  }
});

module.exports = router;
