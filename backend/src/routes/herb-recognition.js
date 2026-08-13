const express = require('express');
const multer = require('multer');
const router = express.Router();
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (/^(image|video)\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持图片或视频文件'));
  }
});

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function getHerbDetail(herbId) {
  const db = databaseManager.getDatabase();
  const herb = await dbGet(db, `SELECT h.id, h.name, h.pinyin, h.alias, h.description, h.usage_dosage, h.caution,
      hc.name as category_name, hr.name as region_name
    FROM herbs h
    LEFT JOIN herb_categories hc ON hc.id = h.category_id
    LEFT JOIN herb_regions hr ON hr.id = h.region_id
    WHERE h.id = ?`, [herbId]);
  if (!herb) return null;

  const meridians = await dbAll(db, `SELECT m.name FROM herb_meridians hm JOIN meridians m ON m.id = hm.meridian_id WHERE hm.herb_id = ?`, [herbId]);
  const properties = await dbAll(db, `SELECT p.name FROM herb_properties hp JOIN properties p ON p.id = hp.property_id WHERE hp.herb_id = ?`, [herbId]);
  const efficacies = await dbAll(db, `SELECT e.name FROM herb_efficacies he JOIN efficacies e ON e.id = he.efficacy_id WHERE he.herb_id = ?`, [herbId]);
  const related = await dbAll(db, `SELECT h2.id, h2.name, hc.name as category_name
    FROM herbs h1
    JOIN herbs h2 ON h2.id != h1.id AND (h2.category_id = h1.category_id OR h2.region_id = h1.region_id)
    LEFT JOIN herb_categories hc ON hc.id = h2.category_id
    WHERE h1.id = ?
    LIMIT 6`, [herbId]);

  return {
    ...herb,
    properties: properties.map(row => row.name),
    meridians: meridians.map(row => row.name),
    efficacies: efficacies.map(row => row.name),
    related
  };
}

async function callRecognitionService(file) {
  const serviceUrl = process.env.HERB_RECOGNITION_URL;
  if (!serviceUrl) return null;

  const form = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype });
  form.append('file', blob, file.originalname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(serviceUrl, {
    method: 'POST',
    body: form,
    signal: controller.signal
  });
  clearTimeout(timer);

  const json = await response.json();
  if (!response.ok || json.success === false) {
    throw new Error(json.message || '识别服务调用失败');
  }
  return json.data || json;
}

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      configured: Boolean(process.env.HERB_RECOGNITION_URL),
      endpoint: process.env.HERB_RECOGNITION_URL ? 'HERB_RECOGNITION_URL' : null
    }
  });
});

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传需要识别的药材图片或视频' });
    }

    const recognition = await callRecognitionService(req.file);
    if (!recognition) {
      return res.status(503).json({
        success: false,
        code: 'RECOGNITION_SERVICE_NOT_CONFIGURED',
        message: '药材识别模型服务尚未配置，无法给出真实识别结果'
      });
    }

    const herbName = recognition.herbName || recognition.name;
    const herbId = recognition.herbId || recognition.id;
    const confidence = Number(recognition.confidence || 0);

    let herb = null;
    const db = databaseManager.getDatabase();
    if (herbId) herb = await getHerbDetail(herbId);
    if (!herb && herbName) {
      const found = await dbGet(db, 'SELECT id FROM herbs WHERE name = ? OR alias LIKE ?', [herbName, `%${herbName}%`]);
      if (found) herb = await getHerbDetail(found.id);
    }

    if (!herb) {
      return res.status(404).json({ success: false, message: '识别结果未匹配到后端药材库记录' });
    }

    res.json({
      success: true,
      data: {
        herb,
        confidence,
        source: 'model-service'
      }
    });
  } catch (error) {
    logger.error('药材识别失败:', error);
    res.status(500).json({ success: false, message: error.message || '药材识别失败' });
  }
});

module.exports = router;
