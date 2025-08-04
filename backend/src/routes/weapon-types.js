const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取武器类型列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    
    const types = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, description 
         FROM categories 
         WHERE name IS NOT NULL AND name != ''
         ORDER BY name ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: types.map(type => ({
        id: type.id.toString(),
        name: type.name,
        description: type.description
      }))
    });
  } catch (error) {
    logger.error('获取武器类型列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取武器类型列表失败'
    });
  }
});

// 检查武器类型是否存在
router.get('/check', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '武器类型名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();
    
    const type = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, name FROM categories WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({
      success: true,
      exists: !!type,
      data: type ? {
        id: type.id.toString(),
        name: type.name
      } : null
    });
  } catch (error) {
    logger.error('检查武器类型存在性错误:', error);
    res.status(500).json({
      success: false,
      message: '检查武器类型失败'
    });
  }
});

// 获取武器类型详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const typeId = req.params.id;
    const db = databaseManager.getDatabase();

    const type = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM categories WHERE id = ?',
        [typeId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!type) {
      return res.status(404).json({
        success: false,
        message: '武器类型不存在'
      });
    }

    // 获取该类型的武器数量
    const weaponCount = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count 
         FROM weapons w
         INNER JOIN weapon_categories wc ON w.id = wc.weapon_id
         WHERE wc.category_id = ?`,
        [typeId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    res.json({
      success: true,
      data: {
        id: type.id.toString(),
        name: type.name,
        description: type.description,
        weapon_count: weaponCount
      }
    });
  } catch (error) {
    logger.error('获取武器类型详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取武器类型详情失败'
    });
  }
});

// 创建武器类型
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // 验证必需字段
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '武器类型名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();

    // 检查武器类型是否已存在
    const existingType = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM categories WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingType) {
      return res.status(409).json({
        success: false,
        message: '武器类型已存在'
      });
    }

    // 创建武器类型
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO categories (name, description)
         VALUES (?, ?)`,
        [name, description || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    logger.info(`武器类型创建成功: ${name} (ID: ${result.id})`);

    res.status(201).json({
      success: true,
      message: '武器类型创建成功',
      data: {
        id: result.id.toString(),
        name,
        description
      }
    });
  } catch (error) {
    logger.error('创建武器类型错误:', error);
    res.status(500).json({
      success: false,
      message: '创建武器类型失败'
    });
  }
});

// 更新武器类型
router.put('/:id', async (req, res) => {
  try {
    const typeId = req.params.id;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '武器类型名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE categories 
         SET name = ?, description = ?
         WHERE id = ?`,
        [name, description || null, typeId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '武器类型不存在'
      });
    }

    logger.info(`武器类型更新成功: ${name} (ID: ${typeId})`);

    res.json({
      success: true,
      message: '武器类型更新成功',
      data: {
        id: typeId,
        name,
        description
      }
    });
  } catch (error) {
    logger.error('更新武器类型错误:', error);
    res.status(500).json({
      success: false,
      message: '更新武器类型失败'
    });
  }
});

// 删除武器类型
router.delete('/:id', async (req, res) => {
  try {
    const typeId = req.params.id;
    const db = databaseManager.getDatabase();

    // 检查是否有武器关联到此类型
    const weaponCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM weapon_categories WHERE category_id = ?',
        [typeId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    if (weaponCount > 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除武器类型，还有 ${weaponCount} 个武器关联到此类型`
      });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM categories WHERE id = ?',
        [typeId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '武器类型不存在'
      });
    }

    logger.info(`武器类型删除成功: ID ${typeId}`);

    res.json({
      success: true,
      message: '武器类型删除成功'
    });
  } catch (error) {
    logger.error('删除武器类型错误:', error);
    res.status(500).json({
      success: false,
      message: '删除武器类型失败'
    });
  }
});

module.exports = router;