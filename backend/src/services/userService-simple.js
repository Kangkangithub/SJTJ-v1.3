const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const logger = require('../utils/logger');

class UserService {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/military-knowledge.db');
    }

    // 获取数据库连接
    getDb() {
        return new sqlite3.Database(this.dbPath);
    }

    // 用户注册
    async register(userData) {
        const { username, email, password, name } = userData;
        
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            // 检查用户名和邮箱是否已存在
            db.get(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                [username, email],
                async (err, row) => {
                    if (err) {
                        db.close();
                        logger.error('检查用户存在性失败:', err);
                        return reject(new Error('数据库查询失败'));
                    }
                    
                    if (row) {
                        db.close();
                        return reject(new Error('用户名或邮箱已存在'));
                    }
                    
                    try {
                        // 加密密码
                        const saltRounds = 12;
                        const password_hash = await bcrypt.hash(password, saltRounds);
                        
                        // 插入新用户
                        db.run(
                            `INSERT INTO users (username, email, password_hash, name, role, status, preferences) 
                             VALUES (?, ?, ?, ?, 'user', 'active', '{"theme":"light","language":"zh-cn"}')`,
                            [username, email, password_hash, name || username],
                            function(err) {
                                if (err) {
                                    db.close();
                                    logger.error('用户注册失败:', err);
                                    return reject(new Error('用户注册失败'));
                                }
                                
                                const userId = this.lastID;
                                logger.info(`新用户注册成功: ${username}`);
                                
                                // 获取完整用户信息
                                db.get(
                                    'SELECT id, username, email, name, role FROM users WHERE id = ?',
                                    [userId],
                                    (err, user) => {
                                        db.close();
                                        
                                        if (err) {
                                            logger.error('获取新用户信息失败:', err);
                                            return reject(new Error('获取用户信息失败'));
                                        }
                                        
                                        // 生成JWT令牌
                                        const token = jwt.sign(
                                            { 
                                                userId: user.id, 
                                                username: user.username, 
                                                role: user.role 
                                            },
                                            process.env.JWT_SECRET || 'default-secret-key',
                                            { expiresIn: '7d' }
                                        );
                                        
                                        resolve({
                                            success: true,
                                            message: '注册成功',
                                            data: {
                                                user: {
                                                    id: user.id,
                                                    username: user.username,
                                                    email: user.email,
                                                    name: user.name,
                                                    role: user.role
                                                },
                                                token
                                            }
                                        });
                                    }
                                );
                            }
                        );
                    } catch (hashError) {
                        db.close();
                        logger.error('密码加密失败:', hashError);
                        reject(new Error('密码处理失败'));
                    }
                }
            );
        });
    }

    // 用户登录
    async login(username, password) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            db.get(
                'SELECT id, username, email, password_hash, name, role, status FROM users WHERE username = ? OR email = ?',
                [username, username],
                async (err, user) => {
                    if (err) {
                        db.close();
                        logger.error('用户登录查询失败:', err);
                        return reject(new Error('数据库查询失败'));
                    }
                    
                    if (!user) {
                        db.close();
                        return reject(new Error('用户不存在'));
                    }
                    
                    if (user.status !== 'active') {
                        db.close();
                        return reject(new Error('账户已被禁用'));
                    }
                    
                    try {
                        // 验证密码
                        const isValidPassword = await bcrypt.compare(password, user.password_hash);
                        
                        if (!isValidPassword) {
                            db.close();
                            return reject(new Error('密码错误'));
                        }
                        
                        // 更新最后登录时间
                        db.run(
                            'UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [user.id],
                            (updateErr) => {
                                db.close();
                                
                                if (updateErr) {
                                    logger.error('更新登录时间失败:', updateErr);
                                }
                                
                                logger.info(`用户登录成功: ${user.username}`);
                                
                                // 生成JWT令牌
                                const token = jwt.sign(
                                    { 
                                        userId: user.id, 
                                        username: user.username, 
                                        role: user.role 
                                    },
                                    process.env.JWT_SECRET || 'default-secret-key',
                                    { expiresIn: '7d' }
                                );
                                
                                resolve({
                                    success: true,
                                    message: '登录成功',
                                    data: {
                                        user: {
                                            id: user.id,
                                            username: user.username,
                                            email: user.email,
                                            name: user.name,
                                            role: user.role
                                        },
                                        token
                                    }
                                });
                            }
                        );
                    } catch (compareError) {
                        db.close();
                        logger.error('密码验证失败:', compareError);
                        reject(new Error('密码验证失败'));
                    }
                }
            );
        });
    }

    // 获取用户信息
    async getUserById(userId) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            db.get(
                `SELECT id, username, email, name, phone, bio, avatar, role, status, 
                        preferences, created_at, updated_at, last_login
                 FROM users WHERE id = ?`,
                [userId],
                (err, user) => {
                    db.close();
                    
                    if (err) {
                        logger.error('获取用户信息失败:', err);
                        return reject(new Error('数据库查询失败'));
                    }
                    
                    if (!user) {
                        return reject(new Error('用户不存在'));
                    }
                    
                    // 解析preferences JSON
                    let preferences = {};
                    try {
                        if (user.preferences) {
                            preferences = JSON.parse(user.preferences);
                        }
                    } catch (parseError) {
                        logger.error('解析用户偏好设置失败:', parseError);
                        preferences = { theme: 'light', language: 'zh-cn' };
                    }
                    
                    resolve({
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        name: user.name,
                        phone: user.phone,
                        bio: user.bio,
                        avatar: user.avatar,
                        role: user.role,
                        status: user.status,
                        preferences,
                        created_at: user.created_at,
                        updated_at: user.updated_at,
                        last_login: user.last_login
                    });
                }
            );
        });
    }

    // 更新用户资料
    async updateProfile(userId, updateData) {
        const { name, phone, bio, preferences } = updateData;
        
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            // 构建更新字段
            const updates = [];
            const values = [];
            
            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                values.push(phone);
            }
            if (bio !== undefined) {
                updates.push('bio = ?');
                values.push(bio);
            }
            if (preferences !== undefined) {
                updates.push('preferences = ?');
                values.push(JSON.stringify(preferences));
            }
            
            if (updates.length === 0) {
                db.close();
                return reject(new Error('没有要更新的字段'));
            }
            
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(userId);
            
            const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
            
            db.run(sql, values, function(err) {
                if (err) {
                    db.close();
                    logger.error('更新用户资料失败:', err);
                    return reject(new Error('更新用户资料失败'));
                }
                
                if (this.changes === 0) {
                    db.close();
                    return reject(new Error('用户不存在'));
                }
                
                // 获取更新后的用户信息
                db.get(
                    `SELECT id, username, email, name, phone, bio, avatar, role, status, 
                            preferences, created_at, updated_at, last_login
                     FROM users WHERE id = ?`,
                    [userId],
                    (err, user) => {
                        db.close();
                        
                        if (err) {
                            logger.error('获取更新后用户信息失败:', err);
                            return reject(new Error('获取用户信息失败'));
                        }
                        
                        logger.info(`用户资料更新成功: ${user.username}`);
                        
                        // 解析preferences JSON
                        let parsedPreferences = {};
                        try {
                            if (user.preferences) {
                                parsedPreferences = JSON.parse(user.preferences);
                            }
                        } catch (parseError) {
                            logger.error('解析用户偏好设置失败:', parseError);
                            parsedPreferences = { theme: 'light', language: 'zh-cn' };
                        }
                        
                        resolve({
                            id: user.id,
                            username: user.username,
                            email: user.email,
                            name: user.name,
                            phone: user.phone,
                            bio: user.bio,
                            avatar: user.avatar,
                            role: user.role,
                            status: user.status,
                            preferences: parsedPreferences,
                            created_at: user.created_at,
                            updated_at: user.updated_at,
                            last_login: user.last_login
                        });
                    }
                );
            });
        });
    }

    // 修改密码
    async changePassword(userId, oldPassword, newPassword) {
        return new Promise((resolve, reject) => {
            const db = this.getDb();
            
            // 首先验证旧密码
            db.get(
                'SELECT password_hash FROM users WHERE id = ?',
                [userId],
                async (err, user) => {
                    if (err) {
                        db.close();
                        logger.error('查询用户密码失败:', err);
                        return reject(new Error('数据库查询失败'));
                    }
                    
                    if (!user) {
                        db.close();
                        return reject(new Error('用户不存在'));
                    }
                    
                    try {
                        // 验证旧密码
                        const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
                        
                        if (!isValidPassword) {
                            db.close();
                            return reject(new Error('原密码错误'));
                        }
                        
                        // 加密新密码
                        const saltRounds = 12;
                        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
                        
                        // 更新密码
                        db.run(
                            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [newPasswordHash, userId],
                            function(updateErr) {
                                db.close();
                                
                                if (updateErr) {
                                    logger.error('更新密码失败:', updateErr);
                                    return reject(new Error('更新密码失败'));
                                }
                                
                                if (this.changes === 0) {
                                    return reject(new Error('用户不存在'));
                                }
                                
                                logger.info(`用户密码修改成功: userId=${userId}`);
                                resolve({ message: '密码修改成功' });
                            }
                        );
                    } catch (cryptoError) {
                        db.close();
                        logger.error('密码处理失败:', cryptoError);
                        reject(new Error('密码处理失败'));
                    }
                }
            );
        });
    }
}

module.exports = new UserService();