const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');
const config = require('../config');

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';
const TIMEOUT = 30000;

// =============================================
// 辅助：调用 Deepseek API
// =============================================
async function callDeepseek(messages, temperature = 0.7) {
  if (!DEEPSEEK_API_KEY) {
    return { error: '未配置 Deepseek API 密钥', mock: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
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

    if (!res.ok) {
      throw new Error(`Deepseek API 返回 ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return { content: data.choices[0].message.content };
  } catch (error) {
    logger.error('Deepseek API 调用失败:', error.message);
    return { error: error.message, mock: true };
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// 辅助：调用 C 的 Python AI 服务
// =============================================
async function callPythonService(endpoint, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!res.ok) return { error: `Python 服务返回 ${res.status}` };
    return await res.json();
  } catch (error) {
    return { error: `Python 服务不可用: ${error.message}`, unavailable: true };
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// 获取药材知识库上下文
// =============================================
async function getHerbContext(query) {
  const db = databaseManager.getDatabase();

  // 搜索相关药材
  const herbs = await new Promise((resolve, reject) => {
    const term = `%${query}%`;
    db.all(
      `SELECT h.name, h.pinyin, h.description, h.efficacy, h.usage_dosage, h.caution,
              hc.name as category, GROUP_CONCAT(DISTINCT p.name) as properties,
              GROUP_CONCAT(DISTINCT m.name) as meridians
       FROM herbs h
       LEFT JOIN herb_categories hc ON h.category_id = hc.id
       LEFT JOIN herb_properties hp ON h.id = hp.herb_id
       LEFT JOIN properties p ON hp.property_id = p.id
       LEFT JOIN herb_meridians hm ON h.id = hm.herb_id
       LEFT JOIN meridians m ON hm.meridian_id = m.id
       WHERE h.name LIKE ? OR h.pinyin LIKE ? OR h.alias LIKE ? OR h.efficacy LIKE ?
       GROUP BY h.id
       LIMIT 10`,
      [term, term, term, term],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  return herbs;
}

// =============================================
// POST /ai-gateway/chat — 通用问答
// =============================================
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ success: false, message: '问题不能为空' });

    // 搜索药材上下文
    const context = await getHerbContext(question);
    const contextStr = context.length > 0
      ? '相关药材信息：\n' + context.map(h =>
          `- ${h.name}（${h.pinyin || ''}）：${h.description}。性味：${h.properties || ''}。归经：${h.meridians || ''}。功效：${h.efficacy || ''}。用量：${h.usage_dosage || ''}${h.caution ? '。注意：' + h.caution : ''}`
        ).join('\n')
      : '';

    const messages = [
      {
        role: 'system',
        content: `你是神农AI，专业的中医药智能助手，回答关于中药材、方剂、性味归经、配伍禁忌的问题。
请使用中文回答，保持专业准确。${contextStr ? '\n\n以下是数据库检索到的相关信息，请基于此回答：\n' + contextStr : ''}`
      },
      { role: 'user', content: question }
    ];

    const result = await callDeepseek(messages);

    if (result.mock) {
      // 降级：无 AI 时返回数据库内容
      return res.json({
        success: true,
        data: {
          answer: context.length > 0
            ? `我找到以下相关药材信息：\n\n${context.map(h => `**${h.name}**（${h.pinyin || ''}）\n${h.description}\n功效：${h.efficacy || ''}\n用量：${h.usage_dosage || ''}`).join('\n\n')}`
            : '抱歉，我没有找到相关的中药材信息。请尝试换个关键词搜索。',
          offline: true,
          context
        }
      });
    }

    res.json({ success: true, data: { answer: result.content, offline: false } });
  } catch (error) {
    logger.error('AI 问答失败:', error);
    res.status(500).json({ success: false, message: 'AI 服务暂时不可用' });
  }
});

// =============================================
// POST /ai-gateway/analyze-herb — 分析单味药材
// =============================================
router.post('/analyze-herb', authenticateToken, async (req, res) => {
  try {
    const { herbName } = req.body;
    if (!herbName) return res.status(400).json({ success: false, message: '药材名称不能为空' });

    const context = await getHerbContext(herbName);
    const herb = context[0];

    if (!herb) return res.status(404).json({ success: false, message: '未找到该药材' });

    const messages = [
      {
        role: 'system',
        content: `你是神农AI，中医药专家。请对以下药材进行详细分析，包括：性味归经、功效主治、用法用量、使用注意、配伍应用。\n\n${JSON.stringify(herb, null, 2)}`
      },
      { role: 'user', content: `请详细分析药材「${herbName}」` }
    ];

    const result = await callDeepseek(messages);

    res.json({
      success: true,
      data: {
        analysis: result.mock
          ? `**${herb.name}**（${herb.pinyin || ''}）\n\n**分类**：${herb.category || '未分类'}\n**性味**：${herb.properties || '未记载'}\n**归经**：${herb.meridians || '未记载'}\n**功效**：${herb.efficacy || ''}\n**主治**：${herb.description || ''}\n**用量**：${herb.usage_dosage || '未记载'}${herb.caution ? `\n\n⚠️ **注意**：${herb.caution}` : ''}`
          : result.content,
        herb,
        offline: !!result.mock
      }
    });
  } catch (error) {
    logger.error('药材分析失败:', error);
    res.status(500).json({ success: false, message: '分析服务暂时不可用' });
  }
});

// =============================================
// POST /ai-gateway/check-compatibility — 配伍禁忌检查
// =============================================
router.post('/check-compatibility', authenticateToken, async (req, res) => {
  try {
    const { herbs } = req.body;
    if (!herbs || !Array.isArray(herbs) || herbs.length < 2) {
      return res.status(400).json({ success: false, message: '请提供至少两味药材' });
    }

    const db = databaseManager.getDatabase();

    // 查找配伍规则
    const rules = [];
    for (let i = 0; i < herbs.length; i++) {
      for (let j = i + 1; j < herbs.length; j++) {
        const rule = await new Promise((resolve, reject) => {
          db.get(
            `SELECT cr.relation_type, cr.description, h1.name as h1, h2.name as h2
             FROM compatibility_rules cr
             JOIN herbs h1 ON cr.herb1_id = h1.id
             JOIN herbs h2 ON cr.herb2_id = h2.id
             WHERE (h1.name = ? AND h2.name = ?)
                OR (h1.name = ? AND h2.name = ?)`,
            [herbs[i], herbs[j], herbs[j], herbs[i]],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        if (rule) rules.push(rule);
      }
    }

    res.json({
      success: true,
      data: {
        compatible: rules.length === 0,
        rules,
        warning: rules.some(r => r.relation_type === '相反' || r.relation_type === '相恶')
          ? '存在配伍禁忌，请谨慎使用！'
          : undefined
      }
    });
  } catch (error) {
    logger.error('配伍检查失败:', error);
    res.status(500).json({ success: false, message: '配伍检查失败' });
  }
});

// =============================================
// POST /ai-gateway/python-proxy — 转发到 C 的 Python 服务
// =============================================
router.post('/python-proxy', authenticateToken, async (req, res) => {
  try {
    const { endpoint, data } = req.body;
    if (!endpoint) return res.status(400).json({ success: false, message: '缺少 endpoint' });

    const result = await callPythonService(endpoint, data || {});

    if (result.unavailable) {
      return res.json({
        success: false,
        message: 'Python AI 服务未启动，请稍后重试',
        serviceUrl: AI_SERVICE_URL
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Python 服务代理失败:', error);
    res.status(502).json({ success: false, message: '上游服务不可用' });
  }
});

// =============================================
// GET /ai-gateway/health — 服务健康检查
// =============================================
router.get('/health', async (req, res) => {
  const pythonStatus = await callPythonService('/health', {});
  res.json({
    success: true,
    data: {
      deepseek: DEEPSEEK_API_KEY ? '已配置' : '未配置',
      pythonService: pythonStatus.unavailable ? '未连接' : '已连接',
      pythonServiceUrl: AI_SERVICE_URL,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
