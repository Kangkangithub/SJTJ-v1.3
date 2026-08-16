const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取方剂列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const db = databaseManager.getDatabase();

    const formulas = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, pinyin, category, description, source
         FROM formulas ORDER BY name ASC LIMIT ? OFFSET ?`,
        [parseInt(limit), offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const total = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM formulas', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    res.json({
      success: true,
      data: {
        formulas,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / parseInt(limit)),
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取方剂列表错误:', error);
    res.status(500).json({ success: false, message: '获取方剂列表失败' });
  }
});

// 获取方剂详情（含组成药材）
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const formulaId = req.params.id;
    const db = databaseManager.getDatabase();

    const formula = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM formulas WHERE id = ?', [formulaId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!formula) return res.status(404).json({ success: false, message: '方剂不存在' });

    const herbs = await new Promise((resolve, reject) => {
      db.all(
        `SELECT fh.id, h.id as herb_id, h.name, h.pinyin, fh.dosage, fh.role, fh.note
         FROM formula_herbs fh
         JOIN herbs h ON fh.herb_id = h.id
         WHERE fh.formula_id = ?
         ORDER BY fh.id ASC`,
        [formulaId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, data: { ...formula, herbs } });
  } catch (error) {
    logger.error('获取方剂详情错误:', error);
    res.status(500).json({ success: false, message: '获取方剂详情失败' });
  }
});

// 创建方剂
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, pinyin, category, description, usage, caution, source, herbs } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '方剂名称不能为空' });

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO formulas (name, pinyin, category, description, usage, caution, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, pinyin || null, category || null, description || null, usage || null, caution || null, source || null],
        function(err) { if (err) reject(err); else resolve({ id: this.lastID }); }
      );
    });

    // 插入方剂组成
    if (herbs && herbs.length > 0) {
      for (const h of herbs) {
        // 查找药材ID
        const herb = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM herbs WHERE id = ? OR name = ?', [h.herb_id || 0, h.herbName || ''], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (herb) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO formula_herbs (formula_id, herb_id, dosage, role, note) VALUES (?, ?, ?, ?, ?)',
              [result.id, herb.id, h.dosage || null, h.role || null, h.note || null],
              (err) => err ? reject(err) : resolve()
            );
          });
        }
      }
    }

    logger.info(`方剂创建成功: ${name} (ID: ${result.id})`);
    res.status(201).json({ success: true, message: '方剂创建成功', data: { id: result.id, name } });
  } catch (error) {
    logger.error('创建方剂错误:', error);
    res.status(400).json({ success: false, message: error.message || '创建方剂失败' });
  }
});

// 更新方剂
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const formulaId = req.params.id;
    const { name, pinyin, category, description, usage, caution, source, herbs } = req.body;
    if (!name) return res.status(400).json({ success: false, message: '方剂名称不能为空' });

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE formulas SET name=?, pinyin=?, category=?, description=?, usage=?, caution=?, source=?
         WHERE id=?`,
        [name, pinyin, category, description, usage, caution, source, formulaId],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '方剂不存在' });

    // 重建方剂组成
    if (herbs) {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM formula_herbs WHERE formula_id = ?', [formulaId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      for (const h of herbs) {
        const herb = await new Promise((resolve, reject) => {
          db.get('SELECT id FROM herbs WHERE id = ? OR name = ?', [h.herb_id || 0, h.herbName || ''], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (herb) {
          await new Promise((resolve, reject) => {
            db.run(
              'INSERT INTO formula_herbs (formula_id, herb_id, dosage, role, note) VALUES (?, ?, ?, ?, ?)',
              [formulaId, herb.id, h.dosage || null, h.role || null, h.note || null],
              (err) => err ? reject(err) : resolve()
            );
          });
        }
      }
    }

    res.json({ success: true, message: '方剂更新成功' });
  } catch (error) {
    logger.error('更新方剂错误:', error);
    res.status(400).json({ success: false, message: '更新方剂失败' });
  }
});

// 删除方剂
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM formulas WHERE id = ?', [req.params.id],
        function(err) { if (err) reject(err); else resolve({ changes: this.changes }); }
      );
    });

    if (result.changes === 0) return res.status(404).json({ success: false, message: '方剂不存在' });

    logger.info(`方剂删除成功: ID ${req.params.id}`);
    res.json({ success: true, message: '方剂删除成功' });
  } catch (error) {
    logger.error('删除方剂错误:', error);
    res.status(500).json({ success: false, message: '删除方剂失败' });
  }
});

module.exports = router;
