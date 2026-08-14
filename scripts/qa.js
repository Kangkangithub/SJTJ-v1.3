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

function renderMarkdown(value) {
  var text = value || "";
  if (_marked) return _marked.parse(text);
  return esc(text).replace(/\n/g, "<br>");
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

function buildAnswerHtml(result) {
  var r = result || {};
  var html = '<div class="rag-answer-body">' + renderMarkdown(r.answer || "") + '</div>';
  html += formatSources(r.sources || []);
  html += formatFormulas(r.formulas || []);
  if (r.cypher) {
    html += '<details class="rag-technical-detail"><summary>查看图谱检索语句</summary><pre><code>' + esc(r.cypher) + '</code></pre></details>';
  }
  return html;
}

function appendMsg(role, content, time) {
  var w = cw();
  if (!w) return null;
  var div = document.createElement("div");
  var isUser = role === "user";
  div.className = "message " + (isUser ? "user-message" : "ai-message");
  var icon = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-brain"></i>';
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
  var panel = document.getElementById("qaHistoryPanel");
  var newBtn = document.getElementById("qaNewChatBtn");
  if (btn && panel) {
    btn.addEventListener("click", function(){
      var next = panel.hasAttribute("hidden");
      if (next) panel.removeAttribute("hidden"); else panel.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", next ? "true" : "false");
      renderConversationList();
    });
    panel.addEventListener("click", function(e){
      var load = e.target.getAttribute("data-load");
      var del = e.target.getAttribute("data-delete");
      if (load) loadConversation(load);
      if (del) deleteConversation(del);
    });
  }
  if (newBtn) {
    newBtn.addEventListener("click", function(){
      currentConversationId = null;
      clearChatToWelcome();
      if (!cloudHistoryEnabled) sessionStorage.removeItem(SESSION_KEY);
      renderConversationList();
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
    .then(function(m){ _marked = m.marked; _marked.setOptions({ breaks: true, gfm: true }); })
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
    if (!cloudHistoryEnabled) loadTempHistory();
  });
  checkAiHealth();
  wirePendingNavigationGuard();
});

async function askRag(question) {
  var resp = await fetch(API_BASE + "/api/ai-engine/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: question, useChain: true }),
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
    body: JSON.stringify({ question: question }),
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
    var html = '<div class="qa-tool-message ' + (r.safe ? 'success' : 'warning') + '">' + esc(r.summary || (r.safe ? "未检测到明确配伍冲突" : "检测到配伍冲突")) + '</div>';
    if (r.conflicts && r.conflicts.length) {
      html += '<ul class="qa-tool-list">';
      r.conflicts.forEach(function(c){
        html += '<li><strong>' + esc(c.herb_a || "") + ' / ' + esc(c.herb_b || "") + '</strong>';
        if (c.relation) html += '：' + esc(c.relation);
        if (c.description) html += '<div>' + esc(c.description) + '</div>';
        if (c.source) html += '<div class="qa-tool-muted">' + esc(c.source) + '</div>';
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
    if (ic) ic.className = "fas fa-chevron-right";
  } else {
    d.style.display = "block";
    if (ic) ic.className = "fas fa-chevron-down";
  }
}

async function openHerbPanel(name) {
  var panel = document.getElementById("herbSidePanel");
  var overlay = document.getElementById("herbPanelOverlay");
  var body = document.getElementById("herbSidePanelBody");
  var title = document.getElementById("herbSidePanelTitle");
  if (!panel || !body) return;
  if (title) title.innerHTML = '<i class="fas fa-leaf"></i> ' + esc(name);
  body.innerHTML = '<div class="herb-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
  panel.classList.add("active");
  if (overlay) overlay.classList.add("active");
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
  html += '<div class="herb-kg-link"><a href="knowledge-graph.html?herb=' + encodeURIComponent(h.name || "") + '" class="herb-kg-btn"><i class="fas fa-project-diagram"></i> 在知识图谱中查看完整关系网络</a></div>';

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
    .attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", 1.5);
  var node = g.append("g").selectAll("g").data(nodes).join("g")
    .call(d3.drag()
      .on("start", function(e, d){ if (!e.active) _d3sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", function(e, d){ d.fx = e.x; d.fy = e.y; })
      .on("end", function(e, d){ if (!e.active) _d3sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  node.append("circle")
    .attr("r", function(d){ return d.isCenter ? 14 : 9; })
    .attr("fill", function(d){ return cm[d.label] || "#95a5a6"; })
    .attr("stroke", function(d){ return d.isCenter ? "#fff" : "rgba(255,255,255,0.3)"; })
    .attr("stroke-width", function(d){ return d.isCenter ? 2.5 : 1; });
  node.append("text")
    .text(function(d){ return d.name.length > 5 ? d.name.substring(0, 5) + "..." : d.name; })
    .attr("font-size", function(d){ return d.isCenter ? "13px" : "10px"; })
    .attr("fill", "#fff").attr("text-anchor", "middle")
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
  var overlay = document.getElementById("herbPanelOverlay");
  if (panel) panel.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
  if (_d3sim) { _d3sim.stop(); _d3sim = null; }
}

window.togglePL = togglePL;
window.openHerbPanel = openHerbPanel;
window.closeHerbPanel = closeHerbPanel;
