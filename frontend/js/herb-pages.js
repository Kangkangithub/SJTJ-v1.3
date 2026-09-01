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
    herbPage: 1,
    herbLimit: 50,
    herbPagination: null,
    herbLoadingMore: false,
    herbSearchComposing: false,
    formulaComposing: false,
    herbLoadError: false,
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
    recommendationError: false,
    categories: [],
    regions: [],
    stats: normalizeStats({}),
    graph: null,
    graphError: false,
    mapMode: false,
    regionDistribution: null,
    regionPage: 1,
    regionPageSize: 6,
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
      await loadHerbs({ limit: 24, imageLimit: 4 });
      return;
    }
    if (state.page === 'search') {
      await loadHerbs({ useFilters: true });
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
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const limit = options.limit || (isMobile ? 5 : 26);
    const page = options.page || 1;
    const append = Boolean(options.append);
    const useFilters = Boolean(options.useFilters);
    const withImages = options.withImages !== false;
    const imageLimit = options.imageLimit || limit;
    let remote = null;
    state.herbLimit = limit;
    let pagination = null;

    state.herbLoadError = false;
    try {
      if (state.searchTerm.trim()) {
        const response = await apiGet(`/api/herbs/search?q=${encodeURIComponent(state.searchTerm.trim())}`);
        const data = unwrap(response) || {};
        remote = data.herbs || [];
        pagination = { current_page: 1, total_pages: 1, total_items: Number(data.total || remote.length), items_per_page: remote.length || limit, isSearch: true };
      } else {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (useFilters) {
          const categoryId = lookupId(state.categories, state.category);
          const regionId = lookupId(state.regions, state.region);
          if (categoryId) params.set('category_id', String(categoryId));
          if (regionId) params.set('region_id', String(regionId));
        }
        const response = await apiGet(`/api/herbs?${params.toString()}`);
        const data = unwrap(response) || {};
        remote = data.herbs || [];
        pagination = data.pagination || null;
      }
    } catch (error) {
      remote = null;
      state.herbLoadError = true;
    }

    if (version !== requestVersion) return;

    if (remote) {
      const normalized = filterNormalizedHerbs(normalizeHerbs(remote));
      state.herbs = append ? state.herbs.concat(normalized) : normalized;
      state.herbPage = page;
      state.herbPagination = pagination;
      if (withImages) await hydrateHerbImages((append ? normalized : state.herbs).slice(0, imageLimit));
      state.apiOnline = true;
    } else if (!append) {
      state.herbs = [];
      state.herbPagination = null;
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
        await loadSimilarHerbsForDetail(state.detailHerb);
        await hydrateHerbImages([state.detailHerb]);
        state.apiOnline = true;
        return;
      }

      if (state.selectedHerbName) {
        const detail = await apiGet(`/api/knowledge/herb-details/${encodeURIComponent(state.selectedHerbName)}`);
        state.detailHerb = normalizeHerb(unwrap(detail));
        await loadSimilarHerbsForDetail(state.detailHerb);
        await hydrateHerbImages([state.detailHerb]);
        state.apiOnline = true;
      }
    } catch (error) {
      state.detailHerb = null;
    }
  }

  async function loadSimilarHerbsForDetail(herb) {
    if (!herb?.id) return;
    try {
      const response = await apiGet(`/api/herbs/${encodeURIComponent(herb.id)}/similar?limit=4`);
      herb.similarHerbs = normalizeHerbs(unwrap(response)?.similar_herbs || []);
    } catch (error) {
      herb.similarHerbs = [];
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
      await hydrateHerbImages(state.detailFormula.herbItems);
      state.apiOnline = true;
    } catch (error) {
      state.detailFormula = null;
    }
  }

  async function loadGraphData() {
    try {
      state.graphError = false;
      const graph = await apiGet('/api/knowledge/graph-data');
      state.graph = normalizeGraph(unwrap(graph));
      state.apiOnline = true;
    } catch (error) {
      state.graph = null;
      state.graphError = true;
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
      state.recommendationError = false;
      await hydrateHerbImages(state.recommendations.herbs);
      state.apiOnline = true;
    } catch (error) {
      state.recommendations = { herbs: [], formulas: [] };
      state.recommendationError = true;
    }
  }

  function render() {
    const hero = getHero();
    document.title = `${hero.title} - ${FALLBACK.siteName || '神农AI'}`;
    app.innerHTML = `
      <div class="page-shell">
        ${renderTopbar()}
        <main class="${state.page === 'home' ? 'main-home' : 'main-compact'}">
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
    let userInfo = {};
    try { userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}'); } catch (e) {}
    const userAvatar = userInfo.avatar || '';
    const userAvatarHtml = isAuthenticated
      ? ((typeof userAvatar === 'string' && userAvatar.indexOf('data:image/') === 0)
          ? `<img class="user-avatar-img" src="${escapeHtml(userAvatar)}" alt="用户头像">`
          : '<img class="user-avatar-img" src="assets/default-avatar.svg" alt="默认头像">')
      : '';
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <button class="nav-toggle" type="button" aria-label="打开菜单" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
          <a class="brand" href="index.html">
            <div class="brand-mark"><img src="assets/herb-ornament.svg" alt="神农AI图标"></div>
            <div class="brand-copy">
              <p class="brand-name">${escapeHtml(FALLBACK.siteName || '神农AI')}</p>
              <p class="brand-subtitle">${escapeHtml(FALLBACK.siteTagline || '中药药材知识图谱系统')}</p>
            </div>
          </a>
          <div class="user-entry">
            <a class="btn ${isAuthenticated ? 'btn-secondary' : 'btn-primary'}" href="${isAuthenticated ? 'profile.html' : 'login.html'}" aria-label="${isAuthenticated ? '打开个人中心' : '登录'}">${isAuthenticated ? userAvatarHtml : '<i class="fa-solid fa-right-to-bracket"></i>'} ${isAuthenticated ? escapeHtml(userLabel) : '登录'}</a>
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
          <div class="sidebar-brand">
            <div class="brand-mark"><img src="assets/herb-ornament.svg" alt="神农AI图标"></div>
            <div class="brand-copy">
              <p class="brand-name">${escapeHtml(FALLBACK.siteName || '神农AI')}</p>
              <p class="brand-subtitle">${escapeHtml(FALLBACK.siteTagline || '中药药材知识图谱系统')}</p>
            </div>
          </div>
        </nav>
      </header>
    `;
  }

  function renderHero(hero) {
    if (state.page !== 'home') return '';
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
          <div class="hero-visual hero-carousel" aria-label="中药材展示轮播">
            <div class="hero-carousel-track">
              <img class="hero-carousel-slide" src="assets/hero-herbs-1.jpg" alt="中药材展示图一" aria-hidden="true">
              <img class="hero-carousel-slide" src="assets/hero-herbs-3.jpg" alt="中药材展示图三">
              <img class="hero-carousel-slide" src="assets/hero-herbs-2.jpg" alt="中药材展示图二">
              <img class="hero-carousel-slide" src="assets/hero-herbs-1.jpg" alt="中药材展示图一">
            </div>
            <div class="hero-carousel-dots" aria-hidden="true"><span></span><span></span><span></span></div>
          </div>
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
    const herbs = getCommonHerbs(4);
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">快速入口</h2>
            <p class="section-note">直接进入常用查询、图谱浏览和智能问答。</p>
          </div>
        </div>
        <div class="grid grid-4 quick-entry-grid">
          ${renderQuickEntry('herb-search.html', 'fa-magnifying-glass', '药材查询', '按名称、分类和产地查找药材。')}
          ${renderQuickEntry('knowledge-graph.html', 'fa-diagram-project', '知识图谱', '查看药材、功效、归经等关系。')}
          ${renderQuickEntry('qa.html', 'fa-comments', 'AI 问答', '围绕药材和方剂进行提问。')}
          ${renderQuickEntry('formula-library.html', 'fa-book-medical', '方剂库', '浏览方剂组成和来源信息。')}
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材分类分布</h2>
            <p class="section-note">查看当前药材库中主要分类的收录数量。</p>
          </div>
          <a class="link-btn" href="herb-search.html">查看全部药材</a>
        </div>
        <div class="grid grid-3">
          ${state.stats.by_category.slice(0, 6).map(renderStatListCard).join('') || '<div class="empty-state">暂无分类统计。</div>'}
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材速览</h2>
            <p class="section-note">快速浏览药材库中的代表性药材。</p>
          </div>
          <a class="link-btn" href="herb-search.html">查看全部药材</a>
        </div>
        <div class="grid grid-2">${herbs.map(renderHerbCard).join('') || '<div class="empty-state">暂无药材数据。</div>'}</div>
      </section>
    `;
  }

  function getCommonHerbs(limit) {
    const common = state.herbs.filter((item) => item.isCommon);
    const fallback = state.herbs.filter((item) => !item.isCommon);
    return common.concat(fallback).slice(0, limit);
  }

  function renderQuickEntry(href, icon, title, note) {
    return `
      <a class="card quick-entry-card" href="${href}">
        <i class="fa-solid ${icon}" aria-hidden="true"></i>
        <span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(note)}</small></span>
      </a>
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
        <div class="js-search-results">
          ${renderSearchResults()}
        </div>
      </section>
    `;
  }

  function renderSearchResults() {
    return `
      <div class="section-header" style="margin-top: 18px;">
        <div>
          <h2 class="section-title">匹配结果</h2>
          <p class="section-note">${renderHerbResultNote()}</p>
        </div>
      </div>
      <div class="grid grid-2">${state.herbs.map(renderHerbCard).join('') || '<div class="empty-state">没有找到匹配药材，请调整筛选条件。</div>'}</div>
      ${renderHerbPager()}
    `;
  }

  function updateSearchResults() {
    const target = document.querySelector('.js-search-results');
    if (!target) return;
    target.innerHTML = renderSearchResults();
    bindHerbPager();
  }
  function renderHerbResultNote() {
    if (state.herbLoadError) return '药材加载失败，请稍后重试。';
    const shown = state.herbs.length;
    const pagination = state.herbPagination || {};
    if (pagination.isSearch) return `当前搜索显示 ${displayCount(shown)} 条结果。`;
    const total = Number(pagination.total_items || state.stats.total_herbs || 0);
    if (total) return `共 ${displayCount(total)} 味药材，当前显示 ${displayCount(shown)} 味。`;
    return `当前显示 ${displayCount(shown)} 味药材。`;
  }

  function renderHerbPager() {
    const pagination = state.herbPagination || {};
    if (pagination.isSearch || state.herbLoadError || !state.herbs.length) return '';
    const current = Number(pagination.current_page || state.herbPage || 1);
    const totalPages = Number(pagination.total_pages || 1);
    if (totalPages <= 1) return '<div class="list-footer-note">已显示全部药材。</div>';
    const pages = getVisibleHerbPages(current, totalPages);
    return `
      <div class="pagination-row" aria-label="药材分页">
        <button class="pagination-btn js-herb-page" type="button" data-page="${current - 1}"${current <= 1 || state.herbLoadingMore ? ' disabled' : ''}>上一页</button>
        <div class="pagination-pages">
          ${pages.map((page) => page === 'ellipsis'
            ? '<span class="pagination-ellipsis">...</span>'
            : `<button class="pagination-btn js-herb-page${page === current ? ' is-active' : ''}" type="button" data-page="${page}"${page === current || state.herbLoadingMore ? ' disabled' : ''}>${page}</button>`
          ).join('')}
        </div>
        <button class="pagination-btn js-herb-page" type="button" data-page="${current + 1}"${current >= totalPages || state.herbLoadingMore ? ' disabled' : ''}>下一页</button>
      </div>
    `;
  }

  function getVisibleHerbPages(current, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const pages = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);
    if (start > 2) pages.push('ellipsis');
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }

  function renderDetail() {
    const fromGraph = getQueryParam('from') === 'graph';
    const backQa = getQueryParam('back') === 'qa';
    const herb = state.detailHerb;
    if (!herb) {
      return `<section class="section"><div class="empty-state">暂无药材详情，请从药材查询页选择一条药材。</div></section>`;
    }
    const relatedFormulas = findRelatedFormulas(herb);
    const relatedHerbs = findRelatedHerbs(herb);

    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材详情</h2>
            <p class="section-note">查看药材的性味、归经、功效等完整信息。</p>
          </div>
          <div class="page-actions">
            ${fromGraph ? '<a class="btn btn-secondary" href="knowledge-graph.html?herb=' + encodeURIComponent(herb.name) + (backQa ? '&from=qa' : '') + '"><i class="fa-solid fa-arrow-left"></i> 返回知识图谱</a>' : '<a class="btn btn-secondary" href="herb-search.html"><i class="fa-solid fa-arrow-left"></i> 返回查询</a>'}
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
            ${renderHerbVideo(herb)}
            <div class="grid grid-2" style="margin-top: 16px;">
              ${renderInfoCard('性味', herb.nature || herb.properties.join('、') || '暂无')}
              <div class="card pad"><h3>归经</h3><div class="chip-row">${renderChips(herb.meridian)}</div></div>
              ${renderInfoCard('用法用量', herb.usage || '暂无')}
              ${renderInfoCard('功效', herb.efficacy.join('、') || '暂无')}
              ${renderInfoCard('注意事项', herb.caution || '暂无', 'detail-info-wide')}
            </div>
            <div class="card pad" style="margin-top: 16px;"><h3>相关方剂</h3><div class="list-stack">${relatedFormulas.map(renderFormulaLinkItem).join('') || '<div class="empty-state">暂无关联方剂。</div>'}</div></div>
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
            ${renderHerbEnrichTool(herb)}
            <div class="card pad" style="margin-top: 16px;"><h3>同类药材</h3><div class="list-stack">${relatedHerbs.map(renderHerbLinkItem).join('') || '<div class="empty-state">暂无同类药材。</div>'}</div></div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderGraph() {
    const fromQa = getQueryParam('from') === 'qa';
    const graphView = buildGraphView();
    const hasGraph = graphView.nodes.length > 0;
    const graphStatusMessage = state.loading
      ? '正在加载知识图谱...'
      : state.graphError
        ? '知识图谱加载失败，请稍后重试。'
        : '暂无知识图谱数据。';
    const sectionNote = state.mapMode
      ? '通过中国地图直观展示各省份中药材分布与产地关系。'
      : '通过关系网络直观展示药材之间的关联结构。';
    // —— 图谱视图布局 ——
    const graphToolbar = hasGraph ? `
      <div class="toolbar graph-toolbar">
        <div class="field graph-search-field">
          <label for="graphHerbSearch">搜索中心药材</label>
          <input class="input js-graph-herb-search" id="graphHerbSearch" value="${escapeAttr(graphView.focusName)}" placeholder="输入药材名或拼音" autocomplete="off" aria-autocomplete="list" aria-controls="graphHerbSuggestions">
          <div class="graph-search-suggestions js-graph-herb-suggestions" id="graphHerbSuggestions" role="listbox" hidden></div>
        </div>
        <div class="field">
          <label for="graphHerbSelect">中心药材</label>
          <select class="select js-graph-herb" id="graphHerbSelect">${graphView.herbs.map((item) => `<option value="${escapeAttr(item.name)}"${item.name === graphView.focusName ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
        </div>
        <a class="btn btn-primary" href="herb-detail.html?herb=${encodeURIComponent(graphView.focusName)}&from=graph${fromQa ? '&back=qa' : ''}"><i class="fa-solid fa-circle-info"></i> 打开详情</a>
      </div>
    ` : `<div class="empty-state">${graphStatusMessage}</div>`;
    const graphCanvas = hasGraph ? `
      <div class="graph-canvas" role="img" aria-label="药材知识图谱关系图">
        <svg class="graph-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${graphView.lines.map((item) => `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.stroke}" stroke-width="0.7" stroke-linecap="round" />`).join('')}</svg>
        ${graphView.nodes.map((item) => renderGraphNode(item)).join('')}
      </div>
    ` : `<div class="graph-canvas empty-graph"><div class="empty-state">${graphStatusMessage}</div></div>`;
    const graphViewHtml = `
      <div class="graph-layout"${state.mapMode ? ' style="display:none"' : ''}>
        <div class="graph-stage">
          ${graphToolbar}
          ${graphCanvas}
          ${hasGraph ? `<div class="graph-legend">${graphView.legend.map((item) => `<span class="legend-item"><span class="legend-dot" style="--color:${item.color}"></span>${escapeHtml(item.label)}</span>`).join('')}</div>` : ''}
        </div>
        <aside>
          <div class="card pad"><h3>图谱规模</h3><p>节点 ${graphView.totalNodes} 个，关系 ${graphView.totalLinks} 条。</p></div>
          ${renderCurrentHerbSummary(graphView)}
        </aside>
      </div>
    `;
    // —— 地图视图布局（地图为视觉中心 + 右侧省份详情常驻栏） ——
    const mapViewHtml = `
      <div class="map-layout"${state.mapMode ? '' : ' style="display:none"'}>
        <div class="map-card">
          <div class="map-container" id="map-container">
            <div class="map-visualization" id="map-visualization"></div>
          </div>
        </div>
        ${renderRegionDetailsPanel()}
      </div>
    `;
    return `
      <section class="section graph-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">知识图谱</h2>
            <p class="section-note">${sectionNote}</p>
          </div>
          <div class="view-switch" role="group" aria-label="视图切换">
            ${fromQa ? '<a class="btn btn-secondary" href="qa.html"><i class="fa-solid fa-arrow-left"></i> 返回 AI 问答</a>' : ''}
            <button type="button" class="btn ${state.mapMode ? 'btn-secondary' : 'btn-primary'} js-graph-view-btn" data-view="graph">图谱视图</button>
            <button type="button" class="btn ${state.mapMode ? 'btn-primary' : 'btn-secondary'} js-map-view-btn" data-view="map">地图视图</button>
          </div>
        </div>
        ${graphViewHtml}
        ${mapViewHtml}
      </section>
    `;
  }

  function renderRegionDetailsPanel() {
    return `
      <div class="region-details-panel" id="regionDetailsPanel">
        <div class="panel-header">
          <button type="button" class="panel-close js-map-panel-close" aria-label="关闭">✕</button>
          <div class="panel-title">
            <div class="title-stamp">🌿</div>
            <div class="title-text">
              <h2 id="panelRegionCn">省份</h2>
              <span id="panelRegionEn">Province</span>
            </div>
          </div>
          <div class="header-ornament">⚕</div>
        </div>
        <div class="panel-body" id="regionPanelBody">
          <div class="panel-loading">点击地图省份，查看该省药材分布详情。</div>
        </div>
      </div>
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
    const herbEmpty = state.recommendationError ? '推荐内容加载失败，请稍后重试。' : '暂无可展示药材，请先完善药材常用标记或方剂关联数据。';
    const formulaEmpty = state.recommendationError ? '推荐内容加载失败，请稍后重试。' : '暂无可展示方剂，请先完善方剂组成数据。';
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">推荐</h2><p class="section-note">根据常用药材标记、方剂收录关系和方剂组成数据整理。</p></div><a class="link-btn" href="herb-search.html">继续查询药材</a></div>
        ${renderCompatibilityTool()}
        <div class="grid grid-2">
          <div class="card pad"><h3>药材推荐</h3><p class="card-note">根据常用药材标记和方剂收录数量排序。</p><div class="list-stack">${herbs.map(renderRecommendationHerbItem).join('') || `<div class="empty-state">${herbEmpty}</div>`}</div></div>
          <div class="card pad"><h3>推荐方剂</h3><p class="card-note">根据方剂组成数量和方剂库记录整理。</p><div class="list-stack">${formulas.map(renderRecommendationFormulaItem).join('') || `<div class="empty-state">${formulaEmpty}</div>`}</div></div>
        </div>
      </section>
    `;
  }

  function renderFormula() {
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">方剂库</h2><p class="section-note">浏览方剂名称、分类和来源，点击卡片查看详情。</p></div><a class="link-btn" href="qa.html">去 AI 问答</a></div>
        <div class="toolbar">
          <div class="field"><label for="formulaTerm">方剂名称</label><input class="input js-formula-term" id="formulaTerm" value="${escapeAttr(state.formulaTerm)}" placeholder="输入方剂名或组成药材"></div>
          <div class="field"><label for="formulaCategory">分类</label><select class="select js-formula-category" id="formulaCategory">${renderOptions(['全部', ...new Set(state.formulas.map((item) => item.category).filter(Boolean))], state.formulaCategory)}</select></div>
          <button class="btn btn-secondary" id="resetFormula"><i class="fa-solid fa-rotate-left"></i> 重置</button>
        </div>
        <div class="formula-layout"><div class="formula-main"><div class="formula-card-grid js-formula-results">${renderFormulaResults()}</div></div></div>
      </section>
    `;
  }

  function renderFormulaResults() {
    const formulas = filterFormulas();
    return formulas.map(renderFormulaCard).join('') || '<div class="empty-state">没有找到匹配方剂，请调整筛选条件。</div>';
  }

  function updateFormulaResults() {
    const target = document.querySelector('.js-formula-results');
    if (!target) return;
    target.innerHTML = renderFormulaResults();
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

  function bindNavToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');
    if (!toggle || !nav) return;
    let overlay = null;

    function openNav() {
      nav.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'nav-overlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', closeNav);
      }
    }
    function closeNav() {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      if (overlay) { overlay.remove(); overlay = null; }
    }

    toggle.addEventListener('click', () => {
      if (nav.classList.contains('open')) closeNav();
      else openNav();
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeNav();
    });
  }

  function bindEvents() {
    bindNavToggle();
    if (state.page === 'search') bindSearch();
    if (state.page === 'graph') bindGraph();
    if (state.page === 'qa') bindQA();
    if (state.page === 'formula') bindFormula();
    if (state.page === 'recommendation') bindRecommendation();
    if (state.page === 'detail') bindDetailTools();
  }

  function bindSearch() {
    const searchInput = document.querySelector('.js-search-term');
    const runSearch = async () => {
      resetHerbPagination();
      state.loading = true;
      await loadHerbs({ useFilters: true });
      state.loading = false;
      updateSearchResults();
    };

    searchInput?.addEventListener('compositionstart', () => {
      state.herbSearchComposing = true;
      clearTimeout(searchTimer);
    });
    searchInput?.addEventListener('compositionend', (event) => {
      state.herbSearchComposing = false;
      state.searchTerm = event.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 300);
    });
    searchInput?.addEventListener('input', (event) => {
      state.searchTerm = event.target.value;
      if (state.herbSearchComposing || event.isComposing) return;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 300);
    });
    document.querySelector('.js-search-category')?.addEventListener('change', async (event) => {
      state.category = event.target.value;
      resetHerbPagination();
      await loadHerbs({ useFilters: true });
      render();
    });
    document.querySelector('.js-search-region')?.addEventListener('change', async (event) => {
      state.region = event.target.value;
      resetHerbPagination();
      await loadHerbs({ useFilters: true });
      render();
    });
    document.getElementById('resetSearch')?.addEventListener('click', async () => {
      state.searchTerm = '';
      state.category = '全部';
      state.region = '全部';
      resetHerbPagination();
      await loadHerbs({ useFilters: true });
      render();
    });
    bindHerbPager();
  }

  function bindHerbPager() {
    document.querySelectorAll('.js-herb-page').forEach((button) => {
      button.addEventListener('click', async () => {
        const page = Number(button.dataset.page || 1);
        const totalPages = Number(state.herbPagination?.total_pages || 1);
        if (!page || page < 1 || page > totalPages || page === state.herbPage) return;
        state.herbLoadingMore = true;
        updateSearchResults();
        await loadHerbs({ page, useFilters: true });
        state.herbLoadingMore = false;
        updateSearchResults();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function resetHerbPagination() {
    state.herbPage = 1;
    state.herbPagination = null;
    state.herbLoadError = false;
  }

  function bindDetailTools() {
    const form = document.querySelector('.js-herb-enrich-form');
    if (!form || !state.detailHerb?.name) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = document.querySelector('.js-herb-enrich-result');
      const button = form.querySelector('button[type="submit"]');
      if (result) result.innerHTML = '<div class="tool-message">正在生成增强信息...</div>';
      if (button) button.disabled = true;
      try {
        const herb = state.detailHerb;
        const response = await apiPost('/api/ai-engine/herb-enrich', {
          herbName: herb.name,
          herbContext: {
            category_name: herb.category,
            region_name: herb.region,
            properties: herb.properties.map((name) => ({ name })),
            meridians: herb.meridian.map((name) => ({ name })),
            efficacies: herb.efficacy.map((name) => ({ name })),
            description: herb.description,
            usage_dosage: herb.usage,
            caution: herb.caution
          }
        });
        if (result) result.innerHTML = renderHerbEnrichResult(unwrap(response));
      } catch (error) {
        if (result) result.innerHTML = '<div class="tool-message error">药材知识增强失败，请稍后重试</div>';
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function bindRecommendation() {
    const form = document.querySelector('.js-compatibility-form');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = form.querySelector('.js-compatibility-input');
      const result = document.querySelector('.js-compatibility-result');
      const button = form.querySelector('button[type="submit"]');
      const herbs = parseToolHerbNames(input?.value || '');
      if (herbs.length < 2) {
        if (result) result.innerHTML = '<div class="tool-message warning">请至少输入两味药材</div>';
        return;
      }
      if (result) result.innerHTML = '<div class="tool-message">正在检测...</div>';
      if (button) button.disabled = true;
      try {
        const response = await apiPost('/api/ai-engine/compatibility', { herbs });
        if (result) result.innerHTML = renderCompatibilityResult(unwrap(response));
      } catch (error) {
        if (result) result.innerHTML = '<div class="tool-message error">配伍检测失败，请稍后重试</div>';
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function setupGraphTouchZoom() {
    const canvas = document.querySelector('.graph-canvas');
    if (!canvas) return;
    let zoom = 1, startDist = 0, startZoom = 1;
    canvas.addEventListener('touchstart', (event) => {
      if (event.touches.length === 2) {
        startDist = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
        startZoom = zoom;
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (event) => {
      if (event.touches.length === 2) {
        const dist = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
        zoom = Math.min(2.5, Math.max(0.8, startZoom * (dist / startDist)));
        canvas.style.transform = 'scale(' + zoom + ')';
        canvas.style.transformOrigin = 'center';
      }
    }, { passive: true });
  }

  function bindGraph() {
    bindRegionPager();
    setupGraphTouchZoom();
    // —— 图谱 / 地图 视图切换 ——
    document.querySelectorAll('.js-graph-view-btn, .js-map-view-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.view === 'map';
        if (state.mapMode === next) return;
        state.mapMode = next;
        render();
      });
    });
    document.querySelector('.js-map-panel-close')?.addEventListener('click', () => {
      const panel = document.getElementById('regionDetailsPanel');
      const body = document.getElementById('regionPanelBody');
      if (body) body.innerHTML = '<div class="panel-loading">点击地图省份，查看该省药材分布详情。</div>';
      const cn = document.getElementById('panelRegionCn');
      const en = document.getElementById('panelRegionEn');
      if (cn) cn.textContent = '省份';
      if (en) en.textContent = 'Province';
    });
    if (state.mapMode && window.worldMapVisualization) {
      window.worldMapVisualization.initialize();
    }
    document.querySelector('.js-graph-herb')?.addEventListener('change', (event) => {
      state.selectedHerbName = event.target.value;
      render();
    });
    const searchInput = document.querySelector('.js-graph-herb-search');
    const suggestions = document.querySelector('.js-graph-herb-suggestions');
    const closeSuggestions = () => {
      if (!suggestions) return;
      suggestions.hidden = true;
      suggestions.innerHTML = '';
    };
    const chooseHerb = (name) => {
      if (!name) return;
      if (searchInput) searchInput.value = name;
      state.selectedHerbName = name;
      closeSuggestions();
      render();
    };
    const updateSuggestions = () => {
      if (!suggestions) return [];
      const matches = findGraphHerbMatches(searchInput?.value || '', 10);
      if (!matches.length) {
        closeSuggestions();
        return matches;
      }
      suggestions.innerHTML = matches.map(renderGraphHerbSuggestion).join('');
      suggestions.hidden = false;
      return matches;
    };
    const selectHerbFromSearch = () => {
      const match = findGraphHerb(searchInput?.value || '');
      if (!match) return;
      chooseHerb(match.name);
    };
    searchInput?.addEventListener('focus', updateSuggestions);
    searchInput?.addEventListener('input', updateSuggestions);
    suggestions?.addEventListener('mousedown', (event) => {
      const option = event.target.closest('.js-graph-herb-option');
      if (!option) return;
      event.preventDefault();
      chooseHerb(option.dataset.name || '');
    });
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const matches = updateSuggestions();
      if (matches[0]) chooseHerb(matches[0].name);
      else selectHerbFromSearch();
    });
    searchInput?.addEventListener('blur', () => {
      window.setTimeout(closeSuggestions, 120);
    });
  }

  function findGraphHerb(term) {
    const keyword = normalizeSearchTerm(term);
    if (!keyword || !state.graph) return null;
    const herbs = state.graph.nodes.filter((node) => node.type === 'Herb');
    return herbs.find((node) => graphHerbSearchValues(node).some((value) => normalizeSearchTerm(value) === keyword))
      || herbs.find((node) => graphHerbSearchValues(node).some((value) => normalizeSearchTerm(value).includes(keyword)))
      || null;
  }

  function findGraphHerbMatches(term, limit = 10) {
    const keyword = normalizeSearchTerm(term);
    if (!keyword || !state.graph) return [];
    return state.graph.nodes
      .filter((node) => node.type === 'Herb' && graphHerbSearchValues(node).some((value) => normalizeSearchTerm(value).includes(keyword)))
      .slice(0, limit);
  }

  function renderGraphHerbSuggestion(node) {
    const props = node.properties || {};
    const meta = [props.pinyin, props.alias || props.aliases].filter(Boolean).join(' / ');
    return `<button type="button" class="graph-search-option js-graph-herb-option" role="option" data-name="${escapeAttr(node.name)}"><span>${escapeHtml(node.name)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</button>`;
  }

  function graphHerbSearchValues(node) {
    const props = node.properties || {};
    return [node.name, props.name, props.pinyin, props.alias, props.aliases].filter(Boolean);
  }

  function normalizeSearchTerm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function bindRegionPager() {
    document.querySelectorAll('.js-region-page').forEach((button) => {
      button.addEventListener('click', () => {
        const page = Number(button.dataset.page || 1);
        const regions = state.regionDistribution?.regions || [];
        const pageSize = state.regionPageSize || 6;
        const totalPages = Math.max(1, Math.ceil(regions.length / pageSize));
        if (!page || page < 1 || page > totalPages || page === state.regionPage) return;
        state.regionPage = page;
        const target = document.querySelector('.js-region-distribution');
        if (target) target.outerHTML = renderRegionDistribution();
        bindRegionPager();
      });
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
    const formulaInput = document.querySelector('.js-formula-term');
    formulaInput?.addEventListener('compositionstart', () => {
      state.formulaComposing = true;
    });
    formulaInput?.addEventListener('compositionend', (event) => {
      state.formulaComposing = false;
      state.formulaTerm = event.target.value;
      updateFormulaResults();
    });
    formulaInput?.addEventListener('input', (event) => {
      state.formulaTerm = event.target.value;
      if (state.formulaComposing || event.isComposing) return;
      updateFormulaResults();
    });
    document.querySelector('.js-formula-category')?.addEventListener('change', (event) => {
      state.formulaCategory = event.target.value;
      updateFormulaResults();
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
    const timeoutMs = getApiTimeout(path);
    let lastError;
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
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

  function getApiTimeout(path) {
    if (path.includes('/api/knowledge/graph-data')) return 30000;
    if (path.includes('/api/knowledge/region-distribution')) return 12000;
    return 6000;
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
    const path = url.startsWith('/') ? url : `/${url}`;
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const host = window.location.host;
      if (host === 'localhost:3001' || host === '127.0.0.1:3001') return path;
    }
    return `http://localhost:3001${path}`;
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
    const similarHerbs = normalizeHerbs(source.similarHerbs || source.relatedHerbs || source.similar_herbs || []);
    const category = source.category || source.category_name || source.categoryName || '';
    const region = source.region || source.region_name || source.regionName || '';
    const nature = source.nature || properties.join('、') || source.property || '';
    const images = normalizeImages(source.images || source.imageList || []);
    const imageUrl = firstImageUrl(images) || absoluteAssetUrl(source.image || source.image_url || source.imageUrl || source.thumbnail || source.thumbnail_url || '');
    const videoUrl = normalizeHerbVideo(source.video);
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
      similarHerbs,
      formulaIds: normalizeList(source.formulaIds).map(Number).filter(Boolean),
      isCommon: Boolean(source.is_common || source.isCommon),
      images,
      imageUrl,
      video: source.video || null,
      videoUrl
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

  function normalizeHerbVideo(video) {
    if (!video) return '';
    if (typeof video === 'string') return absoluteAssetUrl(video);
    if (typeof video === 'object' && video.path) return absoluteAssetUrl(video.path);
    return '';
  }

  function normalizeFormula(item) {
    const source = item || {};
    const rawHerbs = Array.isArray(source.herbs) ? source.herbs : normalizeList(source.herbs || source.ingredients || source.composition).map((name) => ({ name }));
    const herbItems = rawHerbs.map((herb) => {
      if (herb && typeof herb === 'object') {
        const images = normalizeImages(herb.images || herb.imageList || []);
        return {
          id: herb.herb_id || herb.herbId || herb.id || '',
          name: herb.name || herb.herbName || '',
          pinyin: herb.pinyin || '',
          dosage: herb.dosage || '',
          role: herb.role || '',
          note: herb.note || '',
          images,
          imageUrl: firstImageUrl(images) || absoluteAssetUrl(herb.image || herb.image_url || herb.imageUrl || herb.thumbnail || herb.thumbnail_url || '')
        };
      }
      return { id: '', name: String(herb || ''), pinyin: '', dosage: '', role: '', note: '', images: [], imageUrl: '' };
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
    return (Array.isArray(items) ? items : []).map((item) => {
      const images = normalizeImages(item.images || item.imageList || []);
      return {
        id: item.id || item.herb_id || item.name,
        name: item.name || '',
        category: item.category || item.category_name || '',
        region: item.region || item.region_name || '',
        reason: item.reason || '',
        efficacy: normalizeList(item.efficacy_names || item.efficacies, 'name'),
        images,
        imageUrl: firstImageUrl(images) || absoluteAssetUrl(item.image || item.image_url || item.imageUrl || item.thumbnail || item.thumbnail_url || '')
      };
    }).filter((item) => item.name);
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
    const herbs = graph.nodes.filter((node) => node.type === 'Herb').map((node) => ({
      id: node.id,
      name: node.name,
      pinyin: node.properties?.pinyin || '',
      alias: node.properties?.alias || node.properties?.aliases || ''
    }));
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

  function renderCurrentHerbSummary(graphView) {
    const center = graphView.nodes.find((node) => node.center) || graphView.nodes.find((node) => node.type === 'Herb');
    if (!center) {
      return '<div class="card pad" style="margin-top: 16px;"><h3>当前药材关系摘要</h3><div class="empty-state">请选择中心药材后查看关系摘要。</div></div>';
    }
    const grouped = groupGraphSummaryNodes(graphView.nodes.filter((node) => node.id !== center.id));
    const rows = [
      ['当前药材', center.name],
      ['所属分类', formatGraphSummaryNames(grouped.Category)],
      ['产地', formatGraphSummaryNames(grouped.Region)],
      ['性味', formatGraphSummaryNames(grouped.Property)],
      ['归经', formatGraphSummaryNames(grouped.Meridian)],
      ['功效', formatGraphSummaryNames(grouped.Efficacy)]
    ];
    const stats = ['Category', 'Region', 'Property', 'Meridian', 'Efficacy', 'Formula']
      .map((type) => ({ type, label: graphTypeLabel(type), count: grouped[type]?.length || 0 }))
      .filter((item) => item.count > 0);
    return `
      <div class="card pad current-herb-summary" style="margin-top: 16px;">
        <h3>当前药材关系摘要</h3>
        <dl class="fact-list">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '暂无')}</dd></div>`).join('')}</dl>
        ${stats.length ? `<div class="graph-summary-stats"><p class="section-note">关联节点统计</p><div class="chip-row">${stats.map((item) => `<span class="chip">${escapeHtml(item.label)} ${displayCount(item.count)}</span>`).join('')}</div></div>` : ''}
      </div>
    `;
  }

  function groupGraphSummaryNodes(nodes) {
    return nodes.reduce((groups, node) => {
      if (!groups[node.type]) groups[node.type] = [];
      if (!groups[node.type].some((item) => item.name === node.name)) groups[node.type].push(node);
      return groups;
    }, {});
  }

  function formatGraphSummaryNames(nodes) {
    return (nodes || []).map((node) => node.name).filter(Boolean).join('、') || '暂无';
  }

  function graphTypeLabel(type) {
    return { Category: '分类', Region: '产地', Property: '性味', Meridian: '归经', Efficacy: '功效', Formula: '方剂' }[type] || '节点';
  }

  function renderRegionDistribution() {
    const regions = state.regionDistribution?.regions || [];
    if (!regions.length) return `<div class="card pad js-region-distribution" style="margin-top: 16px;"><h3>产地分布</h3><p>暂无产地分布数据。</p></div>`;
    const pageSize = state.regionPageSize || 6;
    const totalPages = Math.max(1, Math.ceil(regions.length / pageSize));
    state.regionPage = Math.min(Math.max(1, state.regionPage || 1), totalPages);
    const currentPage = state.regionPage;
    const start = (currentPage - 1) * pageSize;
    const visibleRegions = regions.slice(start, start + pageSize);
    const pager = regions.length > pageSize ? `
      <div class="region-pager" aria-label="产地分页">
        <button class="link-btn region-page-btn js-region-page" type="button" data-page="${currentPage - 1}"${currentPage <= 1 ? ' disabled' : ''}>上一页</button>
        <span class="region-page-info">第 ${currentPage} / ${totalPages} 页</span>
        <button class="link-btn region-page-btn js-region-page" type="button" data-page="${currentPage + 1}"${currentPage >= totalPages ? ' disabled' : ''}>下一页</button>
      </div>
    ` : '';
    return `
      <div class="card pad js-region-distribution" style="margin-top: 16px;">
        <h3>产地分布</h3>
        <p class="section-note">按药材库中各产地关联药材数量排序。</p>
        <div class="list-stack region-distribution-list">${visibleRegions.map((item) => `<div class="list-item"><span><strong>${escapeHtml(item.name)}</strong></span><span class="tag region-count-tag">收录 ${displayCount(item.herb_count)} 味</span></div>`).join('')}</div>
        ${pager}
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

  function renderHerbVideo(herb) {
    if (!herb.videoUrl) return '';
    return `
      <div class="card pad herb-video-card">
        <h3>药材视频</h3>
        <video class="herb-video" controls preload="metadata" src="${escapeAttr(herb.videoUrl)}"></video>
      </div>
    `;
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
    return `<a class="list-item formula-herb-item" href="${href}">${item.id ? renderHerbImage(item, 'formula-herb-thumb') : ''}<span><strong>${escapeHtml(item.name)}</strong>${details ? `<p>${escapeHtml(details)}</p>` : ''}</span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderFormulaFieldCard(title, text) {
    return text ? `<div class="card pad formula-detail-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>` : '';
  }

  function renderCompatibilityTool() {
    return `
      <div class="card pad ai-tool-card compatibility-tool">
        <div class="ai-tool-header"><div><h3>配伍检测</h3><p>输入多味药材，检测是否存在明确配伍冲突。</p></div></div>
        <form class="ai-tool-form js-compatibility-form">
          <label class="sr-only" for="compatibilityHerbs">药材名称</label>
          <input class="input js-compatibility-input" id="compatibilityHerbs" placeholder="例如：人参, 藜芦" autocomplete="off">
          <button class="btn btn-primary" type="submit">检测配伍</button>
        </form>
        <div class="ai-tool-result js-compatibility-result" aria-live="polite"></div>
      </div>
    `;
  }

  function renderHerbEnrichTool(herb) {
    if (!herb?.name) return '';
    return `
      <div class="card pad ai-tool-card herb-enrich-tool">
        <div class="ai-tool-header"><div><h3>药材知识增强</h3><p>基于当前药材资料生成补充信息，结果来自后端 AI 引擎。</p></div></div>
        <form class="ai-tool-form js-herb-enrich-form">
          <span class="tool-subject">${escapeHtml(herb.name)}</span>
          <button class="btn btn-secondary" type="submit">增强知识</button>
        </form>
        <div class="ai-tool-result js-herb-enrich-result" aria-live="polite"></div>
      </div>
    `;
  }

  function renderCompatibilityResult(data) {
    const conflicts = Array.isArray(data?.conflicts) ? data.conflicts : [];
    const unknownHerbs = Array.isArray(data?.unknownHerbs) ? data.unknownHerbs : [];
    const hasWarning = conflicts.length > 0 || unknownHerbs.length > 0 || data?.safe === false;
    const summary = data?.summary || (hasWarning ? '检测结果存在不确定性，请谨慎使用' : '未检测到明确配伍冲突');
    let html = `<div class="tool-message ${hasWarning ? 'warning' : 'success'}">${escapeHtml(summary)}</div>`;
    if (unknownHerbs.length) {
      html += `<ul class="tool-result-list"><li><strong>未收录药材</strong><p>${escapeHtml(unknownHerbs.join('、'))}</p><p class="tool-muted">这些名称未在药材库或配伍规则中匹配到，不能据此判断可以配合使用。</p></li></ul>`;
    }
    if (conflicts.length) {
      html += `<ul class="tool-result-list">${conflicts.map((item) => {
        const names = [item.herb_a, item.herb_b].filter(Boolean).join(' / ');
        const relation = item.relation || '配伍冲突';
        const category = item.category || '明确配伍规则';
        const evidence = item.description || item.source || '命中项目内置配伍禁忌规则库。';
        return `<li><strong>${escapeHtml(names)}</strong><p>冲突类型：${escapeHtml(relation)}</p><p>规则类别：${escapeHtml(category)}</p><p class="tool-muted">依据：${escapeHtml(evidence)}</p></li>`;
      }).join('')}</ul>`;
    }
    return html;
  }

  function renderHerbEnrichResult(data) {
    const fields = [
      ['主治', data?.indications],
      ['用法用量', data?.usage_dosage],
      ['注意事项', data?.caution],
      ['现代药理', data?.pharmacology],
      ['临床应用', data?.clinical_application]
    ].filter((item) => item[1]);
    if (!fields.length) return '<div class="tool-message">未返回可展示的增强信息</div>';
    return `<dl class="tool-result-dl">${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
  }

  function parseToolHerbNames(value) {
    return String(value || '').split(/[，,、\s]+/).map((item) => item.trim()).filter(Boolean);
  }

  function renderInfoCard(title, text, className = '') {
    const extraClass = className ? ` ${escapeAttr(className)}` : '';
    return `<div class="card pad${extraClass}"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || '暂无')}</p></div>`;
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
    return `<a class="list-item recommendation-herb-item" href="herb-detail.html?id=${encodeURIComponent(item.id)}&herb=${encodeURIComponent(item.name)}">${renderHerbImage(item, 'recommendation-thumb')}<span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml([item.category, item.region, item.reason].filter(Boolean).join(' · '))}</p></span><i class="fa-solid fa-arrow-right"></i></a>`;
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

  function findRelatedHerbs(herb) {
    const remote = normalizeHerbs(herb.similarHerbs || herb.relatedHerbs || []);
    if (remote.length) return remote.slice(0, 4);
    return state.herbs.filter((item) => item.id !== herb.id && item.category === herb.category).slice(0, 4);
  }

  function resolveFormulaId(query) {
    if (!query) return null;
    const found = state.formulas.find((item) => String(item.id) === String(query) || item.name === query);
    return found ? found.id : null;
  }

  function getHero() {
    const stats = state.stats || normalizeStats({});
    const commonStats = [
      { value: displayCount(stats.total_herbs), label: '收录药材' },
      { value: displayCount(state.formulas.length), label: '收录方剂' },
      { value: displayCount(stats.by_category.length || state.categories.length), label: '药材分类' }
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
