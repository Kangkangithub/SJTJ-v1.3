const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/auth');
const databaseManager = require('../config/database');
const logger = require('../utils/logger');

class UserService {
  constructor() {
    this.saltRounds = 12;
  }

  // 用户注册
  async registerUser(userData) {
    try {
      const { username, email, password, name } = userData;
      const db = databaseManager.getMongoDatabase();
      const usersCollection = db.collection('users');

      // 检查用户名是否已存在
      const existingUser = await usersCollection.findOne({
        $or: [{ username }, { email }]
      });

      if (existingUser) {
        throw new Error('用户名或邮箱已存在');
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, this.saltRounds);

      // 创建用户文档
      const newUser = {
        username,
        email,
        password_hash: hashedPassword,
        profile: {
          name: name || username,
          avatar: null,
          preferences: {
            theme: 'light',
            language: 'zh-cn'
          }
        },
        role: 'user',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        last_login: null
      };

      // 插入用户到MongoDB
      const result = await usersCollection.insertOne(newUser);
      
      // 在Neo4j中创建用户节点
      const session = databaseManager.getNeo4jSession();
      try {
        await session.run(
          'CREATE (u:User {id: $userId, username: $username, created_at: $createdAt})',
          {
            userId: result.insertedId.toString(),
            username,
            createdAt: new Date().toISOString()
          }
        );
      } finally {
        await session.close();
      }

      logger.info(`新用户注册成功: ${username}`);

      // 生成JWT令牌
      const token = generateToken({
        userId: result.insertedId.toString(),
        username,
        role: 'user'
      });

      return {
        success: true,
        message: '注册成功',
        data: {
          user: {
            id: result.insertedId.toString(),
            username,
            email,
            profile: newUser.profile,
            role: 'user'
          },
          token
        }
      };
    } catch (error) {
      logger.error('用户注册失败:', error);
      throw error;
    }
  }

  // 用户登录
  async loginUser(credentials) {
    try {
      const { username, password } = credentials;
      const db = databaseManager.getMongoDatabase();
      const usersCollection = db.collection('users');

      // 查找用户
      const user = await usersCollection.findOne({
        $or: [{ username }, { email: username }]
      });

      if (!user) {
        throw new Error('用户名或密码错误');
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('用户名或密码错误');
      }

      // 检查用户状态
      if (user.status !== 'active') {
        throw new Error('账户已被禁用');
      }

      // 更新最后登录时间
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            last_login: new Date(),
            updated_at: new Date()
          }
        }
      );

      logger.info(`用户登录成功: ${user.username}`);

      // 生成JWT令牌
      const token = generateToken({
        userId: user._id.toString(),
        username: user.username,
        role: user.role
      });

      return {
        success: true,
        message: '登录成功',
        data: {
          user: {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            profile: user.profile,
            role: user.role
          },
          token
        }
      };
    } catch (error) {
      logger.error('用户登录失败:', error);
      throw error;
    }
  }

  // 获取用户信息
  async getUserById(userId) {
    try {
      const db = databaseManager.getMongoDatabase();
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne(
        { _id: require('mongodb').ObjectId(userId) },
        { projection: { password_hash: 0 } }
      );

      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        success: true,
        data: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          profile: user.profile,
          role: user.role,
          status: user.status,
          created_at: user.created_at,
          last_login: user.last_login
        }
      };
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      throw error;
    }
  }

  // 更新用户资料
  async updateUserProfile(userId, profileData) {
    try {
      const db = databaseManager.getMongoDatabase();
      const usersCollection = db.collection('users');

      const updateData = {
        'profile.name': profileData.name,
        'profile.preferences': profileData.preferences,
        updated_at: new Date()
      };

      // 如果有头像数据，也更新头像
      if (profileData.avatar) {
        updateData['profile.avatar'] = profileData.avatar;
      }

      const result = await usersCollection.updateOne(
        { _id: require('mongodb').ObjectId(userId) },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        throw new Error('用户不存在');
      }

      logger.info(`用户资料更新成功: ${userId}`);

      return {
        success: true,
        message: '资料更新成功'
      };
    } catch (error) {
      logger.error('更新用户资料失败:', error);
      throw error;
    }
  }

  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const db = databaseManager.getMongoDatabase();
      const usersCollection = db.collection('users');

      // 获取用户当前密码
      const user = await usersCollection.findOne(
        { _id: require('mongodb').ObjectId(userId) }
      );

      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证旧密码
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isOldPasswordValid) {
        throw new Error('原密码错误');
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

      // 更新密码
      await usersCollection.updateOne(
        { _id: user._id },
        { 
          $set: { 
            password_hash: hashedNewPassword,
            updated_at: new Date()
          }
        }
      );

      logger.info(`用户密码修改成功: ${user.username}`);

      return {
        success: true,
        message: '密码修改成功'
      };
    } catch (error) {
      logger.error('修改密码失败:', error);
      throw error;
    }
  }

  // 记录用户兴趣（用于推荐系统）
  async recordUserInterest(userId, weaponId, interactionType = 'view') {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        // 在Neo4j中记录用户对武器的兴趣关系
        await session.run(`
          MATCH (u:User {id: $userId})
          MATCH (w:Weapon {id: $weaponId})
          MERGE (u)-[r:INTERESTED_IN]->(w)
          ON CREATE SET r.first_interaction = datetime(), r.count = 1, r.type = $interactionType
          ON MATCH SET r.last_interaction = datetime(), r.count = r.count + 1
        `, {
          userId,
          weaponId,
          interactionType
        });

        logger.info(`记录用户兴趣: ${userId} -> ${weaponId}`);
      } finally {
        await session.close();
      }

      return {
        success: true,
        message: '兴趣记录成功'
      };
    } catch (error) {
      logger.error('记录用户兴趣失败:', error);
      throw error;
    }
  }
}

module.exports = new UserService();