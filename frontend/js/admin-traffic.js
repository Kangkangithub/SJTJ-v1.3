/* 访问统计页：数据加载 + ECharts 渲染 + 主题切换 */
(function () {
  var API_BASE = "";
  var state = { range: "24h", loading: false, reqId: 0, ctrl: null };
  var charts = { trend: null, pages: null, apis: null };

  function $(id) { return document.getElementById(id); }

  function token() {
    return localStorage.getItem("authToken") || localStorage.getItem("token") || "";
  }

  function fmt(n) {
    var v = Number(n || 0);
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000) return (v / 1000).toFixed(1) + "k";
    return String(v);
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function palette() {
    return {
      ink: cssVar("--ink") || "#16241d",
      muted: cssVar("--muted") || "#627069",
      primary: cssVar("--primary") || "#2f6a4f",
      primary2: cssVar("--primary-2") || "#40916c",
      grid: cssVar("--chart-grid") || "rgba(22,36,29,.08)",
      axis: cssVar("--chart-axis") || "#6b7a72",
      glass: cssVar("--glass-strong") || "rgba(255,255,255,.9)",
      border: cssVar("--line") || "rgba(22,36,29,.1)"
    };
  }

  function initTheme() {
    var saved = localStorage.getItem("traffic_theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("traffic_theme", next);
    var btn = $("themeBtn");
    if (btn) btn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    renderCharts(window.__lastData);
  }

  function showGate() {
    var gate = $("loginGate");
    if (gate) gate.hidden = false;
  }

  function setUpdated(text) {
    var el = $("updatedAt");
    if (el) el.textContent = text;
  }

  var RANGE_LABELS = { "1h": "最近 1 小时", "24h": "最近 24 小时", "7d": "最近 7 天", "30d": "最近 30 天" };

  function setRangeBadge() {
    var el = $("rangeBadge");
    if (el) el.textContent = RANGE_LABELS[state.range] || ("最近 " + state.range);
  }

  function labelBucket(bucket, range) {
    if (!bucket) return "";
    var parts = String(bucket).split(" ");
    var date = parts[0] || "";
    var time = parts[1] || "";
    if (range === "1h" || range === "24h") return time.slice(0, 5);
    return date.slice(5);
  }

  function renderSummary(s) {
    $("statPv").textContent = fmt(s.pv);
    $("statUv").textContent = fmt(s.uv);
    $("statApi").textContent = fmt(s.apiCalls);
    $("statAi").textContent = fmt(s.aiCalls);
    $("statAvg").textContent = s.avgMs ? s.avgMs + "ms" : "—";
    $("statErr").textContent = (s.errorRate || 0) + "%";
  }

  function baseTooltip(p) {
    return {
      backgroundColor: p.glass,
      borderColor: p.border,
      borderWidth: 1,
      textStyle: { color: p.ink, fontSize: 12 },
      extraCssText: "backdrop-filter: blur(12px); border-radius: 10px;"
    };
  }

  function renderTrend(rows, range, p) {
    var el = $("trendChart");
    if (!el) return;
    if (!charts.trend) charts.trend = echarts.init(el);
    var labels = (rows || []).map(function (r) { return labelBucket(r.bucket, range); });
    var pv = (rows || []).map(function (r) { return r.pv; });
    var uv = (rows || []).map(function (r) { return r.uv; });
    charts.trend.setOption({
      backgroundColor: "transparent",
      grid: { left: 6, right: 12, top: 30, bottom: 6, containLabel: true },
      tooltip: Object.assign({ trigger: "axis" }, baseTooltip(p)),
      legend: { right: 0, top: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p.muted, fontSize: 11 } },
      xAxis: {
        type: "category", data: labels, boundaryGap: false,
        axisLine: { lineStyle: { color: p.grid } }, axisTick: { show: false },
        axisLabel: { color: p.axis, fontSize: 10 }
      },
      yAxis: {
        type: "value", splitLine: { lineStyle: { color: p.grid, type: "dashed" } },
        axisLabel: { color: p.axis, fontSize: 10 }
      },
      series: [
        {
          name: "PV", type: "line", smooth: true, symbol: "none", data: pv,
          lineStyle: { width: 2, color: p.primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(64,145,108,0.35)" },
              { offset: 1, color: "rgba(64,145,108,0.02)" }
            ])
          }
        },
        {
          name: "UV", type: "line", smooth: true, symbol: "none", data: uv,
          lineStyle: { width: 2, color: p.primary2, type: "dashed" }
        }
      ]
    }, true);
  }

  function renderBar(elId, key, items, p) {
    var el = $(elId);
    if (!el) return;
    if (!charts[key]) charts[key] = echarts.init(el);
    var rows = (items || []).slice(0, 10).reverse();
    var labels = rows.map(function (r) { return r.path || r.query || ""; });
    var values = rows.map(function (r) { return r.count; });
    charts[key].setOption({
      backgroundColor: "transparent",
      grid: { left: 6, right: 20, top: 8, bottom: 6, containLabel: true },
      tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, baseTooltip(p)),
      xAxis: {
        type: "value", splitLine: { lineStyle: { color: p.grid, type: "dashed" } },
        axisLabel: { color: p.axis, fontSize: 10 }
      },
      yAxis: {
        type: "category", data: labels, inverse: false,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: p.ink, fontSize: 11, width: 150, overflow: "truncate" }
      },
      series: [{
        type: "bar", data: values, barWidth: 10,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: p.primary2 },
            { offset: 1, color: p.primary }
          ])
        }
      }]
    }, true);
  }

  function renderSearchList(items) {
    var el = $("searchList");
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = '<p class="empty">暂无搜索数据</p>';
      return;
    }
    var max = Math.max.apply(null, items.map(function (r) { return r.count; })) || 1;
    el.innerHTML = items.map(function (r, i) {
      var width = Math.max(6, Math.round((r.count / max) * 100));
      return '<div class="rank-row">' +
        '<span class="rank-index">' + (i + 1) + '</span>' +
        '<div class="rank-main"><div class="rank-name">' + escapeHtml(r.query) + '</div>' +
        '<div class="rank-bar"><i style="width:' + width + '%"></i></div></div>' +
        '<span class="rank-count">' + r.count + '</span>' +
        '</div>';
    }).join("");
  }

  function renderErrors(items) {
    var el = $("errorTable");
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = '<p class="empty">暂无错误记录</p>';
      return;
    }
    el.innerHTML = items.map(function (r) {
      return '<div class="error-row">' +
        '<span class="err-time">' + formatTime(r.ts) + '</span>' +
        '<span class="err-status">' + r.status + '</span>' +
        '<span class="err-path">' + escapeHtml((r.method || "GET") + " " + r.path) + '</span>' +
        '<span class="err-ms">' + Math.round(r.duration_ms || 0) + 'ms</span>' +
        '</div>';
    }).join("");
  }

  function formatTime(value) {
    if (!value) return "";
    var d = new Date(String(value).replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderCharts(data) {
    if (!data) return;
    var p = palette();
    renderTrend(data.timeseries, data.range, p);
    renderBar("pagesChart", "pages", data.topPages, p);
    renderBar("apisChart", "apis", data.topApis, p);
  }

  async function load(options) {
    var t = token();
    if (!t) {
      showGate();
      setUpdated("未登录");
      return;
    }

    var fresh = !!(options && options.fresh);
    var reqId = ++state.reqId;

    // 取消上一次未完成的请求：避免旧范围的响应晚到后覆盖新选择
    if (state.ctrl) {
      try { state.ctrl.abort(); } catch (error) { /* ignore */ }
    }
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    state.ctrl = ctrl;

    state.loading = true;
    document.body.classList.add("is-loading");
    setUpdated("加载中…");

    try {
      var url = API_BASE + "/api/analytics/overview?range=" + encodeURIComponent(state.range) +
        (fresh ? "&fresh=1" : "");
      var resp = await fetch(url, {
        headers: { Authorization: "Bearer " + t },
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined
      });
      if (reqId !== state.reqId) return;
      if (resp.status === 401 || resp.status === 403) {
        showGate();
        setUpdated("无权限");
        return;
      }
      var json = await resp.json();
      if (reqId !== state.reqId) return;
      if (!resp.ok || !json.success) throw new Error(json.message || "加载失败");
      var data = json.data;
      window.__lastData = data;
      renderSummary(data.summary || {});
      renderCharts(data);
      renderSearchList(data.topSearches);
      renderErrors(data.recentErrors);
      setUpdated("更新于 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (reqId !== state.reqId) return;
      setUpdated("加载失败：" + error.message);
    } finally {
      if (reqId === state.reqId) {
        state.loading = false;
        state.ctrl = null;
        document.body.classList.remove("is-loading");
      }
    }
  }

  function bindRange() {
    document.querySelectorAll(".range-tabs button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var range = btn.getAttribute("data-range");
        if (!range) return;
        state.range = range;
        document.querySelectorAll(".range-tabs button").forEach(function (b) {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        setRangeBadge();
        // 点当前已选中的范围也算一次刷新，不吞掉点击
        load({ fresh: true });
      });
    });
  }

  function bindMisc() {
    var refresh = $("refreshBtn");
    if (refresh) refresh.addEventListener("click", function () { load({ fresh: true }); });
    var theme = $("themeBtn");
    if (theme) {
      theme.setAttribute("aria-pressed", document.documentElement.getAttribute("data-theme") === "dark" ? "true" : "false");
      theme.addEventListener("click", toggleTheme);
    }

    // resize 用 rAF 合并，避免拖拽窗口时反复重排图表
    var resizeRaf = 0;
    window.addEventListener("resize", function () {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(function () {
        resizeRaf = 0;
        Object.keys(charts).forEach(function (k) { if (charts[k]) charts[k].resize(); });
      });
    });

    setInterval(function () {
      if (document.visibilityState === "visible") load();
    }, 30000);

    // 标签页重新可见时补一次刷新，避免展示过期数据
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") load();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    var active = document.querySelector(".range-tabs button.active");
    if (active) active.setAttribute("aria-selected", "true");
    setRangeBadge();
    bindRange();
    bindMisc();
    load();
  });
})();