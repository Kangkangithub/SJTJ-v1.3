/**
 * 神农AI 问答页
 * 只展示真实后端接口结果；未登录时仅保留当前浏览器临时对话。
 */

var API_BASE = (function(){
  var h = window.location.hostname, p = window.location.port;
  if ((h === "localhost" || h === "127.0.0.1") && p === "3001") return "";
  return "http://localhost:3001";
})();

var _busy = false;
var _marked = null;
var _abort = null;
var _allowPendingNavigation = false;
var LEAVE_WARNING = "回答仍在生成，离开后本次回答可能不会保存。";
var _d3sim = null;
var SESSION_KEY = "graphrag_temp_history";
var QA_FORMAT_INSTRUCTION = [
  "回答格式要求：中文正文使用完整自然句，不要把一句话拆成多行。标点必须紧跟前文，不要单独换行。加粗只用于少量重点词、风险提示或专有名词，不要随机加粗零散短词。同一组同类内容的格式必须统一，不要出现有的加粗、有的不加粗。‘药材：...’和‘方剂：...’这类参考信息中，仅加粗标签，名称保持普通文本。‘一句话总结：内容’必须同一行展示，不要把冒号换到下一行。列表只用于并列要点，不要把一句话拆成多个列表项。不要输出多余空行或碎片化短行。如果包含代码块、Cypher、表格或引用，请保持原结构完整。"
].join("\n");
var conversations = [];
var currentConversationId = null;
var cloudHistoryEnabled = false;

function esc(s) {
  if (typeof s !== "string") return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function escA(s) {
  return String(s || "")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toast(msg, type) {
  var old = document.querySelector(".qa-toast");
  if (old) old.remove();
  var t = document.createElement("div");
  t.className = "qa-toast " + (type || "info");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){
    t.style.opacity = "0";
    t.style.transition = "opacity 0.3s";
    setTimeout(function(){ if (t.parentNode) t.remove(); }, 300);
  }, 2500);
}

function cw() { return document.querySelector(".chat-window"); }

function nowTime(value) {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) return value;
  var d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) d = new Date();
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getAuthToken() {
  return localStorage.getItem("authToken") || localStorage.getItem("token") || "";
}

function getUserInfo() {
  try { return JSON.parse(localStorage.getItem("userInfo") || "{}"); }
  catch (e) { return {}; }
}

function hasLoginState() {
  return Boolean(getAuthToken());
}

function buildMessageAvatar(role) {
  if (role !== "user") return '<i class="fas fa-brain"></i>';
  var user = getUserInfo() || {};
  var avatar = user.avatar || (user.profile && user.profile.avatar) || "";
  if (typeof avatar === "string" && avatar.indexOf("data:image/") === 0) {
    return '<img class="message-avatar-image" src="' + escA(avatar) + '" alt="用户头像">';
  }
  var label = user.name || user.username || user.email || "";
  var initial = String(label || "用").trim().slice(0, 1).toUpperCase() || "用";
  return '<span class="message-avatar-initial">' + esc(initial) + '</span>';
}

function clearInvalidLoginState() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("token");
  localStorage.removeItem("userInfo");
}

