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

  const HERO_COPY = {
    home: {
      kicker: '本草知识图谱',
      title: '把药材、方剂、图谱和问答放进同一个前端',
      text: '围绕药材查询、知识图谱、AI 问答、方剂库和设计系统，搭建一套可直接浏览的中医药知识前端。',
      stats: [
        { value: '8', label: '核心药材' },
        { value: '6', label: '常用方剂' },
        { value: '6', label: '设计 token' }
      ],
      actions: [
        { href: 'herb-search.html', label: '进入药材查询', icon: 'fa-magnifying-glass', kind: 'primary' },
        { href: 'knowledge-graph.html', label: '查看知识图谱', icon: 'fa-diagram-project', kind: 'secondary' }
      ]
    },
    search: {
      kicker: '药材查询',
      title: '按药性、归经、产地筛选药材',
      text: '支持关键词检索、分类筛选和产地过滤，快速定位人参、黄芪、当归等常用药材。',
      stats: [
        { value: '8', label: '药材条目' },
        { value: '6', label: '分类维度' },
        { value: '6', label: '归经标签' }
      ],
      actions: [
        { href: 'index.html', label: '回到首页', icon: 'fa-house', kind: 'secondary' },
        { href: 'qa.html', label: '去 AI 问答', icon: 'fa-comments', kind: 'primary' }
      ]
    },
    detail: {
      kicker: '药材详情',
      title: '查看单味药材的性味、功效与配伍',
      text: '从药材基础信息、功效主治、用法注意到相关方剂，提供完整的详情浏览体验。',
      stats: [
        { value: '1', label: '当前药材' },
        { value: '4', label: '信息分区' },
        { value: '相关', label: '联动方剂' }
      ],
      actions: [
        { href: 'herb-search.html', label: '返回查询', icon: 'fa-arrow-left', kind: 'secondary' },
        { href: 'knowledge-graph.html', label: '打开图谱', icon: 'fa-diagram-project', kind: 'primary' }
      ]
    },
    graph: {
      kicker: '知识图谱',
      title: '把药材、功效、归经和方剂串起来',
      text: '通过关系节点、连线和筛选器展示药材之间的结构化知识网络，便于横向比较与联想检索。',
      stats: [
        { value: '1', label: '中心药材' },
        { value: '6', label: '关系节点' },
        { value: '2', label: '关联方剂' }
      ],
      actions: [
        { href: 'herb-detail.html', label: '查看详情', icon: 'fa-circle-info', kind: 'secondary' },
        { href: 'herb-search.html', label: '重新选药材', icon: 'fa-magnifying-glass', kind: 'primary' }
      ]
    },
    qa: {
      kicker: 'AI 问答',
      title: '围绕药材和方剂进行自然语言提问',
      text: '内置示例问答和即时回复模板，能回答功效、归经、配伍和适应证等基础问题。',
      stats: [
        { value: '4', label: '示例问题' },
        { value: '6', label: '回复模板' },
        { value: '1', label: '输入框' }
      ],
      actions: [
        { href: 'formula-library.html', label: '打开方剂库', icon: 'fa-book-medical', kind: 'secondary' },
        { href: 'knowledge-graph.html', label: '联动图谱', icon: 'fa-diagram-project', kind: 'primary' }
      ]
    },
    formula: {
      kicker: '方剂库',
      title: '按方名与分类浏览经典方剂',
      text: '展示方剂组成、功效、主治与配伍步骤，并能从药材跳转回方剂关联。',
      stats: [
        { value: '6', label: '方剂条目' },
        { value: '3', label: '主分类' },
        { value: '2', label: '联动路径' }
      ],
      actions: [
        { href: 'qa.html', label: '问答检索', icon: 'fa-comments', kind: 'secondary' },
        { href: 'design-system.html', label: '设计系统', icon: 'fa-palette', kind: 'primary' }
      ]
    },
    design: {
      kicker: '设计系统',
      title: '统一颜色、字体、组件和状态',
      text: '把页面里实际用到的按钮、卡片、标签、表格和颜色 token 集中展示，便于后续扩展。',
      stats: [
        { value: '6', label: '颜色 token' },
        { value: '4', label: '按钮样式' },
        { value: '3', label: '组件面板' }
      ],
      actions: [
        { href: 'index.html', label: '返回首页', icon: 'fa-house', kind: 'secondary' },
        { href: 'herb-search.html', label: '查看查询页', icon: 'fa-magnifying-glass', kind: 'primary' }
      ]
    }
  };

  const state = {
    selectedHerbId: null,
    selectedFormulaId: null,
    searchTerm: '',
    category: '全部',
    region: '全部',
    formulaTerm: '',
    formulaCategory: '全部',
    chat: []
  };

  const app = document.getElementById('app');
  if (!app || !window.HerbData) {
    return;
  }

  const currentPage = getCurrentPage();
  initState();
  render(currentPage);

  function getCurrentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return PAGE_MAP[path] || document.body.dataset.page || 'home';
  }

  function initState() {
    const herbQuery = getQueryParam('herb');
    const formulaQuery = getQueryParam('formula');
    const searchQuery = getQueryParam('q');
    const categoryQuery = getQueryParam('category');
    const regionQuery = getQueryParam('region');

    state.selectedHerbId = resolveHerbId(herbQuery) || HerbData.herbs[0].id;
    state.selectedFormulaId = resolveFormulaId(formulaQuery) || HerbData.formulas[0].id;
    state.searchTerm = searchQuery || '';
    state.category = categoryQuery || '全部';
    state.region = regionQuery || '全部';
    state.formulaTerm = formulaQuery && !resolveFormulaId(formulaQuery) ? formulaQuery : '';
    state.formulaCategory = getQueryParam('formulaCategory') || '全部';
    state.chat = [
      {
        role: 'assistant',
        title: '本草知识图谱 AI',
        content: '你好，我可以回答药材功效、归经、配伍、方剂组成和适应证等问题。你可以直接问“人参适合什么证型”或“四君子汤的组成是什么”。'
      }
    ];
  }

  function render(page) {
    const hero = HERO_COPY[page] || HERO_COPY.home;
    document.title = `${hero.title} - ${HerbData.siteName}`;
    app.innerHTML = `
      <div class="page-shell">
        ${renderTopbar(page)}
        <main>
          ${renderHero(hero)}
          ${renderPage(page)}
        </main>
        ${renderFooter()}
      </div>
    `;
    bindEvents(page);
  }

  function renderTopbar(page) {
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="index.html">
            <div class="brand-mark"><img src="assets/herb-ornament.svg" alt="本草知识图谱图标"></div>
            <div class="brand-copy">
              <p class="brand-name">${escapeHtml(HerbData.siteName)}</p>
              <p class="brand-subtitle">${escapeHtml(HerbData.siteTagline)}</p>
            </div>
          </a>
          <div class="top-actions">
            <a class="btn btn-secondary" href="herb-search.html"><i class="fa-solid fa-magnifying-glass"></i> 药材查询</a>
            <a class="btn btn-primary" href="qa.html"><i class="fa-solid fa-comments"></i> AI 问答</a>
          </div>
        </div>
        <nav class="nav">
          <div class="nav-inner">
            ${HerbData.nav.map((item) => `
              <a class="nav-link${item.id === page ? ' active' : ''}" href="${item.href}">
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
          <div class="hero-visual">
            <img src="assets/herb-hero.svg" alt="本草知识图谱示意图">
          </div>
        </div>
      </section>
    `;
  }

  function renderPage(page) {
    switch (page) {
      case 'search':
        return renderSearch();
      case 'detail':
        return renderDetail();
      case 'graph':
        return renderGraph();
      case 'qa':
        return renderQA();
      case 'formula':
        return renderFormula();
      case 'design':
        return renderDesign();
      case 'home':
      default:
        return renderHome();
    }
  }

  function renderHome() {
    const herbs = HerbData.herbs.slice(0, 4);
    const formulas = HerbData.formulas.slice(0, 3);
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">首页概览</h2>
            <p class="section-note">先看总览，再进入药材、图谱和方剂页面继续浏览。</p>
          </div>
        </div>
        <div class="grid grid-4">
          <div class="card stat-card"><span class="stat-value">${HerbData.herbs.length}</span><span class="stat-label">药材条目</span></div>
          <div class="card stat-card"><span class="stat-value">${HerbData.formulas.length}</span><span class="stat-label">方剂条目</span></div>
          <div class="card stat-card"><span class="stat-value">${HerbData.filters.categories.length}</span><span class="stat-label">分类维度</span></div>
          <div class="card stat-card"><span class="stat-value">${HerbData.tokens.length}</span><span class="stat-label">设计 token</span></div>
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">重点药材</h2>
            <p class="section-note">用于主页卡片展示和详情页跳转。</p>
          </div>
          <a class="link-btn" href="herb-search.html">查看全部药材</a>
        </div>
        <div class="grid grid-2">
          ${herbs.map(renderHerbCard).join('')}
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">重点方剂</h2>
            <p class="section-note">展示组成、功效和主治路径。</p>
          </div>
          <a class="link-btn" href="formula-library.html">查看方剂库</a>
        </div>
        <div class="grid grid-3">
          ${formulas.map(renderFormulaCard).join('')}
        </div>
      </section>
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">快速入口</h2>
            <p class="section-note">把常用功能集中在首页，减少跳转成本。</p>
          </div>
        </div>
        <div class="grid grid-3">
          ${renderQuickLinkCard('药材查询', '关键词、分类和产地筛选药材。', 'herb-search.html', 'fa-magnifying-glass')}
          ${renderQuickLinkCard('知识图谱', '用关系节点串起药材与方剂。', 'knowledge-graph.html', 'fa-diagram-project')}
          ${renderQuickLinkCard('AI 问答', '围绕功效、配伍与适应证提问。', 'qa.html', 'fa-comments')}
        </div>
      </section>
    `;
  }

  function renderSearch() {
    const herbs = filterHerbs();
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材查询</h2>
            <p class="section-note">输入药材名、分类或产地，快速缩小范围。</p>
          </div>
          <a class="link-btn" href="herb-detail.html?herb=${encodeURIComponent(HerbData.herbs[0].name)}">示例详情</a>
        </div>
        <div class="toolbar">
          <div class="field">
            <label for="searchTerm">药材名称</label>
            <input class="input js-search-term" id="searchTerm" value="${escapeAttr(state.searchTerm)}" placeholder="输入名称、拼音或别名">
          </div>
          <div class="field">
            <label for="categoryFilter">分类</label>
            <select class="select js-search-category" id="categoryFilter">
              ${renderOptions(['全部', ...HerbData.filters.categories], state.category)}
            </select>
          </div>
          <div class="field">
            <label for="regionFilter">产地</label>
            <select class="select js-search-region" id="regionFilter">
              ${renderOptions(['全部', ...HerbData.filters.regions], state.region)}
            </select>
          </div>
          <button class="btn btn-secondary" id="resetSearch"><i class="fa-solid fa-rotate-left"></i> 重置</button>
        </div>
        <div class="section-header" style="margin-top: 18px;">
          <div>
            <h2 class="section-title">匹配结果</h2>
            <p class="section-note">当前共找到 ${herbs.length} 味药材。</p>
          </div>
        </div>
        <div class="grid grid-2">
          ${herbs.map(renderHerbCard).join('') || '<div class="empty-state">没有找到匹配的药材，请调整筛选条件。</div>'}
        </div>
      </section>
    `;
  }

  function renderDetail() {
    const herb = getSelectedHerb();
    const relatedFormulas = HerbData.formulas.filter((item) => item.herbs.includes(herb.name) || herb.formulaIds.includes(item.id));
    const relatedHerbs = HerbData.herbs.filter((item) => item.id !== herb.id && item.category === herb.category).slice(0, 4);

    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">药材详情</h2>
            <p class="section-note">查看基础信息、功效、注意事项和相关方剂。</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-secondary" href="herb-search.html"><i class="fa-solid fa-arrow-left"></i> 返回查询</a>
            <a class="btn btn-primary" href="knowledge-graph.html?herb=${encodeURIComponent(herb.name)}"><i class="fa-solid fa-diagram-project"></i> 打开图谱</a>
          </div>
        </div>
        <div class="detail-layout">
          <div class="detail-main">
            <div class="card detail-hero">
              <div class="detail-thumb" style="--tone:${herb.imageTone}">
                <i class="fa-solid fa-seedling"></i>
              </div>
              <div>
                <div class="tag-row">
                  <span class="tag">${escapeHtml(herb.category)}</span>
                  <span class="tag">${escapeHtml(herb.region)}</span>
                  ${herb.meridian.map((item) => `<span class="tag">归经·${escapeHtml(item)}</span>`).join('')}
                </div>
                <h3 style="margin-top: 12px; font-size: 30px;">${escapeHtml(herb.name)}</h3>
                <p>${escapeHtml(herb.pinyin)} · ${escapeHtml(herb.source)}</p>
                <p>${escapeHtml(herb.description)}</p>
              </div>
            </div>
            <div class="grid grid-2" style="margin-top: 16px;">
              ${renderInfoCard('性味', herb.nature)}
              ${renderInfoCard('用法', herb.usage)}
              ${renderInfoCard('功效', herb.efficacy.join('、'))}
              ${renderInfoCard('注意', herb.caution)}
            </div>
            <div class="grid grid-2" style="margin-top: 16px;">
              <div class="card pad">
                <h3>成分关键词</h3>
                <div class="chip-row">${herb.composition.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}</div>
              </div>
              <div class="card pad">
                <h3>关联方剂</h3>
                <div class="list-stack">${relatedFormulas.map(renderFormulaLinkItem).join('') || '<div class="empty-state">暂无关联方剂。</div>'}</div>
              </div>
            </div>
          </div>
          <aside>
            <div class="card pad">
              <h3>药材档案</h3>
              <dl class="fact-list">
                <div><dt>别名</dt><dd>${escapeHtml(herb.aliases.join('、'))}</dd></div>
                <div><dt>来源</dt><dd>${escapeHtml(herb.source)}</dd></div>
                <div><dt>归经</dt><dd>${escapeHtml(herb.meridian.join('、'))}</dd></div>
                <div><dt>功效</dt><dd>${escapeHtml(herb.efficacy.join('、'))}</dd></div>
              </dl>
            </div>
            <div class="card pad" style="margin-top: 16px;">
              <h3>同类药材</h3>
              <div class="list-stack">${relatedHerbs.map(renderHerbLinkItem).join('') || '<div class="empty-state">暂无同类药材。</div>'}</div>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderGraph() {
    const herb = getSelectedHerb();
    const graph = buildGraph(herb);
    const relatedFormulas = HerbData.formulas.filter((item) => herb.formulaIds.includes(item.id)).slice(0, 3);

    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">知识图谱</h2>
            <p class="section-note">选择中心药材后，查看与功效、归经和方剂之间的关系。</p>
          </div>
        </div>
        <div class="graph-layout">
          <div class="graph-stage">
            <div class="toolbar" style="grid-template-columns: minmax(0, 1fr) auto auto auto;">
              <div class="field">
                <label for="graphHerbSelect">中心药材</label>
                <select class="select js-graph-herb" id="graphHerbSelect">
                  ${HerbData.herbs.map((item) => `<option value="${item.id}"${item.id === herb.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
                </select>
              </div>
              <button class="btn btn-secondary control-btn secondary" data-graph-nav="prev" title="上一个药材"><i class="fa-solid fa-chevron-left"></i></button>
              <button class="btn btn-secondary control-btn secondary" data-graph-nav="next" title="下一个药材"><i class="fa-solid fa-chevron-right"></i></button>
              <a class="btn btn-primary" href="herb-detail.html?herb=${encodeURIComponent(herb.name)}"><i class="fa-solid fa-circle-info"></i> 打开详情</a>
            </div>
            <div class="graph-canvas">
              <svg class="graph-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                ${graph.lines.map((item) => `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.stroke}" stroke-width="0.7" stroke-linecap="round" />`).join('')}
              </svg>
              ${graph.nodes.map((item) => `
                ${item.href ? `<a class="graph-node${item.center ? ' center' : ''}" href="${item.href}" style="left:${item.x}%; top:${item.y}%; --node:${item.color};">` : `<div class="graph-node${item.center ? ' center' : ''}" style="left:${item.x}%; top:${item.y}%; --node:${item.color};">`}
                  <span>${escapeHtml(item.title)}</span>
                  <small>${escapeHtml(item.subtitle)}</small>
                ${item.href ? '</a>' : '</div>'}
              `).join('')}
            </div>
            <div class="graph-legend">
              ${graph.legend.map((item) => `<span class="legend-item"><span class="legend-dot" style="--color:${item.color}"></span>${escapeHtml(item.label)}</span>`).join('')}
            </div>
          </div>
          <aside>
            <div class="card pad">
              <h3>${escapeHtml(herb.name)}</h3>
              <p>${escapeHtml(herb.description)}</p>
              <div class="tag-row">${herb.efficacy.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('')}</div>
            </div>
            <div class="card pad" style="margin-top: 16px;">
              <h3>相关方剂</h3>
              <div class="list-stack">${relatedFormulas.map(renderFormulaLinkItem).join('') || '<div class="empty-state">暂无关联方剂。</div>'}</div>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderQA() {
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">AI 问答</h2>
            <p class="section-note">围绕功效、归经、配伍和方剂适应证进行提问。</p>
          </div>
          <a class="link-btn" href="formula-library.html">打开方剂库</a>
        </div>
        <div class="qa-layout">
          <div class="chat-panel">
            <div class="chat-feed" id="chatFeed">
              ${state.chat.map(renderMessage).join('')}
            </div>
            <div class="chat-composer">
              <textarea id="questionInput" class="textarea" placeholder="输入你的问题，例如：黄芪适合什么证型？"></textarea>
              <button class="submit-btn" id="sendQuestion"><i class="fa-solid fa-paper-plane"></i> 发送</button>
            </div>
            <div class="chip-row" style="margin-top: 12px;">
              ${['黄芪的主要功效是什么？', '四君子汤的组成与作用是什么？', '人参与黄芪如何配伍？', '麻黄汤适合什么证型？'].map((item) => `<button class="btn btn-secondary suggested-question" data-question="${escapeAttr(item)}">${escapeHtml(item)}</button>`).join('')}
            </div>
          </div>
          <aside>
            <div class="card pad">
              <h3>回答范围</h3>
              <div class="chip-row">
                <span class="chip">药材功效</span>
                <span class="chip">性味归经</span>
                <span class="chip">方剂组成</span>
                <span class="chip">用法注意</span>
              </div>
            </div>
            <div class="card pad" style="margin-top: 16px;">
              <h3>常见问题模板</h3>
              <div class="list-stack">
                ${[
                  '人参适合什么证型？',
                  '黄芪和当归怎么搭配？',
                  '银翘散适合什么症状？',
                  '丹参有哪些活血用途？'
                ].map((item) => `<div class="list-item suggested-question" data-question="${escapeAttr(item)}"><span><strong>${escapeHtml(item)}</strong><p>点击后自动填入问题</p></span><i class="fa-solid fa-arrow-right"></i></div>`).join('')}
              </div>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderFormula() {
    const formulas = filterFormulas();
    const formula = getSelectedFormula();

    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">方剂库</h2>
            <p class="section-note">浏览方名、组成、功效和适应证。</p>
          </div>
          <a class="link-btn" href="qa.html">去 AI 问答</a>
        </div>
        <div class="toolbar">
          <div class="field">
            <label for="formulaTerm">方剂名称</label>
            <input class="input js-formula-term" id="formulaTerm" value="${escapeAttr(state.formulaTerm)}" placeholder="输入方剂名或组成药材">
          </div>
          <div class="field">
            <label for="formulaCategory">分类</label>
            <select class="select js-formula-category" id="formulaCategory">
              ${renderOptions(['全部', ...new Set(HerbData.formulas.map((item) => item.category))], state.formulaCategory)}
            </select>
          </div>
          <div class="field">
            <label for="formulaSelect">当前方剂</label>
            <select class="select js-formula-select" id="formulaSelect">
              ${formulas.map((item) => `<option value="${item.id}"${item.id === formula.id ? ' selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-secondary" id="resetFormula"><i class="fa-solid fa-rotate-left"></i> 重置</button>
        </div>
        <div class="formula-layout" style="margin-top: 18px;">
          <div class="formula-main">
            <div class="grid grid-2">
              ${formulas.map(renderFormulaCard).join('') || '<div class="empty-state">没有匹配的方剂，请调整筛选条件。</div>'}
            </div>
          </div>
          <aside>
            <div class="card pad">
              <h3>${escapeHtml(formula.name)}</h3>
              <p>${escapeHtml(formula.effect)}</p>
              <div class="tag-row">
                <span class="tag">${escapeHtml(formula.category)}</span>
                <span class="tag">来源：${escapeHtml(formula.source)}</span>
              </div>
              <div style="margin-top: 14px;" class="chip-row">
                ${formula.herbs.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join('')}
              </div>
            </div>
            <div class="card pad" style="margin-top: 16px;">
              <h3>配伍步骤</h3>
              <ol class="formula-steps">
                ${formula.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ol>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderDesign() {
    return `
      <section class="section">
        <div class="section-header">
          <div>
            <h2 class="section-title">设计系统</h2>
            <p class="section-note">集中展示当前前端用到的颜色、按钮、输入框和卡片样式。</p>
          </div>
        </div>
        <div class="grid grid-2">
          <div class="card pad">
            <h3>颜色 token</h3>
            <table class="token-table">
              <thead>
                <tr><th>名称</th><th>值</th><th>用途</th><th>预览</th></tr>
              </thead>
              <tbody>
                ${HerbData.tokens.map((item) => `
                  <tr>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.value)}</td>
                    <td>${escapeHtml(item.usage)}</td>
                    <td><span class="swatch" style="--color:${item.value}"></span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="card pad">
            <h3>组件样式</h3>
            <div class="component-demo">
              <button class="btn btn-primary"><i class="fa-solid fa-check"></i> 主按钮</button>
              <button class="btn btn-secondary"><i class="fa-solid fa-filter"></i> 次按钮</button>
              <button class="btn btn-ghost"><i class="fa-solid fa-arrow-rotate-left"></i> 轻按钮</button>
              <span class="tag">标签</span>
              <span class="chip">药性</span>
            </div>
            <div class="grid grid-2" style="margin-top: 16px;">
              <div class="field">
                <label>输入框</label>
                <input class="input" value="人参" />
              </div>
              <div class="field">
                <label>下拉框</label>
                <select class="select"><option>补气药</option><option>补血药</option></select>
              </div>
            </div>
            <div class="card pad" style="margin-top: 16px; background: var(--surface-soft);">
              <h4>卡片示例</h4>
              <p>当前界面采用 8px 圆角、低饱和绿色系和清晰的层级结构，避免视觉噪音过高。</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function bindEvents(page) {
    bindTopInteractions();
    if (page === 'search') {
      bindSearchInteractions();
    }
    if (page === 'detail') {
      bindDetailInteractions();
    }
    if (page === 'graph') {
      bindGraphInteractions();
    }
    if (page === 'qa') {
      bindQAInteractions();
    }
    if (page === 'formula') {
      bindFormulaInteractions();
    }
  }

  function bindTopInteractions() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        // Allow normal navigation; this comment is only here to keep the handler explicit.
      });
    });
  }

  function bindSearchInteractions() {
    const termInput = document.querySelector('.js-search-term');
    const categorySelect = document.querySelector('.js-search-category');
    const regionSelect = document.querySelector('.js-search-region');
    const resetButton = document.getElementById('resetSearch');

    termInput?.addEventListener('input', (event) => {
      state.searchTerm = event.target.value;
      render('search');
    });
    categorySelect?.addEventListener('change', (event) => {
      state.category = event.target.value;
      render('search');
    });
    regionSelect?.addEventListener('change', (event) => {
      state.region = event.target.value;
      render('search');
    });
    resetButton?.addEventListener('click', () => {
      state.searchTerm = '';
      state.category = '全部';
      state.region = '全部';
      render('search');
    });
  }

  function bindDetailInteractions() {
    // Detail page is link-driven, so no extra controls are needed yet.
  }

  function bindGraphInteractions() {
    const select = document.querySelector('.js-graph-herb');
    const navButtons = document.querySelectorAll('[data-graph-nav]');

    select?.addEventListener('change', (event) => {
      state.selectedHerbId = Number(event.target.value);
      render('graph');
    });

    navButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const index = HerbData.herbs.findIndex((item) => item.id === state.selectedHerbId);
        if (index < 0) {
          return;
        }
        if (button.dataset.graphNav === 'prev') {
          state.selectedHerbId = HerbData.herbs[(index - 1 + HerbData.herbs.length) % HerbData.herbs.length].id;
        } else {
          state.selectedHerbId = HerbData.herbs[(index + 1) % HerbData.herbs.length].id;
        }
        render('graph');
      });
    });
  }

  function bindQAInteractions() {
    const input = document.getElementById('questionInput');
    const sendButton = document.getElementById('sendQuestion');
    const suggestions = document.querySelectorAll('.suggested-question');

    const sendQuestion = () => {
      const question = input.value.trim();
      if (!question) {
        return;
      }
      state.chat.push({ role: 'user', content: question });
      state.chat.push({ role: 'assistant', title: '本草知识图谱 AI', content: buildAnswer(question) });
      render('qa');
    };

    sendButton?.addEventListener('click', sendQuestion);
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendQuestion();
      }
    });
    suggestions.forEach((item) => {
      item.addEventListener('click', () => {
        input.value = item.dataset.question || '';
        input.focus();
      });
    });
  }

  function bindFormulaInteractions() {
    const termInput = document.querySelector('.js-formula-term');
    const categorySelect = document.querySelector('.js-formula-category');
    const formulaSelect = document.querySelector('.js-formula-select');
    const resetButton = document.getElementById('resetFormula');

    termInput?.addEventListener('input', (event) => {
      state.formulaTerm = event.target.value;
      render('formula');
    });
    categorySelect?.addEventListener('change', (event) => {
      state.formulaCategory = event.target.value;
      render('formula');
    });
    formulaSelect?.addEventListener('change', (event) => {
      state.selectedFormulaId = Number(event.target.value);
      render('formula');
    });
    resetButton?.addEventListener('click', () => {
      state.formulaTerm = '';
      state.formulaCategory = '全部';
      state.selectedFormulaId = HerbData.formulas[0].id;
      render('formula');
    });
  }

  function filterHerbs() {
    const term = normalize(state.searchTerm);
    return HerbData.herbs.filter((item) => {
      const matchedTerm = !term || [item.name, item.pinyin, item.aliases.join(' '), item.description, item.source].some((value) => normalize(value).includes(term));
      const matchedCategory = state.category === '全部' || item.category === state.category;
      const matchedRegion = state.region === '全部' || item.region === state.region;
      return matchedTerm && matchedCategory && matchedRegion;
    });
  }

  function filterFormulas() {
    const term = normalize(state.formulaTerm);
    return HerbData.formulas.filter((item) => {
      const matchedTerm = !term || [item.name, item.category, item.herbs.join(' '), item.indication, item.effect].some((value) => normalize(value).includes(term));
      const matchedCategory = state.formulaCategory === '全部' || item.category === state.formulaCategory;
      return matchedTerm && matchedCategory;
    });
  }

  function buildGraph(herb) {
    const relations = [
      { title: '功效', subtitle: herb.efficacy[0], color: '#14766f', x: 50, y: 17, href: 'qa.html' },
      { title: '性味', subtitle: herb.nature, color: '#c67517', x: 76, y: 30 },
      { title: '归经', subtitle: herb.meridian.join('、'), color: '#2f7651', x: 80, y: 70 },
      { title: '产地', subtitle: herb.region, color: '#a83d30', x: 50, y: 84 },
      { title: '方剂', subtitle: getFormulaCount(herb), color: '#8c7b59', x: 22, y: 70, href: `formula-library.html?formula=${encodeURIComponent(getPrimaryFormula(herb).name)}` },
      { title: '别名', subtitle: herb.aliases[0], color: '#3c7d8c', x: 24, y: 30 }
    ];

    const nodes = [
      { title: herb.name, subtitle: '核心药材', color: herb.imageTone, x: 50, y: 50, center: true, href: `herb-detail.html?herb=${encodeURIComponent(herb.name)}` },
      ...relations
    ];

    const center = nodes[0];
    const lines = relations.map((item) => ({ x1: center.x, y1: center.y, x2: item.x, y2: item.y, stroke: item.color }));

    return {
      nodes,
      lines,
      legend: [
        { label: '核心药材', color: herb.imageTone },
        { label: '功效节点', color: '#14766f' },
        { label: '方剂节点', color: '#8c7b59' },
        { label: '产地节点', color: '#a83d30' }
      ]
    };
  }

  function buildAnswer(question) {
    const q = normalize(question);
    const herb = HerbData.herbs.find((item) => normalize(item.name).includes(q) || normalize(item.aliases.join(' ')).includes(q));

    if (q.includes('四君子汤')) {
      return '四君子汤由人参、白术、茯苓、炙甘草组成，主治脾胃气虚，核心作用是益气健脾。';
    }
    if (q.includes('归脾汤')) {
      return '归脾汤重在益气补血、健脾养心，常用于心脾两虚、失眠健忘和脾不统血。';
    }
    if (q.includes('麻黄汤')) {
      return '麻黄汤用于外感风寒表实证，特点是发汗解表、宣肺平喘，常见表现是恶寒发热、无汗而喘。';
    }
    if (q.includes('银翘散')) {
      return '银翘散适合温病初起和风热表证，重点在辛凉透表、清热解毒。';
    }
    if (q.includes('黄芪')) {
      return '黄芪补气升阳、固表止汗、利水消肿，常用于气虚自汗、久泻脱肛和表虚易感。';
    }
    if (q.includes('人参')) {
      return '人参大补元气、复脉固脱、补脾益肺，适合气虚欲脱、脾肺两虚和津伤口渴。';
    }
    if (q.includes('当归')) {
      return '当归能补血活血、调经止痛、润肠通便，常见于血虚、血瘀和经行不调。';
    }
    if (q.includes('丹参')) {
      return '丹参活血祛瘀、通经止痛、清心除烦，常用于血瘀疼痛和心烦不眠。';
    }
    if (herb) {
      return `${herb.name} 的功效是 ${herb.efficacy.join('、')}，性味为 ${herb.nature}，归经 ${herb.meridian.join('、')}。使用时需注意：${herb.caution}`;
    }
    return '我可以从药材功效、归经、方剂组成和适应证四个方向继续回答。你也可以直接输入药材名或方名。';
  }

  function renderHerbCard(item) {
    return `
      <a class="card herb-card" href="herb-detail.html?herb=${encodeURIComponent(item.name)}">
        <div class="herb-thumb" style="--tone:${item.imageTone}"><i class="fa-solid fa-leaf"></i></div>
        <div>
          <div class="herb-meta">
            <h3>${escapeHtml(item.name)}</h3>
            <span>${escapeHtml(item.pinyin)}</span>
          </div>
          <p>${escapeHtml(item.description)}</p>
          <div class="tag-row">
            <span class="tag">${escapeHtml(item.category)}</span>
            <span class="tag">${escapeHtml(item.region)}</span>
            <span class="tag">${escapeHtml(item.nature)}</span>
          </div>
        </div>
      </a>
    `;
  }

  function renderFormulaCard(item) {
    return `
      <a class="card formula-card" href="formula-library.html?formula=${encodeURIComponent(item.name)}">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.effect)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(item.category)}</span>
          <span class="tag">${escapeHtml(item.source)}</span>
        </div>
        <div class="chip-row" style="margin-top: 12px;">${item.herbs.slice(0, 4).map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join('')}</div>
      </a>
    `;
  }

  function renderQuickLinkCard(title, text, href, icon) {
    return `
      <a class="card quick-link-card pad" href="${href}">
        <h3><i class="fa-solid ${icon}"></i> ${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
        <span class="link-btn">进入页面</span>
      </a>
    `;
  }

  function renderFormulaLinkItem(item) {
    return `
      <a class="list-item" href="formula-library.html?formula=${encodeURIComponent(item.name)}">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.category)} · ${escapeHtml(item.effect)}</p>
        </span>
        <i class="fa-solid fa-arrow-right"></i>
      </a>
    `;
  }

  function renderHerbLinkItem(item) {
    return `
      <a class="list-item" href="herb-detail.html?herb=${encodeURIComponent(item.name)}">
        <span>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.category)} · ${escapeHtml(item.region)}</p>
        </span>
        <i class="fa-solid fa-arrow-right"></i>
      </a>
    `;
  }

  function renderInfoCard(title, text) {
    return `
      <div class="card pad">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(text)}</p>
      </div>
    `;
  }

  function renderMessage(item) {
    return `
      <div class="message ${item.role === 'user' ? 'user' : 'assistant'}">
        ${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ''}
        <div>${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>
      </div>
    `;
  }

  function getSelectedHerb() {
    return resolveHerbId(state.selectedHerbId) ? HerbData.herbs.find((item) => item.id === state.selectedHerbId) || HerbData.herbs[0] : HerbData.herbs[0];
  }

  function getSelectedFormula() {
    return HerbData.formulas.find((item) => item.id === state.selectedFormulaId) || HerbData.formulas[0];
  }

  function getFormulaCount(herb) {
    return HerbData.formulas.filter((item) => herb.formulaIds.includes(item.id)).length;
  }

  function getPrimaryFormula(herb) {
    return HerbData.formulas.find((item) => herb.formulaIds.includes(item.id)) || HerbData.formulas[0];
  }

  function resolveHerbId(query) {
    if (!query) {
      return null;
    }
    const byId = HerbData.herbs.find((item) => String(item.id) === String(query));
    if (byId) {
      return byId.id;
    }
    const byName = HerbData.herbs.find((item) => item.name === query || item.aliases.includes(query));
    return byName ? byName.id : null;
  }

  function resolveFormulaId(query) {
    if (!query) {
      return null;
    }
    const byId = HerbData.formulas.find((item) => String(item.id) === String(query));
    if (byId) {
      return byId.id;
    }
    const byName = HerbData.formulas.find((item) => item.name === query);
    return byName ? byName.id : null;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function renderOptions(options, selected) {
    return options.map((item) => `<option value="${escapeAttr(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('');
  }

  function renderFooter() {
    return `
      <footer class="footer">
        <div>
          <strong>${escapeHtml(HerbData.siteName)}</strong>
          <div>${escapeHtml(HerbData.siteTagline)}</div>
        </div>
      </footer>
    `;
  }

  function normalize(value) {
    return String(value || '').toLowerCase();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();
