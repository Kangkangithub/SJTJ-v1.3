const express = require('express');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

const router = express.Router();

function all(sql, params = []) {
  const db = databaseManager.getDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function buildWhere(query) {
  const where = [];
  const params = [];

  if (query.q) {
    where.push('(h.name LIKE ? OR h.pinyin LIKE ? OR h.description LIKE ? OR e.name LIKE ?)');
    const term = `%${query.q}%`;
    params.push(term, term, term, term);
  }
  if (query.category_id) {
    where.push('h.category_id = ?');
    params.push(Number(query.category_id));
  }
  if (query.region_id) {
    where.push('h.region_id = ?');
    params.push(Number(query.region_id));
  }

  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
    const { clause, params } = buildWhere(req.query);

    const herbs = await all(`
      SELECT
        h.id,
        h.name,
        h.pinyin,
        h.description,
        h.usage_dosage,
        h.is_common,
        hc.name as category_name,
        hr.name as region_name,
        COUNT(DISTINCT f.id) as formula_count,
        GROUP_CONCAT(DISTINCT e.name) as efficacy_names
      FROM herbs h
      LEFT JOIN herb_categories hc ON h.category_id = hc.id
      LEFT JOIN herb_regions hr ON h.region_id = hr.id
      LEFT JOIN herb_efficacies he ON he.herb_id = h.id
      LEFT JOIN efficacies e ON e.id = he.efficacy_id
      LEFT JOIN formula_herbs fh ON fh.herb_id = h.id
      LEFT JOIN formulas f ON f.id = fh.formula_id
      ${clause}
      GROUP BY h.id
      ORDER BY h.is_common DESC, formula_count DESC, h.name ASC
      LIMIT ?
    `, [...params, limit]);

    const formulas = await all(`
      SELECT
        f.id,
        f.name,
        f.pinyin,
        f.category,
        f.description,
        f.source,
        COUNT(fh.herb_id) as herb_count,
        GROUP_CONCAT(h.name) as herb_names
      FROM formulas f
      LEFT JOIN formula_herbs fh ON fh.formula_id = f.id
      LEFT JOIN herbs h ON h.id = fh.herb_id
      GROUP BY f.id
      ORDER BY herb_count DESC, f.name ASC
      LIMIT ?
    `, [Math.min(limit, 12)]);

    res.json({
      success: true,
      data: {
        herbs: herbs.map((item) => ({
          ...item,
          efficacy_names: item.efficacy_names ? item.efficacy_names.split(',') : [],
          reason: item.is_common
            ? '数据库标记为常用药材'
            : item.formula_count > 0
              ? `收录于 ${item.formula_count} 个方剂`
              : '来自后端药材库记录'
        })),
        formulas: formulas.map((item) => ({
          ...item,
          herb_names: item.herb_names ? item.herb_names.split(',') : [],
          reason: item.herb_count > 0 ? `包含 ${item.herb_count} 味组成药材` : '来自后端方剂库记录'
        }))
      }
    });
  } catch (error) {
    logger.error('获取推荐数据失败:', error);
    res.status(500).json({ success: false, message: '获取推荐数据失败' });
  }
});

module.exports = router;
