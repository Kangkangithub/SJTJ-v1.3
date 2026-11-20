/**
 * 访问统计（MVP）
 *
 * 设计原则：请求链路零阻塞。
 * - 请求结束（res finish）后只做内存 push
 * - 每 5 秒或缓冲满 200 条批量落库
 * - 落库失败不影响响应
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");
const databaseManager = require("../config/database-simple");

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 200;
const MAX_BUFFER = 2000;
const CHUNK_SIZE = 50;
const RETENTION_DAYS = 90;

const SKIP_PREFIXES = [
  "/uploads", "/public", "/assets", "/img", "/css", "/js",
  "/favicon", "/health", "/api/analytics"
];
const SKIP_EXT = /\.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|map|mp4|webm|mov)$/i;

const buffer = [];
let timer = null;
let retentionTimer = null;

function shouldSkip(req) {
  if (!req.path) return true;
  if (req.method === "OPTIONS") return true;
  if (SKIP_EXT.test(req.path)) return true;
  return SKIP_PREFIXES.some(prefix => req.path === prefix || req.path.startsWith(prefix + "/"));
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function getSessionId(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.t_sid && /^[a-f0-9]{16,64}$/i.test(cookies.t_sid)) return cookies.t_sid;
  const sid = crypto.randomBytes(16).toString("hex");
  res.append("Set-Cookie", "t_sid=" + sid + "; Path=/; Max-Age=15552000; SameSite=Lax");
  return sid;
}

function getUserId(req) {
  const header = req.headers.authorization;
  const token = header && header.split(" ")[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return decoded.userId || decoded.id || null;
  } catch (error) {
    return null;
  }
}

function hashIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (forwarded ? String(forwarded).split(",")[0] : req.socket.remoteAddress) || "";
  const salt = process.env.TRAFFIC_SALT || "shennong-traffic";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 24);
}

function nowSql() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function flush() {
  if (!buffer.length) return;
  let db;
  try {
    db = databaseManager.getDatabase();
  } catch (error) {
    return; // 数据库还没初始化，保留缓冲下次再写
  }

  const rows = buffer.splice(0, buffer.length);
  const chunks = [];
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) chunks.push(rows.slice(i, i + CHUNK_SIZE));

  db.serialize(() => {
    db.run("BEGIN IMMEDIATE");
    let pending = chunks.length;
    let failed = false;

    const done = () => {
      if (--pending > 0) return;
      if (failed) {
        db.run("ROLLBACK");
        return;
      }
      db.run("COMMIT", err => {
        if (err) console.error("[traffic] commit failed:", err.message);
      });
    };

    chunks.forEach(chunk => {
      const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
      const params = [];
      chunk.forEach(r => params.push(
        r.ts, r.kind, r.path, r.method, r.status, r.duration_ms,
        r.user_id, r.session_id, r.ip_hash, r.ua, r.referer, r.query
      ));
      db.run(
        `INSERT INTO traffic_events (ts,kind,path,method,status,duration_ms,user_id,session_id,ip_hash,ua,referer,query) VALUES ${placeholders}`,
        params,
        err => {
          if (err) {
            failed = true;
            console.error("[traffic] insert failed:", err.message);
          }
          done();
        }
      );
    });
  });
}

function middleware() {
  return function trafficMiddleware(req, res, next) {
    if (shouldSkip(req)) return next();

    const startedAt = process.hrtime.bigint();
    const sessionId = getSessionId(req, res);
    // 路由匹配过程中 req.url / req.path 会被改写，入口处先取出真实路径
    const pathAtStart = (req.originalUrl || req.url || "").split("?")[0];
    const queryAtStart = req.query && req.query.q ? String(req.query.q).slice(0, 100) : null;

    res.on("finish", () => {
      try {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const kind = pathAtStart.startsWith("/api/ai-engine") || pathAtStart.startsWith("/api/ai-gateway")
          ? "ai"
          : (pathAtStart.startsWith("/api/") ? "api" : "page");

        buffer.push({
          ts: nowSql(),
          kind,
          path: pathAtStart,
          method: req.method,
          status: res.statusCode,
          duration_ms: Math.round(durationMs * 100) / 100,
          user_id: getUserId(req),
          session_id: sessionId,
          ip_hash: hashIp(req),
          ua: String(req.headers["user-agent"] || "").slice(0, 300),
          referer: String(req.headers.referer || "").slice(0, 300),
          query: queryAtStart
        });

        if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
        if (buffer.length >= FLUSH_THRESHOLD) flush();
      } catch (error) {
        // 统计失败永远不影响业务
      }
    });

    next();
  };
}

function start() {
  if (timer) return;
  timer = setInterval(flush, FLUSH_INTERVAL_MS);
  if (timer.unref) timer.unref();

  retentionTimer = setInterval(() => {
    try {
      const db = databaseManager.getDatabase();
      db.run("DELETE FROM traffic_events WHERE ts < datetime('now', ?)", [`-${RETENTION_DAYS} days`], err => {
        if (err) console.error("[traffic] retention failed:", err.message);
      });
    } catch (error) {
      // ignore
    }
  }, 6 * 60 * 60 * 1000);
  if (retentionTimer.unref) retentionTimer.unref();
}

function all(sql, params) {
  return new Promise((resolve, reject) => {
    let db;
    try {
      db = databaseManager.getDatabase();
    } catch (error) {
      reject(error);
      return;
    }
    db.all(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

const RANGE_HOURS = { "1h": 1, "24h": 24, "7d": 168, "30d": 720 };

function parseRange(value) {
  const range = RANGE_HOURS[value] ? value : "24h";
  const hours = RANGE_HOURS[range];
  return { range, hours, modifier: `-${hours} hours` };
}

async function getSummary(rangeInfo) {
  const rows = await all(
    `SELECT COUNT(*) AS pv,
            COUNT(DISTINCT session_id) AS uv,
            SUM(CASE WHEN kind IN ('api','ai') THEN 1 ELSE 0 END) AS api_calls,
            SUM(CASE WHEN kind = 'ai' THEN 1 ELSE 0 END) AS ai_calls,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors,
            AVG(duration_ms) AS avg_ms
     FROM traffic_events WHERE ts >= datetime('now', ?)`,
    [rangeInfo.modifier]
  );
  const row = rows[0] || {};
  const pv = Number(row.pv || 0);
  return {
    pv,
    uv: Number(row.uv || 0),
    apiCalls: Number(row.api_calls || 0),
    aiCalls: Number(row.ai_calls || 0),
    errors: Number(row.errors || 0),
    avgMs: Math.round(Number(row.avg_ms || 0) * 10) / 10,
    errorRate: pv ? Math.round((Number(row.errors || 0) / pv) * 10000) / 100 : 0
  };
}

async function getTimeseries(rangeInfo) {
  const format = rangeInfo.hours <= 48 ? "%Y-%m-%d %H:00" : "%Y-%m-%d";
  return all(
    `SELECT strftime('${format}', ts) AS bucket,
            COUNT(*) AS pv,
            COUNT(DISTINCT session_id) AS uv
     FROM traffic_events
     WHERE ts >= datetime('now', ?)
     GROUP BY bucket ORDER BY bucket`,
    [rangeInfo.modifier]
  );
}

async function getTop(rangeInfo) {
  const pages = await all(
    `SELECT path, COUNT(*) AS count FROM traffic_events
     WHERE ts >= datetime('now', ?) AND kind = 'page'
     GROUP BY path ORDER BY count DESC LIMIT 10`,
    [rangeInfo.modifier]
  );
  const apis = await all(
    `SELECT path, COUNT(*) AS count FROM traffic_events
     WHERE ts >= datetime('now', ?) AND kind IN ('api','ai')
     GROUP BY path ORDER BY count DESC LIMIT 10`,
    [rangeInfo.modifier]
  );
  const searches = await all(
    `SELECT query, COUNT(*) AS count FROM traffic_events
     WHERE ts >= datetime('now', ?) AND path = '/api/herbs/search' AND query IS NOT NULL AND query <> ''
     GROUP BY query ORDER BY count DESC LIMIT 10`,
    [rangeInfo.modifier]
  );
  return { pages, apis, searches };
}

async function getRecentErrors(rangeInfo) {
  return all(
    `SELECT ts, method, path, status, duration_ms FROM traffic_events
     WHERE ts >= datetime('now', ?) AND status >= 400
     ORDER BY ts DESC LIMIT 12`,
    [rangeInfo.modifier]
  );
}

// 概览结果短缓存：仅用于合并多个管理员标签页的自动刷新。
// 手动切换范围/点刷新会带 fresh=1 直接绕过缓存。
const OVERVIEW_TTL_MS = 3000;
const overviewCache = new Map();

async function getOverview(rangeValue, options) {
  const rangeInfo = parseRange(rangeValue);
  const fresh = !!(options && options.fresh);

  // 先把内存缓冲落库：flush 与后续查询在同一条连接上按序执行，
  // 手动刷新能立刻看到最近几秒产生的访问，而不是等 5 秒定时落库。
  try { flush(); } catch (error) { /* 统计失败不影响查询 */ }

  if (!fresh) {
    const cached = overviewCache.get(rangeInfo.range);
    if (cached && Date.now() - cached.at < OVERVIEW_TTL_MS) return cached.data;
  }

  const [summary, timeseries, top, recentErrors] = await Promise.all([
    getSummary(rangeInfo),
    getTimeseries(rangeInfo),
    getTop(rangeInfo),
    getRecentErrors(rangeInfo)
  ]);
  const data = {
    range: rangeInfo.range,
    summary,
    timeseries,
    topPages: top.pages,
    topApis: top.apis,
    topSearches: top.searches,
    recentErrors
  };
  overviewCache.set(rangeInfo.range, { at: Date.now(), data });
  return data;
}

module.exports = { middleware, start, flush, getOverview };
