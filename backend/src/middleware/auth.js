const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

// JWT认证中间件（支持简化管理员模式）
const authenticateToken = (req, res, next) => {
  // 检查是否使用简化管理员模式
  const adminHeader = req.headers['x-admin-user'];
  if (adminHeader === 'true') {
    // 简化管理员模式，直接设置管理员用户
    req.user = {
      id: 1,
      username: 'admin',
      role: 'admin'
    };
    logger.info('使用简化管理员模式访问');
    return next();
  }

  // 原有的JWT认证逻辑
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '访问令牌缺失'
    });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      logger.warn('JWT验证失败:', err.message);
      return res.status(403).json({
        success: false,
        message: '访问令牌无效或已过期'
      });
    }

    req.user = user;
    next();
  });
};

// 可选认证中间件（用于可选登录的接口）
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

// 管理员权限中间件（支持简化管理员模式）
const requireAdmin = (req, res, next) => {
  // 检查是否使用简化管理员模式
  const adminHeader = req.headers['x-admin-user'];
  if (adminHeader === 'true') {
    logger.info('简化管理员模式：跳过权限检查');
    return next();
  }

  // 原有的权限检查逻辑
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }
  next();
};

// 生成JWT令牌
const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

// 验证JWT令牌
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('令牌验证失败');
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  generateToken,
  verifyToken
};