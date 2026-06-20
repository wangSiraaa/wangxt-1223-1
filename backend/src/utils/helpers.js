import { v4 as uuidv4 } from 'uuid';

export const generateCode = (prefix) => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${yyyy}${mm}${dd}${rand}`;
};

export const generateUUID = () => uuidv4();

export const ROAD_LEVEL_LABELS = {
  express: '快速路',
  main: '主干道',
  secondary: '次干道',
  branch: '支路',
};

export const SNOW_LEVEL_LABELS = {
  light: '小雪',
  moderate: '中雪',
  heavy: '大雪',
  blizzard: '暴雪',
};

export const MISSION_STATUS_LABELS = {
  assigned: '已分配',
  salt_loaded: '已装盐',
  in_progress: '作业中',
  completed: '已完成',
  cancelled: '已取消',
  replan_required: '需重新规划',
};

export const VEHICLE_STATUS_LABELS = {
  idle: '空闲',
  loading: '装盐中',
  working: '作业中',
  returning: '返程中',
  maintenance: '维护中',
};

export const ALERT_TYPE_LABELS = {
  key_route_unassigned: '重点道路未派车',
  salt_insufficient: '载盐量不足',
  road_closed: '道路封控',
  mission_delay: '任务延迟',
  inventory_low: '库存不足',
};

export const SEVERITY_LABELS = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};
