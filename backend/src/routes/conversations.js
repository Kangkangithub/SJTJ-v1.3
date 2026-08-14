/**
 * 对话历史管理路由
 *
 * @description 提供对话和消息的 CRUD 操作
 * @storage SQLite（conversations + messages 表）
 * @security 对话历史必须绑定真实 JWT 登录态
 */
const express = require("express");
const router = express.Router();
const databaseManager = require("../config/database-simple");
const jwt = require("jsonwebtoken");
const config = require("../config");

// =============================================
// 对话历史认证中间件：只接受真实 JWT 用户身份
// =============================================
function requireConversationAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "请先登录后再保存对话记录" });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "请先登录后再保存对话记录" });
    }
    req.userId = userId;
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "请先登录后再保存对话记录" });
  }
}

// =============================================
// GET /api/conversations — 获取当前用户的对话列表
// =============================================
router.get("/", requireConversationAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const db = databaseManager.getDatabase();

    // 查询对话列表，按更新时间倒序
    const conversations = await new Promise((resolve, reject) => {
      db.all(
        "SELECT id, title, created_at, updated_at FROM conversations " +
        "WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
        [userId, limit, offset],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });

    // 查询总数
    const countResult = await new Promise((resolve, reject) => {
      db.get(
        "SELECT COUNT(*) AS total FROM conversations WHERE user_id = ?",
        [userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          page,
          limit,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      }
    });
  } catch (error) {
    console.error("[Conversations] 获取对话列表失败:", error.message);
    res.status(500).json({ success: false, message: "获取对话列表失败" });
  }
});

// =============================================
// POST /api/conversations — 创建新对话
// =============================================
router.post("/", requireConversationAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { title } = req.body;
    const conversationTitle = (title || "新对话").substring(0, 100);

    const db = databaseManager.getDatabase();

    const result = await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO conversations (user_id, title) VALUES (?, ?)",
        [userId, conversationTitle],
        function(err) { err ? reject(err) : resolve(this); }
      );
    });

    res.status(201).json({
      success: true,
      data: {
        id: result.lastID,
        title: conversationTitle,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[Conversations] 创建对话失败:", error.message);
    res.status(500).json({ success: false, message: "创建对话失败" });
  }
});

// =============================================
// GET /api/conversations/:id — 获取某对话的全部消息
// =============================================
router.get("/:id", requireConversationAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ success: false, message: "无效的对话ID" });
    }

    const db = databaseManager.getDatabase();

    // 验证对话属于当前用户
    const conversation = await new Promise((resolve, reject) => {
      db.get(
        "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?",
        [conversationId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "对话不存在或无权访问" });
    }

    // 获取所有消息
    const messages = await new Promise((resolve, reject) => {
      db.all(
        "SELECT id, role, content, sources, mode, created_at FROM messages " +
        "WHERE conversation_id = ? ORDER BY created_at ASC",
        [conversationId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });

    res.json({
      success: true,
      data: {
        ...conversation,
        messages
      }
    });
  } catch (error) {
    console.error("[Conversations] 获取对话详情失败:", error.message);
    res.status(500).json({ success: false, message: "获取对话详情失败" });
  }
});

// =============================================
// POST /api/conversations/:id/messages — 在对话中添加消息
// =============================================
router.post("/:id/messages", requireConversationAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ success: false, message: "无效的对话ID" });
    }

    const { role, content, sources, mode } = req.body;

    if (!role || !["user", "assistant"].includes(role)) {
      return res.status(400).json({ success: false, message: "role 必须是 user 或 assistant" });
    }
    if (!content || typeof content !== "string") {
      return res.status(400).json({ success: false, message: "content 为必填字段" });
    }

    const db = databaseManager.getDatabase();

    // 验证对话属于当前用户
    const conversation = await new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        [conversationId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "对话不存在或无权访问" });
    }

    // 插入消息
    const result = await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO messages (conversation_id, role, content, sources, mode) VALUES (?, ?, ?, ?, ?)",
        [conversationId, role, content, JSON.stringify(sources || []), mode || ""],
        function(err) { err ? reject(err) : resolve(this); }
      );
    });

    // 如果是用户消息（首条），自动更新对话标题
    if (role === "user") {
      const title = content.replace(/\n/g, " ").substring(0, 30) + (content.length > 30 ? "..." : "");
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE conversations SET title = CASE WHEN title = '新对话' THEN ? ELSE title END, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [title, conversationId],
          (err) => err ? reject(err) : resolve()
        );
      });
    } else {
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [conversationId],
          (err) => err ? reject(err) : resolve()
        );
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: result.lastID,
        conversation_id: conversationId,
        role,
        content,
        sources: sources || [],
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[Conversations] 添加消息失败:", error.message);
    res.status(500).json({ success: false, message: "添加消息失败" });
  }
});

// =============================================
// DELETE /api/conversations/:id — 删除对话（级联删除消息）
// =============================================
router.delete("/:id", requireConversationAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ success: false, message: "无效的对话ID" });
    }

    const db = databaseManager.getDatabase();

    // 验证对话属于当前用户
    const conversation = await new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        [conversationId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "对话不存在或无权访问" });
    }

    // 先删除所有关联消息，再删除对话
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM messages WHERE conversation_id = ?", [conversationId], (err) => err ? reject(err) : resolve());
    });
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM conversations WHERE id = ?", [conversationId], (err) => err ? reject(err) : resolve());
    });

    res.json({ success: true, message: "对话已删除" });
  } catch (error) {
    console.error("[Conversations] 删除对话失败:", error.message);
    res.status(500).json({ success: false, message: "删除对话失败" });
  }
});

// =============================================
// PUT /api/conversations/:id — 更新对话标题
// =============================================
router.put("/:id", requireConversationAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return res.status(400).json({ success: false, message: "无效的对话ID" });
    }

    const { title } = req.body;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ success: false, message: "title 为必填字段" });
    }

    const db = databaseManager.getDatabase();

    // 验证对话属于当前用户
    const conversation = await new Promise((resolve, reject) => {
      db.get(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        [conversationId, userId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "对话不存在或无权访问" });
    }

    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [title.substring(0, 100), conversationId],
        (err) => err ? reject(err) : resolve()
      );
    });

    res.json({ success: true, message: "标题已更新" });
  } catch (error) {
    console.error("[Conversations] 更新对话失败:", error.message);
    res.status(500).json({ success: false, message: "更新对话失败" });
  }
});

module.exports = router;