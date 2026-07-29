/**
 * Mock 数据接口 - 供前端开发（B）使用
 * 返回结构完整的示例数据，不依赖数据库
 */
const express = require('express');
const router = express.Router();

// 示例药材列表
const mockHerbs = [
  { id: 1, name: '人参', pinyin: 'renshen', alias: '白参', category_name: '补虚药',
    region_name: '吉林', description: '大补元气，复脉固脱，补脾益肺，生津养血', usage_dosage: '3-9g,另煎兑服' },
  { id: 2, name: '黄芪', pinyin: 'huangqi', alias: '北芪', category_name: '补虚药',
    region_name: '甘肃', description: '补气升阳，固表止汗，利水消肿', usage_dosage: '9-30g' },
  { id: 3, name: '当归', pinyin: 'danggui', alias: '全当归', category_name: '补虚药',
    region_name: '甘肃', description: '补血活血，调经止痛，润肠通便', usage_dosage: '6-12g' },
  { id: 4, name: '甘草', pinyin: 'gancao', alias: '国老', category_name: '补虚药',
    region_name: '甘肃', description: '补脾益气，清热解毒，祛痰止咳，调和诸药', usage_dosage: '2-10g' },
  { id: 5, name: '麻黄', pinyin: 'mahuang', category_name: '解表药',
    region_name: '山西', description: '发汗解表，宣肺平喘，利水消肿', usage_dosage: '2-10g' },
];

// 示例方剂
const mockFormulas = [
  { id: 1, name: '四君子汤', pinyin: 'sijunzitang', category: '补益剂',
    description: '益气健脾。主治脾胃气虚证。', source: '《太平惠民和剂局方》' },
  { id: 2, name: '四物汤', pinyin: 'siwutang', category: '补益剂',
    description: '补血调血。主治营血虚滞证。', source: '《太平惠民和剂局方》' },
];

// 示例性味归经
const mockProperties = [
  { id: 1, name: '寒', type: 'qi', description: '能清热泻火' },
  { id: 2, name: '热', type: 'qi', description: '能温里散寒' },
  { id: 3, name: '甘', type: 'flavor', description: '能补能和能缓' },
  { id: 4, name: '辛', type: 'flavor', description: '能散能行' },
];

const mockMeridians = [
  { id: 1, name: '肝', abbreviation: 'LR' },
  { id: 2, name: '心', abbreviation: 'HT' },
  { id: 3, name: '脾', abbreviation: 'SP' },
  { id: 4, name: '肺', abbreviation: 'LU' },
  { id: 5, name: '肾', abbreviation: 'KI' },
];

// =============================================
// GET /api/mock — Mock 数据总览
// =============================================
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '神农AI Mock 数据接口',
    note: '返回结构完整的示例数据供前端开发使用',
    endpoints: {
      herbs: '/api/mock/herbs',
      herbDetail: '/api/mock/herbs/1',
      categories: '/api/mock/herb-categories',
      regions: '/api/mock/herb-regions',
      formulas: '/api/mock/formulas',
      knowledgeGraph: '/api/mock/knowledge-graph',
      chat: '/api/mock/chat',
    }
  });
});

// =============================================
// Mock 药材列表
// =============================================
router.get('/herbs', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  res.json({
    success: true,
    data: {
      herbs: mockHerbs.slice(0, parseInt(limit)),
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(mockHerbs.length / parseInt(limit)),
        total_items: mockHerbs.length,
        items_per_page: parseInt(limit)
      }
    }
  });
});

// =============================================
// Mock 药材详情
// =============================================
router.get('/herbs/:id', (req, res) => {
  const herb = mockHerbs.find(h => h.id == req.params.id) || mockHerbs[0];
  res.json({
    success: true,
    data: {
      ...herb,
      properties: [
        { id: 1, name: '甘', type: 'flavor', intensity: 'normal' },
        { id: 2, name: '温', type: 'qi', intensity: 'normal' },
      ],
      meridians: [
        { id: 1, name: '脾', abbreviation: 'SP' },
        { id: 2, name: '肺', abbreviation: 'LU' },
      ],
      efficacies: [
        { id: 1, name: '补气' },
        { id: 2, name: '益气健脾' },
      ],
      images: [],
      quality: {}
    }
  });
});

// =============================================
// Mock 分类/产地/来源列表
// =============================================
router.get('/herb-categories', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '解表药', description: '以发散表邪为主要功效' },
      { id: 2, name: '清热药', description: '以清解里热为主要功效' },
      { id: 3, name: '补虚药', description: '以补益正气为主要功效' },
      { id: 4, name: '理气药', description: '以疏理气机为主要功效' },
      { id: 5, name: '活血化瘀药', description: '以通畅血行为主要功效' },
    ]
  });
});

router.get('/herb-regions', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '甘肃', description: '西北道地产区' },
      { id: 2, name: '四川', description: '西南道地产区' },
      { id: 3, name: '吉林', description: '东北道地产区' },
    ]
  });
});

router.get('/herb-sources', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '植物', description: '来源于植物的根、茎、叶、花、果实、种子等' },
      { id: 2, name: '动物', description: '来源于动物全体或部分组织' },
    ]
  });
});

// =============================================
// Mock 方剂
// =============================================
router.get('/formulas', (req, res) => {
  res.json({
    success: true,
    data: { formulas: mockFormulas }
  });
});

router.get('/formulas/:id', (req, res) => {
  const formula = mockFormulas.find(f => f.id == req.params.id) || mockFormulas[0];
  res.json({
    success: true,
    data: {
      ...formula,
      herbs: [
        { id: 1, name: '人参', dosage: '9g', role: '君' },
        { id: 2, name: '白术', dosage: '9g', role: '臣' },
        { id: 3, name: '茯苓', dosage: '9g', role: '佐' },
        { id: 4, name: '甘草', dosage: '6g', role: '使' },
      ]
    }
  });
});

// =============================================
// Mock 知识图谱
// =============================================
router.get('/knowledge-graph', (req, res) => {
  res.json({
    success: true,
    data: {
      nodes: [
        ...mockHerbs.map(h => ({ id: `herb_${h.id}`, labels: ['Herb'], properties: { name: h.name } })),
        { id: 'category_1', labels: ['Category'], properties: { name: '补虚药' } },
        { id: 'category_2', labels: ['Category'], properties: { name: '解表药' } },
        { id: 'region_1', labels: ['Region'], properties: { name: '甘肃' } },
      ],
      links: [
        { source: 'herb_1', target: 'category_1', type: '属于' },
        { source: 'herb_2', target: 'category_1', type: '属于' },
        { source: 'herb_3', target: 'category_1', type: '属于' },
        { source: 'herb_5', target: 'category_2', type: '属于' },
        { source: 'herb_1', target: 'region_1', type: '产自' },
      ]
    }
  });
});

// =============================================
// Mock AI 问答
// =============================================
router.post('/chat', (req, res) => {
  const { question } = req.body;
  res.json({
    success: true,
    data: {
      answer: `关于「${question}」的查询结果：\n\n**人参**（renshen）\n- 分类：补虚药\n- 性味：甘、微苦，微温\n- 归经：脾、肺、心、肾\n- 功效：大补元气，复脉固脱，补脾益肺，生津养血\n- 用量：3-9g，另煎兑服\n\n⚠️ 不宜与藜芦、五灵脂同用。`,
      offline: true,
      sources: {
        herbs: mockHerbs.slice(0, 1),
        formulas: []
      }
    }
  });
});

module.exports = router;