function authHeaders(extra) {
  var headers = Object.assign({}, extra || {});
  var token = getAuthToken();
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

async function apiJson(path, options) {
  var opts = options || {};
  var headers = authHeaders(opts.headers || {});
  var resp = await fetch(API_BASE + path, Object.assign({}, opts, { headers: headers }));
  if (resp.status === 401 || resp.status === 403) {
    cloudHistoryEnabled = false;
    clearInvalidLoginState();
    throw new Error("AUTH_REQUIRED");
  }
  var data = await resp.json().catch(function(){ return {}; });
  if (!resp.ok || data.success === false) throw new Error(data.message || "REQUEST_FAILED");
  return data;
}

function normalizeAnswerText(value) {
  if (typeof value !== "string") return "";
  if (!value) return "";
  return value
    .replace(/\r\n/g, "\n")
    .split(/(```[\s\S]*?```)/g)
    .map(function(part) {
      if (part.indexOf("```") === 0) return part;
      return normalizeAnswerTextBlock(part);
    })
    .join("")
    .replace(/([^\n])```/g, "$1\n```")
    .replace(/(```[\s\S]*?```)([^\n])/g, "$1\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeAnswerTextBlock(text) {
  var lines = mergePunctuationContinuationLines(String(text || "").split("\n"));
  var out = [];
  var paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(paragraph.reduce(joinInlineText));
    paragraph = [];
  }

  lines.forEach(function(line) {
    var raw = String(line || "").replace(/\s+$/g, "");
    var trimmed = raw.trim();
    if (!trimmed) {
      flushParagraph();
      if (out.length && out[out.length - 1] !== "") out.push("");
      return;
    }
    if (isMarkdownStructureLine(trimmed)) {
      flushParagraph();
      out.push(raw);
      return;
    }
    paragraph.push(trimmed);
  });

  flushParagraph();
  return out.join("\n");
}

function mergePunctuationContinuationLines(lines) {
  var merged = [];
  lines.forEach(function(line) {
    var text = String(line || "");
    var match = text.match(/^\s*([，。；：！？、,.!?;:])\s*(.*)$/);
    if (match && merged.length && merged[merged.length - 1].trim()) {
      merged[merged.length - 1] = merged[merged.length - 1].replace(/\s+$/g, "") + normalizeLeadingPunctuation(match[1]) + match[2].replace(/^\s+/g, "");
      return;
    }
    merged.push(text);
  });
  return merged;
}

function normalizeLeadingPunctuation(mark) {
  if (mark === ":") return "：";
  if (mark === ",") return "，";
  if (mark === ";") return "；";
  if (mark === "!") return "！";
  if (mark === "?") return "？";
  return mark;
}

function isMarkdownStructureLine(line) {
  var text = String(line || "").trim();
  return /^(#{1,6})\s+/.test(text) ||
    /^([-*+])\s+\S/.test(text) ||
    /^\d+[.)]\s+\S/.test(text) ||
    /^>\s?/.test(text) ||
    /^\|.*\|$/.test(text) ||
    /^\s*[-*_]{3,}\s*$/.test(text);
}

function joinInlineText(left, right) {
  var l = String(left || "").replace(/\s+$/g, "");
  var r = String(right || "").replace(/^\s+/g, "");
  if (!l) return r;
  if (!r) return l;
  var punct = r.match(/^([，。；：！？、,.!?;:])\s*(.*)$/);
  if (punct) return l + normalizeLeadingPunctuation(punct[1]) + punct[2];
  if (/[A-Za-z0-9]$/.test(l) && /^[A-Za-z0-9]/.test(r)) return l + " " + r;
  return l + r;
}

function normalizeAnswerEmphasis(value) {
  if (typeof value !== "string") return "";
  return value.split(/(```[\s\S]*?```)/g).map(function(part) {
    if (part.indexOf("```") === 0) return part;
    return part.split("\n").map(normalizeReferenceLineEmphasis).join("\n");
  }).join("");
}

function normalizeReferenceLineEmphasis(line) {
  var text = String(line || "");
  var match = text.match(/^(\s*)\*\*(药材|方剂)\s*[：:]\*\*\s*(.*)$/) ||
    text.match(/^(\s*)\*\*(药材|方剂)\*\*\s*[：:]\s*(.*)$/) ||
    text.match(/^(\s*)(药材|方剂)\s*[：:]\s*(.*)$/);
  if (!match) return line;
  var label = match[2];
  var names = match[3]
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\s*、\s*/g, "、")
    .trim();
  return match[1] + "**" + label + "：**" + (names ? " " + names : "");
}

function renderMarkdownFallback(text) {
  return String(text || "")
    .split(/(```[\s\S]*?```)/g)
    .map(function(part) {
      if (!part) return "";
      if (part.indexOf("```") === 0) {
        return "<pre><code>" + esc(part.replace(/^```\w*\n?/, "").replace(/```$/, "")) + "</code></pre>";
      }
      return part.split(/\n{2,}/).filter(function(block) { return block.trim(); }).map(function(block) {
        return "<p>" + esc(block.split("\n").reduce(joinInlineText)) + "</p>";
      }).join("");
    })
    .join("");
}

function renderMarkdown(value) {
  var text = value || "";
  if (_marked) return _marked.parse(text);
  return renderMarkdownFallback(text);
}

function formatSources(sources) {
  if (!sources || !sources.length) return "";
  var html = '<div class="rag-sources-bar"><strong>参考药材：</strong>';
  sources.forEach(function(s){
    html += '<button class="rag-source-tag herb-clickable-chip" type="button" onclick="openHerbPanel(\'' + escA(s) + '\')">' + esc(String(s)) + '</button>';
  });
  html += '</div>';
  return html;
}

function formatFormulas(formulas) {
  if (!formulas || !formulas.length) return "";
  var html = '<div class="rag-sources-bar"><strong>关联方剂：</strong>';
  formulas.forEach(function(f){
    html += '<span class="rag-source-tag rag-source-formula">' + esc(String(f)) + '</span>';
  });
  html += '</div>';
  return html;
}

function buildRagModeBadge(mode) {
  if (mode === "cypher-chain") {
    return '<span class="rag-badge rag-badge-chain"><i class="fas fa-magic"></i> GraphCypherQAChain</span>'; 
  }
  if (mode === "manual-enhanced") {
    return '<span class="rag-badge rag-badge-manual"><i class="fas fa-search-plus"></i> 增强图检索 + LLM知识增强</span>'; 
  }
  return '<span class="rag-badge rag-badge-fallback"><i class="fas fa-brain"></i> GraphRAG/LLM 回答</span>'; 
}

function buildGraphRagPipelineHtml(r) {
  var steps = Array.isArray(r.pipelineSteps) ? r.pipelineSteps : [];
  // 无任何检索过程数据（历史消息 / 流式占位）时不渲染该栏，避免空壳展示
  if (steps.length === 0 && !r.cypher && !r.mode) return "";
  var html = '<div class="rag-pipeline-toggle" onclick="togglePL(this)">';
  html += '<i class="fas fa-chevron-right"></i><span class="rag-toggle-title">点击展开：后端真实检索过程</span><span class="rag-toggle-subtitle">来自 /api/ai-engine/rag 的 pipelineSteps、Cypher 与 mode</span></div>'; 
  html += '<div class="rag-pipeline-detail" style="display:none;">';
  html += '<div class="rag-pipeline-intro"><i class="fas fa-info-circle"></i> 以下内容由后端返回，反映本次请求实际执行或回退的检索步骤。</div>'; 
  html += '<div class="rag-pipeline-log">';
  if (steps.length) {
    steps.forEach(function(step, index) {
      var status = step && step.status ? String(step.status) : "done";
      var check = status === "error" ? "!" : (status === "fallback" ? "↪" : "✓");
      var name = step && step.name ? String(step.name) : "后端步骤";
      var detail = step && step.detail ? String(step.detail) : "后端未返回详细说明";
      html += '<div class="rag-pipeline-step done rag-step-' + escA(status) + '"><span class="step-num">' + (index + 1) + '</span><span class="step-text"><strong>' + esc(name) + '：</strong>' + esc(detail) + '</span><span class="step-check">' + esc(check) + '</span></div>'; 
    });
  } else {
    html += '<div class="rag-pipeline-step done rag-step-fallback"><span class="step-num">1</span><span class="step-text"><strong>后端步骤：</strong>本次响应未返回 pipelineSteps，无法展示真实检索过程。</span><span class="step-check">↪</span></div>'; 
  }
  html += '</div>'; 
  html += '<div class="rag-cypher-block"><div class="rag-cypher-header"><i class="fas fa-code"></i> 实际执行的 Cypher 图查询语句</div>'; 
  if (r.cypher) {
    html += '<pre><code>' + esc(r.cypher) + '</code></pre>'; 
  } else {
    html += '<div class="rag-cypher-empty"><i class="fas fa-circle-info"></i> 本次未返回 Cypher，可能使用了直接回答或后端回退模式。</div>'; 
  }
  html += '</div>'; 
  html += '<div class="rag-meta-bar">' + buildRagModeBadge(r.mode) + '</div>'; 
  html += '<div class="rag-pipeline-summary"><i class="fas fa-check-circle"></i> GraphRAG 管线执行完成：图谱检索、上下文增强与模型生成已完成。</div>'; 
  html += '</div>'; 
  return html;
}

function buildAnswerHtml(result) {
  var r = result || {};
  var cleanAnswer = normalizeAnswerText(r.answer || "");
  var finalAnswer = normalizeAnswerEmphasis(cleanAnswer);
  // 检索过程栏放在回答最前面，先展示后端真实检索链路
  var html = buildGraphRagPipelineHtml(r);
  html += '<div class="rag-answer-body">' + renderMarkdown(finalAnswer) + '</div>';
  html += formatSources(r.sources || []);
  html += formatFormulas(r.formulas || []);
  return html;
}

function appendMsg(role, content, time) {
  var w = cw();
  if (!w) return null;
  var div = document.createElement("div");
  var isUser = role === "user";
  div.className = "message " + (isUser ? "user-message" : "ai-message");
  var icon = buildMessageAvatar(isUser ? "user" : "ai");
  div.innerHTML = '<div class="message-avatar">' + icon + '</div><div class="message-body"><div class="message-content">' +
    (isUser ? esc(content) : content) + '</div><div class="message-time">' + nowTime(time) + '</div></div>';
  w.appendChild(div);
  w.scrollTop = w.scrollHeight;
  return div;
}

function appendConversationNotice(text) {
  var w = cw();
  if (!w) return null;
  var div = document.createElement("div");
  div.className = "conversation-notice";
  div.innerHTML = '<div class="history-incomplete-notice"><i class="fas fa-circle-info"></i> ' + esc(text) + '</div>';
  w.appendChild(div);
  w.scrollTop = w.scrollHeight;
  return div;
}
function clearChatToWelcome() {
  var w = cw();
  if (!w) return;
  w.innerHTML = '' +
    '<div class="message ai-message">' +
      '<div class="message-avatar"><i class="fas fa-leaf"></i></div>' +
      '<div class="message-body">' +
        '<div class="message-content">您好，我是神农AI。您可以咨询药材功效、方剂组成、配伍关系和常见中医药知识。</div>' +
        '<div class="message-time">' + nowTime() + '</div>' +
        '<div class="suggestion-chips" aria-label="建议问题">' +
          '<button class="suggestion-chip" type="button" data-question="人参有什么功效？">人参有什么功效？</button>' +
          '<button class="suggestion-chip" type="button" data-question="四君子汤的组成与作用是什么？">四君子汤的组成与作用是什么？</button>' +
          '<button class="suggestion-chip" type="button" data-question="脾胃虚寒怎么调理？">脾胃虚寒怎么调理？</button>' +
          '<button class="suggestion-chip" type="button" data-question="黄芪和当归如何配伍？">黄芪和当归如何配伍？</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function saveTempHistory() {
  if (cloudHistoryEnabled) return;
  try {
    var w = cw();
    if (!w) return;
    var msgs = [];
    w.querySelectorAll(".message").forEach(function(el){
      var content = el.querySelector(".message-content");
      var time = el.querySelector(".message-time");
      if (!content || content.querySelector(".rag-interrupted") || el.classList.contains("conversation-notice")) return;
      msgs.push({
        role: el.classList.contains("user-message") ? "user" : "assistant",
        html: content.innerHTML,
        time: time ? time.textContent : ""
      });
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs));
  } catch (e) {}
}

function markAnswerInterrupted(aiDiv) {
  var mc = aiDiv ? aiDiv.querySelector(".message-content") : null;
  if (mc) mc.innerHTML = '<div class="rag-interrupted"><i class="fas fa-circle-exclamation"></i> 回答已中断，请重新提问</div>';
}

function abortPendingAnswer() {
  if (_abort) {
    try { _abort.abort(); } catch (e) {}
  }
}

function handleBeforeUnload(event) {
  if (!_busy || _allowPendingNavigation) return;
  event.preventDefault();
  event.returnValue = "";
}

function wirePendingNavigationGuard() {
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", function() {
    if (_busy) abortPendingAnswer();
  });
  document.addEventListener("click", function(event) {
    if (!_busy || _allowPendingNavigation) return;
    var link = event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    if (link.target && link.target.toLowerCase() === "_blank") return;
    var href = link.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return;
    if (!confirm(LEAVE_WARNING + "确定离开吗？")) {
      event.preventDefault();
      return;
    }
    _allowPendingNavigation = true;
    abortPendingAnswer();
  }, true);
}

