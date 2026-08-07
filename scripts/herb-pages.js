(function () {
  const PAGE_MAP = {
    'index.html': 'home',
    'herb-search.html': 'search',
    'herb-detail.html': 'detail',
    'knowledge-graph.html': 'graph',
    'qa.html': 'qa',
    'formula-library.html': 'formula',
    'recommendation.html': 'formula',
    'design-system.html': 'design'
  };

  const FALLBACK = window.HerbData || { herbs: [], formulas: [], nav: [], filters: {}, tokens: [] };
  const app = document.getElementById('app');
  if (!app) return;
  const FALLBACK_HERBS = normalizeHerbs(FALLBACK.herbs || []);

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
    formulas: normalizeFormulas(FALLBACK.formulas || []),
    categories: toLookup(FALLBACK.filters?.categories || []),
    regions: toLookup(FALLBACK.filters?.regions || []),
    stats: buildFallbackStats(),
    graph: null,
    regionDistribution: null,
    chat: [
      {
        role: 'assistant',
        title: '本草知识图谱 AI',
        content: '你好，我可以回答药材功效、性味归经、配伍和方剂组成等问题。'
      }
    ]
  };

  const apiCache = new Map();
  let searchTimer = null;
  let requestVersion = 0;

  init();

  async function init() {
    state.herbs = filterLocalHerbs(FALLBACK_HERBS);
    state.detailHerb = resolveLocalHerb();
    state.selectedFormulaId = resolveFormulaId(getQueryParam('formula')) || state.formulas[0]?.id || null;
    render();
    await hydrateBaseData();
    await hydratePageData();
    state.loading = false;
    render();
  }

  async function hydrateBaseData() {
    const [categories, regions, stats] = await Promise.allSettled([
      apiGet('/api/herb-categories'),
      apiGet('/api/herb-regions'),
      apiGet('/api/herbs/statistics')
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
    if (state.page === 'graph') {
      await Promise.allSettled([loadHerbs({ limit: 60 }), loadGraphData(), loadRegionDistribution()]);
      return;
    }
  }

  async function loadHerbs(options = {}) {
    const version = ++requestVersion;
    const limit = options.limit || 50;
    const useFilters = Boolean(options.useFilters);
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
      state.apiOnline = true;
    } else {
      state.herbs = filterLocalHerbs(FALLBACK_HERBS).slice(0, limit);
    }
  }

  async function loadDetailHerb() {
    const fallback = resolveLocalHerb();
    state.detailHerb = fallback;

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
        state.apiOnline = true;
        return;
      }

      if (state.selectedHerbName) {
        const detail = await apiGet(`/api/knowledge/herb-details/${encodeURIComponent(state.selectedHerbName)}`);
        state.detailHerb = normalizeHerb(unwrap(detail));
        state.apiOnline = true;
      }
    } catch (error) {
      state.detailHerb = fallback || FALLBACK_HERBS[0];
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

  function render() {
    const hero = getHero();
    document.title = `${hero.title} - ${FALLBACK.siteName || '本草知识图谱'}`;
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
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="index.html">
            <div class="brand-mark"><img src="assets/herb-ornament.svg" alt="本草知识图谱图标"></div>
            <div class="brand-copy">
              <p class="brand-name">${escapeHtml(FALLBACK.siteName || '本草知识图谱')}</p>
              <p class="brand-subtitle">${escapeHtml(FALLBACK.siteTagline || '药材查询、方剂检索、知识图谱与 AI 问答')}</p>
            </div>
          </a>
          <div class="top-actions">
            <a class="btn btn-secondary" href="herb-search.html"><i class="fa-solid fa-magnifying-glass"></i> 药材查询</a>
            <a class="btn btn-primary" href="qa.html"><i class="fa-solid fa-comments"></i> AI 问答</a>
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
          <div class="hero-visual"><img src="assets/herb-hero.svg" alt="本草知识图谱示意图"></div>
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
    if (state.page === 'design') return renderDesign();
    return renderHome();
  }

  function renderHome() {
    const herbs = state.herbs.length ? state.herbs.slice(0, 4) : FALLBACK_HERBS.slice(0, 4);
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">首页概览</h2>
            <p class="section-note">${state.apiOnline ? '已接入后端统计与药材接口。' : '后端未连接时使用离线演示数据。'}</p>
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
            <p class="section-note">来自 /api/herbs/statistics，失败时回退到本地数据。</p>
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
            <p class="section-note">优先展示后端常用药材列表。</p>
          </div>
          <a class="link-btn" href="herb-search.html">查看全部药材</a>
        </div>
        <div class="grid grid-2">${herbs.map(renderHerbCard).join('')}</div>
      </section>
    `;
  }

  function renderSearch() {
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材查询</h2>
            <p class="section-note">无关键词时请求 /api/herbs；有关键词时请求 /api/herbs/search。</p>
          </div>
          <a class="link-btn" href="herb-detail.html?herb=${encodeURIComponent((state.herbs[0] || FALLBACK_HERBS[0])?.name || '')}">示例详情</a>
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
            <p class="section-note">当前显示 ${state.herbs.length} 味药材。${state.loading ? '正在尝试连接后端接口。' : ''}</p>
          </div>
        </div>
        <div class="grid grid-2">${state.herbs.map(renderHerbCard).join('') || '<div class="empty-state">没有找到匹配药材，请调整筛选条件。</div>'}</div>
      </section>
    `;
  }

  function renderDetail() {
    const herb = state.detailHerb || FALLBACK_HERBS[0];
    const relatedFormulas = findRelatedFormulas(herb);
    const relatedHerbs = FALLBACK_HERBS.filter((item) => item.id !== herb.id && item.category === herb.category).slice(0, 4);

    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材详情</h2>
            <p class="section-note">优先来自 /api/herbs/:id 或 /api/knowledge/herb-details/:herbName。</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-secondary" href="herb-search.html"><i class="fa-solid fa-arrow-left"></i> 返回查询</a>
            <a class="btn btn-primary" href="knowledge-graph.html?herb=${encodeURIComponent(herb.name)}"><i class="fa-solid fa-diagram-project"></i> 打开图谱</a>
          </div>
        </div>
        <div class="detail-layout">
          <div class="detail-main">
            <div class="card detail-hero">
              <div class="detail-thumb" style="--tone:${herb.imageTone}"><i class="fa-solid fa-seedling"></i></div>
              <div>
                <div class="tag-row">
                  <span class="tag">${escapeHtml(herb.category || '未分类')}</span>
                  <span class="tag">${escapeHtml(herb.region || '未知产地')}</span>
                  ${herb.isCommon ? '<span class="tag">常用药</span>' : ''}
                </div>
                <h3 style="margin-top: 12px; font-size: 30px;">${escapeHtml(herb.name)}</h3>
                <p>${escapeHtml(herb.pinyin || '')} · ${escapeHtml(herb.source || '来源待补充')}</p>
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
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">知识图谱</h2>
            <p class="section-note">优先使用 /api/knowledge/graph-data?common=1，接口失败时回退到静态图谱。</p>
          </div>
        </div>
        <div class="graph-layout">
          <div class="graph-stage">
            <div class="toolbar" style="grid-template-columns: minmax(0, 1fr) auto;">
              <div class="field">
                <label for="graphHerbSelect">中心药材</label>
                <select class="select js-graph-herb" id="graphHerbSelect">${graphView.herbs.map((item) => `<option value="${escapeAttr(item.name)}"${item.name === graphView.focusName ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select>
              </div>
              <a class="btn btn-primary" href="herb-detail.html?herb=${encodeURIComponent(graphView.focusName)}"><i class="fa-solid fa-circle-info"></i> 打开详情</a>
            </div>
            <div class="graph-canvas">
              <svg class="graph-svg" viewBox="0 0 100 100" preserveAspectRatio="none">${graphView.lines.map((item) => `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.stroke}" stroke-width="0.7" stroke-linecap="round" />`).join('')}</svg>
              ${graphView.nodes.map((item) => renderGraphNode(item)).join('')}
            </div>
            <div class="graph-legend">${graphView.legend.map((item) => `<span class="legend-item"><span class="legend-dot" style="--color:${item.color}"></span>${escapeHtml(item.label)}</span>`).join('')}</div>
          </div>
          <aside>
            <div class="card pad"><h3>图谱规模</h3><p>节点 ${graphView.totalNodes} 个，关系 ${graphView.totalLinks} 条。</p><div class="chip-row"><span class="chip">${state.graph ? '真实图谱' : '静态兜底'}</span><span class="chip">常用药视图</span></div></div>
            ${renderRegionDistribution()}
          </aside>
        </div>
      </section>
    `;
  }

  function renderQA() {
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">AI 问答</h2><p class="section-note">当前为前端模拟问答，药材答案会优先引用已加载数据。</p></div><a class="link-btn" href="formula-library.html">打开方剂库</a></div>
        <div class="qa-layout">
          <div class="chat-panel">
            <div class="chat-feed" id="chatFeed">${state.chat.map(renderMessage).join('')}</div>
            <div class="chat-composer"><textarea id="questionInput" class="textarea" placeholder="输入你的问题，例如：黄芪适合什么证型？"></textarea><button class="submit-btn" id="sendQuestion"><i class="fa-solid fa-paper-plane"></i> 发送</button></div>
            <div class="chip-row" style="margin-top: 12px;">${['黄芪的主要功效是什么？', '四君子汤的组成与作用是什么？', '人参与黄芪如何配伍？', '麻黄汤适合什么证型？'].map((item) => `<button class="btn btn-secondary suggested-question" data-question="${escapeAttr(item)}">${escapeHtml(item)}</button>`).join('')}</div>
          </div>
          <aside><div class="card pad"><h3>回答范围</h3><div class="chip-row"><span class="chip">药材功效</span><span class="chip">性味归经</span><span class="chip">方剂组成</span><span class="chip">用法注意</span></div></div></aside>
        </div>
      </section>
    `;
  }

  function renderFormula() {
    const formulas = filterFormulas();
    const selected = state.formulas.find((item) => item.id === state.selectedFormulaId) || formulas[0] || state.formulas[0];
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">方剂库</h2><p class="section-note">方剂库当前继续使用离线数据，药材详情会联动真实药材接口。</p></div><a class="link-btn" href="qa.html">去 AI 问答</a></div>
        <div class="toolbar">
          <div class="field"><label for="formulaTerm">方剂名称</label><input class="input js-formula-term" id="formulaTerm" value="${escapeAttr(state.formulaTerm)}" placeholder="输入方剂名或组成药材"></div>
          <div class="field"><label for="formulaCategory">分类</label><select class="select js-formula-category" id="formulaCategory">${renderOptions(['全部', ...new Set(state.formulas.map((item) => item.category))], state.formulaCategory)}</select></div>
          <div class="field"><label for="formulaSelect">当前方剂</label><select class="select js-formula-select" id="formulaSelect">${formulas.map((item) => `<option value="${item.id}"${item.id === selected.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></div>
          <button class="btn btn-secondary" id="resetFormula"><i class="fa-solid fa-rotate-left"></i> 重置</button>
        </div>
        <div class="formula-layout" style="margin-top: 18px;"><div class="formula-main"><div class="grid grid-2">${formulas.map(renderFormulaCard).join('') || '<div class="empty-state">没有匹配方剂。</div>'}</div></div><aside>${renderFormulaDetail(selected)}</aside></div>
      </section>
    `;
  }

  function renderDesign() {
    return `
      <section class="section">
        <div class="section-header"><div><h2 class="section-title">设计系统</h2><p class="section-note">当前页面结构保持不变，数据层已支持 API 优先和静态兜底。</p></div></div>
        <div class="grid grid-2">
          <div class="card pad"><h3>颜色 token</h3><table class="token-table"><thead><tr><th>名称</th><th>值</th><th>用途</th><th>预览</th></tr></thead><tbody>${(FALLBACK.tokens || []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(item.usage)}</td><td><span class="swatch" style="--color:${item.value}"></span></td></tr>`).join('')}</tbody></table></div>
          <div class="card pad"><h3>数据策略</h3><div class="list-stack"><div class="list-item"><span><strong>API 优先</strong><p>/api/herbs、/api/herbs/statistics、/api/knowledge/graph-data</p></span><i class="fa-solid fa-plug"></i></div><div class="list-item"><span><strong>静态兜底</strong><p>接口失败时继续使用 scripts/herb-data.js</p></span><i class="fa-solid fa-shield"></i></div></div></div>
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
    const send = () => {
      const question = input?.value.trim();
      if (!question) return;
      state.chat.push({ role: 'user', content: question });
      state.chat.push({ role: 'assistant', title: '本草知识图谱 AI', content: buildAnswer(question) });
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
    document.querySelector('.js-formula-select')?.addEventListener('change', (event) => {
      state.selectedFormulaId = Number(event.target.value);
      render();
    });
    document.getElementById('resetFormula')?.addEventListener('click', () => {
      state.formulaTerm = '';
      state.formulaCategory = '全部';
      state.selectedFormulaId = state.formulas[0]?.id || null;
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
      imageTone: source.imageTone || colorForText(source.name || category || 'herb')
    };
  }

  function normalizeFormulas(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      id: item.id || index + 1,
      name: item.name || '',
      category: item.category || item.type || '方剂',
      source: item.source || '',
      herbs: normalizeList(item.herbs || item.ingredients || item.composition, 'name'),
      effect: item.effect || item.efficacy || '',
      indication: item.indication || '',
      steps: normalizeList(item.steps || item.method || item.role)
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
    return buildFallbackGraphView();
  }

  function buildRemoteGraphView(graph) {
    const herbs = graph.nodes.filter((node) => node.type === 'Herb').map((node) => ({ id: node.id, name: node.name }));
    const focusName = state.selectedHerbName || herbs[0]?.name || FALLBACK_HERBS[0]?.name || '';
    const focus = graph.nodes.find((node) => node.type === 'Herb' && node.name === focusName) || graph.nodes.find((node) => node.type === 'Herb');
    if (!focus) return buildFallbackGraphView();

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

  function buildFallbackGraphView() {
    const herbs = (state.herbs.length ? state.herbs : FALLBACK_HERBS).map((item) => ({ id: item.id, name: item.name }));
    const herb = (state.herbs.length ? state.herbs : FALLBACK_HERBS).find((item) => item.name === state.selectedHerbName) || FALLBACK_HERBS[0];
    const related = [
      { id: 'category', type: 'Category', name: herb.category || '分类', subtitle: '分类', color: colorForType('Category') },
      { id: 'region', type: 'Region', name: herb.region || '产地', subtitle: '产地', color: colorForType('Region') },
      { id: 'property', type: 'Property', name: herb.nature || '性味', subtitle: '性味', color: colorForType('Property') },
      { id: 'meridian', type: 'Meridian', name: herb.meridian.join('、') || '归经', subtitle: '归经', color: colorForType('Meridian') },
      { id: 'efficacy', type: 'Efficacy', name: herb.efficacy[0] || '功效', subtitle: '功效', color: colorForType('Efficacy') }
    ];
    const nodes = layoutNodes([{ id: `herb_${herb.id}`, type: 'Herb', name: herb.name, center: true }, ...related], `herb_${herb.id}`);
    return {
      herbs,
      focusName: herb.name,
      nodes,
      lines: nodes.filter((item) => !item.center).map((item) => ({ x1: 50, y1: 50, x2: item.x, y2: item.y, stroke: colorForType(item.type) })),
      legend: graphLegend(),
      totalNodes: nodes.length,
      totalLinks: Math.max(0, nodes.length - 1)
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
    if (!regions.length) return `<div class="card pad" style="margin-top: 16px;"><h3>产地分布</h3><p>后端产地分布接口不可用时，此处保留为图谱说明面板。</p></div>`;
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
        <div class="herb-thumb" style="--tone:${item.imageTone}"><i class="fa-solid fa-leaf"></i></div>
        <div>
          <div class="herb-meta"><h3>${escapeHtml(item.name)}</h3><span>${escapeHtml(item.pinyin || '')}</span></div>
          <p>${escapeHtml(item.description || item.efficacy.join('、') || '暂无描述。')}</p>
          <div class="tag-row"><span class="tag">${escapeHtml(item.category || '未分类')}</span><span class="tag">${escapeHtml(item.region || '未知产地')}</span>${item.isCommon ? '<span class="tag">常用药</span>' : ''}</div>
        </div>
      </a>
    `;
  }

  function renderFormulaCard(item) {
    return `<a class="card formula-card" href="formula-library.html?formula=${encodeURIComponent(item.name)}"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.effect || item.indication || '')}</p><div class="tag-row"><span class="tag">${escapeHtml(item.category)}</span><span class="tag">${escapeHtml(item.source || '经典方剂')}</span></div><div class="chip-row" style="margin-top: 12px;">${renderChips(item.herbs.slice(0, 4))}</div></a>`;
  }

  function renderFormulaDetail(item) {
    if (!item) return '<div class="empty-state">暂无方剂详情。</div>';
    return `<div class="card pad"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.effect || '')}</p><div class="tag-row"><span class="tag">${escapeHtml(item.category)}</span><span class="tag">来源：${escapeHtml(item.source || '暂无')}</span></div><div class="chip-row" style="margin-top: 14px;">${renderChips(item.herbs)}</div></div><div class="card pad" style="margin-top: 16px;"><h3>配伍步骤</h3><ol class="formula-steps">${(item.steps.length ? item.steps : ['暂无配伍步骤。']).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div>`;
  }

  function renderInfoCard(title, text) {
    return `<div class="card pad"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text || '暂无')}</p></div>`;
  }

  function renderStatListCard(item) {
    return `<div class="card stat-card"><span class="stat-value">${displayCount(item.count)}</span><span class="stat-label">${escapeHtml(item.name)}</span></div>`;
  }

  function renderFormulaLinkItem(item) {
    return `<a class="list-item" href="formula-library.html?formula=${encodeURIComponent(item.name)}"><span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category || item.role || item.effect || '')}</p></span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderHerbLinkItem(item) {
    return `<a class="list-item" href="herb-detail.html?herb=${encodeURIComponent(item.name)}"><span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category)} · ${escapeHtml(item.region)}</p></span><i class="fa-solid fa-arrow-right"></i></a>`;
  }

  function renderMessage(item) {
    return `<div class="message ${item.role === 'user' ? 'user' : 'assistant'}">${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ''}<div>${escapeHtml(item.content)}</div></div>`;
  }

  function renderChips(items) {
    return (items && items.length ? items : ['暂无']).map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('');
  }

  function filterLocalHerbs(items) {
    return filterNormalizedHerbs(items);
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
      const matchedTerm = !term || normalizeText([item.name, item.herbs.join(' '), item.effect, item.indication].join(' ')).includes(term);
      const matchedCategory = state.formulaCategory === '全部' || item.category === state.formulaCategory;
      return matchedTerm && matchedCategory;
    });
  }

  function findRelatedFormulas(herb) {
    const remote = normalizeFormulas(herb.formulas || []);
    if (remote.length) return remote;
    return state.formulas.filter((formula) => formula.herbs.includes(herb.name) || herb.formulaIds.includes(Number(formula.id))).slice(0, 4);
  }

  function resolveLocalHerb() {
    const queryName = state.selectedHerbName;
    const queryId = state.selectedHerbId;
    return FALLBACK_HERBS.find((item) => String(item.id) === String(queryId)) || FALLBACK_HERBS.find((item) => item.name === queryName || item.aliases.includes(queryName)) || FALLBACK_HERBS[0];
  }

  function resolveFormulaId(query) {
    if (!query) return null;
    const found = state.formulas.find((item) => String(item.id) === String(query) || item.name === query);
    return found ? found.id : null;
  }

  function getHero() {
    const stats = state.stats || buildFallbackStats();
    const commonStats = [
      { value: displayCount(stats.total_herbs || FALLBACK_HERBS.length), label: '药材总数' },
      { value: displayCount(stats.by_category.length || state.categories.length), label: '分类维度' },
      { value: state.apiOnline ? 'API' : '离线', label: '数据来源' }
    ];
    const copy = {
      home: ['本草知识图谱', '把药材、方剂、图谱和问答放进同一个前端', '围绕真实后端药材数据，提供查询、详情、图谱、问答和方剂浏览。'],
      search: ['药材查询', '按名称、分类和产地筛选药材', '优先使用后端 275 味药材接口，接口不可用时使用静态兜底。'],
      detail: ['药材详情', '查看单味药材的性味、功效与配伍', '详情页会优先请求后端完整药材信息，并兼容知识图谱详情接口。'],
      graph: ['知识图谱', '把药材、功效、归经和产地串起来', '优先展示后端常用药图谱，并补充产地分布统计。'],
      qa: ['AI 问答', '围绕药材和方剂进行自然语言提问', '当前保留前端模拟问答，答案会引用已加载的药材和方剂数据。'],
      formula: ['方剂库', '按方名与分类浏览经典方剂', '方剂库继续使用离线数据，并与真实药材详情页互相跳转。'],
      design: ['设计系统', '统一颜色、字体、组件和数据状态', '记录当前前端的视觉 token 与 API 优先、静态兜底策略。']
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

  function buildFallbackStats() {
    return normalizeStats({
      total_herbs: FALLBACK_HERBS.length,
      by_category: countBy(FALLBACK_HERBS, 'category'),
      by_region: countBy(FALLBACK_HERBS, 'region'),
      by_efficacy: countBy(FALLBACK_HERBS.flatMap((item) => item.efficacy.map((name) => ({ name }))), 'name')
    });
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

  function buildAnswer(question) {
    const q = normalizeText(question);
    const herb = [...state.herbs, ...FALLBACK_HERBS].find((item) => normalizeText(item.name).includes(q) || q.includes(normalizeText(item.name)));
    if (herb) return `${herb.name} 的功效是 ${herb.efficacy.join('、') || '暂无'}，性味为 ${herb.nature || '暂无'}，归经 ${herb.meridian.join('、') || '暂无'}。${herb.caution ? `注意：${herb.caution}` : ''}`;
    const formula = state.formulas.find((item) => q.includes(normalizeText(item.name)));
    if (formula) return `${formula.name} 由 ${formula.herbs.join('、')} 组成，功效为 ${formula.effect || '暂无'}，主治 ${formula.indication || '暂无'}。`;
    return '我可以从药材功效、归经、方剂组成和适应证四个方向继续回答。你也可以直接输入药材名或方名。';
  }

  function renderOptions(options, selected) {
    return options.map((item) => `<option value="${escapeAttr(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('');
  }

  function renderFooter() {
    return `<footer class="footer"><div><strong>${escapeHtml(FALLBACK.siteName || '本草知识图谱')}</strong><div>${escapeHtml(FALLBACK.siteTagline || '')}</div></div></footer>`;
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
