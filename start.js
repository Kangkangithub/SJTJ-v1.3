#!/usr/bin/env node
/**
 * 神农AI 一键启动脚本（跨平台）
 * 用法：
 *   Windows     双击 start.bat，或执行 node start.js
 *   macOS/Linux 执行 ./start.sh，或 node start.js
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const ROOT = __dirname;
const BACKEND = path.join(ROOT, 'backend');
const PORT = process.env.PORT || '3001';
const ENTRY_URL = 'http://localhost:' + PORT + '/index.html';

function log(msg) {
  console.log(msg);
}

// 判断端口是否被占用
function isPortInUse(port) {
  return new Promise(function (resolve) {
    const socket = net.connect({ port: Number(port), host: '127.0.0.1' });
    socket.setTimeout(800);
    socket.once('connect', function () { socket.destroy(); resolve(true); });
    socket.once('timeout', function () { socket.destroy(); resolve(false); });
    socket.once('error', function () { resolve(false); });
  });
}

// 释放端口（关闭占用 3001 的旧实例）
function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano | findstr :' + port + ' | findstr LISTENING', { shell: 'cmd.exe', encoding: 'utf8' });
      const pids = new Set();
      out.split(/\r?\n/).forEach(function (line) {
        const m = line.trim().match(/(\d+)\s*$/);
        if (m) pids.add(m[1]);
      });
      pids.forEach(function (pid) {
        try { execSync('taskkill /F /PID ' + pid, { shell: 'cmd.exe', stdio: 'ignore' }); } catch (e) {}
      });
    } else {
      execSync('lsof -ti:' + port + ' | xargs kill -9 2>/dev/null || true', { shell: '/bin/bash' });
    }
  } catch (e) {}
}

// 打开浏览器
function openBrowser(url) {
  try {
    if (process.platform === 'win32') execSync('start "" "' + url + '"', { shell: 'cmd.exe' });
    else if (process.platform === 'darwin') execSync('open "' + url + '"', { shell: '/bin/bash' });
    else execSync('xdg-open "' + url + '"', { shell: '/bin/bash' });
  } catch (e) {
    console.log('请手动在浏览器打开：' + url);
  }
}

// 等待服务就绪
async function waitForServer(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortInUse(port)) return true;
    await new Promise(function (r) { setTimeout(r, 500); });
  }
  return false;
}

async function main() {
  console.log('');
  console.log('====================================================');
  console.log('  神农AI — 中医药知识图谱与 Agentic RAG 问答系统');
  console.log('  一键启动');
  console.log('====================================================');
  console.log('');

  // 1. 检查 Node.js
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    console.error('[错误] 需要 Node.js 18 或更高版本，当前：v' + process.versions.node);
    console.error('请到 https://nodejs.org 下载安装。');
    process.exit(1);
  }
  log('✓ Node.js v' + process.versions.node);

  // 2. 检查 .env
  const envPath = path.join(BACKEND, '.env');
  const envExample = path.join(BACKEND, '.env.example');
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envPath);
      log('! 未检测到 backend/.env，已根据 .env.example 自动创建。');
      log('  请先编辑 backend/.env，填入 Neo4j 连接信息和 DeepSeek API Key，再重新启动。');
      process.exit(0);
    } else {
      console.error('[错误] 缺少 backend/.env 配置文件');
      process.exit(1);
    }
  } else {
    log('✓ 已检测到 backend/.env');
  }

  // 3. 检查依赖
  if (!fs.existsSync(path.join(BACKEND, 'node_modules'))) {
    log('⏳ 首次运行，正在安装后端依赖（npm install，可能需要几分钟）...');
    try {
      execSync('npm install', { cwd: BACKEND, stdio: 'inherit' });
    } catch (e) {
      console.error('[错误] 依赖安装失败，请手动在 backend 目录执行 npm install');
      process.exit(1);
    }
  } else {
    log('✓ 后端依赖已就绪');
  }

  // 4. 释放端口（如果有旧实例）
  if (await isPortInUse(PORT)) {
    log('! 端口 ' + PORT + ' 已被占用，正在关闭旧实例...');
    freePort(PORT);
    await new Promise(function (r) { setTimeout(r, 1000); });
  }

  // 5. 启动后端服务
  log('🚀 正在启动后端服务（端口 ' + PORT + '）...');
  log('');
  const child = spawn(process.execPath, ['src/app-simple.js'], {
    cwd: BACKEND,
    stdio: 'inherit'
  });

  // 6. 等待就绪后自动打开浏览器
  const ready = await waitForServer(PORT, 30000);
  if (ready) {
    log('');
    log('🌐 前端入口：' + ENTRY_URL);
    openBrowser(ENTRY_URL);
  } else {
    log('');
    log('服务启动较慢，请稍后手动访问：' + ENTRY_URL);
  }

  child.on('exit', function (code) {
    log('');
    log('服务器已停止。');
    process.exit(code || 0);
  });
}

main();