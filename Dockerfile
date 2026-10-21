# ===== 阶段 1：构建（安装生产依赖）=====
FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# ===== 阶段 2：运行 =====
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# 生产依赖
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# 后端 + 前端（前端由 Express 静态托管）
COPY backend ./backend
COPY frontend ./frontend

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "backend/src/app-simple.js"]