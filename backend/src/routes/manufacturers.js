const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取制造商列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    
    const manufacturers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, country, founded, description, created_at 
         FROM manufacturers 
         ORDER BY name ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: manufacturers.map(manufacturer => ({
        id: manufacturer.id.toString(),
        name: manufacturer.name,
        country: manufacturer.country,
        founded: manufacturer.founded,
        description: manufacturer.description,
        created_at: manufacturer.created_at
      }))
    });
  } catch (error) {
    logger.error('获取制造商列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取制造商列表失败'
    });
  }
});

// 检查制造商是否存在
router.get('/check', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '制造商名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();
    
    const manufacturer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, name FROM manufacturers WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({
      success: true,
      exists: !!manufacturer,
      data: manufacturer ? {
        id: manufacturer.id.toString(),
        name: manufacturer.name
      } : null
    });
  } catch (error) {
    logger.error('检查制造商存在性错误:', error);
    res.status(500).json({
      success: false,
      message: '检查制造商失败'
    });
  }
});

// 获取制造商详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const manufacturerId = req.params.id;
    const db = databaseManager.getDatabase();

    const manufacturer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM manufacturers WHERE id = ?',
        [manufacturerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!manufacturer) {
      return res.status(404).json({
        success: false,
        message: '制造商不存在'
      });
    }

    // 获取该制造商生产的武器
    const weapons = await new Promise((resolve, reject) => {
      db.all(
        `SELECT w.id, w.name, w.type, w.country, w.year 
         FROM weapons w
         INNER JOIN weapon_manufacturers wm ON w.id = wm.weapon_id
         WHERE wm.manufacturer_id = ?
         ORDER BY w.name ASC`,
        [manufacturerId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: {
        id: manufacturer.id.toString(),
        name: manufacturer.name,
        country: manufacturer.country,
        founded: manufacturer.founded,
        description: manufacturer.description,
        created_at: manufacturer.created_at,
        weapons: weapons.map(weapon => ({
          id: weapon.id.toString(),
          name: weapon.name,
          type: weapon.type,
          country: weapon.country,
          year: weapon.year
        }))
      }
    });
  } catch (error) {
    logger.error('获取制造商详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取制造商详情失败'
    });
  }
});

// 创建制造商
router.post('/', async (req, res) => {
  try {
    const { name, country, founded, description } = req.body;
    
    // 验证必需字段
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '制造商名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();

    // 检查制造商是否已存在
    const existingManufacturer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM manufacturers WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingManufacturer) {
      return res.status(409).json({
        success: false,
        message: '制造商已存在'
      });
    }

    // 创建制造商
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO manufacturers (name, country, founded, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [name, country || null, founded || null, description || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    logger.info(`制造商创建成功: ${name} (ID: ${result.id})`);

    res.status(201).json({
      success: true,
      message: '制造商创建成功',
      data: {
        id: result.id.toString(),
        name,
        country,
        founded,
        description
      }
    });
  } catch (error) {
    logger.error('创建制造商错误:', error);
    res.status(500).json({
      success: false,
      message: '创建制造商失败'
    });
  }
});

// 更新制造商（管理员权限）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const manufacturerId = req.params.id;
    const { name, country, founded, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '制造商名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE manufacturers 
         SET name = ?, country = ?, founded = ?, description = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [name, country || null, founded || null, description || null, manufacturerId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '制造商不存在'
      });
    }

    logger.info(`制造商更新成功: ${name} (ID: ${manufacturerId})`);

    res.json({
      success: true,
      message: '制造商更新成功',
      data: {
        id: manufacturerId,
        name,
        country,
        founded,
        description
      }
    });
  } catch (error) {
    logger.error('更新制造商错误:', error);
    res.status(500).json({
      success: false,
      message: '更新制造商失败'
    });
  }
});

// 删除制造商（管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const manufacturerId = req.params.id;
    const db = databaseManager.getDatabase();

    // 检查是否有武器关联到此制造商
    const weaponCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM weapon_manufacturers WHERE manufacturer_id = ?',
        [manufacturerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    if (weaponCount > 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除制造商，还有 ${weaponCount} 个武器关联到此制造商`
      });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM manufacturers WHERE id = ?',
        [manufacturerId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '制造商不存在'
      });
    }

    logger.info(`制造商删除成功: ID ${manufacturerId}`);

    res.json({
      success: true,
      message: '制造商删除成功'
    });
  } catch (error) {
    logger.error('删除制造商错误:', error);
    res.status(500).json({
      success: false,
      message: '删除制造商失败'
    });
  }
});

module.exports = router;