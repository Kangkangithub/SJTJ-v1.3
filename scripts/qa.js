/**
 * GraphRAG 智能问答 — 纯净版
 * Pipeline: Neo4j -> LangChain.js -> GraphCypherQAChain -> DeepSeek-V3
 * Feature: 药材详情面板 + D3 迷你知识图谱
 */

var API_BASE = (function(){
  var h = window.location.hostname, p = window.location.port;
  if ((h === "localhost" || h === "127.0.0.1") && p === "3001") return "";
  return "http://localhost:3001";
})();

var _busy = false;
var _marked = null;
var _abort = null;
var _d3sim = null;
var SESSION_KEY = "graphrag_history";

function esc(s) {
  if (typeof s !== "string") return "";
  var d = document.createElement("div"); d.textContent = s; return d.innerHTML;
}
function escA(s) {
  return (s || "").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function toast(msg, type) {
  var old = document.querySelector(".qa-toast"); if (old) old.remove();
  var t = document.createElement("div"); t.className = "qa-toast " + (type || "info"); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity="0"; t.style.transition="opacity 0.3s";
    setTimeout(function(){ if(t.parentNode) t.remove(); }, 300); }, 2500);
}
function cw() { return document.querySelector(".chat-window"); }

// ========== sessionStorage 对话历史（关闭标签页即清空） ==========
function loadHistory() {
  try {
    var raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    var msgs = JSON.parse(raw);
    if (!msgs || msgs.length === 0) return false;
    var w = cw(); if (!w) return false;
    w.innerHTML = "";
    msgs.forEach(function(m){
      var div = document.createElement("div");
      div.className = "message " + (m.role === "user" ? "user-message" : "ai-message");
      var icon = m.role === "user" ? '<i class="fas fa-user"></i>' : '<i class="fas fa-brain"></i>';
      div.innerHTML = '<div class="message-avatar">' + icon + '</div><div class="message-body"><div class="message-content">' + m.html + '</div></div>';
      w.appendChild(div);
    });
    w.scrollTop = w.scrollHeight;
    return true;
  } catch(e) { return false; }
}

