const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

const router = express.Router();

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1小时

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { cache.delete(key); return null; }
  return item.value;
}

function setCache(key, value, ttl = CACHE_TTL) {
  cache.set(key, { value, expires: Date.now() + ttl });
}

// 获取数据库路径
function getDbPath() {
  const sqlitePath = config.databases.sqlite.path;
  return path.isAbsolute(sqlitePath)
    ? sqlitePath
    : path.join(__dirname, '../../', sqlitePath);
}

// =============================================
// 药材知识图谱数据
// =============================================
router.get('/graph-data', (req, res) => {
  try {
    // 缓存命中直接返回
    const cached = getCached('graph-data');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const db = new Database(getDbPath());

    // 获取所有药材
    const herbs = db.prepare(`
      SELECT h.id, h.name, h.pinyin, h.description, hc.name as category, hr.name as region
      FROM herbs h
      LEFT JOIN herb_categories hc ON h.category_id = hc.id
      LEFT JOIN herb_regions hr ON h.region_id = hr.id
      ORDER BY h.id
    `).all();

    // 获取所有分类
    const categories = db.prepare(`
      SELECT id, name, description FROM herb_categories ORDER BY id
    `).all();

    // 获取所有产地
    const regions = db.prepare(`
      SELECT id, name, description FROM herb_regions ORDER BY id
    `).all();

    // 获取所有来源
    const sources = db.prepare(`
      SELECT id, name FROM herb_sources ORDER BY id
    `).all();

    // 获取性味
    const properties = db.prepare(`
      SELECT id, name, type FROM properties ORDER BY id
    `).all();

    // 获取归经
    const meridians = db.prepare(`
      SELECT id, name FROM meridians ORDER BY id
    `).all();

    // 获取药材-性味关联
    const herbProperties = db.prepare(`
      SELECT hp.herb_id, hp.property_id, h.name as herb_name
      FROM herb_properties hp
      JOIN herbs h ON hp.herb_id = h.id
    `).all();

    // 获取药材-归经关联
    const herbMeridians = db.prepare(`
      SELECT hm.herb_id, hm.meridian_id
      FROM herb_meridians hm
    `).all();

    // 获取药材-功效关联
    const herbEfficacies = db.prepare(`
      SELECT he.herb_id, he.efficacy_id, e.name as efficacy_name
      FROM herb_efficacies he
      JOIN efficacies e ON he.efficacy_id = e.id
    `).all();

    // 获取功效
    const efficacies = db.prepare(`
      SELECT id, name FROM efficacies ORDER BY id
    `).all();

    db.close();

    // 构建节点
    const nodes = [];
    const links = [];

    // 药材节点
    herbs.forEach(h => {
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

    // 分类节点
    categories.forEach(c => {
      nodes.push({
        id: `category_${c.id}`,
        labels: ['Category'],
        properties: { name: c.name, description: c.description || '' }
      });
    });

    // 产地节点
    regions.forEach(r => {
      nodes.push({
        id: `region_${r.id}`,
        labels: ['Region'],
        properties: { name: r.name, description: r.description || '' }
      });
    });

    // 来源节点
    sources.forEach(s => {
      nodes.push({
        id: `source_${s.id}`,
        labels: ['Source'],
        properties: { name: s.name }
      });
    });

    // 性味节点
    properties.forEach(p => {
      nodes.push({
        id: `property_${p.id}`,
        labels: ['Property'],
        properties: { name: p.name, type: p.type }
      });
    });

    // 归经节点
    meridians.forEach(m => {
      nodes.push({
        id: `meridian_${m.id}`,
        labels: ['Meridian'],
        properties: { name: m.name }
      });
    });

    // 功效节点
    efficacies.forEach(e => {
      if (!nodes.find(n => n.id === `efficacy_${e.id}`)) {
        nodes.push({
          id: `efficacy_${e.id}`,
          labels: ['Efficacy'],
          properties: { name: e.name }
        });
      }
    });

    // 创建关系链接
    // 药材 → 分类
    herbs.forEach(h => {
      if (h.category) {
        const cat = categories.find(c => c.name === h.category);
        if (cat) links.push({ source: `herb_${h.id}`, target: `category_${cat.id}`, type: '属于' });
      }
    });

    // 药材 → 产地
    herbs.forEach(h => {
      if (h.region) {
        const region = regions.find(r => r.name === h.region);
        if (region) links.push({ source: `herb_${h.id}`, target: `region_${region.id}`, type: '产自' });
      }
    });

    // 药材 → 来源
    herbs.forEach(h => {
      // source_id is in herbs table but not selected - need to re-query or handle differently
    });

    // 药材 → 性味
    herbProperties.forEach(hp => {
      links.push({ source: `herb_${hp.herb_id}`, target: `property_${hp.property_id}`, type: '性' });
    });

    // 药材 → 归经
    herbMeridians.forEach(hm => {
      links.push({ source: `herb_${hm.herb_id}`, target: `meridian_${hm.meridian_id}`, type: '入' });
    });

    // 药材 → 功效
    herbEfficacies.forEach(he => {
      links.push({ source: `herb_${he.herb_id}`, target: `efficacy_${he.efficacy_id}`, type: '功效' });
    });

    // 写入缓存
    const result = { nodes, links };
    setCache('graph-data', result);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取知识图谱数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取知识图谱数据失败',
      error: error.message
    });
  }
});