function loadTempHistory() {
  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    var msgs = JSON.parse(raw);
    if (!msgs || !msgs.length) return false;
    var w = cw();
    if (!w) return false;
    w.innerHTML = "";
    msgs.forEach(function(m){
      appendMsg(m.role === "user" ? "user" : "ai", m.html || "", m.time);
      var last = w.lastElementChild;
      if (last && m.role === "user") {
        var mc = last.querySelector(".message-content");
        if (mc) mc.innerHTML = esc(mc.textContent || "");
      }
    });
    return true;
  } catch (e) { return false; }
}

function showHistoryHint(text) {
  var panel = document.getElementById("qaHistoryPanel");
  if (panel) panel.innerHTML = '<div class="qa-history-empty">' + esc(text) + '</div>';
}

function renderConversationList() {
  var panel = document.getElementById("qaHistoryPanel");
  if (!panel) return;
  if (!cloudHistoryEnabled) {
    showHistoryHint("登录后可保存对话记录");
    return;
  }
  if (!conversations.length) {
    showHistoryHint("暂无历史对话");
    return;
  }
  panel.innerHTML = conversations.map(function(item){
    var active = String(item.id) === String(currentConversationId) ? " active" : "";
    return '<div class="qa-history-item' + active + '" data-id="' + esc(String(item.id)) + '">' +
      '<button class="qa-history-title" type="button" data-load="' + esc(String(item.id)) + '">' + esc(item.title || "未命名对话") + '</button>' +
      '<button class="qa-history-delete" type="button" data-delete="' + esc(String(item.id)) + '" aria-label="删除对话">删除</button>' +
    '</div>';
  }).join("");
}

