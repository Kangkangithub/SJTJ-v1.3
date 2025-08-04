const databaseManager = require('../config/database');
const logger = require('../utils/logger');

class WeaponService {
  // 创建武器
  async createWeapon(weaponData) {
    try {
      const { name, type, country, year, description, specifications } = weaponData;
      
      // 在MongoDB中存储详细信息
      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');
      
      const weaponDetail = {
        name,
        type,
        country,
        year,
        description,
        specifications: specifications || {},
        images: [],
        documents: [],
        performance_data: {},
        created_at: new Date(),
        updated_at: new Date()
      };

      const mongoResult = await weaponsCollection.insertOne(weaponDetail);
      const weaponId = mongoResult.insertedId.toString();

      // 在Neo4j中创建武器节点和关系
      const session = databaseManager.getNeo4jSession();
      
      try {
        // 创建武器节点
        await session.run(`
          CREATE (w:Weapon {
            id: $weaponId,
            name: $name,
            type: $type,
            country: $country,
            year: $year,
            created_at: datetime()
          })
        `, {
          weaponId,
          name,
          type,
          country,
          year: year || null
        });

        // 创建或连接到类别节点
        await session.run(`
          MATCH (w:Weapon {id: $weaponId})
          MERGE (c:Category {name: $type})
          CREATE (w)-[:BELONGS_TO]->(c)
        `, {
          weaponId,
          type
        });

        // 创建或连接到国家节点
        await session.run(`
          MATCH (w:Weapon {id: $weaponId})
          MERGE (country:Country {name: $country})
          CREATE (w)-[:MANUFACTURED_BY]->(country)
        `, {
          weaponId,
          country
        });

        logger.info(`武器创建成功: ${name} (ID: ${weaponId})`);
      } finally {
        await session.close();
      }

      return {
        success: true,
        message: '武器创建成功',
        data: {
          id: weaponId,
          name,
          type,
          country,
          year,
          description
        }
      };
    } catch (error) {
      logger.error('创建武器失败:', error);
      throw error;
    }
  }

  // 获取武器列表
  async getWeapons(filters = {}, pagination = {}) {
    try {
      const { category, country, page = 1, limit = 20 } = { ...filters, ...pagination };
      const skip = (page - 1) * limit;

      // 构建查询条件
      const query = {};
      if (category) query.type = category;
      if (country) query.country = country;

      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');

      // 获取武器列表
      const weapons = await weaponsCollection
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // 获取总数
      const total = await weaponsCollection.countDocuments(query);

      const weaponList = weapons.map(weapon => ({
        id: weapon._id.toString(),
        name: weapon.name,
        type: weapon.type,
        country: weapon.country,
        year: weapon.year,
        description: weapon.description,
        images: weapon.images || []
      }));

      return {
        success: true,
        data: {
          weapons: weaponList,
          pagination: {
            current_page: page,
            total_pages: Math.ceil(total / limit),
            total_items: total,
            items_per_page: limit
          }
        }
      };
    } catch (error) {
      logger.error('获取武器列表失败:', error);
      throw error;
    }
  }

  // 获取武器详情
  async getWeaponById(weaponId) {
    try {
      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');

      const weapon = await weaponsCollection.findOne({
        _id: require('mongodb').ObjectId(weaponId)
      });

      if (!weapon) {
        throw new Error('武器不存在');
      }

      // 从Neo4j获取关系信息
      const session = databaseManager.getNeo4jSession();
      let relationships = [];
      
      try {
        const result = await session.run(`
          MATCH (w:Weapon {id: $weaponId})-[r]-(related)
          RETURN type(r) as relationship_type, 
                 labels(related) as related_labels,
                 properties(related) as related_properties
          LIMIT 10
        `, { weaponId });

        relationships = result.records.map(record => ({
          type: record.get('relationship_type'),
          related_entity: {
            labels: record.get('related_labels'),
            properties: record.get('related_properties')
          }
        }));
      } finally {
        await session.close();
      }

      return {
        success: true,
        data: {
          id: weapon._id.toString(),
          name: weapon.name,
          type: weapon.type,
          country: weapon.country,
          year: weapon.year,
          description: weapon.description,
          specifications: weapon.specifications,
          images: weapon.images,
          documents: weapon.documents,
          performance_data: weapon.performance_data,
          relationships,
          created_at: weapon.created_at
        }
      };
    } catch (error) {
      logger.error('获取武器详情失败:', error);
      throw error;
    }
  }

