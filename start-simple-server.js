#!/usr/bin/env node

/**
 * 启动简化版后端服务器
 * 使用SQLite数据库，适合开发和演示
 */

const path = require('path');
const fs = require('fs');

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '3001';

// 检查必要的目录和文件
const backendDir = path.join(__dirname, 'backend');
const srcDir = path.join(backendDir, 'src');
const dataDir = path.join(backendDir, 'data');
const uploadsDir = path.join(backendDir, 'uploads');

// 创建必要的目录
[dataDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录: ${dir}`);
  }
});

// 检查关键文件是否存在
const requiredFiles = [
  path.join(srcDir, 'app-simple.js'),
  path.join(srcDir, 'config', 'database-simple.js')
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
  console.error('缺少必要文件:');
  missingFiles.forEach(file => console.error(`  - ${file}`));
  console.error('请确保所有后端文件都已正确创建');
  process.exit(1);
}

// 启动服务器
console.log('正在启动神农AI药材知识库服务...');
console.log(`环境: ${process.env.NODE_ENV}`);
console.log(`端口: ${process.env.PORT}`);
console.log(`数据库: SQLite (herb-knowledge.db)`);
console.log('');

try {
  // 导入并启动应用
  const SimpleApp = require('./backend/src/app-simple.js');
  const app = new SimpleApp();

  app.start().then(() => {
    console.log('');
    console.log('🚀 服务器启动成功！');
    console.log('');
    console.log('可用的API端点:');
    console.log(`  - 健康检查: http://localhost:${process.env.PORT}/health`);
    console.log(`  - API文档: http://localhost:${process.env.PORT}/api`);
    console.log(`  - 药材管理: http://localhost:${process.env.PORT}/api/herbs`);
    console.log(`  - 知识图谱数据: http://localhost:${process.env.PORT}/api/knowledge/graph-data?common=1`);
    console.log('');
    console.log('前端页面:');
    console.log(`  - 知识图谱: 打开 knowledge-graph.html`);
    console.log('');
    console.log('按 Ctrl+C 停止服务器');
  }).catch(error => {
    console.error('服务器启动失败:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('启动过程中出错:', error);
  process.exit(1);
}