async function refreshConversations() {
  if (!hasLoginState()) {
    cloudHistoryEnabled = false;
    renderConversationList();
    return;
  }
  try {
    var data = await apiJson("/api/conversations?limit=20", { method: "GET" });
    cloudHistoryEnabled = true;
    conversations = (data.data && data.data.conversations) || [];
    renderConversationList();
  } catch (e) {
    cloudHistoryEnabled = false;
    renderConversationList();
  }
}

async function ensureConversation(title) {
  if (!cloudHistoryEnabled) return null;
  if (currentConversationId) return currentConversationId;
  var data = await apiJson("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: (title || "新对话").substring(0, 40) })
  });
  currentConversationId = data.data && data.data.id;
  await refreshConversations();
  return currentConversationId;
}

async function saveCloudMessage(role, content, meta) {
  if (!cloudHistoryEnabled || !currentConversationId || !content) return false;
  await apiJson("/api/conversations/" + encodeURIComponent(currentConversationId) + "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: role === "user" ? "user" : "assistant",
      content: content,
      sources: meta && meta.sources ? meta.sources : [],
      mode: meta && meta.mode ? meta.mode : ""
    })
  });
  return true;
}

async function loadConversation(id) {
  try {
    var data = await apiJson("/api/conversations/" + encodeURIComponent(id), { method: "GET" });
    var detail = data.data || {};
    currentConversationId = detail.id;
    var w = cw();
    if (!w) return;
    w.innerHTML = "";
    var messages = detail.messages || [];
    messages.forEach(function(m){
      if (m.role === "user") {
        appendMsg("user", m.content || "", m.created_at);
      } else {
        appendMsg("ai", buildAnswerHtml({ answer: m.content || "", sources: parseSources(m.sources), formulas: [] }), m.created_at);
      }
    });
    if (!messages.length) clearChatToWelcome();
    else if (messages[messages.length - 1].role === "user") appendConversationNotice("这次回答未完成，请重新提问。");
    renderConversationList();
  } catch (e) {
    toast("历史对话加载失败，请稍后重试", "error");
  }
}
function parseSources(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value); }
  catch (e) { return []; }
}

async function deleteConversation(id) {
  if (!confirm("确认删除这条对话记录？")) return;
  try {
    await apiJson("/api/conversations/" + encodeURIComponent(id), { method: "DELETE" });
    if (String(currentConversationId) === String(id)) {
      currentConversationId = null;
      clearChatToWelcome();
    }
    await refreshConversations();
  } catch (e) {
    toast("对话删除失败，请稍后重试", "error");
  }
}

