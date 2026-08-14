const express = require('express');
const multer = require('multer');
const databaseManager = require('../config/database-simple');
const neo4jManager = require('../config/neo4j-simple');
const logger = require('../utils/logger');

const router = express.Router();

const DASHSCOPE_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const DEFAULT_VISION_MODEL = 'qwen3.5-omni-plus';
const MAX_RECOGNITION_FILE_SIZE = Number(process.env.HERB_RECOGNITION_MAX_FILE_SIZE || 10 * 1024 * 1024);
const DASH_SCOPE_TIMEOUT_MS = Number(process.env.DASHSCOPE_TIMEOUT_MS || 30000);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECOGNITION_FILE_SIZE },
  fileFilter(req, file, cb) {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('基础版仅支持图片文件'));
  }
});

function uploadRecognitionFile(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      const maxMb = Math.round(MAX_RECOGNITION_FILE_SIZE / 1024 / 1024);
      return res.status(413).json({ success: false, message: `上传文件过大，请上传 ${maxMb}MB 以内的图片。` });
    }
    return res.status(400).json({ success: false, message: error.message || '上传文件无效' });
  });
}

function cleanModelContent(content) {
  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || '').join('\n').trim();
  }
  return String(content || '').trim();
}

function stripJsonFence(text) {
  return String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseRecognitionContent(content) {
  const text = cleanModelContent(content);
  if (!text) return { herbName: '', confidence: 0 };

  const unfenced = stripJsonFence(text);
  const objectMatch = unfenced.match(/\{[\s\S]*\}/);
  const candidate = objectMatch ? objectMatch[0] : unfenced;

  try {
    const parsed = JSON.parse(candidate);
    return {
      herbName: String(parsed.herbName || parsed.name || parsed.herb || '').trim(),
      confidence: Number(parsed.confidence || 0) || 0
    };
  } catch (error) {
    return { herbName: unfenced.replace(/^药材名称[:：]?/, '').trim(), confidence: 0 };
  }
}

async function callDashScopeVision(file) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return null;

  const mime = file.mimetype || 'image/jpeg';
  const base64 = file.buffer.toString('base64');
  const imageUrl = `data:${mime};base64,${base64}`;
  const model = process.env.VISION_MODEL || DEFAULT_VISION_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DASH_SCOPE_TIMEOUT_MS);

  try {
    const response = await fetch(DASHSCOPE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              {
                type: 'text',
                text: '请识别图中的中药材名称。只返回 JSON，不要解释，格式：{"herbName":"药材名称","confidence":0到1之间的小数}'
              }
            ]
          }
        ]
      }),
      signal: controller.signal
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      logger.warn('DashScope 药材识别调用失败:', { status: response.status, requestId: json.request_id });
      const error = new Error(response.status === 401 || response.status === 403
        ? '药材识别服务鉴权失败，请检查 DashScope 配置'
        : '药材识别服务暂不可用，请稍后重试');
      error.status = 502;
      error.code = response.status === 401 || response.status === 403
        ? 'VISION_SERVICE_AUTH_FAILED'
        : 'VISION_SERVICE_UNAVAILABLE';
      throw error;
    }

    const content = json.choices?.[0]?.message?.content;
    return parseRecognitionContent(content);
  } finally {
    clearTimeout(timer);
  }
}

function normalizeHerbNode(record) {
  const herb = record.get('h');
  if (!herb) return null;
  const neo4jId = herb.identity.toString();
  return {
    id: neo4jId,
    neo4j_id: neo4jId,
    name: herb.properties.name || '',
    pinyin: herb.properties.pinyin || '',
    latin_name: herb.properties.latin_name || '',
    alias: herb.properties.alias || '',
    description: herb.properties.description || herb.properties.efficacy || '',
    efficacy: herb.properties.efficacy || '',
    usage_dosage: herb.properties.usage_dosage || '',
    caution: herb.properties.caution || '',
    is_common: herb.properties.is_common || 0,
    category_name: record.get('category_name') || '',
    region_name: record.get('region_name') || ''
  };
}

function querySqliteHerbByName(name) {
  const db = databaseManager.getDatabase();
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, name, images FROM herbs WHERE name = ? OR alias LIKE ? OR pinyin = ? LIMIT 1',
      [name, `%${name}%`, name],
      (error, row) => error ? reject(error) : resolve(row || null)
    );
  });
}

async function applySqliteImageId(herb) {
  if (!herb?.name) return herb;
  try {
    const sqliteHerb = await querySqliteHerbByName(herb.name);
    if (!sqliteHerb?.id) return herb;

    const neo4jId = herb.neo4j_id || herb.id;
    const nextHerb = {
      ...herb,
      id: sqliteHerb.id,
      sqlite_id: sqliteHerb.id,
      neo4j_id: neo4jId
    };

    try {
      const images = sqliteHerb.images ? JSON.parse(sqliteHerb.images) : [];
      if (Array.isArray(images) && images.length > 0) nextHerb.images = images;
    } catch (error) {
      // 图片 JSON 解析失败时继续交给 /api/herb-images 的本地兜底逻辑处理。
    }

    return nextHerb;
  } catch (error) {
    logger.warn('药材识别 SQLite ID 映射失败:', { herbName: herb.name, message: error.message });
    return herb;
  }
}

async function safeDetailRun(session, cypher, params, label) {
  try {
    return await session.run(cypher, params);
  } catch (error) {
    logger.warn('药材识别补充查询失败:', { label, message: error.message });
    return { records: [] };
  }
}

