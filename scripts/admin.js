(function() {
  const API_BASE = 'http://localhost:3001/api';
  const PAGE_SIZE = 20;
  const state = {
    token: localStorage.getItem('authToken') || localStorage.getItem('token') || '',
    page: 1,
    totalPages: 1,
    totalItems: 0,
    searchTerm: '',
    searchTimer: null,
    categories: [],
    regions: [],
    sources: [],
    herbs: [],
    editingId: ''
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    if (!state.token) {
      window.location.href = 'login.html';
      return;
    }

    bindEvents();
    try {
      const profile = await apiGet('/auth/profile');
      const user = unwrap(profile);
      localStorage.setItem('userInfo', JSON.stringify({ ...user, isLoggedIn: true }));
      if (user.role !== 'admin') {
        showGate('当前账号没有管理权限。');
        return;
      }

      els.panel.hidden = false;
      await Promise.all([loadDictionaries(), loadHerbs()]);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearAuth();
        showGate('登录已过期，请重新登录。', 'login.html', '重新登录');
        return;
      }
      showGate('无权限访问。');
    }
  }

  function cacheElements() {
    els.gate = document.getElementById('adminGate');
    els.gateMessage = document.getElementById('adminGateMessage');
    els.panel = document.getElementById('adminPanel');
    els.message = document.getElementById('adminMessage');
    els.rows = document.getElementById('adminHerbRows');
    els.status = document.getElementById('herbListStatus');
    els.search = document.getElementById('adminHerbSearch');
    els.resetSearch = document.getElementById('resetAdminSearch');
    els.prev = document.getElementById('prevHerbPage');
    els.next = document.getElementById('nextHerbPage');
    els.pageInfo = document.getElementById('herbPageInfo');
    els.newBtn = document.getElementById('newHerbBtn');
    els.modal = document.getElementById('herbFormModal');
    els.form = document.getElementById('herbAdminForm');
    els.formTitle = document.getElementById('herbFormTitle');
    els.saveBtn = document.getElementById('saveHerbBtn');
  }

  function bindEvents() {
    els.search.addEventListener('input', function(event) {
      state.searchTerm = event.target.value.trim();
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(function() {
        state.page = 1;
        loadHerbs();
      }, 300);
    });
    els.resetSearch.addEventListener('click', function() {
      state.searchTerm = '';
      els.search.value = '';
      state.page = 1;
      loadHerbs();
    });
    els.prev.addEventListener('click', function() {
      if (state.page <= 1) return;
      state.page -= 1;
      loadHerbs();
    });
    els.next.addEventListener('click', function() {
      if (state.page >= state.totalPages) return;
      state.page += 1;
      loadHerbs();
    });
    els.newBtn.addEventListener('click', function() { openForm(); });
    els.form.addEventListener('submit', saveHerb);
    document.querySelectorAll('[data-close-admin-modal]').forEach(function(node) {
      node.addEventListener('click', closeForm);
    });
    els.rows.addEventListener('click', function(event) {
      const editId = event.target.closest('[data-edit-herb]')?.dataset.editHerb;
      const deleteId = event.target.closest('[data-delete-herb]')?.dataset.deleteHerb;
      if (editId) editHerb(editId);
      if (deleteId) deleteHerb(deleteId);
    });
  }

  async function loadDictionaries() {
    const [categories, regions, sources] = await Promise.all([
      apiGet('/herb-categories'),
      apiGet('/herb-regions'),
      apiGet('/herb-sources')
    ]);
    state.categories = unwrapList(categories, 'categories');
    state.regions = unwrapList(regions, 'regions');
    state.sources = unwrapList(sources, 'sources');
    renderSelect('herbCategory', state.categories, '选择分类');
    renderSelect('herbRegion', state.regions, '选择产地');
    renderSelect('herbSource', state.sources, '选择来源');
  }

  async function loadHerbs() {
    setListStatus('正在加载药材...');
    try {
      let response;
      if (state.searchTerm) {
        response = await apiGet('/herbs/search?q=' + encodeURIComponent(state.searchTerm));
        const data = unwrap(response) || {};
        state.herbs = data.herbs || [];
        state.totalItems = Number(data.total || state.herbs.length);
        state.totalPages = 1;
        state.page = 1;
      } else {
        response = await apiGet('/herbs?page=' + state.page + '&limit=' + PAGE_SIZE);
        const data = unwrap(response) || {};
        state.herbs = data.herbs || [];
        const pagination = data.pagination || {};
        state.totalItems = Number(pagination.total_items || state.herbs.length);
        state.totalPages = Number(pagination.total_pages || 1);
        state.page = Number(pagination.current_page || state.page);
      }
      renderHerbs();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        showGate('登录已过期或无管理权限。', 'login.html', '重新登录');
        return;
      }
      setListStatus('操作失败，请稍后重试');
    }
  }

  function renderHerbs() {
    if (!state.herbs.length) {
      els.rows.innerHTML = '';
      setListStatus('暂无药材数据');
    } else {
      setListStatus('');
      els.rows.innerHTML = state.herbs.map(function(herb) {
        const category = herb.category_name || herb.category || '-';
        const region = herb.region_name || herb.region || '-';
        const summary = herb.description || herb.efficacy || '-';
        return '<tr>' +
          '<td><strong>' + escapeHtml(herb.name || '-') + '</strong>' + (herb.is_common || herb.isCommon ? '<span class="admin-pill">常用</span>' : '') + '</td>' +
          '<td>' + escapeHtml(category) + '</td>' +
          '<td>' + escapeHtml(region) + '</td>' +
          '<td class="admin-summary">' + escapeHtml(summary) + '</td>' +
          '<td class="admin-actions-cell">' +
            '<button type="button" class="btn secondary" data-edit-herb="' + escapeAttr(herb.id) + '">编辑</button>' +
            '<button type="button" class="btn danger-secondary" data-delete-herb="' + escapeAttr(herb.id) + '">删除</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }
    renderPagination();
  }

  function renderPagination() {
    els.pageInfo.textContent = state.searchTerm
      ? '当前搜索显示 ' + state.herbs.length + ' 条'
      : '第 ' + state.page + ' 页 / 共 ' + state.totalPages + ' 页';
    els.prev.disabled = Boolean(state.searchTerm) || state.page <= 1;
    els.next.disabled = Boolean(state.searchTerm) || state.page >= state.totalPages;
  }

  async function editHerb(id) {
    try {
      showMessage('', '');
      const response = await apiGet('/herbs/' + encodeURIComponent(id));
      const herb = unwrap(response)?.herb || unwrap(response) || {};
      openForm(herb);
    } catch (error) {
      showMessage('操作失败，请稍后重试', 'error');
    }
  }

  async function deleteHerb(id) {
    if (!confirm('确定要删除这味药材吗？此操作不可撤销。')) return;
    try {
      await apiRequest('/herbs/' + encodeURIComponent(id), { method: 'DELETE' });
      showMessage('药材已删除。', 'success');
      await loadHerbs();
    } catch (error) {
      if (error.status === 401 || error.status === 403) showGate('登录已过期或无管理权限。', 'login.html', '重新登录');
      else showMessage('操作失败，请稍后重试', 'error');
    }
  }

  function openForm(herb) {
    const data = herb || {};
    state.editingId = data.id || '';
    els.formTitle.textContent = state.editingId ? '编辑药材' : '新增药材';
    setValue('herbId', data.id || '');
    setValue('herbName', data.name || '');
    setValue('herbPinyin', data.pinyin || '');
    setValue('herbAlias', data.alias || '');
    setValue('herbCategory', data.category_id || data.categoryId || '');
    setValue('herbRegion', data.region_id || data.regionId || '');
    setValue('herbSource', data.source_id || data.sourceId || '');
    setValue('herbDescription', data.description || '');
    setValue('herbEfficacy', data.efficacy || '');
    setValue('herbUsage', data.usage_dosage || data.usageDosage || '');
    setValue('herbCaution', data.caution || '');
    els.modal.hidden = false;
    document.getElementById('herbName').focus();
  }

  function closeForm() {
    els.modal.hidden = true;
    state.editingId = '';
    els.form.reset();
  }

  async function saveHerb(event) {
    event.preventDefault();
    const payload = getFormPayload();
    if (!payload.name) {
      showMessage('请填写药材名称。', 'error');
      return;
    }

    const originalText = els.saveBtn.textContent;
    try {
      els.saveBtn.disabled = true;
      els.saveBtn.textContent = '保存中...';
      if (state.editingId) {
        await apiRequest('/herbs/' + encodeURIComponent(state.editingId), {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showMessage('药材已更新。', 'success');
      } else {
        await apiRequest('/herbs', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showMessage('药材已新增。', 'success');
      }
      closeForm();
      await loadHerbs();
    } catch (error) {
      if (error.status === 401 || error.status === 403) showGate('登录已过期或无管理权限。', 'login.html', '重新登录');
      else showMessage(error.userMessage || '操作失败，请稍后重试', 'error');
    } finally {
      els.saveBtn.disabled = false;
      els.saveBtn.textContent = originalText;
    }
  }

  function getFormPayload() {
    return {
      name: getValue('herbName').trim(),
      pinyin: emptyToNull(getValue('herbPinyin').trim()),
      alias: emptyToNull(getValue('herbAlias').trim()),
      category_id: numberOrNull(getValue('herbCategory')),
      region_id: numberOrNull(getValue('herbRegion')),
      source_id: numberOrNull(getValue('herbSource')),
      description: getValue('herbDescription').trim(),
      efficacy: emptyToNull(getValue('herbEfficacy').trim()),
      usage_dosage: emptyToNull(getValue('herbUsage').trim()),
      caution: emptyToNull(getValue('herbCaution').trim())
    };
  }

  async function apiGet(path) {
    return apiRequest(path, { method: 'GET' });
  }

  async function apiRequest(path, options) {
    const opts = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (opts.body instanceof FormData) delete headers['Content-Type'];
    headers.Authorization = 'Bearer ' + state.token;
    const response = await fetch(API_BASE + path, Object.assign({}, opts, { headers }));
    const data = await response.json().catch(function() { return {}; });
    if (!response.ok || data.success === false) {
      const error = new Error('REQUEST_FAILED');
      error.status = response.status;
      error.userMessage = normalizeError(data);
      throw error;
    }
    return data;
  }

  function unwrap(response) {
    return response && response.data !== undefined ? response.data : response;
  }

  function unwrapList(response, key) {
    const data = unwrap(response);
    if (Array.isArray(data)) return data;
    return data?.[key] || [];
  }

  function normalizeError(data) {
    if (data?.errors && data.errors.length) return data.errors[0].message || '操作失败，请稍后重试';
    return data?.message || '操作失败，请稍后重试';
  }

  function renderSelect(id, items, placeholder) {
    const el = document.getElementById(id);
    el.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>' + items.map(function(item) {
      return '<option value="' + escapeAttr(item.id) + '">' + escapeHtml(item.name || '') + '</option>';
    }).join('');
  }

  function setValue(id, value) {
    document.getElementById(id).value = value == null ? '' : String(value);
  }

  function getValue(id) {
    return document.getElementById(id).value || '';
  }

  function emptyToNull(value) {
    return value === '' ? null : value;
  }

  function numberOrNull(value) {
    return value ? Number(value) : null;
  }

  function setListStatus(text) {
    els.status.textContent = text;
    els.status.hidden = !text;
  }

  function showMessage(text, type) {
    els.message.textContent = text || '';
    els.message.className = 'profile-message ' + (type || '');
  }

  function showGate(message, href, label) {
    els.panel.hidden = true;
    els.gate.hidden = false;
    els.gateMessage.textContent = message;
    const link = els.gate.querySelector('a');
    link.href = href || 'index.html';
    link.textContent = label || '返回首页';
  }

  function clearAuth() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