function saveHistory() {
  try {
    var w = cw(); if (!w) return;
    var msgs = [];
    w.querySelectorAll(".message").forEach(function(el){
      var role = el.classList.contains("user-message") ? "user" : "ai";
      var mc = el.querySelector(".message-content");
      if (mc) msgs.push({ role: role, html: mc.innerHTML });
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(msgs));
  } catch(e) {}
}
document.addEventListener("DOMContentLoaded", function(){
  import("https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js")
    .then(function(m){ _marked = m.marked; _marked.setOptions({breaks:true, gfm:true}); })
    .catch(function(){});

  var btn = document.getElementById("qaSendBtn");
  var ta = document.getElementById("qaTextarea");
  if (btn) btn.addEventListener("click", doSend);
  if (ta) ta.addEventListener("keydown", function(e){
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  });
  loadHistory();
});

function appendMsg(role, content) {
  var w = cw(); if (!w) return null;
  var div = document.createElement("div");
  div.className = "message " + (role === "user" ? "user-message" : "ai-message");
  var icon = role === "user" ? '<i class="fas fa-user"></i>' : '<i class="fas fa-brain"></i>';
  div.innerHTML = '<div class="message-avatar">' + icon + '</div><div class="message-body"><div class="message-content">' +
    (role === "ai" ? content : esc(content)) + '</div></div>';
  w.appendChild(div);
  w.scrollTop = w.scrollHeight;
  return div;
}

async function doSend() {
  if (_busy) return;
  var ta = document.getElementById("qaTextarea");
  var btn = document.getElementById("qaSendBtn");
  if (!ta || !btn) return;
  var input = (ta.value || "").trim();
  if (!input) { toast("请输入问题", "warning"); return; }

  _busy = true;
  ta.value = ""; ta.style.height = "auto";

  appendMsg("user", input);

  var aiDiv = appendMsg("ai", '<div class="rag-loading">' +
    '<div class="rag-pipeline-anim"><span class="rag-dot"></span><span class="rag-dot"></span><span class="rag-dot"></span><span class="rag-dot"></span><span class="rag-dot"></span><span class="rag-dot"></span></div>' +
    '<div class="rag-status-text">正在初始化 GraphRAG 管线...</div></div>');
  var statusEl = aiDiv ? aiDiv.querySelector(".rag-status-text") : null;

  // 完整 6 步管线动画文字
  var steps = [
    "🔭 关键词提取：LLM 分析用户问题，提取中医药关键实体（药材名/功效/症状/方剂）...",
    "🔗 Neo4j 图检索：执行 Cypher 查询，在 Neo4j AuraDB 中全文搜索匹配的药材节点与方剂节点...",
    "🔀 1-2跳图遍历：沿关系边扩展，获取药材的性味归经、功效主治、配伍禁忌等关联知识图谱数据...",
    "✨ LLM 知识增强：调用 DeepSeek-V3 对每味命中药材补充现代药理研究、临床应用要点等深度知识...",
    "📝 上下文构建：将图谱检索结果与 LLM 增强知识格式化为结构化提示上下文...",
    "🤖 DeepSeek-V3 生成：基于增强上下文，调用 DeepSeek-V3 生成带引用来源的精准中医药答案..."
  ];
  var timers = [];
  steps.forEach(function(s, i){
    timers.push(setTimeout(function(){ if (statusEl) statusEl.textContent = s; }, i * 600));
  });

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> 检索中...'; }

  try {
    _abort = new AbortController();
    var resp = await fetch(API_BASE + "/api/ai-engine/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: input, useChain: true }),
      signal: _abort.signal
    });
    if (!resp.ok) {
      var er = await resp.json().catch(function(){ return {}; });
      throw new Error(er.message || "服务错误 " + resp.status);
    }
    var data = await resp.json();
    if (!data.success) throw new Error(data.message || "查询失败");

    timers.forEach(function(t){ clearTimeout(t); });
    var r = data.data, html = "";

    // ====== GraphRAG 检索过程（默认折叠，含完整说明） ======
    html += '<div class="rag-pipeline-toggle" onclick="togglePL(this)"><i class="fas fa-chevron-right"></i> GraphRAG 检索过程（点击展开查看完整 5 步管线 + Cypher 查询）</div>';
    html += '<div class="rag-pipeline-detail">';
    html += '<div class="rag-pipeline-intro"><i class="fas fa-info-circle"></i> 以下为本次 GraphRAG 问答的完整技术管线：用户问题 → LLM 提取关键词 → Neo4j 图检索 → 1-2跳图遍历扩展 → LLM 知识增强 → DeepSeek-V3 生成答案</div>';
    html += '<div class="rag-pipeline-log">';
    [{n:1,ic:"🔭",tx:"关键词提取：LLM 分析用户问题，提取中医药关键实体（药材名/功效/症状/方剂）"},
     {n:2,ic:"🔗",tx:"Neo4j 图检索：在 Neo4j AuraDB 中执行 Cypher 全文搜索匹配的药材/方剂节点"},
     {n:3,ic:"🔀",tx:"1-2跳图遍历：沿关系边扩展获取性味归经、功效主治、配伍禁忌等关联数据"},
     {n:4,ic:"✨",tx:"LLM 知识增强：DeepSeek-V3 补充现代药理研究、临床应用等深度知识"},
     {n:5,ic:"📝",tx:"上下文构建：将图谱数据与增强知识格式化为结构化提示上下文"},
     {n:6,ic:"🤖",tx:"DeepSeek-V3 生成：基于增强上下文生成带引用来源的精准中医药答案"}].forEach(function(s){
      html += '<div class="rag-pipeline-step done"><span class="step-num">' + s.n + '</span><span class="step-text">' + s.ic + ' ' + s.tx + '</span><span class="step-check">✅</span></div>';
    });
    html += '</div>';
    if (r.cypher) html += '<div class="rag-cypher-block"><div class="rag-cypher-header"><i class="fas fa-code"></i> 实际执行的 Cypher 图查询语句</div><pre><code>' + esc(r.cypher) + '</code></pre></div>';
    var badge = r.mode === "cypher-chain"
      ? '<span class="rag-badge rag-badge-chain"><i class="fas fa-magic"></i> GraphCypherQAChain（LLM 自动生成 Cypher）</span>'
      : '<span class="rag-badge rag-badge-manual"><i class="fas fa-search-plus"></i> 增强图检索 + LLM 知识增强（手动构建上下文）</span>';
    html += '<div class="rag-meta-bar">' + badge + '</div>';
    html += '<div class="rag-pipeline-summary"><i class="fas fa-check-circle"></i> GraphRAG 管线执行完成 — Neo4j 图数据库 → LangChain.js 编排 → DeepSeek-V3 生成</div>';
    html += '</div>'; // rag-pipeline-detail

    // 药材来源标签
    if (r.sources && r.sources.length > 0) {
      html += '<div class="rag-sources-bar"><i class="fas fa-database"></i> <strong>Neo4j 检索到的药材（点击查看详情）：</strong>';
      r.sources.forEach(function(s){
        html += '<span class="rag-source-tag herb-clickable-chip" onclick="openHerbPanel(\'' + escA(s) + '\')"><i class="fas fa-leaf"></i> ' + esc(s) + '</span>';
      });
      html += '</div>';
    }
    // 方剂
    if (r.formulas && r.formulas.length > 0) {
      html += '<div class="rag-sources-bar"><i class="fas fa-book-medical"></i> <strong>关联方剂：</strong>';
      r.formulas.forEach(function(f){
        html += '<span class="rag-source-tag rag-source-formula"><i class="fas fa-prescription"></i> ' + esc(f) + '</span>';
      });
      html += '</div>';
    }
    // 答案区（加锚点 id）
    html += '<div class="rag-answer-body" ></div>';

    var mc = aiDiv.querySelector(".message-content");
    if (mc) {
      mc.innerHTML = html;
      var ab = mc.querySelector(".rag-answer-body");
      if (ab) {
        ab.innerHTML = _marked ? _marked.parse(r.answer || "") : (r.answer || "").replace(/\n/g, "<br>");
      }
    }

    // 自动滚动到当前答案区开头
    setTimeout(function(){
      var ansEl = aiDiv.querySelector(".rag-answer-body");
      if (ansEl) {
        ansEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);

    if (window.hljs && aiDiv) {
      try { aiDiv.querySelectorAll("pre code").forEach(function(b){ hljs.highlightElement(b); }); } catch(e) {}
    }
    saveHistory();

  } catch(e) {
    if (e.name !== "AbortError") {
      console.error("GraphRAG 错误:", e);
      timers.forEach(function(t){ clearTimeout(t); });
      var mc = aiDiv ? aiDiv.querySelector(".message-content") : null;
      if (mc) mc.innerHTML = '<div class="rag-error"><i class="fas fa-exclamation-triangle"></i> GraphRAG 管线异常：' + esc(e.message) + '</div>';
      toast("问答失败: " + e.message, "error");
    }
  } finally {
    _busy = false;
    if (btn) { btn.disabled = false; btn.innerHTML = "发送"; }
    _abort = null;
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
  panel.classList.add("active");   // 修复：CSS 定义的是 .active，不是 .open
  if (overlay) overlay.classList.add("active");
  try {
    var resp = await fetch(API_BASE + "/api/ai-engine/herb-detail/" + encodeURIComponent(name));
    var data = await resp.json();
    if (!data.success) { body.innerHTML = '<div class="herb-loading">未找到匹配的药材</div>'; return; }
    renderHerb(body, data.data);
  } catch(e) { body.innerHTML = '<div class="herb-loading">加载失败</div>'; }
}

function renderHerb(ct, h) {
  var html = '<div class="herb-panel-card"><div class="herb-panel-name">' + esc(h.name || "") + '</div>';
  if (h.pinyin) html += '<div class="detail-row"><span class="detail-label">拼音</span><span class="detail-value">' + esc(h.pinyin) + '</span></div>';
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
  if (h.caution) html += '<div class="detail-row"><span class="detail-label">注意事项</span><span class="detail-value" style="color:#e74c3c;">' + esc(h.caution) + '</span></div>';
  html += '</div>';

  // 跳转知识图谱按钮
  html += '<div class="herb-kg-link"><a href="knowledge-graph.html?herb=' + encodeURIComponent(h.name || "") + '" target="_blank" class="herb-kg-btn"><i class="fas fa-project-diagram"></i> 在知识图谱中查看完整关系网络</a></div>';

  if (h.graphData && h.graphData.nodes && h.graphData.nodes.length) {
    html += '<div class="herb-mini-graph-container"><h4><i class="fas fa-project-diagram"></i> 知识图谱关联</h4><svg id="herbMiniGraphSvg"></svg><div class="mini-graph-legend"><span class="legend-item"><span class="legend-dot" style="background:#27ae60"></span>药材</span><span class="legend-item"><span class="legend-dot" style="background:#f39c12"></span>性味</span><span class="legend-item"><span class="legend-dot" style="background:#3498db"></span>归经</span><span class="legend-item"><span class="legend-dot" style="background:#e74c3c"></span>功效</span><span class="legend-item"><span class="legend-dot" style="background:#9b59b6"></span>分类</span><span class="legend-item"><span class="legend-dot" style="background:#8e44ad"></span>方剂</span></div></div>';
  }
  ct.innerHTML = html;
  if (h.graphData && h.graphData.nodes && h.graphData.nodes.length) {
    setTimeout(function(){ drawMini("herbMiniGraphSvg", h.graphData); }, 200);
  }
}

function drawMini(svgId, gd) {
  var svgEl = document.getElementById(svgId);
  if (!svgEl) return;
  if (_d3sim) { _d3sim.stop(); _d3sim = null; }
  var w = svgEl.clientWidth || 320, h = 320;
  var svg = d3.select("#" + svgId);
  svg.selectAll("*").remove();
  svg.attr("viewBox", [0, 0, w, h]);
  var g = svg.append("g");
  var cm = { "Herb": "#27ae60", "Property": "#f39c12", "Meridian": "#3498db", "Efficacy": "#e74c3c", "Category": "#9b59b6", "Formula": "#8e44ad" };
  var nodes = gd.nodes.map(function(n){ return { id: n.id, name: n.name, label: n.label, isCenter: n.isCenter }; });
  var links = gd.links || gd.edges || [];
  _d3sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(function(d){ return d.id; }).distance(60))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(w/2, h/2))
    .force("collision", d3.forceCollide().radius(30));
  var link = g.append("g").selectAll("line").data(links).join("line")
    .attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", 1.5);
  var node = g.append("g").selectAll("g").data(nodes).join("g")
    .call(d3.drag()
      .on("start", function(e, d){ if(!e.active) _d3sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", function(e, d){ d.fx = e.x; d.fy = e.y; })
      .on("end", function(e, d){ if(!e.active) _d3sim.alphaTarget(0); d.fx = null; d.fy = null; }));
  node.append("circle")
    .attr("r", function(d){ return d.isCenter ? 14 : 9; })
    .attr("fill", function(d){ return cm[d.label] || "#95a5a6"; })
    .attr("stroke", function(d){ return d.isCenter ? "#fff" : "rgba(255,255,255,0.3)"; })
    .attr("stroke-width", function(d){ return d.isCenter ? 2.5 : 1; });
  node.append("text")
    .text(function(d){ return d.name.length > 5 ? d.name.substring(0,5)+"..." : d.name; })
    .attr("font-size", function(d){ return d.isCenter ? "13px" : "10px"; })
    .attr("fill", "#fff").attr("text-anchor", "middle")
    .attr("dy", function(d){ return d.isCenter ? 24 : 18; });
  node.append("title").text(function(d){ return d.name; });
  _d3sim.on("tick", function(){
    link.attr("x1", function(d){ return d.source.x; }).attr("y1", function(d){ return d.source.y; })
      .attr("x2", function(d){ return d.target.x; }).attr("y2", function(d){ return d.target.y; });
    node.attr("transform", function(d){ return "translate(" + d.x + "," + d.y + ")"; });
  });
  setTimeout(function(){
    var bb = g.node().getBBox();
    if (bb.width > 0) {
      var sc = Math.min(w/bb.width, h/bb.height, 1.5) * 0.85;
      svg.transition().duration(500).call(
        d3.zoom().transform,
        d3.zoomIdentity.translate((w-bb.width*sc)/2-bb.x*sc, (h-bb.height*sc)/2-bb.y*sc).scale(sc)
      );
    }
  }, 800);
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

