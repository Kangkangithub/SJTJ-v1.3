const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取产地列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const regions = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, description FROM herb_regions WHERE name IS NOT NULL ORDER BY name ASC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, data: regions });
  } catch (error) {
    logger.error('获取产地列表错误:', error);
    res.status(500).json({ success: false, message: '获取产地列表失败' });
  }
});

// 检查产地是否存在
router.get('/check', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ success: false, message: '产地名称不能为空' });

    const db = databaseManager.getDatabase();
    const region = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM herb_regions WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({ success: true, exists: !!region, data: region || null });
  } catch (error) {
    logger.error('检查产地错误:', error);
    res.status(500).json({ success: false, message: '检查产地失败' });
  }
});

// 获取产地详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const region = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM herb_regions WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!region) return res.status(404).json({ success: false, message: '产地不存在' });

    const herbCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM herbs WHERE region_id = ?', [region.id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({ success: true, data: { ...region, herb_count: herbCount } });
  } catch (error) {
    logger.error('获取产地详情错误:', error);
    res.status(500).json({ success: false, message: '获取产地详情失败' });
  }
});

// 创建产地
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '产地名称不能为空' });

    const db = databaseManager.getDatabase();
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM herb_regions WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) return res.status(409).json({ success: false, message: '产地已存在' });

    const result = await new Promise((resolve, reject) => {
      db.run('INSERT INTO herb_regions (name, description) VALUES (?, ?)',
        [name, description || null],
        function(err) { if (err) reject(err); else resolve({ id: this.lastID }); }
      );
    });

    logger.info(`产地创建成功: ${name} (ID: ${result.id})`);
    res.status(201).json({ success: true, message: '产地创建成功', data: { id: result.id, name, description } });
  } catch (error) {
    logger.error('创建产地错误:', error);
    res.status(500).json({ success: false, message: '创建产地失败' });
  }
});

// 更新产地
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '产地名称不能为空' });

    const db = databaseManager.getDatabase();
    const result = await new Promise((resolve, reject) => {
      db.run('UPDATE herb_regions SET name = ?, description = ? WHERE id = ?',
        [name, description || null, req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '产地不存在' });

    logger.info(`产地更新成功: ${name} (ID: ${req.params.id})`);
    res.json({ success: true, message: '产地更新成功', data: { id: req.params.id, name, description } });
  } catch (error) {
    logger.error('更新产地错误:', error);
    res.status(500).json({ success: false, message: '更新产地失败' });
  }
});

// 删除产地
router.delete('/:id', async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const herbCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM herbs WHERE region_id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (herbCount > 0) return res.status(400).json({
      success: false, message: `无法删除，还有 ${herbCount} 个药材关联到此产地`
    });

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM herb_regions WHERE id = ?', [req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '产地不存在' });

    logger.info(`产地删除成功: ID ${req.params.id}`);
    res.json({ success: true, message: '产地删除成功' });
  } catch (error) {
    logger.error('删除产地错误:', error);
    res.status(500).json({ success: false, message: '删除产地失败' });
  }
});

module.exports = router;
