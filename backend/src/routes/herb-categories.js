const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取分类列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const categories = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, description FROM herb_categories WHERE name IS NOT NULL ORDER BY name ASC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('获取药材分类列表错误:', error);
    res.status(500).json({ success: false, message: '获取药材分类列表失败' });
  }
});

// 检查分类是否存在
router.get('/check', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ success: false, message: '分类名称不能为空' });

    const db = databaseManager.getDatabase();
    const cat = await new Promise((resolve, reject) => {
      db.get('SELECT id, name FROM herb_categories WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({ success: true, exists: !!cat, data: cat || null });
  } catch (error) {
    logger.error('检查分类错误:', error);
    res.status(500).json({ success: false, message: '检查分类失败' });
  }
});

// 获取分类详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const cat = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM herb_categories WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!cat) return res.status(404).json({ success: false, message: '分类不存在' });

    const herbCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM herbs WHERE category_id = ?', [cat.id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({ success: true, data: { ...cat, herb_count: herbCount } });
  } catch (error) {
    logger.error('获取分类详情错误:', error);
    res.status(500).json({ success: false, message: '获取分类详情失败' });
  }
});

// 创建分类
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '分类名称不能为空' });

    const db = databaseManager.getDatabase();
    const existing = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM herb_categories WHERE name = ?', [name], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) return res.status(409).json({ success: false, message: '分类已存在' });

    const result = await new Promise((resolve, reject) => {
      db.run('INSERT INTO herb_categories (name, description) VALUES (?, ?)',
        [name, description || null],
        function(err) { if (err) reject(err); else resolve({ id: this.lastID }); }
      );
    });

    logger.info(`分类创建成功: ${name} (ID: ${result.id})`);
    res.status(201).json({ success: true, message: '分类创建成功', data: { id: result.id, name, description } });
  } catch (error) {
    logger.error('创建分类错误:', error);
    res.status(500).json({ success: false, message: '创建分类失败' });
  }
});

// 更新分类
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '分类名称不能为空' });

    const db = databaseManager.getDatabase();
    const result = await new Promise((resolve, reject) => {
      db.run('UPDATE herb_categories SET name = ?, description = ? WHERE id = ?',
        [name, description || null, req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '分类不存在' });

    logger.info(`分类更新成功: ${name} (ID: ${req.params.id})`);
    res.json({ success: true, message: '分类更新成功', data: { id: req.params.id, name, description } });
  } catch (error) {
    logger.error('更新分类错误:', error);
    res.status(500).json({ success: false, message: '更新分类失败' });
  }
});

// 删除分类
router.delete('/:id', async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const herbCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM herbs WHERE category_id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (herbCount > 0) return res.status(400).json({
      success: false, message: `无法删除，还有 ${herbCount} 个药材关联到此分类`
    });

    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM herb_categories WHERE id = ?', [req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '分类不存在' });

    logger.info(`分类删除成功: ID ${req.params.id}`);
    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    logger.error('删除分类错误:', error);
    res.status(500).json({ success: false, message: '删除分类失败' });
  }
});

module.exports = router;