async function runDetailQueries(session, herbName) {
  // neo4j-driver 不允许同一个 session 并发执行多条查询，按顺序查询避免 500。
  const propRes = await safeDetailRun(
    session,
    'MATCH (h:Herb {name: $name})-[:HAS_PROPERTY]->(p:Property) RETURN p.name AS name, p.type AS type ORDER BY p.name',
    { name: herbName },
    'properties'
  );
  const merRes = await safeDetailRun(
    session,
    'MATCH (h:Herb {name: $name})-[:MERIDIAN_AFFINITY]->(m:Meridian) RETURN m.name AS name, m.abbreviation AS abbreviation ORDER BY m.name',
    { name: herbName },
    'meridians'
  );
  const effRes = await safeDetailRun(
    session,
    'MATCH (h:Herb {name: $name})-[:HAS_EFFICACY]->(e:Efficacy) RETURN e.name AS name ORDER BY e.name',
    { name: herbName },
    'efficacies'
  );
  const formulaRes = await safeDetailRun(
    session,
    'MATCH (h:Herb {name: $name})<-[rel:CONTAINS_HERB]-(f:Formula) RETURN f.name AS name, rel.dosage AS dosage, rel.role AS role ORDER BY f.name LIMIT 8',
    { name: herbName },
    'formulas'
  );
  const relatedRes = await safeDetailRun(
    session,
    'MATCH (h:Herb {name: $name})-[:BELONGS_TO_CATEGORY|FROM_REGION]-(shared)<-[:BELONGS_TO_CATEGORY|FROM_REGION]-(other:Herb) WHERE other.name <> h.name OPTIONAL MATCH (other)-[:BELONGS_TO_CATEGORY]->(c:Category) RETURN DISTINCT other, c.name AS category_name LIMIT 6',
    { name: herbName },
    'related'
  );

  const related = [];
  for (const record of relatedRes.records) {
    const node = record.get('other');
    if (!node?.properties?.name) continue;
    related.push(await applySqliteImageId({
      id: node.identity.toString(),
      neo4j_id: node.identity.toString(),
      name: node.properties.name || '',
      category_name: record.get('category_name') || ''
    }));
  }

  return {
    properties: propRes.records.map((r) => ({ name: r.get('name'), type: r.get('type') })).filter((item) => item.name),
    meridians: merRes.records.map((r) => ({ name: r.get('name'), abbreviation: r.get('abbreviation') })).filter((item) => item.name),
    efficacies: effRes.records.map((r) => ({ name: r.get('name') })).filter((item) => item.name),
    formulas: formulaRes.records.map((r) => ({ name: r.get('name'), dosage: r.get('dosage'), role: r.get('role') })).filter((item) => item.name),
    related
  };
}

async function findHerbInNeo4j(name) {
  const session = neo4jManager.getSession();
  try {
    let result = await session.run(
      'MATCH (h:Herb) WHERE h.name = $name OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region) RETURN h, c.name AS category_name, r.name AS region_name LIMIT 1',
      { name }
    );

    if (!result.records.length) {
      result = await session.run(
        'MATCH (h:Herb) WHERE h.name = $name OR h.pinyin = $name OR h.alias = $name OPTIONAL MATCH (h)-[:BELONGS_TO_CATEGORY]->(c:Category) OPTIONAL MATCH (h)-[:FROM_REGION]->(r:Region) RETURN h, c.name AS category_name, r.name AS region_name LIMIT 1',
        { name }
      );
    }

    if (!result.records.length) return null;

    let herb = normalizeHerbNode(result.records[0]);
    if (!herb?.name) return null;

    herb = await applySqliteImageId(herb);
    const detail = await runDetailQueries(session, herb.name);
    return { ...herb, ...detail };
  } finally {
    await session.close();
  }
}

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      configured: Boolean(process.env.DASHSCOPE_API_KEY),
      endpoint: process.env.DASHSCOPE_API_KEY ? 'DASHSCOPE_API_KEY' : null,
      model: process.env.VISION_MODEL || DEFAULT_VISION_MODEL
    }
  });
});

router.post('/', uploadRecognitionFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传需要识别的药材图片' });
    }

    const recognition = await callDashScopeVision(req.file);
    if (!recognition) {
      return res.status(503).json({
        success: false,
        code: 'VISION_SERVICE_NOT_CONFIGURED',
        message: 'DashScope 多模态识别服务尚未配置'
      });
    }

    const herbName = String(recognition.herbName || '').trim();
    if (!herbName) {
      return res.status(422).json({
        success: false,
        code: 'HERB_RECOGNITION_FAILED',
        message: '未能识别出明确药材，请更换清晰图片后重试'
      });
    }

    const herb = await findHerbInNeo4j(herbName);
    if (!herb) {
      return res.status(404).json({
        success: false,
        code: 'HERB_NOT_FOUND',
        message: `已识别到药材“${herbName}”，但知识图谱中暂无该药材`
      });
    }

    res.json({
      success: true,
      data: {
        herb,
        confidence: Number(recognition.confidence || 0) || 0,
        source: 'dashscope-vision'
      }
    });
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    const isNeo4jUnavailable = String(error.message || '').includes('[Neo4j]');
    logger.error('药材图片识别失败:', { message: error.message, name: error.name });
    res.status(isAbort ? 504 : error.status || (isNeo4jUnavailable ? 503 : 500)).json({
      success: false,
      code: isAbort
        ? 'HERB_RECOGNITION_TIMEOUT'
        : error.code || (isNeo4jUnavailable ? 'KNOWLEDGE_GRAPH_UNAVAILABLE' : 'HERB_RECOGNITION_FAILED'),
      message: isAbort
        ? '药材识别请求超时，请稍后重试'
        : error.message || '药材识别失败，请稍后重试'
    });
  }
});

module.exports = router;
