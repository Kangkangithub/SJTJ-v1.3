const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate, herbSchema } = require('../middleware/validation');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 缓存
const routeCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10分钟
function getCached(key) {
  const item = routeCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) { routeCache.delete(key); return null; }
  return item.value;
}
function setCached(key, value, ttl = CACHE_TTL) {
  routeCache.set(key, { value, expires: Date.now() + ttl });
}
function clearCache() {
  routeCache.clear();
}

// =============================================
// 图片兜底目录：backend/uploads/herbs
// =============================================
const HERB_IMAGE_DIR = path.join(__dirname, '../../uploads', 'herbs');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// 当数据库未记录图片时，按「文件名 = 药材名」约定兜底，返回动态图片条目
// 使图片文件在仓库内即可直接显示，不依赖每台机器的私有数据库
function resolveHerbImages(herbName, dbImages) {
  if (dbImages && dbImages.length > 0) return dbImages;
  const ext = IMAGE_EXTENSIONS.find((item) => fs.existsSync(path.join(HERB_IMAGE_DIR, `${herbName}${item}`)));
  if (!ext) return [];
  const filename = `${herbName}${ext}`;
  const filePath = path.join(HERB_IMAGE_DIR, filename);
  return [{
    id: `fallback_${herbName}`,
    filename,
    originalName: filename,
    path: `/uploads/herbs/${filename}`,
    size: fs.statSync(filePath).size,
    description: '',
    uploadedAt: null
  }];
}

// =============================================
// 视频兜底目录：backend/uploads/videos
// =============================================
const HERB_VIDEO_DIR = path.join(__dirname, '../../uploads', 'videos');

// 当数据库未记录视频时，按「文件名 = 药材名」约定兜底，返回动态视频对象
function resolveHerbVideo(herbName, dbVideo) {
  if (dbVideo) return dbVideo;
  const ext = ['.mp4', '.webm'].find(e => fs.existsSync(path.join(HERB_VIDEO_DIR, herbName + e)));
  if (!ext) return null;
  const filename = herbName + ext;
  const filePath = path.join(HERB_VIDEO_DIR, filename);
  return {
    filename,
    path: `/uploads/videos/${filename}`,
    size: fs.statSync(filePath).size,
    mimeType: ext === '.mp4' ? 'video/mp4' : 'video/webm'
  };
}