function wireHistoryControls() {
  var btn = document.getElementById("qaHistoryBtn");
  var sidebar = document.getElementById("convSidebar");
  var panel = document.getElementById("qaHistoryPanel");
  var newBtn = document.getElementById("qaNewChatBtn");

  // 关闭侧边栏（移动端覆盖式显示用）
  function closeHistoryPanel() {
    if (sidebar) sidebar.classList.remove("open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  if (btn && sidebar) {
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      sidebar.classList.toggle("open");
      btn.setAttribute("aria-expanded", sidebar.classList.contains("open") ? "true" : "false");
    });
  }

  if (panel) {
    panel.addEventListener("click", function(e){
      e.stopPropagation();
      var load = e.target.getAttribute("data-load");
      var del = e.target.getAttribute("data-delete");
      // 选择某条历史对话后关闭侧边栏
      if (load) { loadConversation(load); closeHistoryPanel(); }
      if (del) deleteConversation(del);
    });
  }

  // 点击侧边栏和按钮以外的区域时，关闭侧边栏（移动端）
  document.addEventListener("click", function(e){
    if (!sidebar || !sidebar.classList.contains("open")) return;
    if (sidebar.contains(e.target)) return;
    if (btn && btn.contains(e.target)) return;
    closeHistoryPanel();
  });

  if (newBtn) {
    newBtn.addEventListener("click", function(){
      currentConversationId = null;
      clearChatToWelcome();
      if (!cloudHistoryEnabled) sessionStorage.removeItem(SESSION_KEY);
      renderConversationList();
      closeHistoryPanel();
    });
  }
}

function wireSuggestionChips() {
  document.addEventListener("click", function(e) {
    var chip = e.target.closest ? e.target.closest(".suggestion-chip") : null;
    if (!chip) return;
    var ta = document.getElementById("qaTextarea");
    if (!ta) return;
    ta.value = chip.getAttribute("data-question") || chip.textContent || "";
    ta.focus();
  });
}

async function checkAiHealth() {
  var el = document.getElementById("qaServiceStatus");
  if (!el) return;
  try {
    var data = await apiJson("/api/ai-engine/health", { method: "GET" });
    var status = data.data || {};
    if (status.neo4j !== "connected") el.textContent = "AI 服务部分能力暂不可用";
    else el.textContent = "";
  } catch (e) {
    el.textContent = "AI 服务暂不可用";
  }
}

document.addEventListener("DOMContentLoaded", function(){
  import("https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js")
    .then(function(m){ _marked = m.marked; _marked.setOptions({ breaks: false, gfm: true }); })
    .catch(function(){});

  var btn = document.getElementById("qaSendBtn");
  var ta = document.getElementById("qaTextarea");
  if (btn) btn.addEventListener("click", doSend);
  if (ta) ta.addEventListener("keydown", function(e){
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  });

  wireSuggestionChips();
  wireHistoryControls();
  clearChatToWelcome();
  refreshConversations().then(function(){
    if (!cloudHistoryEnabled) {
      // 未登录：从 sessionStorage 恢复临时对话
      loadTempHistory();
    } else if (conversations.length > 0) {
      // 登录状态：自动恢复最近一条对话，保证跳转页面后对话不丢失
      loadConversation(conversations[0].id);
    }
  });
  checkAiHealth();
  // 恢复上次打开的药材详情面板（页面跳转后保持打开状态）
  try {
    var savedHerb = sessionStorage.getItem("qa_herb_panel");
    if (savedHerb) openHerbPanel(savedHerb);
  } catch (e) {}
  wirePendingNavigationGuard();
});

async function askRag(question) {
  var resp = await fetch(API_BASE + "/api/ai-engine/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: question, useChain: true, formatInstruction: QA_FORMAT_INSTRUCTION }),
    signal: _abort.signal
  });
  var data = await resp.json().catch(function(){ return {}; });
  if (!resp.ok || data.success === false) throw new Error(data.message || "RAG_FAILED");
  return data.data || {};
}

async function askRagStream(question, aiDiv) {
  var resp = await fetch(API_BASE + "/api/ai-engine/rag-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: question, useChain: true, formatInstruction: QA_FORMAT_INSTRUCTION }),
    signal: _abort.signal
  });
  if (!resp.ok || !resp.body) throw new Error("STREAM_FAILED");

  var reader = resp.body.getReader();
  var decoder = new TextDecoder("utf-8");
  var buffer = "";
  var answer = "";
  var sources = [];
  var streamDone = false;
  var mc = aiDiv ? aiDiv.querySelector(".message-content") : null;

  function update() {
    if (mc) mc.innerHTML = buildAnswerHtml({ answer: answer || "正在生成回答...", sources: sources });
  }

  while (true) {
    var chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    var events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (var i = 0; i < events.length; i++) {
      var lines = events[i].split("\n");
      for (var j = 0; j < lines.length; j++) {
        var line = lines[j].trim();
        if (!line || !line.startsWith("data:")) continue;
        var payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          streamDone = true;
          continue;
        }
        try {
          var eventData = JSON.parse(payload);
          if (eventData.type === "context" && eventData.herbs) sources = eventData.herbs;
          else if (eventData.type === "sources" && eventData.content) answer += eventData.content;
          else if (eventData.type === "error") throw new Error("STREAM_FAILED");
          else if (eventData.choices && eventData.choices[0] && eventData.choices[0].delta) {
            answer += eventData.choices[0].delta.content || "";
          }
        } catch (e) {
          if (payload && payload.charAt(0) !== "{") answer += payload;
          else throw e;
        }
        update();
      }
    }
  }
  return { answer: answer, sources: sources, mode: "rag-stream" };
}

