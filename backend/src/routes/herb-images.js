const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const databaseManager = require('../config/database-simple');
const logger = require('../utils/logger');

const HERB_IMAGE_DIR = path.join(__dirname, '../../uploads/herbs');

function resolveHerbImages(herbName, dbImages) {
  if (dbImages && dbImages.length > 0) return dbImages;
  const filename = `${herbName}.png`;
  const filePath = path.join(HERB_IMAGE_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  return [{
    id: `fallback_${herbName}`,
    filename,
    originalName: filename,
    path: `/uploads/herbs/${filename}`,
    size: fs.statSync(filePath).size,
    description: '',
    uploadedAt: null
  }];
}

// 配置 multer 文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/herbs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'herb-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif, webp)'));
  }
});

// 获取药材的所有图片
router.get('/:herbId', async (req, res) => {
  try {
    let herbId = parseInt(req.params.herbId);
    if (isNaN(herbId)) {
      return res.status(400).json({ success: false, message: '无效的药材ID格式' });
    }

    const db = databaseManager.getDatabase();
    const herb = await new Promise((resolve, reject) => {
      db.get('SELECT id, name, images FROM herbs WHERE id = ?', [herbId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!herb) return res.status(404).json({ success: false, message: '药材不存在' });

    let images = [];
    try { images = herb.images ? JSON.parse(herb.images) : []; } catch (e) { images = []; }
    images = resolveHerbImages(herb.name, images);

    res.json({ success: true, data: { herbId, herbName: herb.name, images } });
  } catch (error) {
    logger.error('获取药材图片失败:', error);
    res.status(500).json({ success: false, message: '获取药材图片失败' });
  }
});

// 上传药材图片
router.post('/:herbId', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const herbId = req.params.herbId;
    const { description } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: '请选择要上传的图片' });

    const db = databaseManager.getDatabase();

    const herb = await new Promise((resolve, reject) => {
      db.get('SELECT images FROM herbs WHERE id = ?', [herbId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!herb) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: '药材不存在' });
    }

    let images = [];
    try { images = herb.images ? JSON.parse(herb.images) : []; } catch (e) { images = []; }

    const newImage = {
      id: Date.now(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/herbs/${req.file.filename}`,
      size: req.file.size,
      description: description || '',
      uploadedAt: new Date().toISOString()
    };

    images.push(newImage);

    await new Promise((resolve, reject) => {
      db.run('UPDATE herbs SET images = ?, updated_at = datetime("now") WHERE id = ?',
        [JSON.stringify(images), herbId],
        function(err) { if (err) reject(err); else resolve(); }
      );
    });

    logger.info(`药材图片上传成功: 药材ID ${herbId}, 文件 ${req.file.filename}`);
    res.json({ success: true, message: '图片上传成功', data: { image: newImage } });
  } catch (error) {
    logger.error('上传药材图片失败:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: '上传图片失败' });
  }
});

// 删除药材图片
router.delete('/:herbId/:imageId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const herbId = req.params.herbId;
    const imageId = parseInt(req.params.imageId);

    const db = databaseManager.getDatabase();
    const herb = await new Promise((resolve, reject) => {
      db.get('SELECT images FROM herbs WHERE id = ?', [herbId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!herb) return res.status(404).json({ success: false, message: '药材不存在' });

    let images = [];
    try { images = herb.images ? JSON.parse(herb.images) : []; } catch (e) { images = []; }

    const imageIndex = images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return res.status(404).json({ success: false, message: '图片不存在' });

    const imageToDelete = images[imageIndex];
    const filePath = path.join(__dirname, '../../uploads/herbs', imageToDelete.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    images.splice(imageIndex, 1);

    await new Promise((resolve, reject) => {
      db.run('UPDATE herbs SET images = ?, updated_at = datetime("now") WHERE id = ?',
        [JSON.stringify(images), herbId],
        function(err) { if (err) reject(err); else resolve(); }
      );
    });

    logger.info(`药材图片删除成功: 药材ID ${herbId}, 图片ID ${imageId}`);
    res.json({ success: true, message: '图片删除成功' });
  } catch (error) {
    logger.error('删除药材图片失败:', error);
    res.status(500).json({ success: false, message: '删除图片失败' });
  }
});

// 更新图片描述
router.put('/:herbId/:imageId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const herbId = req.params.herbId;
    const imageId = parseInt(req.params.imageId);
    const { description } = req.body;

    const db = databaseManager.getDatabase();
    const herb = await new Promise((resolve, reject) => {
      db.get('SELECT images FROM herbs WHERE id = ?', [herbId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!herb) return res.status(404).json({ success: false, message: '药材不存在' });

    let images = [];
    try { images = herb.images ? JSON.parse(herb.images) : []; } catch (e) { images = []; }

    const imageIndex = images.findIndex(img => img.id === imageId);
    if (imageIndex === -1) return res.status(404).json({ success: false, message: '图片不存在' });

    images[imageIndex].description = description || '';
    images[imageIndex].updatedAt = new Date().toISOString();

    await new Promise((resolve, reject) => {
      db.run('UPDATE herbs SET images = ?, updated_at = datetime("now") WHERE id = ?',
        [JSON.stringify(images), herbId],
        function(err) { if (err) reject(err); else resolve(); }
      );
    });

    res.json({ success: true, message: '图片描述更新成功', data: { image: images[imageIndex] } });
  } catch (error) {
    logger.error('更新图片描述失败:', error);
    res.status(500).json({ success: false, message: '更新图片描述失败' });
  }
});

module.exports = router;
