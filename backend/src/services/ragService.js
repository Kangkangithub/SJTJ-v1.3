/**
 * RAG（检索增强生成）问答服务
 * 用于构建基于药材知识库的智能问答
 */
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// 简单内存缓存
const answerCache = new Map();
const CACHE_TTL = 3600 * 1000; // 1小时

class RAGService {

  // =============================================
  // 搜索知识库（药材 + 方剂 + 配伍）
  // =============================================
    async searchKnowledgeBase(query) {
    // 优先从 Neo4j 搜索
    let herbs = [], formulas = [], propertiesMeridians = [];
    try {
      const session = neo4jManager.getSession();
      try {
        // 搜索药材（模糊匹配名称、拼音、别名、功效、描述）
        const herbResult = await session.run(
          'MATCH (h:Herb) WHERE h.name CONTAINS $q OR h.pinyin CONTAINS $q OR h.alias CONTAINS $q OR h.efficacy CONTAINS $q OR h.description CONTAINS $q OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) RETURN h, c.name AS category LIMIT 8',
          { q: query }
        );
        for (const record of herbResult.records) {
          const h = record.get('h');
          herbs.push({
            id: h.identity.toString(),
            name: h.properties.name,
            pinyin: h.properties.pinyin || '',
            alias: h.properties.alias || '',
            description: h.properties.description || '',
            efficacy: h.properties.efficacy || '',
            usage_dosage: h.properties.usage_dosage || '',
            caution: h.properties.caution || '',
            category: record.get('category') || ''
          });
        }

        // 获取药材的性味
        if (herbs.length > 0) {
          const herbNames = herbs.map(h => h.name);
          const propResult = await session.run(
            'MATCH (h:Herb)-[:HAS_PROPERTY]->(p:Property) WHERE h.name IN $names WITH h, collect(DISTINCT p.name) AS props RETURN h.name AS herb_name, props',
            { names: herbNames }
          );
          for (const record of propResult.records) {
            propertiesMeridians.push({
              herb_id: record.get('herb_name'),
              properties: (record.get('props') || []).join('、')
            });
          }
        }

        // 搜索方剂
        try {
          const formulaResult = await session.run(
            'MATCH (f:Formula) WHERE f.name CONTAINS $q OR f.description CONTAINS $q RETURN f.name AS name, f.pinyin AS pinyin, f.category AS category, f.description AS description LIMIT 5',
            { q: query }
          );
          for (const record of formulaResult.records) {
            formulas.push({
              name: record.get('name'),
              pinyin: record.get('pinyin') || '',
              category: record.get('category') || '',
              description: record.get('description') || ''
            });
          }
        } catch (e) { /* 方剂数据可能不存在 */ }

        return { herbs, formulas, propertiesMeridians };
      } finally {
        await session.close();
      }
    } catch (neoError) {
      console.warn('[ragService] Neo4j 搜索失败，回退到 SQLite:', neoError.message);
    }

    // 回退：SQLite 查询
    const db = databaseManager.getDatabase();
    const term = '%' + query + '%';

    herbs = await new Promise((resolve, reject) => {
      db.all(
        'SELECT h.id, h.name, h.pinyin, h.alias, h.description, h.efficacy, h.usage_dosage, h.caution, hc.name as category FROM herbs h LEFT JOIN herb_categories hc ON h.category_id = hc.id WHERE h.name LIKE ? OR h.pinyin LIKE ? OR h.alias LIKE ? OR h.description LIKE ? OR h.efficacy LIKE ? LIMIT 8',
        [term, term, term, term, term],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });

    formulas = await new Promise((resolve, reject) => {
      db.all(
        'SELECT f.id, f.name, f.pinyin, f.category, f.description FROM formulas f WHERE f.name LIKE ? OR f.pinyin LIKE ? OR f.description LIKE ? LIMIT 5',
        [term, term, term],
        (err, rows) => { if (err) reject(err); else resolve(rows); }
      );
    });

    if (herbs.length > 0) {
      const herbIds = herbs.map(h => h.id);
      const placeholders = herbIds.map(() => "?").join(",");
      propertiesMeridians = await new Promise((resolve, reject) => {
        db.all(
          'SELECT hp.herb_id, GROUP_CONCAT(DISTINCT p.name) as properties FROM herb_properties hp JOIN properties p ON hp.property_id = p.id WHERE hp.herb_id IN (' + placeholders + ') GROUP BY hp.herb_id',
          herbIds,
          (err, rows) => { if (err) reject(err); else resolve(rows); }
        );
      });
    }

    return { herbs, formulas, propertiesMeridians };
  }

  // =============================================
  // 构建上下文提示
  // =============================================
  buildContext(knowledge) {
    const parts = [];

    if (knowledge.herbs.length > 0) {
      parts.push('【相关药材】');
      knowledge.herbs.forEach(h => {
        const prop = knowledge.propertiesMeridians.find(p => p.herb_id === h.id);
        parts.push(
          `- ${h.name}（${h.pinyin || ''}）${h.alias ? '又名' + h.alias : ''}
           分类：${h.category || '未分类'}
           性味：${prop ? prop.properties : '未记载'}
           功效：${h.efficacy || ''}
           主治：${h.description || ''}
           用量：${h.usage_dosage || '未记载'}${h.caution ? '\n           注意：' + h.caution : ''}`
        );
      });
    }

    if (knowledge.formulas.length > 0) {
      parts.push('【相关方剂】');
      knowledge.formulas.forEach(f => {
        parts.push(
          `- ${f.name}（${f.pinyin || ''}）
           分类：${f.category || '未分类'}
           功效：${f.description || ''}`
        );
      });
    }

    return parts.join('\n\n');
  }

  // =============================================
  // 调用 Deepseek 获取 AI 回答
  // =============================================
  async callAI(messages, temperature = 0.7) {
    if (!DEEPSEEK_API_KEY) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (error) {
      logger.warn('RAG AI 调用失败:', error.message);
      return null;
    }
  }

  // =============================================
  // 主入口：回答问题
  // =============================================
  async answer(question, userId = null) {
    const cacheKey = question.toLowerCase().trim();

    // 检查缓存
    const cached = answerCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    }

    // 搜索知识库
    const knowledge = await this.searchKnowledgeBase(question);
    const context = this.buildContext(knowledge);

    let aiAnswer = null;

    // 尝试 AI 回答
    if (DEEPSEEK_API_KEY) {
      const messages = [
        {
          role: 'system',
          content: `你是神农AI，专业的中医药智能助手。回答关于中药材、方剂、性味归经、配伍禁忌的问题。

请基于以下知识库信息回答。如果知识库中没有相关信息，请如实告知。
回答请简洁准确，使用中文，适当使用Markdown格式。

${context}`}
      ];
      messages.push({ role: 'user', content: question });
      aiAnswer = await this.callAI(messages);
    }

    // 降级：AI 不可用时用数据库信息
    const finalAnswer = aiAnswer || this.buildFallbackAnswer(knowledge, question);

    // 存缓存
    answerCache.set(cacheKey, {
      result: { answer: finalAnswer, sources: knowledge, fromAI: !!aiAnswer },
      timestamp: Date.now()
    });

    // 存入问答记录
    if (userId) {
      const db = databaseManager.getDatabase();
      db.run(
        'INSERT INTO qa_records (user_id, question, answer, created_at) VALUES (?, ?, ?, datetime(\'now\'))',
        [userId, question, finalAnswer],
        (err) => {
          if (err) logger.warn('保存问答记录失败:', err.message);
        }
      );
    }

    return {
      answer: finalAnswer,
      sources: {
        herbs: knowledge.herbs.map(h => ({ id: h.id, name: h.name, category: h.category })),
        formulas: knowledge.formulas.map(f => ({ id: f.id, name: f.name }))
      },
      fromAI: !!aiAnswer
    };
  }

