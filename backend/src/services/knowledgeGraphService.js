const databaseManager = require('../config/database_Neo4j');
const logger = require('../utils/logger');

class KnowledgeGraphService {
  // 执行Cypher查询
  async executeCypherQuery(cypherQuery, parameters = {}) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        const result = await session.run(cypherQuery, parameters);
        
        const records = result.records.map(record => {
          const recordData = {};
          record.keys.forEach(key => {
            const value = record.get(key);
            // 处理Neo4j节点和关系对象
            if (value && typeof value === 'object' && value.constructor.name === 'Node') {
              recordData[key] = {
                identity: value.identity.toString(),
                labels: value.labels,
                properties: value.properties
              };
            } else if (value && typeof value === 'object' && value.constructor.name === 'Relationship') {
              recordData[key] = {
                identity: value.identity.toString(),
                type: value.type,
                properties: value.properties,
                start: value.start.toString(),
                end: value.end.toString()
              };
            } else {
              recordData[key] = value;
            }
          });
          return recordData;
        });

        return {
          success: true,
          data: {
            records,
            summary: {
              query: cypherQuery,
              parameters,
              recordCount: records.length
            }
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('Cypher查询执行失败:', error);
      throw error;
    }
  }

  // 获取知识图谱概览
  async getGraphOverview() {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        // 获取节点统计
        const nodeStats = await session.run(`
          MATCH (n)
          RETURN labels(n) as labels, count(n) as count
          ORDER BY count DESC
        `);

        // 获取关系统计
        const relationshipStats = await session.run(`
          MATCH ()-[r]->()
          RETURN type(r) as relationship_type, count(r) as count
          ORDER BY count DESC
        `);

        const nodeStatistics = nodeStats.records.map(record => ({
          labels: record.get('labels'),
          count: record.get('count').toNumber()
        }));

        const relationshipStatistics = relationshipStats.records.map(record => ({
          type: record.get('relationship_type'),
          count: record.get('count').toNumber()
        }));

        return {
          success: true,
          data: {
            node_statistics: nodeStatistics,
            relationship_statistics: relationshipStatistics,
            total_nodes: nodeStatistics.reduce((sum, stat) => sum + stat.count, 0),
            total_relationships: relationshipStatistics.reduce((sum, stat) => sum + stat.count, 0)
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('获取知识图谱概览失败:', error);
      throw error;
    }
  }

  // 获取武器知识图谱
  async getWeaponGraph(weaponId, depth = 2) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        const result = await session.run(`
          MATCH path = (w:Weapon {id: $weaponId})-[*1..$depth]-(related)
          RETURN w as center_weapon,
                 nodes(path) as path_nodes,
                 relationships(path) as path_relationships
          LIMIT 100
        `, {
          weaponId,
          depth
        });

        const nodes = new Map();
        const relationships = [];

        result.records.forEach(record => {
          const pathNodes = record.get('path_nodes');
          const pathRelationships = record.get('path_relationships');

          // 处理节点
          pathNodes.forEach(node => {
            const nodeId = node.identity.toString();
            if (!nodes.has(nodeId)) {
              nodes.set(nodeId, {
                id: nodeId,
                labels: node.labels,
                properties: node.properties
              });
            }
          });

          // 处理关系
          pathRelationships.forEach(rel => {
            relationships.push({
              id: rel.identity.toString(),
              type: rel.type,
              properties: rel.properties,
              source: rel.start.toString(),
              target: rel.end.toString()
            });
          });
        });

        return {
          success: true,
          data: {
            nodes: Array.from(nodes.values()),
            relationships,
            center_weapon_id: weaponId
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('获取武器知识图谱失败:', error);
      throw error;
    }
  }

  // 搜索知识图谱
  async searchGraph(searchTerm, nodeTypes = [], limit = 20) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        let cypherQuery = `
          MATCH (n)
          WHERE (n.name CONTAINS $searchTerm OR n.description CONTAINS $searchTerm)
        `;

        const parameters = { searchTerm, limit };

        // 如果指定了节点类型，添加标签过滤
        if (nodeTypes.length > 0) {
          const labelConditions = nodeTypes.map((type, index) => {
            parameters[`label${index}`] = type;
            return `$label${index} IN labels(n)`;
          }).join(' OR ');
          cypherQuery += ` AND (${labelConditions})`;
        }

        cypherQuery += `
          RETURN n, labels(n) as node_labels
          LIMIT $limit
        `;

        const result = await session.run(cypherQuery, parameters);

        const searchResults = result.records.map(record => {
          const node = record.get('n');
          return {
            id: node.identity.toString(),
            labels: record.get('node_labels'),
            properties: node.properties
          };
        });

        return {
          success: true,
          data: {
            results: searchResults,
            search_term: searchTerm,
            total_found: searchResults.length
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('搜索知识图谱失败:', error);
      throw error;
    }
  }

  // 获取节点的邻居
  async getNodeNeighbors(nodeId, relationshipTypes = [], limit = 10) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        let cypherQuery = `
          MATCH (n)-[r]-(neighbor)
          WHERE id(n) = $nodeId
        `;

        const parameters = { nodeId: parseInt(nodeId), limit };

        // 如果指定了关系类型，添加过滤
        if (relationshipTypes.length > 0) {
          const typeConditions = relationshipTypes.map(type => `'${type}'`).join(', ');
          cypherQuery += ` AND type(r) IN [${typeConditions}]`;
        }

        cypherQuery += `
          RETURN neighbor, r, type(r) as relationship_type
          LIMIT $limit
        `;

        const result = await session.run(cypherQuery, parameters);

        const neighbors = result.records.map(record => {
          const neighbor = record.get('neighbor');
          const relationship = record.get('r');
          
          return {
            node: {
              id: neighbor.identity.toString(),
              labels: neighbor.labels,
              properties: neighbor.properties
            },
            relationship: {
              id: relationship.identity.toString(),
              type: record.get('relationship_type'),
              properties: relationship.properties
            }
          };
        });

        return {
          success: true,
          data: {
            neighbors,
            center_node_id: nodeId
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('获取节点邻居失败:', error);
      throw error;
    }
  }

  // 查找两个节点之间的路径
  async findPath(startNodeId, endNodeId, maxDepth = 5) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        const result = await session.run(`
          MATCH path = shortestPath((start)-[*1..$maxDepth]-(end))
          WHERE id(start) = $startNodeId AND id(end) = $endNodeId
          RETURN path,
                 length(path) as path_length,
                 nodes(path) as path_nodes,
                 relationships(path) as path_relationships
        `, {
          startNodeId: parseInt(startNodeId),
          endNodeId: parseInt(endNodeId),
          maxDepth
        });

        if (result.records.length === 0) {
          return {
            success: true,
            data: {
              path_found: false,
              message: '未找到连接路径'
            }
          };
        }

        const record = result.records[0];
        const pathNodes = record.get('path_nodes').map(node => ({
          id: node.identity.toString(),
          labels: node.labels,
          properties: node.properties
        }));

        const pathRelationships = record.get('path_relationships').map(rel => ({
          id: rel.identity.toString(),
          type: rel.type,
          properties: rel.properties,
          source: rel.start.toString(),
          target: rel.end.toString()
        }));

        return {
          success: true,
          data: {
            path_found: true,
            path_length: record.get('path_length').toNumber(),
            nodes: pathNodes,
            relationships: pathRelationships
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('查找路径失败:', error);
      throw error;
    }
  }

  // 获取推荐武器（基于用户兴趣图谱）
  async getRecommendedWeapons(userId, limit = 10) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        const result = await session.run(`
          MATCH (u:User {id: $userId})-[:INTERESTED_IN]->(interested:Weapon)
          MATCH (interested)-[:BELONGS_TO]->(category:Category)<-[:BELONGS_TO]-(recommended:Weapon)
          WHERE NOT (u)-[:INTERESTED_IN]->(recommended)
          WITH recommended, count(*) as relevance_score
          ORDER BY relevance_score DESC
          LIMIT $limit
          RETURN recommended.id as weapon_id,
                 recommended.name as weapon_name,
                 recommended.type as weapon_type,
                 recommended.country as weapon_country,
                 relevance_score
        `, {
          userId,
          limit
        });

        const recommendations = result.records.map(record => ({
          weapon_id: record.get('weapon_id'),
          name: record.get('weapon_name'),
          type: record.get('weapon_type'),
          country: record.get('weapon_country'),
          relevance_score: record.get('relevance_score').toNumber()
        }));

        return {
          success: true,
          data: {
            recommendations,
            user_id: userId
          }
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('获取推荐武器失败:', error);
      throw error;
    }
  }

  // 创建武器之间的相似关系
  async createSimilarityRelationship(weaponId1, weaponId2, similarityScore = 0.8) {
    try {
      const session = databaseManager.getNeo4jSession();
      
      try {
        await session.run(`
          MATCH (w1:Weapon {id: $weaponId1})
          MATCH (w2:Weapon {id: $weaponId2})
          MERGE (w1)-[r:SIMILAR_TO]-(w2)
          SET r.similarity_score = $similarityScore,
              r.created_at = datetime()
        `, {
          weaponId1,
          weaponId2,
          similarityScore
        });

        logger.info(`创建相似关系: ${weaponId1} <-> ${weaponId2} (相似度: ${similarityScore})`);

        return {
          success: true,
          message: '相似关系创建成功'
        };
      } finally {
        await session.close();
      }
    } catch (error) {
      logger.error('创建相似关系失败:', error);
      throw error;
    }
  }
}

module.exports = new KnowledgeGraphService();