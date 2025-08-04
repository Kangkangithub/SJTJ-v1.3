const express = require('express');
const router = express.Router();
const weaponService = require('../services/weaponService');
const userService = require('../services/userService');
const { validate, weaponSchema } = require('../middleware/validation');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// 获取武器列表
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category, country, page, limit } = req.query;
    const filters = { category, country };
    const pagination = { 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 20 
    };

    const result = await weaponService.getWeapons(filters, pagination);
    res.json(result);
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

    const filters = { category, country };
    const result = await weaponService.searchWeapons(searchTerm, filters);
    res.json(result);
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
    const result = await weaponService.getWeaponStatistics();
    res.json(result);
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
    const result = await weaponService.getWeaponById(weaponId);
    
    // 如果用户已登录，记录用户兴趣
    if (req.user) {
      try {
        await userService.recordUserInterest(req.user.userId, weaponId, 'view');
      } catch (interestError) {
        logger.warn('记录用户兴趣失败:', interestError);
        // 不影响主要功能，继续执行
      }
    }

    res.json(result);
  } catch (error) {
    logger.error('获取武器详情错误:', error);
    if (error.message === '武器不存在') {
      res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '获取武器详情失败'
      });
    }
  }
});

// 获取相似武器
router.get('/:id/similar', async (req, res) => {
  try {
    const weaponId = req.params.id;
    const limit = parseInt(req.query.limit) || 5;
    
    const result = await weaponService.getSimilarWeapons(weaponId, limit);
    res.json(result);
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
    const result = await weaponService.createWeapon(req.body);
    res.status(201).json(result);
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
    const result = await weaponService.updateWeapon(weaponId, req.body);
    res.json(result);
  } catch (error) {
    logger.error('更新武器错误:', error);
    if (error.message === '武器不存在') {
      res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    } else {
      res.status(400).json({
        success: false,
        message: error.message || '更新武器失败'
      });
    }
  }
});

// 删除武器（管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const result = await weaponService.deleteWeapon(weaponId);
    res.json(result);
  } catch (error) {
    logger.error('删除武器错误:', error);
    if (error.message === '武器不存在') {
      res.status(404).json({
        success: false,
        message: '武器不存在'
      });
    } else {
      res.status(400).json({
        success: false,
        message: error.message || '删除武器失败'
      });
    }
  }
});

// 用户收藏武器
router.post('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const userId = req.user.userId;
    
    // 记录用户兴趣（收藏类型）
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

module.exports = router;