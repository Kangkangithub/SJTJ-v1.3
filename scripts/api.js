// ============================================================
// API 请求封装 - 统一管理后端接口调用
// 使用说明见 frontend-api-guide.md
// ============================================================

const USE_MOCK = false;  // true=使用Mock数据, false=使用真实接口
const API_BASE = 'http://localhost:3001/api';

// ---------- 核心请求函数 ----------

function getToken() {
  return localStorage.getItem('token');
}

/**
 * 统一请求封装
 * @param {string} path    - 接口路径，如 '/herbs'
 * @param {object} options - fetch 选项
 * @returns {Promise}      - 解析后的 data 字段
 */
async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});

  // 非 FormData 时自动设置 JSON Content-Type
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 自动携带 token
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { ...options, headers });
  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

// ---------- 药材 API ----------

const herbApi = {
  /** 药材列表（支持分页、分类、产地筛选） */
  list: (params = {}) =>
    request(`/herbs?${new URLSearchParams(params)}`),

  /** 搜索药材 */
  search: (q) =>
    request(`/herbs/search?q=${encodeURIComponent(q)}`),

  /** 药材详情 */
  detail: (id) => request(`/herbs/${id}`),

  /** 相似药材 */
  similar: (id, limit = 5) =>
    request(`/herbs/${id}/similar?limit=${limit}`),

  /** 药材统计 */
  statistics: () => request('/herbs/statistics'),

  /** 收藏药材（需登录） */
  favorite: (id) =>
    request(`/herbs/${id}/favorite`, { method: 'POST' }),

  /** 取消收藏（需登录） */
  unfavorite: (id) =>
    request(`/herbs/${id}/favorite`, { method: 'DELETE' }),
};

// ---------- 分类 / 产地 / 来源 API ----------

const categoryApi = {
  list:     ()           => request('/herb-categories'),
  detail:   (id)         => request(`/herb-categories/${id}`),
  create:   (data)       => request('/herb-categories', { method: 'POST', body: JSON.stringify(data) }),
  update:   (id, data)   => request(`/herb-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:   (id)         => request(`/herb-categories/${id}`, { method: 'DELETE' }),
};

const regionApi = {
  list:     ()           => request('/herb-regions'),
  detail:   (id)         => request(`/herb-regions/${id}`),
  create:   (data)       => request('/herb-regions', { method: 'POST', body: JSON.stringify(data) }),
  update:   (id, data)   => request(`/herb-regions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:   (id)         => request(`/herb-regions/${id}`, { method: 'DELETE' }),
};

const sourceApi = {
  list:     ()           => request('/herb-sources'),
  detail:   (id)         => request(`/herb-sources/${id}`),
  create:   (data)       => request('/herb-sources', { method: 'POST', body: JSON.stringify(data) }),
  update:   (id, data)   => request(`/herb-sources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:   (id)         => request(`/herb-sources/${id}`, { method: 'DELETE' }),
};

// ---------- 方剂 API ----------

const formulaApi = {
  list:   (params = {}) =>
    request(`/formulas?${new URLSearchParams(params)}`),
  detail: (id)           => request(`/formulas/${id}`),
  create: (data)         => request('/formulas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data)     => request(`/formulas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id)           => request(`/formulas/${id}`, { method: 'DELETE' }),
};

// ---------- 用户认证 API ----------

const authApi = {
  login:    (payload) => request('/auth/login',    { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  profile:  ()        => request('/auth/profile'),
  updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data) => request('/auth/change-password', { method: 'PUT', body: JSON.stringify(data) }),
  logout:   ()        => request('/auth/logout', { method: 'POST' }),
};

// ---------- 知识图谱 API ----------

const graphApi = {
  /** 图谱数据 */
  graphData:   () => request('/knowledge/graph-data'),
  /** 图谱节点药材详情 */
  herbDetails: (herbName) =>
    request(`/knowledge/herb-details/${encodeURIComponent(herbName)}`),
  /** 地区分布 */
  regionDistribution: () => request('/knowledge/region-distribution'),
};

// ---------- AI 网关 API ----------

const aiApi = {
  /** AI 问答（需登录） */
  chat: (question) =>
    request('/ai-gateway/chat', { method: 'POST', body: JSON.stringify({ question }) }),

  /** 单味药材分析（需登录） */
  analyzeHerb: (herbName) =>
    request('/ai-gateway/analyze-herb', { method: 'POST', body: JSON.stringify({ herbName }) }),

  /** 配伍禁忌检查（需登录） */
  checkCompatibility: (herbs) =>
    request('/ai-gateway/check-compatibility', { method: 'POST', body: JSON.stringify({ herbs }) }),

  /** 健康检查 */
  health: () => request('/ai-gateway/health'),
};

// ---------- 药材图片 API ----------

const imageApi = {
  /** 获取药材图片 */
  list: (herbId) => request(`/herb-images/${herbId}`),
  /** 上传图片（需登录，multipart/form-data） */
  upload: (herbId, formData) =>
    request(`/herb-images/${herbId}`, { method: 'POST', body: formData }),
  /** 删除图片（需登录） */
  delete: (herbId, imageId) =>
    request(`/herb-images/${herbId}/${imageId}`, { method: 'DELETE' }),
  /** 更新图片说明（需登录） */
  updateDesc: (herbId, imageId, description) =>
    request(`/herb-images/${herbId}/${imageId}`, { method: 'PUT', body: JSON.stringify({ description }) }),
};

// ---------- Mock API 切换 ----------

/**
 * 根据 USE_MOCK 自动切换真实接口和 Mock 接口
 * 用法：apiGet('/herbs') → mock 模式下请求 /mock/herbs
 */
function apiGet(path, params = '') {
  const base = USE_MOCK ? '/mock' : '';
  const query = params ? `?${new URLSearchParams(params)}` : '';
  return request(`${base}${path}${query}`);
}
