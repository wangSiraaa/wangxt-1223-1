export const BASE_URL = '';

async function request(method, path, data = null, options = {}) {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };
  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }
  const url = data && method === 'GET'
    ? `${BASE_URL}${path}?${new URLSearchParams(data).toString()}`
    : `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, config);
    const result = await res.json();
    if (result.code !== 0) {
      throw new Error(result.message || '请求失败');
    }
    return result;
  } catch (e) {
    console.error(`[API Error] ${method} ${path}:`, e);
    throw e;
  }
}

export const api = {
  dashboard: {
    stats: (params) => request('GET', '/api/dashboard', params),
    timeline: (params) => request('GET', '/api/timeline', params),
    mapData: () => request('GET', '/api/map-data'),
    search: (params) => request('GET', '/api/search', params),
    users: () => request('GET', '/api/users'),
    login: (data) => request('POST', '/api/login', data),
  },
  events: {
    list: (params) => request('GET', '/api/events', params),
    get: (id) => request('GET', `/api/events/${id}`),
    stats: (id) => request('GET', `/api/events/stats/${id}`),
    create: (data) => request('POST', '/api/events', data),
    update: (id, data) => request('PUT', `/api/events/${id}`, data),
    remove: (id) => request('DELETE', `/api/events/${id}`),
  },
  roads: {
    list: (params) => request('GET', '/api/roads', params),
    withMissions: (params) => request('GET', '/api/roads/with-missions', params),
    get: (id) => request('GET', `/api/roads/${id}`),
    create: (data) => request('POST', '/api/roads', data),
    update: (id, data) => request('PUT', `/api/roads/${id}`, data),
    remove: (id) => request('DELETE', `/api/roads/${id}`),
  },
  vehicles: {
    list: (params) => request('GET', '/api/vehicles', params),
    get: (id) => request('GET', `/api/vehicles/${id}`),
    create: (data) => request('POST', '/api/vehicles', data),
    update: (id, data) => request('PUT', `/api/vehicles/${id}`, data),
    updateSalt: (id, data) => request('PATCH', `/api/vehicles/${id}/salt`, data),
    remove: (id) => request('DELETE', `/api/vehicles/${id}`),
  },
  missions: {
    list: (params) => request('GET', '/api/missions', params),
    validate: (data) => request('POST', '/api/missions/validate', data),
    get: (id) => request('GET', `/api/missions/${id}`),
    create: (data) => request('POST', '/api/missions', data),
    update: (id, data) => request('PUT', `/api/missions/${id}`, data),
    cancel: (id) => request('PUT', `/api/missions/${id}/cancel`),
    start: (id) => request('PUT', `/api/missions/${id}/start`),
    complete: (id, data) => request('PUT', `/api/missions/${id}/complete`, data),
    replan: (id, data) => request('PUT', `/api/missions/${id}/replan`, data),
    batchReplan: (data) => request('POST', '/api/missions/batch/replan', data),
  },
  warehouse: {
    warehouses: () => request('GET', '/api/warehouse/warehouses'),
    warehouse: (id) => request('GET', `/api/warehouse/warehouses/${id}`),
    createWarehouse: (data) => request('POST', '/api/warehouse/warehouses', data),
    inventory: (params) => request('GET', '/api/warehouse/inventory', params),
    transactions: (params) => request('GET', '/api/warehouse/transactions', params),
    outbound: (data) => request('POST', '/api/warehouse/outbound', data),
    inbound: (data) => request('POST', '/api/warehouse/inbound', data),
  },
  closures: {
    list: (params) => request('GET', '/api/closures', params),
    impactSummary: (params) => request('GET', '/api/closures/impact/summary', params),
    get: (id) => request('GET', `/api/closures/${id}`),
    create: (data) => request('POST', '/api/closures', data),
    update: (id, data) => request('PUT', `/api/closures/${id}`, data),
    lift: (id) => request('PUT', `/api/closures/${id}/lift`),
  },
  alerts: {
    list: (params) => request('GET', '/api/alerts', params),
    stats: (params) => request('GET', '/api/alerts/stats', params),
    check: (params) => request('POST', '/api/alerts/check', params),
    get: (id) => request('GET', `/api/alerts/${id}`),
    markRead: (id) => request('PUT', `/api/alerts/${id}/read`),
    markAllRead: (params) => request('PUT', '/api/alerts/read-all', params),
    resolve: (id, data) => request('PUT', `/api/alerts/${id}/resolve`, data),
  },
};

export const labels = {
  roadLevel: {
    express: '快速路',
    main: '主干道',
    secondary: '次干道',
    branch: '支路',
  },
  snowLevel: {
    light: '小雪',
    moderate: '中雪',
    heavy: '大雪',
    blizzard: '暴雪',
  },
  missionStatus: {
    assigned: '已分配',
    salt_loaded: '已装盐',
    in_progress: '作业中',
    completed: '已完成',
    cancelled: '已取消',
    replan_required: '需重规划',
  },
  vehicleStatus: {
    idle: '空闲',
    loading: '装盐中',
    working: '作业中',
    returning: '返程中',
    maintenance: '维护中',
  },
  alertType: {
    key_route_unassigned: '重点道路未派车',
    salt_insufficient: '载盐量不足',
    road_closed: '道路封控',
    mission_delay: '任务延迟',
    inventory_low: '库存不足',
  },
  severity: {
    info: '提示',
    warning: '警告',
    critical: '严重',
  },
  roadStatus: {
    normal: '正常',
    closed: '封控',
    processing: '作业中',
    completed: '已完成',
  },
  closureType: {
    police: '交警封控',
    weather: '天气封控',
    accident: '事故封控',
    construction: '施工封控',
  },
  eventStatus: {
    active: '进行中',
    monitoring: '监测中',
    completed: '已结束',
    cancelled: '已取消',
  },
  transType: {
    inbound: '入库',
    outbound: '出库',
    adjust: '调整',
  },
  userRole: {
    commander: '指挥中心',
    fleet_manager: '车队长',
    warehouse_manager: '仓库管理员',
  },
};

export const severityColors = {
  info: 'badge-blue',
  warning: 'badge-yellow',
  critical: 'badge-red',
};

export const missionStatusColors = {
  assigned: 'badge-blue',
  salt_loaded: 'badge-purple',
  in_progress: 'badge-yellow',
  completed: 'badge-green',
  cancelled: 'badge-gray',
  replan_required: 'badge-red',
};

export const vehicleStatusColors = {
  idle: 'badge-green',
  loading: 'badge-purple',
  working: 'badge-yellow',
  returning: 'badge-blue',
  maintenance: 'badge-gray',
};

export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const map = {
    YYYY: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0'),
  };
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (match) => map[match]);
}

export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return Number(num).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