  // =============================================
  // 降级回答（AI 不可用时）
  // =============================================
  buildFallbackAnswer(knowledge, question) {
    const parts = [];

    if (knowledge.herbs.length === 0 && knowledge.formulas.length === 0) {
      return `关于「${question}」，我在知识库中没有找到相关信息。请尝试换个关键词搜索。`;
    }

    if (knowledge.herbs.length > 0) {
      parts.push('### 相关药材\n');
      knowledge.herbs.forEach(h => {
        const prop = knowledge.propertiesMeridians.find(p => p.herb_id === h.id);
        parts.push(`**${h.name}**${h.pinyin ? '（' + h.pinyin + '）' : ''}`);
        parts.push(`- 分类：${h.category || '未分类'}`);
        if (prop) parts.push(`- 性味：${prop.properties}`);
        if (h.efficacy) parts.push(`- 功效：${h.efficacy}`);
        if (h.description) parts.push(`- 主治：${h.description}`);
        if (h.usage_dosage) parts.push(`- 用量：${h.usage_dosage}`);
        if (h.caution) parts.push(`- ⚠️ 注意：${h.caution}`);
        parts.push('');
      });
    }

    if (knowledge.formulas.length > 0) {
      parts.push('### 相关方剂\n');
      knowledge.formulas.forEach(f => {
        parts.push(`**${f.name}**${f.pinyin ? '（' + f.pinyin + '）' : ''}`);
        parts.push(`- 分类：${f.category || '未分类'}`);
        if (f.description) parts.push(`- 功效：${f.description}`);
        parts.push('');
      });
    }

    return parts.join('\n');
  }

  // =============================================
  // 清除缓存
  // =============================================
  clearCache() {
    answerCache.clear();
  }
}

module.exports = new RAGService();
