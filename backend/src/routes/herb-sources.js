const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取来源列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const sources = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, description, created_at FROM herb_sources ORDER BY name ASC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, data: sources });
  } catch (error) {
    logger.error('获取来源列表错误:', error);
    res.status(500).json({ success: false, message: '获取来源列表失败' });
  }
});

// 检查来源是否存在
router.get('/check', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ success: false, message: '来源名称不能为空' });

    const db = databaseManager.getDatabase();
    const source = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM herb_sources WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({ success: true, exists: !!source, data: source || null });
  } catch (error) {
    logger.error('检查来源错误:', error);
    res.status(500).json({ success: false, message: '检查来源失败' });
  }
});

// 获取来源详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const source = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM herb_sources WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!source) return res.status(404).json({ success: false, message: '来源不存在' });

    const herbCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM herbs WHERE source_id = ?', [source.id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({ success: true, data: { ...source, herb_count: herbCount } });
  } catch (error) {
    logger.error('获取来源详情错误:', error);
    res.status(500).json({ success: false, message: '获取来源详情失败' });
  }
});

// 创建来源
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '来源名称不能为空' });

    const db = databaseManager.getDatabase();
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM herb_sources WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) return res.status(409).json({ success: false, message: '来源已存在' });

    const result = await new Promise((resolve, reject) => {
      db.run('INSERT INTO herb_sources (name, description, created_at) VALUES (?, ?, datetime(\'now\'))',
        [name, description || null],
        function(err) { if (err) reject(err); else resolve({ id: this.lastID }); }
      );
    });

    logger.info(`来源创建成功: ${name} (ID: ${result.id})`);
    res.status(201).json({ success: true, message: '来源创建成功', data: { id: result.id, name, description } });
  } catch (error) {
    logger.error('创建来源错误:', error);
    res.status(500).json({ success: false, message: '创建来源失败' });
  }
});

// 更新来源（管理员权限）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '来源名称不能为空' });

    const db = databaseManager.getDatabase();
    const result = await new Promise((resolve, reject) => {
      db.run('UPDATE herb_sources SET name = ?, description = ? WHERE id = ?',
        [name, description || null, req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '来源不存在' });

    logger.info(`来源更新成功: ${name} (ID: ${req.params.id})`);
    res.json({ success: true, message: '来源更新成功', data: { id: req.params.id, name, description } });
  } catch (error) {
    logger.error('更新来源错误:', error);
    res.status(500).json({ success: false, message: '更新来源失败' });
  }
});

// 删除来源（管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const herbCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM herbs WHERE source_id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (herbCount > 0) return res.status(400).json({
      success: false, message: `无法删除，还有 ${herbCount} 个药材关联到此来源`
    });

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM herb_sources WHERE id = ?', [req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '来源不存在' });

    logger.info(`来源删除成功: ID ${req.params.id}`);
    res.json({ success: true, message: '来源删除成功' });
  } catch (error) {
    logger.error('删除来源错误:', error);
    res.status(500).json({ success: false, message: '删除来源失败' });
  }
});

module.exports = router;
