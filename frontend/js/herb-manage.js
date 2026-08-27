/**
 * 药材管理系统 - 前端交互模块 (herb-manage.js)
 * @description 管理面板的 CRUD 操作、表单交互、列表渲染
 * @architecture 方案 B（后端代理）：前端 -> Express API -> neo4j-driver -> Neo4j AuraDB
 * @dependency 需要在 knowledge-graph.html 中引入本脚本
 */

(function() {
  'use strict';

  // API 基础地址（始终指向 Neo4j 后端端口，避免被 Codex 代理拦截）
  const API_BASE = 'http://localhost:3001';

  // ==================== 状态管理 ====================
  const state = {
    currentPage: 1,
    pageSize: 15,
    totalPages: 0,
    totalHerbs: 0,
    searchTerm: '',
    categoryFilter: '',
    regionFilter: '',
    isCommonFilter: '',
    herbs: [],
    dropdowns: null,
    isEditMode: false,
    editHerbName: null
  };

  // ==================== DOM 引用缓存 ====================
  let dom = {};

  function cacheDom() {
    dom = {
      tabBar: document.getElementById('herbTabBar'),
      tabBtns: document.querySelectorAll('.herb-tab-btn'),
      graphPanel: document.getElementById('graph-panel-wrapper'),
      managePanel: document.getElementById('herb-manage-panel'),
      searchInput: document.getElementById('herbSearchInput'),
      searchBtn: document.getElementById('herbSearchBtn'),
      categoryFilter: document.getElementById('herbCategoryFilter'),
      regionFilter: document.getElementById('herbRegionFilter'),
      commonFilter: document.getElementById('herbCommonFilter'),
      addBtn: document.getElementById('herbAddBtn'),
      tableBody: document.getElementById('herbTableBody'),
      pagination: document.getElementById('herbPagination'),
      totalCount: document.getElementById('herbTotalCount'),
      modal: document.getElementById('herbFormModal'),
      modalTitle: document.getElementById('herbModalTitle'),
      herbForm: document.getElementById('herbForm'),
      modalClose: document.getElementById('herbModalClose'),
      formCancel: document.getElementById('herbFormCancel'),
      // 表单字段
      formName: document.getElementById('herbFormName'),
      formPinyin: document.getElementById('herbFormPinyin'),
      formLatin: document.getElementById('herbFormLatin'),
      formAlias: document.getElementById('herbFormAlias'),
      formCategory: document.getElementById('herbFormCategory'),
      formRegion: document.getElementById('herbFormRegion'),
      formQiTags: document.getElementById('herbFormQiTags'),
      formFlavorTags: document.getElementById('herbFormFlavorTags'),
      formMeridianTags: document.getElementById('herbFormMeridianTags'),
      formEfficacySearch: document.getElementById('herbFormEfficacySearch'),
      formEfficacyDropdown: document.getElementById('herbEfficacyDropdown'),
      formEfficacySelected: document.getElementById('herbEfficacySelected'),
      formDescription: document.getElementById('herbFormDescription'),
      formUsage: document.getElementById('herbFormUsage'),
      formCaution: document.getElementById('herbFormCaution'),
      formIsCommon: document.getElementById('herbFormIsCommon')
    };
  }

  // ==================== 初始化 ====================
  function init() {
    if (!document.getElementById('herb-manage-panel')) return;
    cacheDom();
    bindEvents();
    loadDropdowns();
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // Tab 切换
    if (dom.tabBtns) {
      dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
      });
    }

    // 搜索
    if (dom.searchBtn) dom.searchBtn.addEventListener('click', doSearch);
    if (dom.searchInput) dom.searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    // 筛选
    if (dom.categoryFilter) dom.categoryFilter.addEventListener('change', doSearch);
    if (dom.regionFilter) dom.regionFilter.addEventListener('change', doSearch);
    if (dom.commonFilter) dom.commonFilter.addEventListener('change', doSearch);

    // 新增按钮
    if (dom.addBtn) dom.addBtn.addEventListener('click', openCreateModal);

    // 模态弹窗关闭
    if (dom.modalClose) dom.modalClose.addEventListener('click', closeModal);
    if (dom.formCancel) dom.formCancel.addEventListener('click', closeModal);
    if (dom.herbForm) dom.herbForm.addEventListener('submit', handleFormSubmit);

    // 功效搜索下拉
    if (dom.formEfficacySearch) {
      dom.formEfficacySearch.addEventListener('input', handleEfficacySearch);
      dom.formEfficacySearch.addEventListener('focus', handleEfficacySearch);
    }
    document.addEventListener('click', e => {
      if (dom.formEfficacyDropdown && !e.target.closest('.efficacy-search-wrapper')) {
        dom.formEfficacyDropdown.classList.remove('open');
      }
    });

    // 点击模态背景关闭
    if (dom.modal) {
      dom.modal.addEventListener('click', e => { if (e.target === dom.modal) closeModal(); });
    }
  }

  // ==================== Tab 切换 ====================
  function switchTab(tabName) {
    dom.tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));

    if (tabName === 'graph') {
      // 显示图谱面板（<main> 内所有内容），隐藏管理面板
      if (dom.graphPanel) dom.graphPanel.style.display = '';
      if (dom.managePanel) dom.managePanel.classList.remove('active');
      // 重新触发图谱 D3 渲染 resize
      if (window.knowledgeGraph && typeof window.knowledgeGraph.resize === 'function') {
        setTimeout(() => window.knowledgeGraph.resize(), 200);
      }
    } else if (tabName === 'manage') {
      // 隐藏图谱面板，显示药材管理面板
      if (dom.graphPanel) dom.graphPanel.style.display = 'none';
      if (dom.managePanel) dom.managePanel.classList.add('active');
      loadHerbList();
    }
  }

  // ==================== 下拉框数据加载 ====================
  async function loadDropdowns() {
    try {
      const res = await fetch(API_BASE + '/api/herbs-manage/dropdowns');
      const json = await res.json();
      if (json.success) {
        state.dropdowns = json.data;
        populateDropdowns();
      }
    } catch (e) {
      console.error('[药材管理] 加载下拉框数据失败:', e);
    }
  }

  function populateDropdowns() {
    if (!state.dropdowns) return;

    // 填充分类下拉
    const catSelect = dom.categoryFilter;
    if (catSelect && state.dropdowns.categories) {
      catSelect.innerHTML = '<option value="">全部分类</option>' +
        state.dropdowns.categories.map(c => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join('');
    }

    // 填充产地下拉
    const regSelect = dom.regionFilter;
    if (regSelect && state.dropdowns.regions) {
      regSelect.innerHTML = '<option value="">全部产地</option>' +
        state.dropdowns.regions.map(r => '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>').join('');
    }

    // 填充表单下拉框
    populateFormSelects();
  }

  function populateFormSelects() {
    if (!state.dropdowns) return;

    // 分类
    const catSel = dom.formCategory;
    if (catSel) {
      catSel.innerHTML = '<option value="">请选择分类</option>' +
        state.dropdowns.categories.map(c => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>').join('');
    }

    // 产地
    const regSel = dom.formRegion;
    if (regSel) {
      regSel.innerHTML = '<option value="">请选择产地</option>' +
        state.dropdowns.regions.map(r => '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>').join('');
    }

    // 性味-气标签
    if (dom.formQiTags && state.dropdowns.properties_qi) {
      dom.formQiTags.innerHTML = state.dropdowns.properties_qi.map(q =>
        '<span class="tag-chip" data-value="' + escapeHtml(q) + '" data-group="qi">' + escapeHtml(q) + '</span>'
      ).join('');
    }

    // 性味-味标签
    if (dom.formFlavorTags && state.dropdowns.properties_flavor) {
      dom.formFlavorTags.innerHTML = state.dropdowns.properties_flavor.map(f =>
        '<span class="tag-chip" data-value="' + escapeHtml(f) + '" data-group="flavor">' + escapeHtml(f) + '</span>'
      ).join('');
    }

    // 归经标签
    if (dom.formMeridianTags && state.dropdowns.meridians) {
      dom.formMeridianTags.innerHTML = state.dropdowns.meridians.map(m =>
        '<span class="tag-chip" data-value="' + escapeHtml(m) + '" data-group="meridian">' + escapeHtml(m) + '</span>'
      ).join('');
    }

    // 标签点击事件（事件委托）
    [dom.formQiTags, dom.formFlavorTags, dom.formMeridianTags].forEach(container => {
      if (!container) return;
      container.addEventListener('click', e => {
        const chip = e.target.closest('.tag-chip');
        if (!chip) return;
        chip.classList.toggle('selected');
      });
    });
  }

  // ==================== 功效搜索 ====================
  let selectedEfficacies = [];

  function handleEfficacySearch() {
    if (!state.dropdowns || !dom.formEfficacyDropdown) return;
    const query = (dom.formEfficacySearch.value || '').trim().toLowerCase();
    const filtered = state.dropdowns.efficacies.filter(e =>
      e.toLowerCase().includes(query) && !selectedEfficacies.includes(e)
    ).slice(0, 20);

    if (filtered.length > 0) {
      dom.formEfficacyDropdown.innerHTML = filtered.map(e =>
        '<div class="efficacy-dropdown-item" data-value="' + escapeHtml(e) + '">' + escapeHtml(e) + '</div>'
      ).join('');
      dom.formEfficacyDropdown.classList.add('open');

      // 绑定点击
      dom.formEfficacyDropdown.querySelectorAll('.efficacy-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          const val = item.dataset.value;
          if (!selectedEfficacies.includes(val)) {
            selectedEfficacies.push(val);
            renderSelectedEfficacies();
          }
          dom.formEfficacyDropdown.classList.remove('open');
          dom.formEfficacySearch.value = '';
        });
      });
    } else {
      dom.formEfficacyDropdown.classList.remove('open');
    }
  }

  function renderSelectedEfficacies() {
    if (!dom.formEfficacySelected) return;
    dom.formEfficacySelected.innerHTML = selectedEfficacies.map(e =>
      '<span class="eff-tag">' + escapeHtml(e) + '<span class="remove-tag" data-value="' + escapeHtml(e) + '">×</span></span>'
    ).join('');

    // 移除按钮
    dom.formEfficacySelected.querySelectorAll('.remove-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedEfficacies = selectedEfficacies.filter(e => e !== btn.dataset.value);
        renderSelectedEfficacies();
      });
    });
  }

  function clearSelectedEfficacies() {
    selectedEfficacies = [];
    renderSelectedEfficacies();
    if (dom.formEfficacySearch) dom.formEfficacySearch.value = '';
  }

  // ==================== 药材列表 ====================
  async function loadHerbList() {
    if (!dom.tableBody) return;

    dom.tableBody.innerHTML = '<tr><td colspan="7" class="herb-loading"><i class="fas fa-spinner fa-spin"></i>加载中...</td></tr>';

    try {
      const params = new URLSearchParams({
        page: state.currentPage,
        limit: state.pageSize,
        search: state.searchTerm,
        category: state.categoryFilter,
        region: state.regionFilter,
        is_common: state.isCommonFilter
      });

      const res = await fetch(API_BASE + '/api/herbs-manage?' + params.toString());
      const json = await res.json();

      if (json.success) {
        state.herbs = json.data.herbs;
        state.totalPages = json.data.pagination.totalPages;
        state.totalHerbs = json.data.pagination.total;
        renderHerbTable();
        renderPagination();
        if (dom.totalCount) dom.totalCount.textContent = '共 ' + state.totalHerbs + ' 味药材';
      }
    } catch (e) {
      console.error('[药材管理] 加载列表失败:', e);
      dom.tableBody.innerHTML = '<tr><td colspan="7" class="herb-empty"><i class="fas fa-exclamation-triangle"></i>加载失败，请检查网络连接</td></tr>';
    }
  }

  function renderHerbTable() {
    if (!dom.tableBody) return;

    if (state.herbs.length === 0) {
      dom.tableBody.innerHTML = '<tr><td colspan="7" class="herb-empty"><i class="fas fa-leaf"></i>暂无药材数据</td></tr>';
      return;
    }

    dom.tableBody.innerHTML = state.herbs.map(h => {
      const commonBadge = h.is_common
        ? '<span class="badge badge-common">常用</span>'
        : '<span class="badge badge-normal">-</span>';
      return (
        '<tr>' +
        '<td><span class="herb-name-cell" data-name="' + escapeHtml(h.name) + '">' + escapeHtml(h.name) + '</span></td>' +
        '<td>' + escapeHtml(h.pinyin || '-') + '</td>' +
        '<td>' + escapeHtml(h.category_name || '-') + '</td>' +
        '<td>' + escapeHtml(h.region_name || '-') + '</td>' +
        '<td>' + commonBadge + '</td>' +
        '<td class="actions-cell">' +
        '<button class="btn-icon-sm edit-btn" data-name="' + escapeHtml(h.name) + '" title="编辑"><i class="fas fa-edit"></i></button>' +
        '<button class="btn-icon-sm delete-btn" data-name="' + escapeHtml(h.name) + '" title="删除"><i class="fas fa-trash"></i></button>' +
        '</td>' +
        '</tr>'
      );
    }).join('');

    // 绑定行内按钮事件
    dom.tableBody.querySelectorAll('.herb-name-cell').forEach(cell => {
      cell.addEventListener('click', () => viewHerbDetail(cell.dataset.name));
    });
    dom.tableBody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.name));
    });
    dom.tableBody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => confirmDelete(btn.dataset.name));
    });
  }

  function renderPagination() {
    if (!dom.pagination) return;

    if (state.totalPages <= 1) {
      dom.pagination.innerHTML = '';
      return;
    }

    let html = '';
    html += '<button ' + (state.currentPage <= 1 ? 'disabled' : '') + ' data-page="' + (state.currentPage - 1) + '">上一页</button>';
    html += '<span class="page-info">第 ' + state.currentPage + ' / ' + state.totalPages + ' 页</span>';
    html += '<button ' + (state.currentPage >= state.totalPages ? 'disabled' : '') + ' data-page="' + (state.currentPage + 1) + '">下一页</button>';

    dom.pagination.innerHTML = html;
    dom.pagination.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        state.currentPage = parseInt(btn.dataset.page);
        loadHerbList();
      });
    });
  }

  function doSearch() {
    state.searchTerm = (dom.searchInput ? dom.searchInput.value : '') || '';
    state.categoryFilter = (dom.categoryFilter ? dom.categoryFilter.value : '') || '';
    state.regionFilter = (dom.regionFilter ? dom.regionFilter.value : '') || '';
    state.isCommonFilter = (dom.commonFilter ? dom.commonFilter.value : '') || '';
    state.currentPage = 1;
    loadHerbList();
  }

  // ==================== 模态弹窗 ====================
  function openCreateModal() {
    state.isEditMode = false;
    state.editHerbName = null;
    if (dom.modalTitle) dom.modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> 新增药材';
    clearForm();
    if (dom.modal) dom.modal.classList.add('open');
    // 刷新下拉框
    loadDropdowns();
  }

  async function openEditModal(name) {
    state.isEditMode = true;
    state.editHerbName = name;
    if (dom.modalTitle) dom.modalTitle.innerHTML = '<i class="fas fa-edit"></i> 编辑药材：' + escapeHtml(name);

    // 填充表单
    try {
      const res = await fetch(API_BASE + '/api/herbs-manage/' + encodeURIComponent(name));
      const json = await res.json();
      if (json.success) {
        fillForm(json.data);
      } else {
        showToast('获取药材详情失败: ' + json.message, 'error');
        return;
      }
    } catch (e) {
      showToast('网络错误', 'error');
      return;
    }

    if (dom.modal) dom.modal.classList.add('open');
    loadDropdowns();
  }

  function closeModal() {
    if (dom.modal) dom.modal.classList.remove('open');
    clearForm();
  }

  function clearForm() {
    if (dom.herbForm) dom.herbForm.reset();
    if (dom.formName) dom.formName.value = '';
    if (dom.formPinyin) dom.formPinyin.value = '';
    if (dom.formLatin) dom.formLatin.value = '';
    if (dom.formAlias) dom.formAlias.value = '';
    if (dom.formCategory) dom.formCategory.value = '';
    if (dom.formRegion) dom.formRegion.value = '';
    if (dom.formDescription) dom.formDescription.value = '';
    if (dom.formUsage) dom.formUsage.value = '';
    if (dom.formCaution) dom.formCaution.value = '';
    if (dom.formIsCommon) dom.formIsCommon.checked = false;

    // 清除标签选中
    document.querySelectorAll('.tag-chip.selected').forEach(c => c.classList.remove('selected'));
    clearSelectedEfficacies();
  }

  function fillForm(data) {
    if (dom.formName) dom.formName.value = data.name || '';
    if (dom.formPinyin) dom.formPinyin.value = data.pinyin || '';
    if (dom.formLatin) dom.formLatin.value = data.latin_name || '';
    if (dom.formAlias) dom.formAlias.value = data.alias || '';
    if (dom.formCategory) dom.formCategory.value = data.category_name || '';
    if (dom.formRegion) dom.formRegion.value = data.region_name || '';
    if (dom.formDescription) dom.formDescription.value = data.description || '';
    if (dom.formUsage) dom.formUsage.value = data.usage_dosage || '';
    if (dom.formCaution) dom.formCaution.value = data.caution || '';
    if (dom.formIsCommon) dom.formIsCommon.checked = !!(data.is_common);

    // 清除旧选中
    document.querySelectorAll('.tag-chip.selected').forEach(c => c.classList.remove('selected'));
    clearSelectedEfficacies();

    // 延迟填充（等下拉框数据加载完成）
    setTimeout(() => {
      // 性味-气
      if (data.properties) {
        data.properties.forEach(p => {
          if (p.type === 'qi') {
            const chip = document.querySelector('#herbFormQiTags .tag-chip[data-value="' + CSS.escape(p.name) + '"]');
            if (chip) chip.classList.add('selected');
          }
          if (p.type === 'flavor') {
            const chip = document.querySelector('#herbFormFlavorTags .tag-chip[data-value="' + CSS.escape(p.name) + '"]');
            if (chip) chip.classList.add('selected');
          }
        });
      }

      // 归经
      if (data.meridians) {
        data.meridians.forEach(m => {
          const chip = document.querySelector('#herbFormMeridianTags .tag-chip[data-value="' + CSS.escape(m.name) + '"]');
          if (chip) chip.classList.add('selected');
        });
      }

      // 功效
      if (data.efficacies) {
        selectedEfficacies = data.efficacies.map(e => e.name);
        renderSelectedEfficacies();
      }
    }, 600);
  }

  // ==================== 表单提交 ====================
  async function handleFormSubmit(e) {
    e.preventDefault();

    // 收集表单数据
    const name = (dom.formName ? dom.formName.value : '').trim();
    if (!name) { showToast('请输入药材名称', 'error'); return; }

    // 收集选中的标签
    const qiTags = [];
    const flavorTags = [];
    const meridianTags = [];

    if (dom.formQiTags) {
      dom.formQiTags.querySelectorAll('.tag-chip.selected').forEach(c => qiTags.push(c.dataset.value));
    }
    if (dom.formFlavorTags) {
      dom.formFlavorTags.querySelectorAll('.tag-chip.selected').forEach(c => flavorTags.push(c.dataset.value));
    }
    if (dom.formMeridianTags) {
      dom.formMeridianTags.querySelectorAll('.tag-chip.selected').forEach(c => meridianTags.push(c.dataset.value));
    }

    const payload = {
      name,
      pinyin: dom.formPinyin ? dom.formPinyin.value.trim() : '',
      latin_name: dom.formLatin ? dom.formLatin.value.trim() : '',
      alias: dom.formAlias ? dom.formAlias.value.trim() : '',
      description: dom.formDescription ? dom.formDescription.value.trim() : '',
      usage_dosage: dom.formUsage ? dom.formUsage.value.trim() : '',
      caution: dom.formCaution ? dom.formCaution.value.trim() : '',
      is_common: dom.formIsCommon ? (dom.formIsCommon.checked ? 1 : 0) : 0,
      category: dom.formCategory ? dom.formCategory.value : '',
      region: dom.formRegion ? dom.formRegion.value : '',
      properties_qi: qiTags,
      properties_flavor: flavorTags,
      meridians: meridianTags,
      efficacies: selectedEfficacies
    };

    try {
      let url = API_BASE + '/api/herbs-manage';
      let method = 'POST';

      if (state.isEditMode && state.editHerbName) {
        url = API_BASE + '/api/herbs-manage/' + encodeURIComponent(state.editHerbName);
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (json.success) {
        showToast(state.isEditMode ? '药材更新成功' : '药材创建成功', 'success');
        closeModal();
        loadHerbList();
        loadDropdowns(); // 刷新下拉框（可能有新分类/产地）
      } else {
        showToast(json.message || '操作失败', 'error');
      }
    } catch (e) {
      console.error('[药材管理] 提交失败:', e);
      showToast('网络错误，请重试', 'error');
    }
  }

  // ==================== 删除确认 ====================
  function confirmDelete(name) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = [
      '<div class="confirm-dialog">',
      '<div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>',
      '<h3>确认删除</h3>',
      '<p>确定要删除药材 <strong>' + escapeHtml(name) + '</strong> 吗？<br>此操作不可撤销。</p>',
      '<div class="confirm-actions">',
      '<button class="btn-secondary" id="confirmCancel">取消</button>',
      '<button class="btn-danger" id="confirmDelete">确认删除</button>',
      '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);

    overlay.querySelector('#confirmCancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.querySelector('#confirmDelete').addEventListener('click', async () => {
      document.body.removeChild(overlay);
      await executeDelete(name);
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  async function executeDelete(name) {
    try {
      const res = await fetch(API_BASE + '/api/herbs-manage/' + encodeURIComponent(name), { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        showToast('药材删除成功', 'success');
        loadHerbList();
        loadDropdowns();
      } else {
        showToast(json.message || '删除失败', 'error');
      }
    } catch (e) {
      showToast('网络错误', 'error');
    }
  }

  // ==================== 查看详情 ====================
  async function viewHerbDetail(name) {
    // 显示详情面板，隐藏列表
    const detailPanel = document.getElementById('herb-detail-panel');
    const tableWrapper = document.querySelector('.herb-table-wrapper');
    const pagination = document.getElementById('herbPagination');
    const totalCount = document.getElementById('herbTotalCount');
    const toolbar = document.querySelector('.herb-manage-toolbar');

    if (detailPanel) detailPanel.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    if (totalCount) totalCount.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';

    const content = document.getElementById('herbDetailContent');
    if (content) content.innerHTML = '<div class="herb-loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';

    try {
      const res = await fetch(API_BASE + '/api/herbs-manage/' + encodeURIComponent(name));
      const json = await res.json();
      if (json.success && json.data) {
        renderHerbDetail(json.data);
      } else {
        if (content) content.innerHTML = '<div class="herb-loading"><i class="fas fa-exclamation-circle"></i> 未找到该药材信息</div>';
      }
    } catch (e) {
      console.error('[药材管理] 加载详情失败:', e);
      if (content) content.innerHTML = '<div class="herb-loading"><i class="fas fa-exclamation-triangle"></i> 加载失败，请检查网络连接</div>';
    }
  }

  function renderHerbDetail(data) {
    const content = document.getElementById('herbDetailContent');
    if (!content) return;

    // 设置标题
    const titleEl = document.getElementById('herbDetailTitle');
    if (titleEl) titleEl.textContent = data.name || '药材详情';

    // 性味标签
    const qiFlavorTags = [];
    if (data.properties && data.properties.length > 0) {
      data.properties.forEach(p => {
        const cls = (p.name === '温' || p.name === '热') ? 'warm' :
                    (p.name === '寒' || p.name === '凉') ? 'cool' : '';
        const label = p.type === 'qi' ? p.name + '性' : p.name + '味';
        qiFlavorTags.push('<span class="detail-tag ' + cls + '">' + escapeHtml(label) + '</span>');
      });
    }

    // 归经标签
    const meridianTags = (data.meridians || []).map(m =>
      '<span class="detail-tag">' + escapeHtml(m.name) + '经</span>'
    ).join('');

    // 功效标签
    const efficacyTags = (data.efficacies || []).map(e =>
      '<span class="detail-tag">' + escapeHtml(e.name) + '</span>'
    ).join('');

    // 相关方剂
    let formulasHtml = '';
    if (data.formulas && data.formulas.length > 0) {
      formulasHtml = data.formulas.map(f =>
        '<div class="formula-item">' +
        '<span class="formula-name">' + escapeHtml(f.name || '未知方剂') + '</span>' +
        (f.role ? '<span class="formula-role">' + escapeHtml(f.role) + '</span>' : '') +
        '</div>'
      ).join('');
    } else {
      formulasHtml = '<div class="detail-empty">暂未收录相关方剂</div>';
    }

    content.innerHTML = [
      // 基本信息
      '<div class="detail-card">',
      '<h4><i class="fas fa-info-circle"></i> 基本信息</h4>',
      '<div class="detail-row"><span class="detail-label">名称</span><span class="detail-value large">' + escapeHtml(data.name || '-') + '</span></div>',
      '<div class="detail-row"><span class="detail-label">拼音</span><span class="detail-value">' + escapeHtml(data.pinyin || '-') + '</span></div>',
      '<div class="detail-row"><span class="detail-label">拉丁名</span><span class="detail-value">' + escapeHtml(data.latin_name || '-') + '</span></div>',
      '<div class="detail-row"><span class="detail-label">别名</span><span class="detail-value">' + escapeHtml(data.alias || '-') + '</span></div>',
      '<div class="detail-row"><span class="detail-label">常用</span><span class="detail-value">' + (data.is_common ? '<span class="badge badge-common">常用药材</span>' : '否') + '</span></div>',
      '</div>',
      // 分类与产地
      '<div class="detail-card">',
      '<h4><i class="fas fa-tags"></i> 分类与产地</h4>',
      '<div class="detail-row"><span class="detail-label">分类</span><span class="detail-value">' + escapeHtml(data.category_name || '-') + '</span></div>',
      '<div class="detail-row"><span class="detail-label">产地</span><span class="detail-value">' + escapeHtml(data.region_name || '-') + '</span></div>',
      '</div>',
      // 性味归经
      '<div class="detail-card">',
      '<h4><i class="fas fa-leaf"></i> 性味</h4>',
      qiFlavorTags.length > 0 ? '<div class="detail-tags">' + qiFlavorTags.join('') + '</div>' : '<div class="detail-empty">暂无数据</div>',
      '</div>',
      '<div class="detail-card">',
      '<h4><i class="fas fa-project-diagram"></i> 归经</h4>',
      meridianTags ? '<div class="detail-tags">' + meridianTags + '</div>' : '<div class="detail-empty">暂无数据</div>',
      '</div>',
      // 功效
      '<div class="detail-card full-width">',
      '<h4><i class="fas fa-star"></i> 功效</h4>',
      efficacyTags ? '<div class="detail-tags">' + efficacyTags + '</div>' : '<div class="detail-empty">暂无数据</div>',
      '</div>',
      // 描述与用法
      '<div class="detail-card full-width">',
      '<h4><i class="fas fa-align-left"></i> 描述</h4>',
      '<p style="color:#e0e0e0;font-size:14px;line-height:1.7;">' + escapeHtml(data.description || '暂无描述') + '</p>',
      '</div>',
      '<div class="detail-card">',
      '<h4><i class="fas fa-prescription-bottle"></i> 用法用量</h4>',
      '<div class="detail-row"><span class="detail-value">' + escapeHtml(data.usage_dosage || '暂无数据') + '</span></div>',
      '</div>',
      '<div class="detail-card">',
      '<h4><i class="fas fa-exclamation-triangle"></i> 注意事项</h4>',
      '<div class="detail-row"><span class="detail-value">' + escapeHtml(data.caution || '暂无') + '</span></div>',
      '</div>',
      // 相关方剂
      '<div class="detail-card full-width detail-formulas">',
      '<h4><i class="fas fa-mortar-pestle"></i> 相关方剂</h4>',
      formulasHtml,
      '</div>'
    ].join('');
  }

  // 返回列表
  function backToList() {
    const detailPanel = document.getElementById('herb-detail-panel');
    const tableWrapper = document.querySelector('.herb-table-wrapper');
    const pagination = document.getElementById('herbPagination');
    const totalCount = document.getElementById('herbTotalCount');
    const toolbar = document.querySelector('.herb-manage-toolbar');

    if (detailPanel) detailPanel.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = '';
    if (pagination) pagination.style.display = '';
    if (totalCount) totalCount.style.display = '';
    if (toolbar) toolbar.style.display = '';
  }

  // ==================== Toast 提示 ====================
  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = 'herb-toast ' + (type || 'success');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2500);
  }

  // ==================== 工具函数 ====================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== 启动 ====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露到全局
  window.herbManage = { switchTab, loadHerbList, openCreateModal, closeModal, backToList };
})();
