const Database = require('better-sqlite3');
const path = require('path');

// 确保数据目录存在
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database('./data/database.db');

// 创建用户表
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

try {
    db.exec(createUsersTable);
    console.log('✅ 用户表创建成功');
    
    // 检查表结构
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('📋 现有表:', tables);
    
    // 检查用户表的列结构
    const columns = db.prepare("PRAGMA table_info(users)").all();
    console.log('📊 用户表结构:', columns);
    
} catch (error) {
    console.error('❌ 数据库初始化失败:', error);
} finally {
    db.close();
    console.log('🔒 数据库连接已关闭');
}