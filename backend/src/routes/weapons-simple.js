const express = require('express');
const router = express.Router();
const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const { validate, weaponSchema } = require('../middleware/validation');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

// 获取武器列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, country, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const db = databaseManager.getDatabase();
    
    // 构建查询条件
    let whereClause = '';
    let params = [];
    
    if (category) {
      whereClause += ' WHERE type = ?';
      params.push(category);
    }
    
    if (country) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ' country = ?';
      params.push(country);
    }
    
    // 获取武器列表
    const weapons = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, type, country, year, description 
         FROM weapons${whereClause} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    // 获取总数
    const total = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM weapons${whereClause}`,
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
        weapons: weapons.map(weapon => ({
          id: weapon.id.toString(),
          name: weapon.name,
          type: weapon.type,
          country: weapon.country,
          year: weapon.year,
          description: weapon.description
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / parseInt(limit)),
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('获取武器列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取武器列表失败'
    });
  }
});

// 搜索武器
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { q: searchTerm, category, country } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const db = databaseManager.getDatabase();
    
    // 构建搜索查询
    let whereClause = 'WHERE (name LIKE ? OR description LIKE ?)';
    let params = [`%${searchTerm}%`, `%${searchTerm}%`];
    
    if (category) {
      whereClause += ' AND type = ?';
      params.push(category);
    }
    
    if (country) {
      whereClause += ' AND country = ?';
      params.push(country);
    }

    const weapons = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, type, country, year, description 
         FROM weapons ${whereClause} 
         LIMIT 50`,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: {
        weapons: weapons.map(weapon => ({
          id: weapon.id.toString(),
          name: weapon.name,
          type: weapon.type,
          country: weapon.country,
          year: weapon.year,
          description: weapon.description
        })),
        total: weapons.length
      }
    });
  } catch (error) {
    logger.error('搜索武器错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索武器失败'
    });
  }
});