// =============================================
// 获取药材详情（替代原 country-details）
// =============================================
router.get('/herb-details/:herbName', (req, res) => {
  try {
    const herbName = decodeURIComponent(req.params.herbName);
    const db = new Database(getDbPath());

    const herb = db.prepare(`
      SELECT h.*, hc.name as category_name, hr.name as region_name, hs.name as source_name
      FROM herbs h
      LEFT JOIN herb_categories hc ON h.category_id = hc.id
      LEFT JOIN herb_regions hr ON h.region_id = hr.id
      LEFT JOIN herb_sources hs ON h.source_id = hs.id
      WHERE h.name = ?
    `).get(herbName);

    if (!herb) {
      db.close();
      return res.status(404).json({ success: false, message: '药材不存在' });
    }

    // 性味
    const properties = db.prepare(`
      SELECT p.name, p.type, hp.intensity
      FROM herb_properties hp
      JOIN properties p ON hp.property_id = p.id
      WHERE hp.herb_id = ?
    `).all(herb.id);

    // 归经
    const meridians = db.prepare(`
      SELECT m.name, m.abbreviation
      FROM herb_meridians hm
      JOIN meridians m ON hm.meridian_id = m.id
      WHERE hm.herb_id = ?
    `).all(herb.id);

    // 功效
    const efficacies = db.prepare(`
      SELECT e.name
      FROM herb_efficacies he
      JOIN efficacies e ON he.efficacy_id = e.id
      WHERE he.herb_id = ?
    `).all(herb.id);

    // 包含此药材的方剂
    const formulas = db.prepare(`
      SELECT f.id, f.name, fh.dosage, fh.role
      FROM formula_herbs fh
      JOIN formulas f ON fh.formula_id = f.id
      WHERE fh.herb_id = ?
      ORDER BY f.name
    `).all(herb.id);

    // 配伍禁忌
    const incompatibilities = db.prepare(`
      SELECT h2.name as herb2_name, cr.relation_type, cr.description
      FROM compatibility_rules cr
      JOIN herbs h2 ON cr.herb2_id = h2.id
      WHERE cr.herb1_id = ? AND cr.relation_type IN ('相反','相恶')
    `).all(herb.id);

    db.close();

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
router.get('/region-distribution', (req, res) => {
  try {
    const db = new Database(getDbPath());

    const regions = db.prepare(`
      SELECT hr.id, hr.name, hr.description, COUNT(h.id) as herb_count
      FROM herb_regions hr
      LEFT JOIN herbs h ON hr.id = h.region_id
      GROUP BY hr.id, hr.name
      ORDER BY herb_count DESC
    `).all();

    // 每个地区的药材列表
    const regionHerbs = {};
    for (const r of regions) {
      regionHerbs[r.name] = db.prepare(`
        SELECT h.id, h.name, hc.name as category
        FROM herbs h
        LEFT JOIN herb_categories hc ON h.category_id = hc.id
        WHERE h.region_id = ?
        ORDER BY h.name
        LIMIT 20
      `).all(r.id);
    }

    db.close();

    res.json({
      success: true,
      data: {
        regions,
        regionHerbs,
        statistics: {
          totalRegions: regions.length,
          totalHerbs: regions.reduce((sum, r) => sum + r.herb_count, 0)
        }
      }
    });
  } catch (error) {
    console.error('获取地区分布数据失败:', error);
    res.status(500).json({ success: false, message: '获取地区分布数据失败', error: error.message });
  }
});

module.exports = router;
