(function () {
  const PAGE_MAP = {
    'index.html': 'home',
    'herb-search.html': 'search',
    'herb-detail.html': 'detail',
    'knowledge-graph.html': 'graph',
    'qa.html': 'qa',
    'formula-library.html': 'formula',
    'formula-detail.html': 'formulaDetail',
    'recommendation.html': 'recommendation',
    'design-system.html': 'design'
  };

  const FALLBACK = window.HerbData || { herbs: [], formulas: [], nav: [], filters: {}, tokens: [] };
  const app = document.getElementById('app');
  if (!app) return;

  const state = {
    page: getCurrentPage(),
    loading: true,
    apiOnline: false,
    searchTerm: getQueryParam('q') || '',
    category: getQueryParam('category') || '全部',
    region: getQueryParam('region') || '全部',
    formulaTerm: '',
    formulaCategory: '全部',
    selectedHerbId: getQueryParam('id') || null,
    selectedHerbName: getQueryParam('herb') || null,
    selectedFormulaId: null,
    herbs: [],
    detailHerb: null,
    formulas: [],
    detailFormula: null,
    recommendations: { herbs: [], formulas: [] },
    categories: [],
    regions: [],
    stats: normalizeStats({}),
    graph: null,
    regionDistribution: null,
    chat: [
      {
        role: 'assistant',
        title: '神农AI',
        content: '你好，我可以回答药材功效、性味归经、配伍和方剂组成等问题。'
      }
    ]
  };

  const apiCache = new Map();
  const imageCache = new Map();
  let searchTimer = null;
  let requestVersion = 0;

  init();

  async function init() {
    render();
    await hydrateBaseData();
    await hydratePageData();
    state.loading = false;
    render();
  }

  async function hydrateBaseData() {
    const [categories, regions, stats, formulas] = await Promise.allSettled([
      apiGet('/api/herb-categories'),
      apiGet('/api/herb-regions'),
      apiGet('/api/herbs/statistics'),
      apiGet('/api/formulas?limit=100')
    ]);

    if (categories.status === 'fulfilled') {
      state.categories = toLookup(unwrap(categories.value));
    }
    if (regions.status === 'fulfilled') {
      state.regions = toLookup(unwrap(regions.value));
    }
    if (stats.status === 'fulfilled') {
      state.stats = normalizeStats(unwrap(stats.value));
    }
    if (formulas.status === 'fulfilled') {
      state.formulas = normalizeFormulas(unwrap(formulas.value)?.formulas || unwrap(formulas.value) || []);
      state.selectedFormulaId = resolveFormulaId(getQueryParam('formula')) || state.formulas[0]?.id || null;
    }
  }

  async function hydratePageData() {
    if (state.page === 'home') {
      await loadHerbs({ limit: 8 });
      return;
    }
    if (state.page === 'search') {
      await loadHerbs({ limit: 50, useFilters: true });
      return;
    }
    if (state.page === 'detail') {
      await loadDetailHerb();
      return;
    }
    if (state.page === 'formulaDetail') {
      await loadFormulaDetail();
      return;
    }
    if (state.page === 'graph') {
      await Promise.allSettled([loadHerbs({ limit: 60, withImages: false }), loadGraphData(), loadRegionDistribution()]);
      return;
    }
    if (state.page === 'recommendation') {
      await loadRecommendations();
    }
  }

  async function loadHerbs(options = {}) {
    const version = ++requestVersion;
    const limit = options.limit || 50;
    const useFilters = Boolean(options.useFilters);
    const withImages = options.withImages !== false;
    let remote = null;

    try {
      if (state.searchTerm.trim()) {
        const response = await apiGet(`/api/herbs/search?q=${encodeURIComponent(state.searchTerm.trim())}`);
        remote = unwrap(response)?.herbs || [];
      } else {
        const params = new URLSearchParams({ page: '1', limit: String(limit) });
        if (useFilters) {
          const categoryId = lookupId(state.categories, state.category);
          const regionId = lookupId(state.regions, state.region);
          if (categoryId) params.set('category_id', String(categoryId));
          if (regionId) params.set('region_id', String(regionId));
        }
        const response = await apiGet(`/api/herbs?${params.toString()}`);
        remote = unwrap(response)?.herbs || [];
      }
    } catch (error) {
      remote = null;
    }

    if (version !== requestVersion) return;

    if (remote && remote.length) {
      state.herbs = filterNormalizedHerbs(normalizeHerbs(remote));
      if (withImages) await hydrateHerbImages(state.herbs.slice(0, limit));
      state.apiOnline = true;
    } else {
      state.herbs = [];
    }
  }

  async function loadDetailHerb() {
    state.detailHerb = null;

    try {
      let herbId = state.selectedHerbId;
      if (!herbId && state.selectedHerbName) {
        const search = await apiGet(`/api/herbs/search?q=${encodeURIComponent(state.selectedHerbName)}`);
        const found = (unwrap(search)?.herbs || [])[0];
        herbId = found?.id || null;
      }

      if (herbId) {
        const detail = await apiGet(`/api/herbs/${encodeURIComponent(herbId)}`);
        state.detailHerb = normalizeHerb(unwrap(detail));
        await hydrateHerbImages([state.detailHerb]);
        state.apiOnline = true;
        return;
      }

      if (state.selectedHerbName) {
        const detail = await apiGet(`/api/knowledge/herb-details/${encodeURIComponent(state.selectedHerbName)}`);
        state.detailHerb = normalizeHerb(unwrap(detail));
        await hydrateHerbImages([state.detailHerb]);
        state.apiOnline = true;
      }
    } catch (error) {
      state.detailHerb = null;
    }
  }

  async function loadFormulaDetail() {
    state.detailFormula = null;
    const queryId = getQueryParam('id');
    const queryName = getQueryParam('formula');
    const matched = queryId ? null : state.formulas.find((item) => item.name === queryName);
    const formulaId = queryId || matched?.id;
    if (!formulaId) return;

    try {
      const response = await apiGet(`/api/formulas/${encodeURIComponent(formulaId)}`);
      state.detailFormula = normalizeFormula(unwrap(response));
      state.apiOnline = true;
    } catch (error) {
      state.detailFormula = null;
    }
  }

  async function loadGraphData() {
    try {
      const graph = await apiGet('/api/knowledge/graph-data?common=1');
      state.graph = normalizeGraph(unwrap(graph));
      state.apiOnline = true;
    } catch (error) {
      state.graph = null;
    }
  }

  async function loadRegionDistribution() {
    try {
      const response = await apiGet('/api/knowledge/region-distribution');
      state.regionDistribution = unwrap(response);
      state.apiOnline = true;
    } catch (error) {
      state.regionDistribution = null;
    }
  }

  async function loadRecommendations() {
    try {
      const response = await apiGet('/api/recommendations?limit=12');
      const data = unwrap(response) || {};
      state.recommendations = {
        herbs: normalizeRecommendedHerbs(data.herbs || []),
        formulas: normalizeRecommendedFormulas(data.formulas || [])
      };
      state.apiOnline = true;
    } catch (error) {
      state.recommendations = { herbs: [], formulas: [] };
    }
  }

  function render() {
    const hero = getHero();
    document.title = `${hero.title} - ${FALLBACK.siteName || '神农AI'}`;
    app.innerHTML = `
      <div class="page-shell">
        ${renderTopbar()}
        <main>
          ${renderHero(hero)}
          ${renderPage()}
        </main>
        ${renderFooter()}
      </div>
    `;
    bindEvents();
  }

  function renderTopbar() {
    const isAuthenticated = Boolean(localStorage.getItem('authToken') || localStorage.getItem('token'));
    const userName = isAuthenticated ? getStoredUserName() : '';
    const userLabel = userName || '个人中心';
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="index.html">
            <div class="brand-mark"><img src="assets/herb-ornament.svg" alt="神农AI图标"></div>
            <div class="brand-copy">
              <p class="brand-name">${escapeHtml(FALLBACK.siteName || '神农AI')}</p>
              <p class="brand-subtitle">${escapeHtml(FALLBACK.siteTagline || '中药药材知识图谱系统')}</p>
            </div>
          </a>
          <div class="user-entry">
            <a class="btn ${isAuthenticated ? 'btn-secondary' : 'btn-primary'}" href="${isAuthenticated ? 'profile.html' : 'login.html'}" aria-label="${isAuthenticated ? '打开个人中心' : '登录'}"><i class="fa-solid ${isAuthenticated ? 'fa-user' : 'fa-right-to-bracket'}"></i> ${isAuthenticated ? escapeHtml(userLabel) : '登录'}</a>
          </div>
        </div>
        <nav class="nav">
          <div class="nav-inner">
            ${(FALLBACK.nav || []).map((item) => `
              <a class="nav-link${item.id === state.page ? ' active' : ''}" href="${item.href}">
                <i class="fa-solid ${item.icon}"></i>${escapeHtml(item.label)}
              </a>
            `).join('')}
          </div>
        </nav>
      </header>
    `;
  }

  function renderHero(hero) {
    return `
      <section class="hero-wrap">
        <div class="hero">
          <div class="hero-copy">
            <span class="hero-kicker"><i class="fa-solid fa-leaf"></i>${escapeHtml(hero.kicker)}</span>
            <h1>${escapeHtml(hero.title)}</h1>
            <p>${escapeHtml(hero.text)}</p>
            <div class="hero-actions">
              ${hero.actions.map((item) => `
                <a class="btn ${item.kind === 'primary' ? 'btn-primary' : 'btn-secondary'}" href="${item.href}">
                  <i class="fa-solid ${item.icon}"></i>${escapeHtml(item.label)}
                </a>
              `).join('')}
            </div>
            <div class="hero-meta grid grid-3" style="margin-top: 20px;">
              ${hero.stats.map((item) => `
                <div class="card stat-card">
                  <span class="stat-value">${escapeHtml(item.value)}</span>
                  <span class="stat-label">${escapeHtml(item.label)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="hero-visual"><img src="assets/new-hero.png" alt="神农AI系统示意图"></div>
        </div>
      </section>
    `;
  }

  function renderPage() {
    if (state.page === 'search') return renderSearch();
    if (state.page === 'detail') return renderDetail();
    if (state.page === 'graph') return renderGraph();
    if (state.page === 'qa') return renderQA();
    if (state.page === 'formula') return renderFormula();
    if (state.page === 'formulaDetail') return renderFormulaDetailPage();
    if (state.page === 'recommendation') return renderRecommendation();
    if (state.page === 'design') return renderDesign();
    return renderHome();
  }

  function renderHome() {
    const herbs = state.herbs.slice(0, 4);
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">首页概览</h2>
            <p class="section-note">总览药材、方剂、分类和产地数据。</p>
          </div>
        </div>
        <div class="grid grid-4">
          <div class="card stat-card"><span class="stat-value">${displayCount(state.stats.total_herbs || herbs.length)}</span><span class="stat-label">药材总数</span></div>
          <div class="card stat-card"><span class="stat-value">${displayCount(state.formulas.length)}</span><span class="stat-label">方剂条目</span></div>
          <div class="card stat-card"><span class="stat-value">${displayCount(state.stats.by_category.length || state.categories.length)}</span><span class="stat-label">分类维度</span></div>
          <div class="card stat-card"><span class="stat-value">${displayCount(state.stats.by_region.length || state.regions.length)}</span><span class="stat-label">产地维度</span></div>
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">分类统计</h2>
            <p class="section-note">统计药材在各类别下的数量分布。</p>
          </div>
        </div>
        <div class="grid grid-3">
          ${state.stats.by_category.slice(0, 6).map(renderStatListCard).join('') || '<div class="empty-state">暂无分类统计。</div>'}
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">重点药材</h2>
            <p class="section-note">浏览精选常用药材。</p>
          </div>
          <a class="link-btn" href="herb-search.html">查看全部药材</a>
        </div>
        <div class="grid grid-2">${herbs.map(renderHerbCard).join('') || '<div class="empty-state">暂无药材数据。</div>'}</div>
      </section>
    `;
  }

  function renderSearch() {
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材查询</h2>
            <p class="section-note">按名称、分类和产地筛选药材。</p>
          </div>
          ${state.herbs[0] ? `<a class="link-btn" href="herb-detail.html?id=${encodeURIComponent(state.herbs[0].id)}&herb=${encodeURIComponent(state.herbs[0].name)}">打开首条详情</a>` : ''}
        </div>
        <div class="toolbar">
          <div class="field">
            <label for="searchTerm">药材名称</label>
            <input class="input js-search-term" id="searchTerm" value="${escapeAttr(state.searchTerm)}" placeholder="输入名称、拼音、别名或功效">
          </div>
          <div class="field">
            <label for="categoryFilter">分类</label>
            <select class="select js-search-category" id="categoryFilter">${renderOptions(['全部', ...state.categories.map((item) => item.name)], state.category)}</select>
          </div>
          <div class="field">
            <label for="regionFilter">产地</label>
            <select class="select js-search-region" id="regionFilter">${renderOptions(['全部', ...state.regions.map((item) => item.name)], state.region)}</select>
          </div>
          <button class="btn btn-secondary" id="resetSearch"><i class="fa-solid fa-rotate-left"></i> 重置</button>
        </div>
        <div class="section-header" style="margin-top: 18px;">
          <div>
            <h2 class="section-title">匹配结果</h2>
            <p class="section-note">当前显示 ${state.herbs.length} 味药材。</p>
          </div>
        </div>
        <div class="grid grid-2">${state.herbs.map(renderHerbCard).join('') || '<div class="empty-state">没有找到匹配药材，请调整筛选条件。</div>'}</div>
      </section>
    `;
  }

  function renderDetail() {
    const herb = state.detailHerb;
    if (!herb) {
      return `<section class="section"><div class="empty-state">暂无药材详情，请从药材查询页选择一条药材。</div></section>`;
    }
    const relatedFormulas = findRelatedFormulas(herb);
    const relatedHerbs = state.herbs.filter((item) => item.id !== herb.id && item.category === herb.category).slice(0, 4);

    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材详情</h2>
            <p class="section-note">查看药材的性味、归经、功效等完整信息。</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-secondary" href="herb-search.html"><i class="fa-solid fa-arrow-left"></i> 返回查询</a>
            <a class="btn btn-primary" href="knowledge-graph.html?herb=${encodeURIComponent(herb.name)}"><i class="fa-solid fa-diagram-project"></i> 打开图谱</a>
          </div>
        </div>
        <div class="detail-layout">
          <div class="detail-main">
            <div class="card detail-hero">
              ${renderHerbImage(herb, 'detail-thumb')}
              <div>
                <div class="tag-row">
                  <span class="tag">${escapeHtml(herb.category || '未分类')}</span>
                  <span class="tag">${escapeHtml(herb.region || '未知产地')}</span>
                  ${herb.isCommon ? '<span class="tag">常用药</span>' : ''}
                </div>
                <h3 style="margin-top: 12px; font-size: 30px;">${escapeHtml(herb.name)}</h3>
                ${herb.source ? `<p>${escapeHtml(herb.source)}</p>` : ''}
                <p>${escapeHtml(herb.description || '暂无描述。')}</p>
              </div>
            </div>
            <div class="grid grid-2" style="margin-top: 16px;">
              ${renderInfoCard('性味', herb.nature || herb.properties.join('、') || '暂无')}
              ${renderInfoCard('用法用量', herb.usage || '暂无')}
              ${renderInfoCard('功效', herb.efficacy.join('、') || '暂无')}
              ${renderInfoCard('注意事项', herb.caution || '暂无')}
            </div>
            <div class="grid grid-2" style="margin-top: 16px;">
              <div class="card pad"><h3>归经</h3><div class="chip-row">${renderChips(herb.meridian)}</div></div>
              <div class="card pad"><h3>相关方剂</h3><div class="list-stack">${relatedFormulas.map(renderFormulaLinkItem).join('') || '<div class="empty-state">暂无关联方剂。</div>'}</div></div>
            </div>
          </div>
          <aside>
            <div class="card pad">
              <h3>药材档案</h3>
              <dl class="fact-list">
                <div><dt>别名</dt><dd>${escapeHtml(herb.aliases.join('、') || '暂无')}</dd></div>
                <div><dt>来源</dt><dd>${escapeHtml(herb.source || '暂无')}</dd></div>
                <div><dt>产地</dt><dd>${escapeHtml(herb.region || '暂无')}</dd></div>
                <div><dt>分类</dt><dd>${escapeHtml(herb.category || '暂无')}</dd></div>
              </dl>
            </div>
            <div class="card pad" style="margin-top: 16px;"><h3>同类药材</h3><div class="list-stack">${relatedHerbs.map(renderHerbLinkItem).join('') || '<div class="empty-state">暂无同类药材。</div>'}</div></div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderGraph() {
    const graphView = buildGraphView();
    const hasGraph = graphView.nodes.length > 0;
    const graphToolbar = hasGraph ? `
      <div class="toolbar" style="grid-template-columns: minmax(0, 1fr) auto;">
        <div class="field">
          <label for="graphHerbSelect">中心药材</label>
          <select class="select js-graph-herb" id="graphHerbSelect">${graphView.herbs.map((item) => `<option value="${escapeAttr(item.name)}"${item.name === graphView.focusName ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
        </div>
        <a class="btn btn-primary" href="herb-detail.html?herb=${encodeURIComponent(graphView.focusName)}"><i class="fa-solid fa-circle-info"></i> 打开详情</a>
      </div>
    ` : '<div class="empty-state">暂无知识图谱数据。</div>'; 
    const graphCanvas = hasGraph ? `
      <div class="graph-canvas" role="img" aria-label="药材知识图谱关系图">
        <svg class="graph-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${graphView.lines.map((item) => `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.stroke}" stroke-width="0.7" stroke-linecap="round" />`).join('')}</svg>
        ${graphView.nodes.map((item) => renderGraphNode(item)).join('')}
      </div>
    ` : '<div class="graph-canvas empty-graph"><div class="empty-state">暂无可展示的图谱节点或关系。</div></div>'; 
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">知识图谱</h2>
            <p class="section-note">通过关系网络直观展示药材之间的关联结构。</p>
          </div>
        </div>
        <div class="graph-layout">
          <div class="graph-stage">
            ${graphToolbar}
            ${graphCanvas}
            ${hasGraph ? `<div class="graph-legend">${graphView.legend.map((item) => `<span class="legend-item"><span class="legend-dot" style="--color:${item.color}"></span>${escapeHtml(item.label)}</span>`).join('')}</div>` : ''}
          </div>
          <aside>
            <div class="card pad"><h3>图谱规模</h3><p>节点 ${graphView.totalNodes} 个，关系 ${graphView.totalLinks} 条。</p><div class="chip-row"><span class="chip">常用药视图</span></div></div>
            ${renderRegionDistribution()}
          </aside>
        </div>
      </section>
    `;
  }

  function renderQA() {
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">AI 问答</h2><p class="section-note">围绕药材功效、配伍和方剂组成提问。</p></div><a class="link-btn" href="formula-library.html">打开方剂库</a></div>
        <div class="qa-panel card" aria-label="AI 问答面板">
          <div class="qa-panel-header">
            <div><h3>神农问答</h3><p>输入问题后获取回答。</p></div>
            <div class="chip-row"><span class="tag">药材功效</span><span class="tag">性味归经</span><span class="tag">方剂组成</span></div>
          </div>
          <div class="chat-feed" id="chatFeed" aria-live="polite">${state.chat.map(renderMessage).join('')}</div>
          <div class="suggestion-row">${['黄芪的主要功效是什么？', '四君子汤的组成与作用是什么？', '人参与黄芪如何配伍？', '麻黄汤适合什么证型？'].map((item) => `<button class="btn btn-secondary suggested-question" data-question="${escapeAttr(item)}">${escapeHtml(item)}</button>`).join('')}</div>
          <div class="chat-composer"><label class="sr-only" for="questionInput">输入问题</label><textarea id="questionInput" class="textarea" placeholder="输入你的问题，例如：黄芪适合什么证型？"></textarea><button class="submit-btn" id="sendQuestion"><i class="fa-solid fa-paper-plane"></i> 发送</button></div>
        </div>
      </section>
    `;
  }

  function renderRecommendation() {
    const herbs = state.recommendations.herbs || [];
    const formulas = state.recommendations.formulas || [];
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">推荐</h2><p class="section-note">基于药材库与方剂库整理常用推荐。</p></div><a class="link-btn" href="herb-search.html">继续查询药材</a></div>
        <div class="grid grid-2">
          <div class="card pad"><h3>推荐药材</h3><div class="list-stack">${herbs.map(renderRecommendationHerbItem).join('') || '<div class="empty-state">暂无推荐药材。</div>'}</div></div>
          <div class="card pad"><h3>推荐方剂</h3><div class="list-stack">${formulas.map(renderRecommendationFormulaItem).join('') || '<div class="empty-state">暂无推荐方剂。</div>'}</div></div>
        </div>
      </section>
    `;
  }

  function renderFormula() {
    const formulas = filterFormulas();
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">方剂库</h2><p class="section-note">浏览方剂名称、分类和来源，点击卡片查看详情。</p></div><a class="link-btn" href="qa.html">去 AI 问答</a></div>
        <div class="toolbar">
          <div class="field"><label for="formulaTerm">方剂名称</label><input class="input js-formula-term" id="formulaTerm" value="${escapeAttr(state.formulaTerm)}" placeholder="输入方剂名或组成药材"></div>
          <div class="field"><label for="formulaCategory">分类</label><select class="select js-formula-category" id="formulaCategory">${renderOptions(['全部', ...new Set(state.formulas.map((item) => item.category).filter(Boolean))], state.formulaCategory)}</select></div>
          <button class="btn btn-secondary" id="resetFormula"><i class="fa-solid fa-rotate-left"></i> 重置</button>
        </div>
        <div class="formula-layout"><div class="formula-main"><div class="formula-card-grid">${formulas.map(renderFormulaCard).join('') || '<div class="empty-state">没有匹配方剂。</div>'}</div></div></div>
      </section>
    `;
  }

  function renderFormulaDetailPage() {
    const formula = state.detailFormula;
    if (!formula) {
      return `<section class="section"><div class="empty-state">未找到方剂详情，请从方剂库重新选择。</div></section>`;
    }
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">方剂详情</h2><p class="section-note">查看方剂来源、组成和使用注意。</p></div><a class="link-btn" href="formula-library.html">返回方剂库</a></div>
        <div class="formula-detail-layout">
          <div class="card pad formula-detail-card"><h3>${escapeHtml(formula.name)}</h3>${renderFormulaMeta(formula)}${renderOptionalParagraph(formula.description)}</div>
          ${renderFormulaHerbs(formula.herbItems)}
          ${renderFormulaFieldCard('主治', formula.indication)}
          ${renderFormulaFieldCard('用法', formula.usage)}
          ${renderFormulaFieldCard('注意事项', formula.caution)}
        </div>
      </section>
    `;
  }

  function renderDesign() {
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">设计系统</h2><p class="section-note">集中展示神农AI前端用到的颜色、按钮和组件样式。</p></div></div>
        <div class="grid grid-2">
          <div class="card pad"><h3>颜色 token</h3><table class="token-table"><thead><tr><th>名称</th><th>值</th><th>用途</th><th>预览</th></tr></thead><tbody>${(FALLBACK.tokens || []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.usage)}</td><td><span class="swatch" style="--color:${item.value}"></span></td></tr>`).join('')}</tbody></table></div>
          <div class="card pad"><h3>颜色 token</h3><table class="token-table"><thead><tr><th>名称</th><th>值</th><th>用途</th><th>预览</th></tr></thead><tbody>${(FALLBACK.tokens || []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.usage)}</td><td><span class="swatch" style="--color:${item.value}"></span></td></tr>`).join('')}</tbody></table></div>
        </div>
      </section>
    `;
  }

  function bindEvents() {
    if (state.page === 'search') bindSearch();
    if (state.page === 'graph') bindGraph();
    if (state.page === 'qa') bindQA();
    if (state.page === 'formula') bindFormula();
  }

  function bindSearch() {
    document.querySelector('.js-search-term')?.addEventListener('input', (event) => {
      state.searchTerm = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        state.loading = true;
        await loadHerbs({ limit: 50, useFilters: true });
        state.loading = false;
        render();
      }, 300);
    });
    document.querySelector('.js-search-category')?.addEventListener('change', async (event) => {
      state.category = event.target.value;
      await loadHerbs({ limit: 50, useFilters: true });
      render();
    });
    document.querySelector('.js-search-region')?.addEventListener('change', async (event) => {
      state.region = event.target.value;
      await loadHerbs({ limit: 50, useFilters: true });
      render();
    });
    document.getElementById('resetSearch')?.addEventListener('click', async () => {
      state.searchTerm = '';
      state.category = '全部';
      state.region = '全部';
      await loadHerbs({ limit: 50, useFilters: true });
      render();
    });
  }

  function bindGraph() {
    document.querySelector('.js-graph-herb')?.addEventListener('change', (event) => {
      state.selectedHerbName = event.target.value;
      render();
    });
  }

  function bindQA() {
    const input = document.getElementById('questionInput');
    const send = async () => {
      const question = input?.value.trim();
      if (!question) return;
      state.chat.push({ role: 'user', content: question });
      state.chat.push({ role: 'assistant', title: '神农AI', content: '正在整理回答...' });
      render();
      try {
        const response = await apiPost('/api/ai-gateway/chat', { question });
        state.chat[state.chat.length - 1].content = unwrap(response)?.answer || '暂无回答内容。';
      } catch (error) {
        state.chat[state.chat.length - 1].content = '问答暂时不可用，请稍后重试。';
      }
      render();
    };
    document.getElementById('sendQuestion')?.addEventListener('click', send);
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
    document.querySelectorAll('.suggested-question').forEach((item) => {
      item.addEventListener('click', () => {
        if (input) input.value = item.dataset.question || '';
        input?.focus();
      });
    });
  }

  function bindFormula() {
    document.querySelector('.js-formula-term')?.addEventListener('input', (event) => {
      state.formulaTerm = event.target.value;
      render();
    });
    document.querySelector('.js-formula-category')?.addEventListener('change', (event) => {
      state.formulaCategory = event.target.value;
      render();
    });
    document.getElementById('resetFormula')?.addEventListener('click', () => {
      state.formulaTerm = '';
      state.formulaCategory = '全部';
      render();
    });
  }

  async function apiGet(path) {
    if (apiCache.has(path)) return apiCache.get(path);
    const urls = buildApiUrls(path);
    let lastError;
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
          const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const json = await response.json();
          if (json && json.success === false) throw new Error(json.message || 'API request failed');
          apiCache.set(path, json);
          state.apiOnline = true;
          return json;
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('API unavailable');
  }

  async function apiPost(path, body) {
    const urls = buildApiUrls(path);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    let lastError;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          credentials: 'same-origin'
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json.success === false) throw new Error(json.message || `HTTP ${response.status}`);
        return json;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('API unavailable');
  }

  async function hydrateHerbImages(herbs) {
    const targets = (Array.isArray(herbs) ? herbs : []).filter((herb) => herb?.id && !herb.imageUrl);
    await Promise.allSettled(targets.map(async (herb) => {
      const imageUrl = await loadHerbImage(herb.id);
      if (imageUrl) herb.imageUrl = imageUrl;
    }));
  }

  async function loadHerbImage(herbId) {
    if (imageCache.has(herbId)) return imageCache.get(herbId);
    try {
      const response = await apiGet(`/api/herb-images/${encodeURIComponent(herbId)}`);
      const imageUrl = firstImageUrl(unwrap(response)?.images || []);
      imageCache.set(herbId, imageUrl);
      return imageUrl;
    } catch (error) {
      imageCache.set(herbId, '');
      return '';
    }
  }

  function firstImageUrl(images) {
    const image = (Array.isArray(images) ? images : []).find((item) => item?.path || item?.url || item?.image_url || item?.imageUrl || item?.thumbnail || item?.thumbnail_url);
    return image ? absoluteAssetUrl(image.path || image.url || image.image_url || image.imageUrl || image.thumbnail || image.thumbnail_url) : '';
  }

  function absoluteAssetUrl(value) {
    if (!value) return '';
    const url = String(value);
    if (/^https?:\/\//i.test(url)) return url;
    return `http://localhost:3001${url.startsWith('/') ? url : `/${url}`}`;
  }

  function buildApiUrls(path) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const urls = [cleanPath];
    if (window.location.origin !== 'http://localhost:3001') urls.push(`http://localhost:3001${cleanPath}`);
    if (window.location.origin !== 'http://127.0.0.1:3001') urls.push(`http://127.0.0.1:3001${cleanPath}`);
    return [...new Set(urls)];
  }

  function normalizeHerbs(items) {
    return (Array.isArray(items) ? items : []).map(normalizeHerb).filter((item) => item.name);
  }

  function normalizeHerb(raw) {
    const source = raw?.basicInfo ? { ...raw.basicInfo, ...raw } : raw || {};
    const aliases = normalizeList(source.aliases || source.alias);
    const efficacy = normalizeList(source.efficacy || source.efficacies, 'name');
    const meridian = normalizeList(source.meridian || source.meridians, 'name');
    const properties = normalizeList(source.properties, 'name');
    const formulas = normalizeFormulas(source.formulas || []);
    const category = source.category || source.category_name || source.categoryName || '';
    const region = source.region || source.region_name || source.regionName || '';
    const nature = source.nature || properties.join('、') || source.property || '';
    const images = normalizeImages(source.images || source.imageList || []);
    const imageUrl = firstImageUrl(images) || absoluteAssetUrl(source.image || source.image_url || source.imageUrl || source.thumbnail || source.thumbnail_url || '');
    return {
      id: source.id || source.herb_id || source.name,
      name: source.name || '',
      pinyin: source.pinyin || '',
      aliases,
      category,
      region,
      source: source.source || source.source_name || source.sourceName || '',
      nature,
      properties,
      meridian,
      efficacy,
      usage: source.usage || source.usage_dosage || source.usageDosage || '',
      caution: source.caution || '',
      description: source.description || source.efficacy || '',
      composition: normalizeList(source.composition),
      formulas,
      formulaIds: normalizeList(source.formulaIds).map(Number).filter(Boolean),
      isCommon: Boolean(source.is_common || source.isCommon),
      images,
      imageUrl
    };
  }

  function normalizeFormulas(items) {
    return (Array.isArray(items) ? items : []).map(normalizeFormula).filter((item) => item.name);
  }

  function normalizeImages(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return [value];
    const text = String(value).trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (error) {
      return [{ path: text }];
    }
    return [];
  }

  function normalizeFormula(item) {
    const source = item || {};
    const rawHerbs = Array.isArray(source.herbs) ? source.herbs : normalizeList(source.herbs || source.ingredients || source.composition).map((name) => ({ name }));
    const herbItems = rawHerbs.map((herb) => {
      if (herb && typeof herb === 'object') {
        return {
          id: herb.herb_id || herb.herbId || herb.id || '',
          name: herb.name || herb.herbName || '',
          pinyin: herb.pinyin || '',
          dosage: herb.dosage || '',
          role: herb.role || '',
          note: herb.note || ''
        };
      }
      return { id: '', name: String(herb || ''), pinyin: '', dosage: '', role: '', note: '' };
    }).filter((herb) => herb.name);

    return {
      id: source.id || source.formula_id || '',
      name: source.name || '',
      pinyin: source.pinyin || '',
      category: source.category || source.type || '',
      source: source.source || '',
      description: source.description || '',
      usage: source.usage || source.usage_dosage || source.usageDosage || '',
      caution: source.caution || '',
      indication: source.indication || '',
      herbs: herbItems.map((herb) => herb.name),
      herbItems
    };
  }

  function normalizeRecommendedHerbs(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      id: item.id || item.herb_id || item.name,
      name: item.name || '',
      category: item.category || item.category_name || '',
      region: item.region || item.region_name || '',
      reason: item.reason || '',
      efficacy: normalizeList(item.efficacy_names || item.efficacies, 'name')
    })).filter((item) => item.name);
  }

  function normalizeRecommendedFormulas(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
      id: item.id || '',
      name: item.name || '',
      category: item.category || '方剂',
      source: item.source || '',
      herbs: normalizeList(item.herb_names || item.herbs, 'name'),
      reason: item.reason || ''
    })).filter((item) => item.name);
  }

  function normalizeGraph(raw) {
    if (!raw || !Array.isArray(raw.nodes)) return null;
    return {
      nodes: raw.nodes.map((node) => ({
        id: node.id,
        labels: node.labels || [inferNodeType(node.id)],
        type: (node.labels || [inferNodeType(node.id)])[0],
        name: node.properties?.name || node.name || node.id,
        description: node.properties?.description || '',
        properties: node.properties || {}
      })),
      links: (raw.links || []).map((link) => ({
        source: typeof link.source === 'object' ? link.source.id : link.source,
        target: typeof link.target === 'object' ? link.target.id : link.target,
        type: link.type || ''
      }))
    };
  }

  function buildGraphView() {
    if (state.graph) return buildRemoteGraphView(state.graph);
    return buildEmptyGraphView();
  }

  function buildRemoteGraphView(graph) {
    const herbs = graph.nodes.filter((node) => node.type === 'Herb').map((node) => ({ id: node.id, name: node.name }));
    const focusName = state.selectedHerbName || herbs[0]?.name || '';
    const focus = graph.nodes.find((node) => node.type === 'Herb' && node.name === focusName) || graph.nodes.find((node) => node.type === 'Herb');
    if (!focus) return buildEmptyGraphView();

    const relatedLinks = graph.links.filter((link) => link.source === focus.id || link.target === focus.id).slice(0, 10);
    const relatedIds = new Set([focus.id]);
    relatedLinks.forEach((link) => {
      relatedIds.add(link.source);
      relatedIds.add(link.target);
    });

    const nodes = [...relatedIds].map((id) => graph.nodes.find((node) => node.id === id)).filter(Boolean);
    const positioned = layoutNodes(nodes, focus.id);
    return {
      herbs,
      focusName: focus.name,
      nodes: positioned,
      lines: relatedLinks.map((link) => {
        const source = positioned.find((node) => node.id === link.source);
        const target = positioned.find((node) => node.id === link.target);
        return source && target ? { x1: source.x, y1: source.y, x2: target.x, y2: target.y, stroke: colorForType(target.type) } : null;
      }).filter(Boolean),
      legend: graphLegend(),
      totalNodes: graph.nodes.length,
      totalLinks: graph.links.length
    };
  }

  function buildEmptyGraphView() {
    return {
      herbs: state.herbs.map((item) => ({ id: item.id, name: item.name })),
      focusName: '',
      nodes: [],
      lines: [],
      legend: graphLegend(),
      totalNodes: 0,
      totalLinks: 0
    };
  }

  function layoutNodes(nodes, centerId) {
    const center = nodes.find((node) => node.id === centerId) || nodes[0];
    const others = nodes.filter((node) => node.id !== center.id);
    const positioned = [{ ...center, center: true, x: 50, y: 50, color: colorForType(center.type || 'Herb'), subtitle: '中心药材' }];
    others.forEach((node, index) => {
      const angle = (-90 + index * (360 / Math.max(others.length, 1))) * Math.PI / 180;
      positioned.push({
        ...node,
        x: 50 + Math.cos(angle) * 31,
        y: 50 + Math.sin(angle) * 31,
        color: colorForType(node.type),
        subtitle: node.type || inferNodeType(node.id)
      });
    });
    return positioned;
  }

  function renderGraphNode(item) {
    const tag = item.type === 'Herb' ? 'a' : 'div';
    const href = item.type === 'Herb' ? ` href="herb-detail.html?herb=${encodeURIComponent(item.name)}"` : '';
    return `<${tag} class="graph-node${item.center ? ' center' : ''}"${href} style="left:${item.x}%; top:${item.y}%; --node:${item.color};"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.subtitle || item.type || '')}</small></${tag}>`;
  }

  function renderRegionDistribution() {
    const regions = state.regionDistribution?.regions || [];
    if (!regions.length) return `<div class="card pad" style="margin-top: 16px;"><h3>产地分布</h3><p>暂无产地分布数据。</p></div>`;
    return `
      <div class="card pad" style="margin-top: 16px;">
        <h3>产地分布</h3>
        <div class="list-stack">${regions.slice(0, 6).map((item) => `<div class="list-item"><span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description || '')}</p></span><span class="tag">${displayCount(item.herb_count)}</span></div>`).join('')}</div>
      </div>
    `;
  }

  function renderHerbCard(item) {
    return `
      <a class="card herb-card" href="herb-detail.html?id=${encodeURIComponent(item.id)}&herb=${encodeURIComponent(item.name)}">
        ${renderHerbImage(item, 'herb-thumb')}
        <div>
          <div class="herb-meta"><h3>${escapeHtml(item.name)}</h3></div>
          <p>${escapeHtml(item.description || item.efficacy.join('、') || '暂无描述。')}</p>
          <div class="tag-row"><span class="tag">${escapeHtml(item.category || '未分类')}</span><span class="tag">${escapeHtml(item.region || '未知产地')}</span>${item.isCommon ? '<span class="tag">常用药</span>' : ''}</div>
        </div>
      </a>
    `;
  }

  function renderFormulaCard(item) {
    const meta = [item.category, item.source ? `来源：${item.source}` : ''].filter(Boolean);
    return `
      <a class="card formula-card" href="${formulaDetailHref(item)}">
        <h3>${escapeHtml(item.name)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        ${meta.length ? `<div class="tag-row">${meta.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join('')}</div>` : ''}
        ${item.herbs.length ? `<div class="chip-row formula-card-herbs">${item.herbs.slice(0, 4).map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join('')}</div>` : ''}
      </a>
    `;
  }

  function renderHerbImage(item, className) {
    if (item.imageUrl) {
      return `<div class="${className} has-image"><img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}药材图片" loading="lazy"></div>`;
    }
    return `<div class="${className} no-image"><span>暂无药材图片</span></div>`;
  }

  function renderFormulaMeta(formula) {
    const items = [formula.category, formula.source ? `来源：${formula.source}` : ''].filter(Boolean);
    if (!items.length) return '';
    return `<div class="tag-row formula-meta-tags">${items.map((value) => `<span class="tag">${escapeHtml(value)}</span>`).join('')}</div>`;
  }

  function renderOptionalParagraph(text) {
    return text ? `<p>${escapeHtml(text)}</p>` : '';
  }

  function renderFormulaHerbs(items) {
    if (!items.length) return '';
    return `<div class="card pad formula-detail-card"><h3>组成药材</h3><div class="formula-herb-list">${items.map(renderFormulaHerbItem).join('')}</div></div>`;
  }

  function renderFormulaHerbItem(item) {
    const href = item.id ? `herb-detail.html?id=${encodeURIComponent(item.id)}&herb=${encodeURIComponent(item.name)}` : `herb-detail.html?herb=${encodeURIComponent(item.name)}`;
    const details = [item.dosage, item.role ? `角色：${item.role}` : '', item.note].filter(Boolean).join(' · ');
    return `<a class="list-item" href="${href}"><span><strong>${escapeHtml(item.name)}</strong>${details ? `<p>${escapeHtml(details)}</p>` : ''}</span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderFormulaFieldCard(title, text) {
    return text ? `<div class="card pad formula-detail-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>` : '';
  }

  function renderInfoCard(title, text) {
    return `<div class="card pad"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || '暂无')}</p></div>`;
  }

  function renderStatListCard(item) {
    return `<div class="card stat-card"><span class="stat-value">${displayCount(item.count)}</span><span class="stat-label">${escapeHtml(item.name)}</span></div>`;
  }

  function renderFormulaLinkItem(item) {
    return `<a class="list-item" href="${formulaDetailHref(item)}"><span><strong>${escapeHtml(item.name)}</strong>${item.category ? `<p>${escapeHtml(item.category)}</p>` : ''}</span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderHerbLinkItem(item) {
    return `<a class="list-item" href="herb-detail.html?herb=${encodeURIComponent(item.name)}"><span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category)} · ${escapeHtml(item.region)}</p></span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderRecommendationHerbItem(item) {
    return `<a class="list-item" href="herb-detail.html?id=${encodeURIComponent(item.id)}&herb=${encodeURIComponent(item.name)}"><span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml([item.category, item.region, item.reason].filter(Boolean).join(' · '))}</p></span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderRecommendationFormulaItem(item) {
    const detail = [item.category, item.reason].filter(Boolean).join(' · ');
    return `<a class="list-item" href="${formulaDetailHref(item)}"><span><strong>${escapeHtml(item.name)}</strong>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}</span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function formulaDetailHref(item) {
    const params = new URLSearchParams();
    if (item.id) params.set('id', item.id);
    params.set('formula', item.name);
    return `formula-detail.html?${params.toString()}`;
  }

  function renderMessage(item) {
    return `<div class="message ${item.role === 'user' ? 'user' : 'assistant'}">${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ''}<div>${escapeHtml(item.content)}</div></div>`;
  }

  function renderChips(items) {
    return (items && items.length ? items : ['暂无']).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('');
  }

  function filterNormalizedHerbs(items) {
    const term = normalizeText(state.searchTerm);
    return items.filter((item) => {
      const text = normalizeText([item.name, item.pinyin, item.aliases.join(' '), item.description, item.efficacy.join(' ')].join(' '));
      const matchedTerm = !term || text.includes(term);
      const matchedCategory = state.category === '全部' || item.category === state.category;
      const matchedRegion = state.region === '全部' || item.region === state.region;
      return matchedTerm && matchedCategory && matchedRegion;
    });
  }

  function filterFormulas() {
    const term = normalizeText(state.formulaTerm);
    return state.formulas.filter((item) => {
      const matchedTerm = !term || normalizeText([item.name, item.herbs.join(' '), item.description, item.usage, item.caution].join(' ')).includes(term);
      const matchedCategory = state.formulaCategory === '全部' || item.category === state.formulaCategory;
      return matchedTerm && matchedCategory;
    });
  }

  function findRelatedFormulas(herb) {
    const remote = normalizeFormulas(herb.formulas || []);
    if (remote.length) return remote;
    return state.formulas.filter((formula) => formula.herbs.includes(herb.name) || herb.formulaIds.includes(Number(formula.id))).slice(0, 4);
  }

  function resolveFormulaId(query) {
    if (!query) return null;
    const found = state.formulas.find((item) => String(item.id) === String(query) || item.name === query);
    return found ? found.id : null;
  }

  function getHero() {
    const stats = state.stats || normalizeStats({});
    const commonStats = [
      { value: displayCount(stats.total_herbs), label: '药材总数' },
      { value: displayCount(stats.by_category.length || state.categories.length), label: '分类维度' },
      { value: displayCount(state.formulas.length), label: '方剂条目' }
    ];
    const copy = {
      home: ['神农AI', '中药药材知识图谱系统', '提供药材查询、详情、图谱、问答和方剂浏览。'],
      search: ['药材查询', '按名称、分类和产地筛选药材', '支持关键词、分类和产地筛选。'],
      detail: ['药材详情', '查看单味药材的性味、功效与配伍', '展示药材的性味、归经、功效和相关方剂。'], 
      graph: ['知识图谱', '把药材、功效、归经和产地串起来', '查看药材、功效、归经和产地之间的关系。'],
      qa: ['AI 问答', '围绕药材和方剂进行自然语言提问', '提出药材功效、归经、配伍和方剂组成等问题。'],
      formula: ['方剂库', '按方名与分类浏览经典方剂', '浏览经典方剂及其组成药材。'],
      formulaDetail: ['方剂详情', '查看方剂来源、组成和注意事项', '详情来自后端方剂接口。'],
      recommendation: ['推荐', '基于药材库生成推荐列表', '按常用药、方剂收录和药材关系整理推荐。'],
      design: ['设计系统', '统一颜色、字体、组件和数据状态', '集中展示颜色 token、按钮样式和组件示例。']
    }[state.page] || [];
    return {
      kicker: copy[0],
      title: copy[1],
      text: copy[2],
      stats: commonStats,
      actions: [
        { href: 'herb-search.html', label: '进入药材查询', icon: 'fa-magnifying-glass', kind: 'primary' },
        { href: 'knowledge-graph.html', label: '查看知识图谱', icon: 'fa-diagram-project', kind: 'secondary' }
      ]
    };
  }


  function normalizeStats(raw) {
    return {
      total_herbs: Number(raw?.total_herbs || raw?.totalHerbs || 0),
      by_category: normalizeStatRows(raw?.by_category),
      by_region: normalizeStatRows(raw?.by_region),
      by_efficacy: normalizeStatRows(raw?.by_efficacy),
      common_by_category: normalizeStatRows(raw?.common_by_category)
    };
  }

  function normalizeStatRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((item) => ({ name: item.name || item.category || item.region || '未命名', count: Number(item.count || item.herb_count || 0) }));
  }

  function countBy(items, key) {
    const map = new Map();
    items.forEach((item) => {
      const name = item[key] || '未分类';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }

  function unwrap(response) {
    return response?.data ?? response;
  }

  function normalizeList(value, prop) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => prop && item && typeof item === 'object' ? item[prop] : item).filter(Boolean).map(String);
    return String(value).split(/[、,，;；\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  function toLookup(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => typeof item === 'string' ? { id: index + 1, name: item } : { id: item.id || index + 1, name: item.name || String(item) }).filter((item) => item.name);
  }

  function lookupId(items, name) {
    if (!name || name === '全部') return null;
    return items.find((item) => item.name === name)?.id || null;
  }

  function inferNodeType(id) {
    const value = String(id || '').split('_')[0];
    return { herb: 'Herb', category: 'Category', region: 'Region', source: 'Source', property: 'Property', meridian: 'Meridian', efficacy: 'Efficacy' }[value] || 'Node';
  }

  function colorForType(type) {
    return {
      Herb: '#2f7651',
      Category: '#14766f',
      Region: '#a83d30',
      Source: '#8c7b59',
      Property: '#c67517',
      Meridian: '#3c7d8c',
      Efficacy: '#7f3d3d'
    }[type] || '#627069';
  }

  function graphLegend() {
    return [
      { label: '药材', color: colorForType('Herb') },
      { label: '分类', color: colorForType('Category') },
      { label: '产地', color: colorForType('Region') },
      { label: '性味', color: colorForType('Property') },
      { label: '归经', color: colorForType('Meridian') },
      { label: '功效', color: colorForType('Efficacy') }
    ];
  }

  function colorForText(value) {
    const colors = ['#2f7651', '#14766f', '#c67517', '#a83d30', '#3c7d8c', '#8c7b59'];
    const index = String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }


  function renderOptions(options, selected) {
    return options.map((item) => `<option value="${escapeAttr(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('');
  }

  function getStoredUserName() {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const value = userInfo.name || userInfo.username || ''; 
      return typeof value === 'string' ? value.trim() : ''; 
    } catch (error) {
      return ''; 
    }
  }

  function renderFooter() {
    return `<footer class="footer"><div><strong>${escapeHtml(FALLBACK.siteName || '神农AI')}</strong><div>${escapeHtml(FALLBACK.siteTagline || '')}</div></div></footer>`;
  }

  function getCurrentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return PAGE_MAP[path] || document.body.dataset.page || 'home';
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function displayCount(value) {
    return Number.isFinite(Number(value)) ? String(Number(value)) : String(value || 0);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();
