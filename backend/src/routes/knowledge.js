const express = require('express');
const router = express.Router();
const knowledgeGraphService = require('../services/knowledgeGraphService');
const { validate, knowledgeQuerySchema } = require('../middleware/validation');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// 获取知识图谱概览
router.get('/overview', async (req, res) => {
  try {
    const result = await knowledgeGraphService.getGraphOverview();
    res.json(result);
  } catch (error) {
    logger.error('获取知识图谱概览错误:', error);
    res.status(500).json({
      success: false,
      message: '获取知识图谱概览失败'
    });
  }
});

// 获取武器知识图谱
router.get('/weapon/:id', optionalAuth, async (req, res) => {
  try {
    const weaponId = req.params.id;
    const depth = parseInt(req.query.depth) || 2;
    
    if (depth > 5) {
      return res.status(400).json({
        success: false,
        message: '查询深度不能超过5层'
      });
    }

    const result = await knowledgeGraphService.getWeaponGraph(weaponId, depth);
    res.json(result);
  } catch (error) {
    logger.error('获取武器知识图谱错误:', error);
    res.status(500).json({
      success: false,
      message: '获取武器知识图谱失败'
    });
  }
});

// 搜索知识图谱
router.get('/search', async (req, res) => {
  try {
    const { q: searchTerm, types, limit } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const nodeTypes = types ? types.split(',') : [];
    const searchLimit = parseInt(limit) || 20;

    const result = await knowledgeGraphService.searchGraph(searchTerm, nodeTypes, searchLimit);
    res.json(result);
  } catch (error) {
    logger.error('搜索知识图谱错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索知识图谱失败'
    });
  }
});

// 获取节点邻居
router.get('/node/:id/neighbors', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const relationshipTypes = req.query.types ? req.query.types.split(',') : [];
    const limit = parseInt(req.query.limit) || 10;

    const result = await knowledgeGraphService.getNodeNeighbors(nodeId, relationshipTypes, limit);
    res.json(result);
  } catch (error) {
    logger.error('获取节点邻居错误:', error);
    res.status(500).json({
      success: false,
      message: '获取节点邻居失败'
    });
  }
});

// 查找两个节点之间的路径
router.get('/path', async (req, res) => {
  try {
    const { start, end, maxDepth } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: '起始节点和结束节点ID都是必填项'
      });
    }

    const depth = parseInt(maxDepth) || 5;
    
    if (depth > 10) {
      return res.status(400).json({
        success: false,
        message: '最大深度不能超过10层'
      });
    }

    const result = await knowledgeGraphService.findPath(start, end, depth);
    res.json(result);
  } catch (error) {
    logger.error('查找路径错误:', error);
    res.status(500).json({
      success: false,
      message: '查找路径失败'
    });
  }
});

// 执行自定义Cypher查询
router.post('/query', validate(knowledgeQuerySchema), async (req, res) => {
  try {
    const { query, parameters = {} } = req.body;
    
    // 安全检查：禁止危险操作
    const dangerousKeywords = ['DELETE', 'REMOVE', 'DROP', 'CREATE', 'MERGE', 'SET'];
    const upperQuery = query.toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return res.status(403).json({
          success: false,
          message: `查询中不允许使用 ${keyword} 操作`
        });
      }
    }

    const result = await knowledgeGraphService.executeCypherQuery(query, parameters);
    res.json(result);
  } catch (error) {
    logger.error('执行Cypher查询错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '查询执行失败'
    });
  }
});

// 获取推荐武器（基于知识图谱）
router.get('/recommendations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;

    const result = await knowledgeGraphService.getRecommendedWeapons(userId, limit);
    res.json(result);
  } catch (error) {
    logger.error('获取推荐武器错误:', error);
    res.status(500).json({
      success: false,
      message: '获取推荐武器失败'
    });
  }
});

// 获取知识图谱统计信息
router.get('/statistics', async (req, res) => {
  try {
    const result = await knowledgeGraphService.getGraphOverview();
    res.json(result);
  } catch (error) {
    logger.error('获取知识图谱统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取知识图谱统计失败'
    });
  }
});

module.exports = router;