const express = require('express');
const router = express.Router();
const userService = require('../services/userService-simple');
const { validate, userRegistrationSchema, userLoginSchema } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// 用户注册
router.post('/register', validate(userRegistrationSchema), async (req, res) => {
  try {
    const result = await userService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    logger.error('注册接口错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '注册失败'
    });
  }
});

// 用户登录
router.post('/login', validate(userLoginSchema), async (req, res) => {
  try {
    const result = await userService.login(req.body.username, req.body.password);
    res.json(result);
  } catch (error) {
    logger.error('登录接口错误:', error);
    res.status(401).json({
      success: false,
      message: error.message || '登录失败'
    });
  }
});

// 获取当前用户信息
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await userService.getUserById(req.user.userId);
    res.json({
      success: true,
      message: '获取用户信息成功',
      data: result
    });
  } catch (error) {
    logger.error('获取用户信息错误:', error);
    res.status(404).json({
      success: false,
      message: error.message || '获取用户信息失败'
    });
  }
});

// 更新用户资料
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, bio, preferences, avatar } = req.body;
    const result = await userService.updateProfile(req.user.userId, {
      name,
      phone,
      bio,
      preferences,
      avatar
    });
    res.json({
      success: true,
      message: '用户资料更新成功',
      data: result
    });
  } catch (error) {
    logger.error('更新用户资料错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '更新用户资料失败'
    });
  }
});

// 修改密码
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '原密码和新密码都是必填项'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码至少需要6个字符'
      });
    }

    const result = await userService.changePassword(req.user.userId, oldPassword, newPassword);
    res.json(result);
  } catch (error) {
    logger.error('修改密码错误:', error);
    res.status(400).json({
      success: false,
      message: error.message || '修改密码失败'
    });
  }
});

// 刷新令牌
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const { generateToken } = require('../middleware/auth');
    
    const newToken = generateToken({
      userId: req.user.userId,
      username: req.user.username,
      role: req.user.role
    });

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token: newToken
      }
    });
  } catch (error) {
    logger.error('刷新令牌错误:', error);
    res.status(400).json({
      success: false,
      message: '令牌刷新失败'
    });
  }
});

// 退出登录
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: '退出登录成功'
    });
  } catch (error) {
    logger.error('退出登录错误:', error);
    res.status(400).json({
      success: false,
      message: '退出登录失败'
    });
  }
});

module.exports = router;