  // 搜索武器
  async searchWeapons(searchTerm, filters = {}) {
    try {
      const { category, country } = filters;
      
      // 构建搜索查询
      const searchQuery = {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      // 添加过滤条件
      if (category) searchQuery.type = category;
      if (country) searchQuery.country = country;

      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');

      const weapons = await weaponsCollection
        .find(searchQuery)
        .limit(50)
        .toArray();

      const weaponList = weapons.map(weapon => ({
        id: weapon._id.toString(),
        name: weapon.name,
        type: weapon.type,
        country: weapon.country,
        year: weapon.year,
        description: weapon.description
      }));

      return {
        success: true,
        data: {
          weapons: weaponList,
          total: weaponList.length
        }
      };
    } catch (error) {
      logger.error('搜索武器失败:', error);
      throw error;
    }
  }

  // 获取相似武器
  async getSimilarWeapons(weaponId, limit = 5) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        // 使用Neo4j查找相似武器
        const result = await session.run(`
          MATCH (w:Weapon {id: $weaponId})-[:BELONGS_TO]->(c:Category)<-[:BELONGS_TO]-(similar:Weapon)
          WHERE similar.id <> $weaponId
          RETURN similar.id as id, similar.name as name, similar.type as type, similar.country as country
          LIMIT $limit
          
          UNION
          
          MATCH (w:Weapon {id: $weaponId})-[:MANUFACTURED_BY]->(country:Country)<-[:MANUFACTURED_BY]-(similar:Weapon)
          WHERE similar.id <> $weaponId
          RETURN similar.id as id, similar.name as name, similar.type as type, similar.country as country
          LIMIT $limit
        `, {
          weaponId,
          limit
        });

        const similarWeapons = result.records.map(record => ({
          id: record.get('id'),
          name: record.get('name'),
          type: record.get('type'),
          country: record.get('country')
        }));

        return {
          success: true,
          data: {
            similar_weapons: similarWeapons
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('获取相似武器失败:', error);
      throw error;
    }
  }

  // 更新武器
  async updateWeapon(weaponId, updateData) {
    try {
      const { name, type, country, year, description, specifications } = updateData;
      
      // 更新MongoDB中的详细信息
      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');
      
      const updateDoc = {
        name,
        type,
        country,
        year,
        description,
        specifications: specifications || {},
        updated_at: new Date()
      };

      const mongoResult = await weaponsCollection.updateOne(
        { _id: require('mongodb').ObjectId(weaponId) },
        { $set: updateDoc }
      );

      if (mongoResult.matchedCount === 0) {
        throw new Error('武器不存在');
      }

      // 更新Neo4j中的武器节点
      const session = databaseManager.getNeo4jSession();
      
      try {
        // 更新武器节点属性
        await session.run(`
          MATCH (w:Weapon {id: $weaponId})
          SET w.name = $name,
              w.type = $type,
              w.country = $country,
              w.year = $year,
              w.updated_at = datetime()
        `, {
          weaponId,
          name,
          type,
          country,
          year: year || null
        });

        // 更新类别关系
        await session.run(`
          MATCH (w:Weapon {id: $weaponId})-[r:BELONGS_TO]->()
          DELETE r
        `, { weaponId });

        await session.run(`
          MATCH (w:Weapon {id: $weaponId})
          MERGE (c:Category {name: $type})
          CREATE (w)-[:BELONGS_TO]->(c)
        `, {
          weaponId,
          type
        });

        // 更新国家关系
        await session.run(`
          MATCH (w:Weapon {id: $weaponId})-[r:MANUFACTURED_BY]->()
          DELETE r
        `, { weaponId });

        await session.run(`
          MATCH (w:Weapon {id: $weaponId})
          MERGE (country:Country {name: $country})
          CREATE (w)-[:MANUFACTURED_BY]->(country)
        `, {
          weaponId,
          country
        });

        logger.info(`武器更新成功: ${name} (ID: ${weaponId})`);
      } finally {
        await session.close();
      }

      return {
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
      };
    } catch (error) {
      logger.error('更新武器失败:', error);
      throw error;
    }
  }

  // 删除武器
  async deleteWeapon(weaponId) {
    try {
      // 从MongoDB中删除详细信息
      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');
      
      const mongoResult = await weaponsCollection.deleteOne({
        _id: require('mongodb').ObjectId(weaponId)
      });

      if (mongoResult.deletedCount === 0) {
        throw new Error('武器不存在');
      }

      // 从Neo4j中删除武器节点和相关关系
      const session = databaseManager.getNeo4jSession();
      
      try {
        await session.run(`
          MATCH (w:Weapon {id: $weaponId})
          DETACH DELETE w
        `, { weaponId });

        logger.info(`武器删除成功: ID ${weaponId}`);
      } finally {
        await session.close();
      }

      return {
        success: true,
        message: '武器删除成功'
      };
    } catch (error) {
      logger.error('删除武器失败:', error);
      throw error;
    }
  }

  // 获取武器统计信息
  async getWeaponStatistics() {
    try {
      const db = databaseManager.getMongoDatabase();
      const weaponsCollection = db.collection('weapon_details');

      // 按类型统计
      const typeStats = await weaponsCollection.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();

      // 按国家统计
      const countryStats = await weaponsCollection.aggregate([
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();

      // 总数统计
      const totalWeapons = await weaponsCollection.countDocuments();

      return {
        success: true,
        data: {
          total_weapons: totalWeapons,
          by_type: typeStats.map(stat => ({
            type: stat._id,
            count: stat.count
          })),
          by_country: countryStats.map(stat => ({
            country: stat._id,
            count: stat.count
          }))
        }
      };
    } catch (error) {
      logger.error('获取武器统计失败:', error);
      throw error;
    }
  }
}

module.exports = new WeaponService();