async function doSend() {
  if (_busy) return;
  var ta = document.getElementById("qaTextarea");
  var btn = document.getElementById("qaSendBtn");
  var streamToggle = document.getElementById("qaStreamToggle");
  if (!ta || !btn) return;
  var input = (ta.value || "").trim();
  if (!input) { toast("请输入问题", "warning"); return; }

  _busy = true;
  ta.value = "";
  appendMsg("user", input);
  var aiDiv = appendMsg("ai", '<div class="rag-loading"><div class="rag-pipeline-anim"><span class="rag-dot"></span><span class="rag-dot"></span><span class="rag-dot"></span></div><div class="rag-status-text">正在生成回答...</div></div>');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> 生成中...';
  var loadingSteps = [
    "关键词提取：分析用户问题...",
    "Neo4j 图检索：查询图谱相关节点...",
    "向量检索：语义匹配证型与功效...",
    "关联知识扩展：补充性味、归经、功效、配伍...",
    "LLM 知识增强：融合图谱上下文...",
    "上下文构建：整理证据与候选知识...",
    "DeepSeek-V3 生成：输出最终答案..."
  ];
  var loadingIndex = 0;
  var loadingTimer = null;
  var loadingText = aiDiv ? aiDiv.querySelector(".rag-status-text") : null;
  if (loadingText) {
    loadingText.textContent = loadingSteps[0];
    loadingTimer = setInterval(function() {
      loadingIndex = (loadingIndex + 1) % loadingSteps.length;
      loadingText.textContent = loadingSteps[loadingIndex];
    }, 1200);
  }

  try {
    _abort = new AbortController();
    if (cloudHistoryEnabled) {
      try {
        await ensureConversation(input);
        await saveCloudMessage("user", input, {});
      } catch (e) {
        cloudHistoryEnabled = false;
        renderConversationList();
        toast("登录后可保存对话记录", "info");
      }
    }

    var result;
    if (streamToggle && streamToggle.checked) {
      result = await askRagStream(input, aiDiv);
      if (!result.answer) throw new Error("STREAM_EMPTY");
    } else {
      result = await askRag(input);
      var mc1 = aiDiv ? aiDiv.querySelector(".message-content") : null;
      if (mc1) mc1.innerHTML = buildAnswerHtml(result);
    }

    if (window.hljs && aiDiv) {
      try { aiDiv.querySelectorAll("pre code").forEach(function(b){ hljs.highlightElement(b); }); } catch(e) {}
    }
    if (cloudHistoryEnabled && currentConversationId) {
      try {
        await saveCloudMessage("assistant", result.answer || "", { sources: result.sources || [], mode: result.mode || "rag" });
        await refreshConversations();
      } catch (e) {
        toast("对话记录保存失败", "warning");
      }
    } else {
      saveTempHistory();
    }
  } catch (e) {
    var mc = aiDiv ? aiDiv.querySelector(".message-content") : null;
    if (e.name === "AbortError") {
      markAnswerInterrupted(aiDiv);
    } else {
      if (mc) mc.innerHTML = '<div class="rag-error"><i class="fas fa-exclamation-triangle"></i> 回答生成失败，请稍后重试</div>';
      toast(streamToggle && streamToggle.checked ? "流式回答失败，请稍后重试" : "回答生成失败，请稍后重试", "error");
    }
  } finally {
    if (loadingTimer) clearInterval(loadingTimer);
    _busy = false;
    _allowPendingNavigation = false;
    btn.disabled = false;
    btn.innerHTML = "发送";
    _abort = null;
  }
}

function wireTools() {
  var compatibilityForm = document.getElementById("compatibilityForm");
  var herbEnrichForm = document.getElementById("herbEnrichForm");
  if (compatibilityForm) compatibilityForm.addEventListener("submit", handleCompatibility);
  if (herbEnrichForm) herbEnrichForm.addEventListener("submit", handleHerbEnrich);
}

function setToolResult(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function parseHerbNames(value) {
  return String(value || "")
    .split(/[，,、\s]+/)
    .map(function(item){ return item.trim(); })
    .filter(Boolean);
}

async function handleCompatibility(e) {
  e.preventDefault();
  var input = document.getElementById("compatibilityInput");
  var herbs = parseHerbNames(input ? input.value : "");
  if (herbs.length < 2) {
    setToolResult("compatibilityResult", '<div class="qa-tool-message warning">请至少输入两味药材</div>');
    return;
  }
  setToolResult("compatibilityResult", '<div class="qa-tool-message">正在检测...</div>');
  try {
    var data = await apiJson("/api/ai-engine/compatibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ herbs: herbs })
    });
    var r = data.data || {};
    var unknownHerbs = Array.isArray(r.unknownHerbs) ? r.unknownHerbs : [];
    var hasWarning = !r.safe || unknownHerbs.length > 0 || (r.conflicts && r.conflicts.length);
    var html = '<div class="qa-tool-message ' + (hasWarning ? 'warning' : 'success') + '">' + esc(r.summary || (hasWarning ? "检测结果存在不确定性，请谨慎使用" : "未检测到明确配伍冲突")) + '</div>';
    if (unknownHerbs.length) {
      html += '<ul class="qa-tool-list"><li><strong>未收录药材</strong><div>' + esc(unknownHerbs.join('、')) + '</div><div class="qa-tool-muted">这些名称未在药材库或配伍规则中匹配到，不能据此判断可以配合使用。</div></li></ul>';
    }
    if (r.conflicts && r.conflicts.length) {
      html += '<ul class="qa-tool-list">';
      r.conflicts.forEach(function(c){
        html += '<li><strong>' + esc(c.herb_a || "") + ' / ' + esc(c.herb_b || "") + '</strong>'; 
        html += '<div>冲突类型：' + esc(c.relation || "配伍冲突") + '</div>'; 
        html += '<div>规则类别：' + esc(c.category || "明确配伍规则") + '</div>'; 
        html += '<div class="qa-tool-muted">依据：' + esc(c.description || c.source || "命中项目内置配伍禁忌规则库。") + '</div>'; 
        html += '</li>'; 
      });
      html += '</ul>';
    }
    setToolResult("compatibilityResult", html);
  } catch (err) {
    setToolResult("compatibilityResult", '<div class="qa-tool-message error">配伍检测失败，请稍后重试</div>');
  }
}

