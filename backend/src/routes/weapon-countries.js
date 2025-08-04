const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取国家列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    
    const countries = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, code 
         FROM countries 
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
      data: countries.map(country => ({
        id: country.id.toString(),
        name: country.name,
        code: country.code
      }))
    });
  } catch (error) {
    logger.error('获取国家列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取国家列表失败'
    });
  }
});

// 检查国家是否存在
router.get('/check', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '国家名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();
    
    const country = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, name FROM countries WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({
      success: true,
      exists: !!country,
      data: country ? {
        id: country.id.toString(),
        name: country.name
      } : null
    });
  } catch (error) {
    logger.error('检查国家存在性错误:', error);
    res.status(500).json({
      success: false,
      message: '检查国家失败'
    });
  }
});

// 获取国家详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const countryId = req.params.id;
    const db = databaseManager.getDatabase();

    const country = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM countries WHERE id = ?',
        [countryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!country) {
      return res.status(404).json({
        success: false,
        message: '国家不存在'
      });
    }

    // 获取该国家的武器数量
    const weaponCount = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count 
         FROM weapons w
         INNER JOIN weapon_countries wc ON w.id = wc.weapon_id
         WHERE wc.country_id = ?`,
        [countryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    res.json({
      success: true,
      data: {
        id: country.id.toString(),
        name: country.name,
        code: country.code,
        weapon_count: weaponCount
      }
    });
  } catch (error) {
    logger.error('获取国家详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取国家详情失败'
    });
  }
});

// 创建国家
router.post('/', async (req, res) => {
  try {
    const { name, code } = req.body;
    
    // 验证必需字段
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '国家名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();

    // 检查国家是否已存在
    const existingCountry = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM countries WHERE name = ?',
        [name],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingCountry) {
      return res.status(409).json({
        success: false,
        message: '国家已存在'
      });
    }

    // 创建国家
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO countries (name, code)
         VALUES (?, ?)`,
        [name, code || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    logger.info(`国家创建成功: ${name} (ID: ${result.id})`);

    res.status(201).json({
      success: true,
      message: '国家创建成功',
      data: {
        id: result.id.toString(),
        name,
        code
      }
    });
  } catch (error) {
    logger.error('创建国家错误:', error);
    res.status(500).json({
      success: false,
      message: '创建国家失败'
    });
  }
});

// 更新国家
router.put('/:id', async (req, res) => {
  try {
    const countryId = req.params.id;
    const { name, code } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '国家名称不能为空'
      });
    }

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE countries 
         SET name = ?, code = ?
         WHERE id = ?`,
        [name, code || null, countryId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '国家不存在'
      });
    }

    logger.info(`国家更新成功: ${name} (ID: ${countryId})`);

    res.json({
      success: true,
      message: '国家更新成功',
      data: {
        id: countryId,
        name,
        code
      }
    });
  } catch (error) {
    logger.error('更新国家错误:', error);
    res.status(500).json({
      success: false,
      message: '更新国家失败'
    });
  }
});

// 删除国家
router.delete('/:id', async (req, res) => {
  try {
    const countryId = req.params.id;
    const db = databaseManager.getDatabase();

    // 检查是否有武器关联到此国家
    const weaponCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM weapon_countries WHERE country_id = ?',
        [countryId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    if (weaponCount > 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除国家，还有 ${weaponCount} 个武器关联到此国家`
      });
    }

    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM countries WHERE id = ?',
        [countryId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '国家不存在'
      });
    }

    logger.info(`国家删除成功: ID ${countryId}`);

    res.json({
      success: true,
      message: '国家删除成功'
    });
  } catch (error) {
    logger.error('删除国家错误:', error);
    res.status(500).json({
      success: false,
      message: '删除国家失败'
    });
  }
});

module.exports = router;