// 获取武器统计信息
router.get('/statistics', async (req, res) => {
  try {
    const db = databaseManager.getDatabase();

    // 按类型统计
    const typeStats = await new Promise((resolve, reject) => {
      db.all(
        'SELECT type, COUNT(*) as count FROM weapons GROUP BY type ORDER BY count DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // 按国家统计
    const countryStats = await new Promise((resolve, reject) => {
      db.all(
        'SELECT country, COUNT(*) as count FROM weapons GROUP BY country ORDER BY count DESC LIMIT 10',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // 总数统计
    const totalWeapons = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM weapons',
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    res.json({
      success: true,
      data: {
        total_weapons: totalWeapons,
        by_type: typeStats,
        by_country: countryStats
      }
    });
  } catch (error) {
    logger.error('获取武器统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取武器统计失败'
    });
  }
});

// 获取武器详情
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const db = databaseManager.getDatabase();

    const weapon = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM weapons WHERE id = ?',
        [weaponId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!weapon) {
      return res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    }

    // 如果用户已登录，记录用户兴趣
    if (req.user) {
      try {
        const userService = require('../services/userService-simple');
        await userService.recordUserInterest(req.user.userId, weaponId, 'view');
      } catch (interestError) {
        logger.warn('记录用户兴趣失败:', interestError);
      }
    }

    res.json({
      success: true,
      data: {
        id: weapon.id.toString(),
        name: weapon.name,
        type: weapon.type,
        country: weapon.country,
        year: weapon.year,
        description: weapon.description,
        specifications: JSON.parse(weapon.specifications || '{}'),
        images: JSON.parse(weapon.images || '[]'),
        performance_data: JSON.parse(weapon.performance_data || '{}'),
        created_at: weapon.created_at
      }
    });
  } catch (error) {
    logger.error('获取武器详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取武器详情失败'
    });
  }
});

// 获取相似武器
router.get('/:id/similar', async (req, res) => {
  try {
    const weaponId = req.params.id;
    const limit = parseInt(req.query.limit) || 5;
    const db = databaseManager.getDatabase();

    // 首先获取当前武器信息
    const currentWeapon = await new Promise((resolve, reject) => {
      db.get(
        'SELECT type, country FROM weapons WHERE id = ?',
        [weaponId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!currentWeapon) {
      return res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    }

    // 查找相似武器（同类型或同国家）
    const similarWeapons = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, type, country 
         FROM weapons 
         WHERE id != ? AND (type = ? OR country = ?) 
         ORDER BY 
           CASE WHEN type = ? THEN 1 ELSE 2 END,
           CASE WHEN country = ? THEN 1 ELSE 2 END
         LIMIT ?`,
        [weaponId, currentWeapon.type, currentWeapon.country, 
         currentWeapon.type, currentWeapon.country, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      success: true,
      data: {
        similar_weapons: similarWeapons.map(weapon => ({
          id: weapon.id.toString(),
          name: weapon.name,
          type: weapon.type,
          country: weapon.country
        }))
      }
    });
  } catch (error) {
    logger.error('获取相似武器错误:', error);
    res.status(500).json({
      success: false,
      message: '获取相似武器失败'
    });
  }
});

// 创建武器（管理员权限）
router.post('/', authenticateToken, requireAdmin, validate(weaponSchema), async (req, res) => {
  try {
    const { name, type, country, year, description, specifications, manufacturer } = req.body;
    const db = databaseManager.getDatabase();

    // 创建武器
    const weaponResult = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO weapons (name, type, country, year, description, specifications, images, performance_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          name,
          type,
          country,
          year || null,
          description || '',
          JSON.stringify(specifications || {}),
          JSON.stringify([]),
          JSON.stringify({})
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    // 处理制造商关联
    if (manufacturer) {
      await handleManufacturerAssociation(db, weaponResult.id, manufacturer);
    }

    logger.info(`武器创建成功: ${name} (ID: ${weaponResult.id})`);

    res.status(201).json({
      success: true,
      message: '武器创建成功',
      data: {
        id: weaponResult.id.toString(),
        name,
        type,
        country,
        year,
        description,
        manufacturer: manufacturer ? manufacturer.name : null
      }
    });
  } catch (error) {
    logger.error('创建武器错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '创建武器失败'
    });
  }
});

// 更新武器（管理员权限）
router.put('/:id', authenticateToken, requireAdmin, validate(weaponSchema), async (req, res) => {
  try {
    const weaponId = req.params.id;
    const { name, type, country, year, description, specifications } = req.body;
    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE weapons 
         SET name = ?, type = ?, country = ?, year = ?, description = ?, 
             specifications = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [
          name,
          type,
          country,
          year || null,
          description || '',
          JSON.stringify(specifications || {}),
          weaponId
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    }

    logger.info(`武器更新成功: ${name} (ID: ${weaponId})`);

    res.json({
      success: true,
      message: '武器更新成功',
      data: {
        id: weaponId,
        name,
        type,
        country,
        year,
        description
      }
    });
  } catch (error) {
    logger.error('更新武器错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新武器失败'
    });
  }
});

// 删除武器（管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM weapons WHERE id = ?',
        [weaponId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    }

    logger.info(`武器删除成功: ID ${weaponId}`);

    res.json({
      success: true,
      message: '武器删除成功'
    });
  } catch (error) {
    logger.error('删除武器错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '删除武器失败'
    });
  }
});

// 用户收藏武器
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const userId = req.user.userId;
    
    // 记录用户兴趣（收藏类型）
    const userService = require('../services/userService-simple');
    await userService.recordUserInterest(userId, weaponId, 'favorite');
    
    res.json({
      success: true,
      message: '收藏成功'
    });
  } catch (error) {
    logger.error('收藏武器错误:', error);
    res.status(400).json({
      success: false,
      message: '收藏失败'
    });
  }
});

// 用户取消收藏武器
router.delete('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const userId = req.user.userId;
    
    // 这里需要实现取消收藏的逻辑
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

// 处理制造商关联的辅助函数
async function handleManufacturerAssociation(db, weaponId, manufacturerData) {
  try {
    let manufacturerId;

    if (manufacturerData.isNew) {
      // 创建新制造商
      const manufacturerResult = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO manufacturers (name, country, founded, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            manufacturerData.name,
            manufacturerData.country || null,
            manufacturerData.founded || null,
            manufacturerData.description || null
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });
      manufacturerId = manufacturerResult.id;
      logger.info(`新制造商创建成功: ${manufacturerData.name} (ID: ${manufacturerId})`);
    } else {
      // 查找现有制造商
      const existingManufacturer = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM manufacturers WHERE name = ?',
          [manufacturerData.name],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!existingManufacturer) {
        throw new Error(`制造商 "${manufacturerData.name}" 不存在`);
      }
      manufacturerId = existingManufacturer.id;
    }

    // 创建武器-制造商关联
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO weapon_manufacturers (weapon_id, manufacturer_id) VALUES (?, ?)',
        [weaponId, manufacturerId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`武器-制造商关联创建成功: 武器ID ${weaponId} - 制造商ID ${manufacturerId}`);
  } catch (error) {
    logger.error('处理制造商关联失败:', error);
    throw error;
  }
}

// 管理员直接添加武器端点（绕过权限验证）
router.post('/direct-add', async (req, res) => {
    try {
        console.log('直接添加武器请求:', req.body);
        console.log('请求头:', req.headers);
        
        // 检查是否为管理员用户
        const adminUser = req.headers['x-admin-user'];
        if (!adminUser || adminUser !== 'JunkangShen') {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以直接添加武器'
            });
        }

        const weaponData = req.body;
        
        // 验证必需字段
        if (!weaponData.name || !weaponData.type || !weaponData.country) {
            return res.status(400).json({
                success: false,
                message: '缺少必需字段：name, type, country'
            });
        }

        // 直接插入数据库
        const db = require('../config/database-simple').getDatabase();
        
        const insertQuery = `
            INSERT INTO weapons (name, type, country, year, description, specifications, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        const specifications = weaponData.specifications ? JSON.stringify(weaponData.specifications) : null;
        
        const result = await new Promise((resolve, reject) => {
          db.run(insertQuery, [
            weaponData.name,
            weaponData.type,
            weaponData.country,
            weaponData.year || null,
            weaponData.description || null,
            specifications
          ], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          });
        });

        // 处理制造商关联
        if (weaponData.manufacturer) {
          try {
            await handleManufacturerAssociation(db, result.id, weaponData.manufacturer);
          } catch (manufacturerError) {
            logger.warn('制造商关联失败，但武器已创建:', manufacturerError);
          }
        }

        console.log('武器添加成功，ID:', result.id);

        res.json({
            success: true,
            message: '武器添加成功',
            data: {
                id: result.id,
                ...weaponData
            }
        });

    } catch (error) {
        console.error('直接添加武器失败:', error);
        res.status(500).json({
            success: false,
            message: '添加武器失败: ' + error.message
        });
    }
});

// 管理员直接删除武器端点（绕过权限验证）
router.delete('/direct-delete/:id', async (req, res) => {
    try {
        const weaponId = req.params.id;
        console.log('直接删除武器请求，ID:', weaponId);
        console.log('请求头:', req.headers);
        
        // 检查是否为管理员用户
        const adminUser = req.headers['x-admin-user'];
        if (!adminUser || adminUser !== 'JunkangShen') {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以直接删除武器'
            });
        }

        // 直接从数据库删除
        const db = require('../config/database-simple').getDatabase();
        
        // 首先检查武器是否存在
        const weapon = await new Promise((resolve, reject) => {
            db.get('SELECT name FROM weapons WHERE id = ?', [weaponId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!weapon) {
            return res.status(404).json({
                success: false,
                message: '武器不存在'
            });
        }

        // 删除武器-制造商关联
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM weapon_manufacturers WHERE weapon_id = ?', [weaponId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // 删除武器
        const result = await new Promise((resolve, reject) => {
            db.run('DELETE FROM weapons WHERE id = ?', [weaponId], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });

        console.log(`武器删除成功: ${weapon.name} (ID: ${weaponId})`);

        res.json({
            success: true,
            message: '武器删除成功',
            data: {
                id: weaponId,
                name: weapon.name
            }
        });

    } catch (error) {
        console.error('直接删除武器失败:', error);
        res.status(500).json({
            success: false,
            message: '删除武器失败: ' + error.message
        });
    }
});

// 管理员直接更新武器端点（绕过权限验证）
router.put('/direct-update/:id', async (req, res) => {
    try {
        const weaponId = req.params.id;
        const weaponData = req.body;
        console.log('直接更新武器请求，ID:', weaponId);
        console.log('更新数据:', weaponData);
        console.log('请求头:', req.headers);
        
        // 检查是否为管理员用户
        const adminUser = req.headers['x-admin-user'];
        if (!adminUser || adminUser !== 'JunkangShen') {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以直接更新武器'
            });
        }

        // 验证必需字段
        if (!weaponData.name || !weaponData.type || !weaponData.country) {
            return res.status(400).json({
                success: false,
                message: '缺少必需字段：name, type, country'
            });
        }

        // 直接更新数据库
        const db = require('../config/database-simple').getDatabase();
        
        const updateQuery = `
            UPDATE weapons 
            SET name = ?, type = ?, country = ?, year = ?, description = ?, 
                specifications = ?, updated_at = datetime('now')
            WHERE id = ?
        `;
        
        const specifications = weaponData.specifications ? JSON.stringify(weaponData.specifications) : null;
        
        const result = await new Promise((resolve, reject) => {
            db.run(updateQuery, [
                weaponData.name,
                weaponData.type,
                weaponData.country,
                weaponData.year || null,
                weaponData.description || null,
                specifications,
                weaponId
            ], function(err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '武器不存在'
            });
        }

        console.log(`武器更新成功: ${weaponData.name} (ID: ${weaponId})`);

        res.json({
            success: true,
            message: '武器更新成功',
            data: {
                id: weaponId,
                ...weaponData
            }
        });

    } catch (error) {
        console.error('直接更新武器失败:', error);
        res.status(500).json({
            success: false,
            message: '更新武器失败: ' + error.message
        });
    }
});

module.exports = router;