// =============================================
// 辅助函数：获取药材完整信息（含性味归经功效）
// =============================================
async function getHerbFullInfo(db, herbId) {
  // 药材基本信息
  const herb = await new Promise((resolve, reject) => {
    db.get(
      `SELECT h.*, hc.name as category_name, hr.name as region_name, hs.name as source_name
       FROM herbs h
       LEFT JOIN herb_categories hc ON h.category_id = hc.id
       LEFT JOIN herb_regions hr ON h.region_id = hr.id
       LEFT JOIN herb_sources hs ON h.source_id = hs.id
       WHERE h.id = ?`,
      [herbId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (!herb) return null;

  // 性味
  const properties = await new Promise((resolve, reject) => {
    db.all(
      `SELECT p.id, p.name, p.type, hp.intensity
       FROM herb_properties hp
       JOIN properties p ON hp.property_id = p.id
       WHERE hp.herb_id = ?`,
      [herbId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  // 归经
  const meridians = await new Promise((resolve, reject) => {
    db.all(
      `SELECT m.id, m.name, m.abbreviation
       FROM herb_meridians hm
       JOIN meridians m ON hm.meridian_id = m.id
       WHERE hm.herb_id = ?`,
      [herbId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  // 功效
  const efficacies = await new Promise((resolve, reject) => {
    db.all(
      `SELECT e.id, e.name
       FROM herb_efficacies he
       JOIN efficacies e ON he.efficacy_id = e.id
       WHERE he.herb_id = ?`,
      [herbId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  return {
    ...herb,
    properties,
    meridians,
    efficacies,
    images: resolveHerbImages(herb.name, JSON.parse(herb.images || '[]')),
    video: resolveHerbVideo(herb.name, null),
    quality: JSON.parse(herb.quality || '{}')
  };
}

// =============================================
// 获取药材列表
// =============================================
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category_id, region_id, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const db = databaseManager.getDatabase();

    let whereClause = '';
    let params = [];

    if (category_id) {
      whereClause += ' WHERE h.category_id = ?';
      params.push(category_id);
    }

    if (region_id) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ' h.region_id = ?';
      params.push(region_id);
    }

    const herbs = await new Promise((resolve, reject) => {
      db.all(
        `SELECT h.id, h.name, h.pinyin, h.alias, h.images, hc.name as category_name,
                hr.name as region_name, h.description, h.usage_dosage, h.is_common
         FROM herbs h
         LEFT JOIN herb_categories hc ON h.category_id = hc.id
         LEFT JOIN herb_regions hr ON h.region_id = hr.id
         ${whereClause}
         ORDER BY h.name ASC`,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const enrichedHerbs = herbs.map((herb) => {
      let dbImages = [];
      try { dbImages = herb.images ? JSON.parse(herb.images) : []; } catch (error) { dbImages = []; }
      return { ...herb, images: resolveHerbImages(herb.name, dbImages) };
    }).sort((a, b) => {
      const imageDiff = Number(Boolean(b.images?.length)) - Number(Boolean(a.images?.length));
      return imageDiff || String(a.name).localeCompare(String(b.name), 'zh-Hans');
    });

    const pagedHerbs = enrichedHerbs.slice(offset, offset + limitNum);

    const total = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM herbs h${whereClause}`,
        params,
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    res.json({
      success: true,
      data: {
        herbs: pagedHerbs,
        pagination: {
          current_page: pageNum,
          total_pages: Math.ceil(total / limitNum),
          total_items: total,
          items_per_page: limitNum
        }
      }
    });
  } catch (error) {
    logger.error('获取药材列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取药材列表失败'
    });
  }
});

// =============================================
// 搜索药材
// =============================================
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const term = q.trim();
    const searchTerm = `%${term}%`;

    const db = databaseManager.getDatabase();

    // 搜索匹配的药材ID（加权排序）
    const matchedIds = await new Promise((resolve, reject) => {
      db.all(
        `SELECT h.id,
           CASE
             WHEN h.name = ? THEN 0
             WHEN h.alias = ? THEN 1
             WHEN h.pinyin = ? THEN 2
             ELSE 3
           END as rank,
           h.name
         FROM herbs h
         WHERE h.name LIKE ?
            OR h.alias LIKE ?
            OR h.pinyin LIKE ?
            OR h.efficacy LIKE ?
            OR h.description LIKE ?
         ORDER BY rank, h.name ASC
         LIMIT 50`,
        [term, term, term, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const ids = matchedIds.map(m => m.id);

    // 批量获取完整药材信息（含性味归经功效方剂）
    const herbs = [];
    for (const id of ids) {
      const herb = await getHerbFullInfo(db, id);
      if (herb) {
        // 附加包含此药材的方剂
        herb.formulas = await new Promise((resolve, reject) => {
          db.all(
            `SELECT f.id, f.name, fh.dosage, fh.role
             FROM formula_herbs fh
             JOIN formulas f ON fh.formula_id = f.id
             WHERE fh.herb_id = ?
             ORDER BY f.name`,
            [id],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
        herbs.push(herb);
      }
    }

    res.json({
      success: true,
      data: {
        herbs,
        total: herbs.length
      }
    });
  } catch (error) {
    logger.error('搜索药材错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索药材失败'
    });
  }
});

// =============================================
// 药材统计
// =============================================
router.get('/statistics', async (req, res) => {
  try {
    const cached = getCached('statistics');
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const db = databaseManager.getDatabase();

    const categoryStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT hc.name, COUNT(*) as count
         FROM herbs h
         JOIN herb_categories hc ON h.category_id = hc.id
         GROUP BY hc.name ORDER BY count DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const regionStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT hr.name, COUNT(*) as count
         FROM herbs h
         JOIN herb_regions hr ON h.region_id = hr.id
         GROUP BY hr.name ORDER BY count DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const totalHerbs = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM herbs',
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // 功效统计（按药材关联的功效计数）
    const efficacyStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT e.name, COUNT(DISTINCT he.herb_id) as count
         FROM herb_efficacies he
         JOIN efficacies e ON he.efficacy_id = e.id
         GROUP BY e.name ORDER BY count DESC LIMIT 20`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // 常用药材分类统计
    const commonCategoryStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT hc.name, COUNT(*) as count
         FROM herbs h
         JOIN herb_categories hc ON h.category_id = hc.id
         WHERE h.is_common = 1
         GROUP BY hc.name ORDER BY count DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const statsData = {
      total_herbs: totalHerbs,
      by_category: categoryStats,
      by_region: regionStats,
      by_efficacy: efficacyStats,
      common_by_category: commonCategoryStats
    };
    setCached('statistics', statsData);
    res.json({ success: true, data: statsData });
  } catch (error) {
    logger.error('获取药材统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取药材统计失败'
    });
  }
});

// =============================================
// 获取药材详情
// =============================================
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const herbId = req.params.id;
    const db = databaseManager.getDatabase();

    const herb = await getHerbFullInfo(db, herbId);

    if (!herb) {
      return res.status(404).json({
        success: false,
        message: '药材不存在'
      });
    }

    // 记录用户浏览兴趣
    if (req.user) {
      try {
        const userService = require('../services/userService-simple');
        await userService.recordUserInterest(req.user.userId, herbId, 'view');
      } catch (interestError) {
        logger.warn('记录用户兴趣失败:', interestError);
      }
    }

    res.json({
      success: true,
      data: herb
    });
  } catch (error) {
    logger.error('获取药材详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取药材详情失败'
    });
  }
});

// =============================================
// 获取相似药材
// =============================================
router.get('/:id/similar', async (req, res) => {
  try {
    const herbId = req.params.id;
    const limit = parseInt(req.query.limit) || 5;
    const db = databaseManager.getDatabase();

    const currentHerb = await new Promise((resolve, reject) => {
      db.get(
        'SELECT category_id, region_id FROM herbs WHERE id = ?',
        [herbId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!currentHerb) {
      return res.status(404).json({
        success: false,
        message: '药材不存在'
      });
    }

    const similarHerbs = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, pinyin, category_id, region_id
         FROM herbs
         WHERE id != ? AND (category_id = ? OR region_id = ?)
         ORDER BY
           CASE WHEN category_id = ? THEN 1 ELSE 2 END,
           CASE WHEN region_id = ? THEN 1 ELSE 2 END
         LIMIT ?`,
        [herbId, currentHerb.category_id, currentHerb.region_id,
         currentHerb.category_id, currentHerb.region_id, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: {
        similar_herbs: similarHerbs
      }
    });
  } catch (error) {
    logger.error('获取相似药材错误:', error);
    res.status(500).json({
      success: false,
      message: '获取相似药材失败'
    });
  }
});

// =============================================
// 创建药材（管理员权限）
// =============================================
// 存在性检查辅助函数
async function checkExists(db, table, id, label) {
  if (!id) return null;
  const row = await new Promise((resolve, reject) => {
    db.get(`SELECT id FROM ${table} WHERE id = ?`, [id], (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });
  if (!row) throw new Error(`${label} (ID: ${id}) 不存在`);
  return row;
}

router.post('/', authenticateToken, requireAdmin, validate(herbSchema), async (req, res) => {
  try {
    const { name, pinyin, latin_name, alias, category_id, region_id, source_id,
            description, efficacy, usage_dosage, caution, property_ids, meridian_ids, efficacy_ids } = req.body;
    const db = databaseManager.getDatabase();

    // 存在性检查
    if (category_id) await checkExists(db, 'herb_categories', category_id, '分类');
    if (region_id) await checkExists(db, 'herb_regions', region_id, '产地');
    if (source_id) await checkExists(db, 'herb_sources', source_id, '来源');
    if (property_ids && property_ids.length) {
      for (const pid of property_ids) await checkExists(db, 'properties', pid, '性味');
    }
    if (meridian_ids && meridian_ids.length) {
      for (const mid of meridian_ids) await checkExists(db, 'meridians', mid, '归经');
    }
    if (efficacy_ids && efficacy_ids.length) {
      for (const eid of efficacy_ids) await checkExists(db, 'efficacies', eid, '功效');
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO herbs (name, pinyin, latin_name, alias, category_id, region_id, source_id,
           description, efficacy, usage_dosage, caution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [name, pinyin || null, latin_name || null, alias || null,
         category_id || null, region_id || null, source_id || null,
         description || '', efficacy || null, usage_dosage || null, caution || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    // 插入性味关联
    if (property_ids && property_ids.length > 0) {
      for (const pid of property_ids) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT OR IGNORE INTO herb_properties (herb_id, property_id) VALUES (?, ?)',
            [result.id, pid],
            (err) => err ? reject(err) : resolve()
          );
        });
      }
    }

    // 插入归经关联
    if (meridian_ids && meridian_ids.length > 0) {
      for (const mid of meridian_ids) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT OR IGNORE INTO herb_meridians (herb_id, meridian_id) VALUES (?, ?)',
            [result.id, mid],
            (err) => err ? reject(err) : resolve()
          );
        });
      }
    }

    // 插入功效关联
    if (efficacy_ids && efficacy_ids.length > 0) {
      for (const eid of efficacy_ids) {
        await new Promise((resolve, reject) => {
          db.run(
            'INSERT OR IGNORE INTO herb_efficacies (herb_id, efficacy_id) VALUES (?, ?)',
            [result.id, eid],
            (err) => err ? reject(err) : resolve()
          );
        });
      }
    }

    logger.info(`药材创建成功: ${name} (ID: ${result.id})`);
    clearCache();

    res.status(201).json({
      success: true,
      message: '药材创建成功',
      data: { id: result.id, name }
    });
  } catch (error) {
    logger.error('创建药材错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '创建药材失败'
    });
  }
});

// =============================================
// 更新药材（管理员权限）
// =============================================
router.put('/:id', authenticateToken, requireAdmin, validate(herbSchema), async (req, res) => {
  try {
    const herbId = req.params.id;
    const { name, pinyin, latin_name, alias, category_id, region_id, source_id,
            description, efficacy, usage_dosage, caution,
            property_ids, meridian_ids, efficacy_ids } = req.body;
    const db = databaseManager.getDatabase();

    // 存在性检查
    if (category_id) await checkExists(db, 'herb_categories', category_id, '分类');
    if (region_id) await checkExists(db, 'herb_regions', region_id, '产地');
    if (source_id) await checkExists(db, 'herb_sources', source_id, '来源');
    if (property_ids && property_ids.length) {
      for (const pid of property_ids) await checkExists(db, 'properties', pid, '性味');
    }
    if (meridian_ids && meridian_ids.length) {
      for (const mid of meridian_ids) await checkExists(db, 'meridians', mid, '归经');
    }
    if (efficacy_ids && efficacy_ids.length) {
      for (const eid of efficacy_ids) await checkExists(db, 'efficacies', eid, '功效');
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE herbs
         SET name = ?, pinyin = ?, latin_name = ?, alias = ?,
             category_id = ?, region_id = ?, source_id = ?,
             description = ?, efficacy = ?, usage_dosage = ?, caution = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
        [name, pinyin, latin_name, alias,
         category_id, region_id, source_id,
         description, efficacy, usage_dosage, caution, herbId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '药材不存在'
      });
    }

    // 重建性味关联
    if (property_ids) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM herb_properties WHERE herb_id = ?', [herbId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      for (const pid of property_ids) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO herb_properties (herb_id, property_id) VALUES (?, ?)',
            [herbId, pid], (err) => err ? reject(err) : resolve());
        });
      }
    }

    // 重建归经关联
    if (meridian_ids) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM herb_meridians WHERE herb_id = ?', [herbId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      for (const mid of meridian_ids) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO herb_meridians (herb_id, meridian_id) VALUES (?, ?)',
            [herbId, mid], (err) => err ? reject(err) : resolve());
        });
      }
    }

    // 重建功效关联
    if (efficacy_ids) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM herb_efficacies WHERE herb_id = ?', [herbId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      for (const eid of efficacy_ids) {
        await new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO herb_efficacies (herb_id, efficacy_id) VALUES (?, ?)',
            [herbId, eid], (err) => err ? reject(err) : resolve());
        });
      }
    }

    logger.info(`药材更新成功: ${name} (ID: ${herbId})`);
    clearCache();

    res.json({
      success: true,
      message: '药材更新成功',
      data: { id: herbId, name }
    });
  } catch (error) {
    logger.error('更新药材错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新药材失败'
    });
  }
});

// =============================================
// 删除药材（管理员权限）
// =============================================
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const herbId = req.params.id;
    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM herbs WHERE id = ?',
        [herbId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '药材不存在'
      });
    }

    logger.info(`药材删除成功: ID ${herbId}`);
    clearCache();

    res.json({
      success: true,
      message: '药材删除成功'
    });
  } catch (error) {
    logger.error('删除药材错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '删除药材失败'
    });
  }
});

// =============================================
// 收藏药材
// =============================================
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const herbId = req.params.id;
    const userId = req.user.userId;
    const db = databaseManager.getDatabase();

    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO user_favorites (user_id, target_type, target_id) VALUES (?, ?, ?)',
        [userId, 'herb', herbId],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({
      success: true,
      message: '收藏成功'
    });
  } catch (error) {
    logger.error('收藏药材错误:', error);
    res.status(400).json({
      success: false,
      message: '收藏失败'
    });
  }
});

// =============================================
// 取消收藏药材
// =============================================
router.delete('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const herbId = req.params.id;
    const userId = req.user.userId;
    const db = databaseManager.getDatabase();

    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM user_favorites WHERE user_id = ? AND target_type = ? AND target_id = ?',
        [userId, 'herb', herbId],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({
      success: true,
      message: '取消收藏成功'
    });
  } catch (error) {
    logger.error('取消收藏错误:', error);
    res.status(400).json({
      success: false,
      message: '取消收藏失败'
    });
  }
});

// =============================================
// 管理员直接添加药材（绕过权限验证）
// =============================================
router.post('/direct-add', async (req, res) => {
  try {
    const adminUser = req.headers['x-admin-user'];
    if (!adminUser || adminUser !== 'JunkangShen') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以直接添加药材'
      });
    }

    const data = req.body;
    if (!data.name) {
      return res.status(400).json({
        success: false,
        message: '缺少必需字段：name'
      });
    }

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO herbs (name, pinyin, latin_name, alias, category_id, region_id, source_id,
           description, efficacy, usage_dosage, caution, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [data.name, data.pinyin || null, data.latin_name || null, data.alias || null,
         data.category_id || null, data.region_id || null, data.source_id || null,
         data.description || '', data.efficacy || null, data.usage_dosage || null, data.caution || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    res.json({
      success: true,
      message: '药材添加成功',
      data: { id: result.id, ...data }
    });
  } catch (error) {
    logger.error('直接添加药材失败:', error);
    res.status(500).json({
      success: false,
      message: '添加药材失败: ' + error.message
    });
  }
});

// =============================================
// 管理员直接删除药材
// =============================================
router.delete('/direct-delete/:id', async (req, res) => {
  try {
    const adminUser = req.headers['x-admin-user'];
    if (!adminUser || adminUser !== 'JunkangShen') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以直接删除药材'
      });
    }

    const herbId = req.params.id;
    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM herbs WHERE id = ?', [herbId], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '药材不存在'
      });
    }

    res.json({
      success: true,
      message: '药材删除成功'
    });
  } catch (error) {
    logger.error('直接删除药材失败:', error);
    res.status(500).json({
      success: false,
      message: '删除药材失败: ' + error.message
    });
  }
});

// =============================================
// 管理员直接更新药材
// =============================================
router.put('/direct-update/:id', async (req, res) => {
  try {
    const adminUser = req.headers['x-admin-user'];
    if (!adminUser || adminUser !== 'JunkangShen') {
      return res.status(403).json({
        success: false,
        message: '只有管理员可以直接更新药材'
      });
    }

    const herbId = req.params.id;
    const data = req.body;
    if (!data.name) {
      return res.status(400).json({
        success: false,
        message: '缺少必需字段：name'
      });
    }

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE herbs SET name = ?, pinyin = ?, alias = ?,
            description = ?, efficacy = ?, usage_dosage = ?, caution = ?,
            updated_at = datetime('now')
         WHERE id = ?`,
        [data.name, data.pinyin || null, data.alias || null,
         data.description || '', data.efficacy || null,
         data.usage_dosage || null, data.caution || null, herbId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '药材不存在'
      });
    }

    res.json({
      success: true,
      message: '药材更新成功'
    });
  } catch (error) {
    logger.error('直接更新药材失败:', error);
    res.status(500).json({
      success: false,
      message: '更新药材失败: ' + error.message
    });
  }
});

module.exports = router;