async function handleHerbEnrich(e) {
  e.preventDefault();
  var input = document.getElementById("herbEnrichInput");
  var name = input ? input.value.trim() : "";
  if (!name) {
    setToolResult("herbEnrichResult", '<div class="qa-tool-message warning">请输入药材名</div>');
    return;
  }
  setToolResult("herbEnrichResult", '<div class="qa-tool-message">正在生成增强信息...</div>');
  try {
    var data = await apiJson("/api/ai-engine/herb-enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ herbName: name })
    });
    var r = data.data || {};
    var fields = [
      ["主治", r.indications],
      ["用法用量", r.usage_dosage],
      ["注意事项", r.caution],
      ["现代药理", r.pharmacology],
      ["临床应用", r.clinical_application]
    ];
    var html = '<dl class="qa-tool-dl">';
    var count = 0;
    fields.forEach(function(item){
      if (!item[1]) return;
      count++;
      html += '<dt>' + esc(item[0]) + '</dt><dd>' + esc(String(item[1])) + '</dd>';
    });
    html += '</dl>';
    setToolResult("herbEnrichResult", count ? html : '<div class="qa-tool-message">未返回可展示的增强信息</div>');
  } catch (err) {
    setToolResult("herbEnrichResult", '<div class="qa-tool-message error">药材知识增强失败，请稍后重试</div>');
  }
}

function togglePL(el) {
  var d = el.nextElementSibling;
  if (!d) return;
  var ic = el.querySelector("i");
  if (d.style.display === "block") {
    d.style.display = "none";
    d.classList.remove("open");
    el.classList.remove("open");
    var titleClosed = el.querySelector(".rag-toggle-title");
    if (titleClosed) titleClosed.textContent = "点击展开：后端真实检索过程";
    if (ic) ic.className = "fas fa-chevron-right";
  } else {
    d.style.display = "block";
    d.classList.add("open");
    el.classList.add("open");
    var titleOpen = el.querySelector(".rag-toggle-title");
    if (titleOpen) titleOpen.textContent = "点击收起：后端真实检索过程";
    if (ic) ic.className = "fas fa-chevron-right";
  }
}

async function openHerbPanel(name) {
  var panel = document.getElementById("herbSidePanel");
  var stage = document.querySelector(".qa-stage");
  var body = document.getElementById("herbSidePanelBody");
  var title = document.getElementById("herbSidePanelTitle");
  if (!panel || !body) return;
  if (title) title.innerHTML = '<i class="fas fa-leaf"></i> ' + esc(name);
  body.innerHTML = '<div class="herb-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
  panel.classList.add("active");
  if (stage) stage.classList.add("panel-open");
  try { sessionStorage.setItem("qa_herb_panel", name); } catch (e) {}
  try {
    var resp = await fetch(API_BASE + "/api/ai-engine/herb-detail/" + encodeURIComponent(name));
    var data = await resp.json();
    if (!data.success) { body.innerHTML = '<div class="herb-loading">未找到匹配的药材</div>'; return; }
    renderHerb(body, data.data);
  } catch(e) {
    body.innerHTML = '<div class="herb-loading">加载失败</div>';
  }
}

