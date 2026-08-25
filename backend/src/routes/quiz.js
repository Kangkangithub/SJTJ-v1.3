const express = require('express');
const router = express.Router();
const databaseManager = require('../config/database-simple');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const CATEGORY_LABELS = {
  herbs: '药材分类',
  regions: '道地产区',
  properties: '性味归经',
  formulas: '方剂组成'
};

const DIFFICULTY_SETTINGS = {
  easy: { questions: 5, timeLimit: 300 },
  medium: { questions: 10, timeLimit: 600 },
  hard: { questions: 15, timeLimit: 900 }
};

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      err ? reject(err) : resolve(this);
    });
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeOptions(correct, pool, size = 4) {
  const options = shuffle([...new Set(pool.filter(Boolean).filter(item => item !== correct))]).slice(0, size - 1);
  options.push(correct);
  const shuffled = shuffle(options);
  return {
    options: shuffled,
    correctAnswer: shuffled.indexOf(correct)
  };
}

async function ensureAttemptTable(db) {
  await dbRun(db, `CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    time_used INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

async function buildHerbQuestions(db, count) {
  const herbs = await dbAll(db, `SELECT h.id, h.name, hc.name as category_name
    FROM herbs h JOIN herb_categories hc ON h.category_id = hc.id
    WHERE hc.name IS NOT NULL ORDER BY RANDOM() LIMIT ?`, [count * 2]);
  const categories = (await dbAll(db, 'SELECT name FROM herb_categories ORDER BY name')).map(row => row.name);

  return herbs.map((herb) => {
    const result = makeOptions(herb.category_name, categories);
    return {
      id: `herb-category-${herb.id}`,
      category: 'herbs',
      question: `下列哪一项是「${herb.name}」所属的药材分类？`,
      hint: '可从药材功效方向判断其分类。',
      ...result
    };
  }).filter(q => q.correctAnswer >= 0).slice(0, count);
}

async function buildRegionQuestions(db, count) {
  const herbs = await dbAll(db, `SELECT h.id, h.name, hr.name as region_name
    FROM herbs h JOIN herb_regions hr ON h.region_id = hr.id
    WHERE hr.name IS NOT NULL ORDER BY RANDOM() LIMIT ?`, [count * 2]);
  const regions = (await dbAll(db, 'SELECT name FROM herb_regions ORDER BY name')).map(row => row.name);

  return herbs.map((herb) => {
    const result = makeOptions(herb.region_name, regions);
    return {
      id: `herb-region-${herb.id}`,
      category: 'regions',
      question: `「${herb.name}」在当前药材库中的主要产地记录是哪里？`,
      hint: '题目基于后端药材库中的产地字段。',
      ...result
    };
  }).filter(q => q.correctAnswer >= 0).slice(0, count);
}

async function buildPropertyQuestions(db, count) {
  const rows = await dbAll(db, `SELECT h.id, h.name, p.name as property_name
    FROM herbs h
    JOIN herb_properties hp ON hp.herb_id = h.id
    JOIN properties p ON p.id = hp.property_id
    ORDER BY RANDOM() LIMIT ?`, [count * 2]);
  const properties = (await dbAll(db, 'SELECT name FROM properties ORDER BY name')).map(row => row.name);

  return rows.map((row) => {
    const result = makeOptions(row.property_name, properties);
    return {
      id: `herb-property-${row.id}-${row.property_name}`,
      category: 'properties',
      question: `下列哪一项属于「${row.name}」的性味记录？`,
      hint: '性味来自后端 herb_properties 关联表。',
      ...result
    };
  }).filter(q => q.correctAnswer >= 0).slice(0, count);
}

async function buildFormulaQuestions(db, count) {
  const rows = await dbAll(db, `SELECT f.id, f.name as formula_name, h.name as herb_name
    FROM formulas f
    JOIN formula_herbs fh ON fh.formula_id = f.id
    JOIN herbs h ON h.id = fh.herb_id
    ORDER BY RANDOM() LIMIT ?`, [count * 2]);
  const herbs = (await dbAll(db, 'SELECT name FROM herbs ORDER BY RANDOM() LIMIT 120')).map(row => row.name);

  return rows.map((row) => {
    const result = makeOptions(row.herb_name, herbs);
    return {
      id: `formula-herb-${row.id}-${row.herb_name}`,
      category: 'formulas',
      question: `下列哪味药材收录在方剂「${row.formula_name}」的组成中？`,
      hint: '题目基于后端 formula_herbs 方剂组成表。',
      ...result
    };
  }).filter(q => q.correctAnswer >= 0).slice(0, count);
}

router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }))
  });
});

router.get('/questions', async (req, res) => {
  try {
    const category = CATEGORY_LABELS[req.query.category] ? req.query.category : 'herbs';
    const difficulty = DIFFICULTY_SETTINGS[req.query.difficulty] ? req.query.difficulty : 'easy';
    const settings = DIFFICULTY_SETTINGS[difficulty];
    const db = databaseManager.getDatabase();

    const builders = {
      herbs: buildHerbQuestions,
      regions: buildRegionQuestions,
      properties: buildPropertyQuestions,
      formulas: buildFormulaQuestions
    };
    const questions = await builders[category](db, settings.questions);

    res.json({
      success: true,
      data: {
        category,
        categoryLabel: CATEGORY_LABELS[category],
        difficulty,
        settings,
        questions
      }
    });
  } catch (error) {
    logger.error('生成测评题目失败:', error);
    res.status(500).json({ success: false, message: '生成测评题目失败' });
  }
});

router.post('/attempts', optionalAuth, async (req, res) => {
  try {
    const { category, difficulty, score, total, timeUsed } = req.body || {};
    if (!CATEGORY_LABELS[category] || !DIFFICULTY_SETTINGS[difficulty]) {
      return res.status(400).json({ success: false, message: '测评分类或难度无效' });
    }
    if (!Number.isFinite(Number(score)) || !Number.isFinite(Number(total)) || Number(total) <= 0) {
      return res.status(400).json({ success: false, message: '测评成绩无效' });
    }

    const db = databaseManager.getDatabase();
    await ensureAttemptTable(db);
    const userId = req.user?.userId || req.user?.id || null;
    const result = await dbRun(db,
      'INSERT INTO quiz_attempts (user_id, category, difficulty, score, total, time_used) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, category, difficulty, Number(score), Number(total), Number(timeUsed || 0)]
    );

    res.status(201).json({ success: true, data: { id: result.lastID } });
  } catch (error) {
    logger.error('保存测评记录失败:', error);
    res.status(500).json({ success: false, message: '保存测评记录失败' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const db = databaseManager.getDatabase();
    await ensureAttemptTable(db);
    const category = req.query.category;
    const difficulty = req.query.difficulty;
    const params = [];
    const where = [];
    if (CATEGORY_LABELS[category]) {
      where.push('qa.category = ?');
      params.push(category);
    }
    if (DIFFICULTY_SETTINGS[difficulty]) {
      where.push('qa.difficulty = ?');
      params.push(difficulty);
    }

    const rows = await dbAll(db, `SELECT qa.*, COALESCE(u.username, '未登录用户') as username
      FROM quiz_attempts qa
      LEFT JOIN users u ON u.id = qa.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY CAST(qa.score AS REAL) / qa.total DESC, qa.time_used ASC, qa.created_at DESC
      LIMIT 50`, params);

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('获取测评排行榜失败:', error);
    res.status(500).json({ success: false, message: '获取测评排行榜失败' });
  }
});

module.exports = router;
