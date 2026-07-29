#!/bin/bash
# =============================================
# 神农AI - 药材知识库 一键部署脚本
# =============================================

set -e

echo "================================"
echo "  神农AI - 药材知识库系统部署"
echo "================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 14+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
echo "✅ Node.js $(node -v)"

# 进入 backend 目录
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install

# 创建必要目录
mkdir -p data uploads/herbs logs

# 初始化数据库
echo ""
echo "🗄️ 初始化药材数据库..."
node scripts/init-herb-data.js

# 启动服务
echo ""
echo "🚀 启动服务器..."
echo ""
echo "================================"
echo "  部署完成！"
echo ""
echo "  📍 本地访问: http://localhost:3001"
echo "  📍 健康检查: http://localhost:3001/health"
echo "  📍 API 文档: http://localhost:3001/api"
echo ""
echo "  管理员账户:"
echo "    用户名: JunkangShen"
echo "    密码: kk20050318"
echo "================================"

# 使用 PM2 启动（如果已安装）或直接启动
if command -v pm2 &> /dev/null; then
    echo ""
    echo "📡 使用 PM2 启动..."
    pm2 start src/app-simple.js --name "herb-knowledge"
    pm2 save
    pm2 status
else
    echo ""
    echo "📡 直接启动 (nohup)..."
    nohup node src/app-simple.js > logs/app.log 2>&1 &
    echo "PID: $!"
    echo "日志: logs/app.log"
fi

echo ""
echo "✅ 部署完成！"