function renderHerb(ct, h) {
  var html = '<div class="herb-panel-card"><div class="herb-panel-name">' + esc(h.name || "") + '</div>';
  if (h.latin_name) html += '<div class="detail-row"><span class="detail-label">拉丁名</span><span class="detail-value">' + esc(h.latin_name) + '</span></div>';
  if (h.category_name) html += '<div class="detail-row"><span class="detail-label">分类</span><span class="detail-value">' + esc(h.category_name) + '</span></div>';
  if (h.region_name) html += '<div class="detail-row"><span class="detail-label">产地</span><span class="detail-value">' + esc(h.region_name) + '</span></div>';
  if (h.properties && h.properties.length) {
    html += '<div class="detail-row"><span class="detail-label">性味</span><span class="detail-value detail-tags">';
    h.properties.forEach(function(p){ html += '<span class="detail-tag">' + esc(p.name || p) + '</span>'; });
    html += '</span></div>';
  }
  if (h.meridians && h.meridians.length) {
    html += '<div class="detail-row"><span class="detail-label">归经</span><span class="detail-value detail-tags">';
    h.meridians.forEach(function(m){ html += '<span class="detail-tag">' + esc(m.name || m) + '</span>'; });
    html += '</span></div>';
  }
  if (h.efficacies && h.efficacies.length) {
    html += '<div class="detail-row"><span class="detail-label">功效</span><span class="detail-value detail-tags">';
    h.efficacies.forEach(function(e){ html += '<span class="detail-tag detail-tag-cool">' + esc(e.name || e) + '</span>'; });
    html += '</span></div>';
  }
  if (h.description) html += '<div class="detail-row"><span class="detail-label">描述</span><span class="detail-value">' + esc(h.description) + '</span></div>';
  if (h.usage_dosage) html += '<div class="detail-row"><span class="detail-label">用法用量</span><span class="detail-value">' + esc(h.usage_dosage) + '</span></div>';
  if (h.caution) html += '<div class="detail-row"><span class="detail-label">注意事项</span><span class="detail-value detail-danger">' + esc(h.caution) + '</span></div>';
  html += '</div>';
  html += '<div class="herb-kg-link"><a href="knowledge-graph.html?herb=' + encodeURIComponent(h.name || "") + '&from=qa" class="herb-kg-btn"><i class="fas fa-project-diagram"></i> 在知识图谱中查看完整关系网络</a></div>';

  if (h.graphData && h.graphData.nodes && h.graphData.nodes.length) {
    html += '<div class="herb-mini-graph-container"><h4><i class="fas fa-project-diagram"></i> 知识图谱关联</h4><svg id="herbMiniGraphSvg"></svg><div class="mini-graph-legend"><span class="legend-item"><span class="legend-dot" style="background:#27ae60"></span>药材</span><span class="legend-item"><span class="legend-dot" style="background:#f39c12"></span>性味</span><span class="legend-item"><span class="legend-dot" style="background:#3498db"></span>归经</span><span class="legend-item"><span class="legend-dot" style="background:#e74c3c"></span>功效</span><span class="legend-item"><span class="legend-dot" style="background:#9b59b6"></span>分类</span><span class="legend-item"><span class="legend-dot" style="background:#8e44ad"></span>方剂</span></div></div>';
  }
  ct.innerHTML = html;
  if (h.graphData && h.graphData.nodes && h.graphData.nodes.length) setTimeout(function(){ drawMini("herbMiniGraphSvg", h.graphData); }, 200);
}

function drawMini(svgId, gd) {
  var svgEl = document.getElementById(svgId);
  if (!svgEl || !window.d3) return;
  if (_d3sim) { _d3sim.stop(); _d3sim = null; }
  var w = svgEl.clientWidth || 320, h = 320;
  var svg = d3.select("#" + svgId);
  svg.selectAll("*").remove();
  svg.attr("viewBox", [0, 0, w, h]);
  var g = svg.append("g");
  var cm = { Herb: "#27ae60", Property: "#f39c12", Meridian: "#3498db", Efficacy: "#e74c3c", Category: "#9b59b6", Formula: "#8e44ad" };
  var nodes = gd.nodes.map(function(n){ return { id: n.id, name: n.name, label: n.label, isCenter: n.isCenter }; });
  var links = gd.links || gd.edges || [];
  _d3sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(function(d){ return d.id; }).distance(60))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(w / 2, h / 2))
    .force("collision", d3.forceCollide().radius(30));
  var link = g.append("g").selectAll("line").data(links).join("line")
    .attr("stroke", "rgba(22, 36, 29, 0.22)").attr("stroke-width", 1.5);
  var node = g.append("g").selectAll("g").data(nodes).join("g")
    .call(d3.drag()
      .on("start", function(e, d){ if (!e.active) _d3sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", function(e, d){ d.fx = e.x; d.fy = e.y; })
      .on("end", function(e, d){ if (!e.active) _d3sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  node.append("circle")
    .attr("r", function(d){ return d.isCenter ? 14 : 9; })
    .attr("fill", function(d){ return cm[d.label] || "#95a5a6"; })
    .attr("stroke", function(d){ return d.isCenter ? "#20563b" : "rgba(22, 36, 29, 0.25)"; })
    .attr("stroke-width", function(d){ return d.isCenter ? 2.5 : 1; });
  node.append("text")
    .text(function(d){ return d.name.length > 5 ? d.name.substring(0, 5) + "..." : d.name; })
    .attr("font-size", function(d){ return d.isCenter ? "13px" : "10px"; })
    .attr("fill", "#16241d").attr("text-anchor", "middle")
    .attr("dy", function(d){ return d.isCenter ? 24 : 18; });
  node.append("title").text(function(d){ return d.name; });
  _d3sim.on("tick", function(){
    link.attr("x1", function(d){ return d.source.x; }).attr("y1", function(d){ return d.source.y; })
      .attr("x2", function(d){ return d.target.x; }).attr("y2", function(d){ return d.target.y; });
    node.attr("transform", function(d){ return "translate(" + d.x + "," + d.y + ")"; });
  });
}

function closeHerbPanel() {
  var panel = document.getElementById("herbSidePanel");
  var stage = document.querySelector(".qa-stage");
  if (panel) panel.classList.remove("active");
  if (stage) stage.classList.remove("panel-open");
  try { sessionStorage.removeItem("qa_herb_panel"); } catch (e) {}
  if (_d3sim) { _d3sim.stop(); _d3sim = null; }
}

window.togglePL = togglePL;
window.openHerbPanel = openHerbPanel;
window.closeHerbPanel = closeHerbPanel;
