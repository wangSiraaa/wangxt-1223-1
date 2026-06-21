import { query } from '../utils/db.js';
import { success, error, badRequest, notFound } from '../utils/response.js';

export const getRoads = async (ctx) => {
  const { road_level, is_key_route, status } = ctx.query;
  let sql = 'SELECT * FROM roads WHERE 1=1';
  const params = [];
  if (road_level) {
    params.push(road_level);
    sql += ` AND road_level = $${params.length}`;
  }
  if (is_key_route !== undefined) {
    params.push(is_key_route === 'true' || is_key_route === true);
    sql += ` AND is_key_route = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ' ORDER BY priority ASC, road_level ASC, length_km DESC';
  const result = await query(sql, params);
  success(ctx, result.rows);
};

export const getRoadById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query('SELECT * FROM roads WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    notFound(ctx, '道路不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const createRoad = async (ctx) => {
  const body = ctx.request.body;
  if (!body.road_code || !body.road_name || !body.road_level || !body.length_km) {
    badRequest(ctx, '道路编码、名称、等级、长度为必填项');
    return;
  }
  const result = await query(
    `INSERT INTO roads
     (road_code, road_name, road_level, length_km, lanes, salt_per_km, priority, is_key_route, start_point, end_point, geojson_feature, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      body.road_code,
      body.road_name,
      body.road_level,
      body.length_km,
      body.lanes || 2,
      body.salt_per_km || 0.5,
      body.priority || 3,
      body.is_key_route || false,
      body.start_point || null,
      body.end_point || null,
      body.geojson_feature || null,
      body.status || 'normal',
    ]
  );
  success(ctx, result.rows[0], '道路创建成功');
};

export const updateRoad = async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body;
  const check = await query('SELECT id FROM roads WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '道路不存在');
    return;
  }
  const updates = [];
  const params = [id];
  const fields = ['road_name', 'road_level', 'length_km', 'lanes', 'salt_per_km', 'priority', 'is_key_route', 'start_point', 'end_point', 'geojson_feature', 'status'];
  fields.forEach((field) => {
    if (body[field] !== undefined) {
      params.push(body[field]);
      updates.push(`${field} = $${params.length}`);
    }
  });
  if (updates.length === 0) {
    badRequest(ctx, '没有可更新的字段');
    return;
  }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  const result = await query(
    `UPDATE roads SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  success(ctx, result.rows[0], '道路更新成功');
};

export const deleteRoad = async (ctx) => {
  const { id } = ctx.params;
  await query('DELETE FROM roads WHERE id = $1', [id]);
  success(ctx, null, '道路删除成功');
};

export const getRoadsWithMissions = async (ctx) => {
  const { event_id } = ctx.query;
  let sql = `
    SELECT r.*,
           (SELECT COUNT(*) FROM missions m WHERE m.road_id = r.id AND m.event_id = $1
            AND m.status IN ('assigned', 'salt_loaded', 'in_progress')) as active_mission_count,
           (SELECT string_agg(v.plate_number, ',') FROM missions m
            LEFT JOIN vehicles v ON v.id = m.vehicle_id
            WHERE m.road_id = r.id AND m.event_id = $1 AND m.status IN ('assigned', 'salt_loaded', 'in_progress')) as assigned_vehicles,
           (SELECT COUNT(*) FROM road_closures rc WHERE rc.road_id = r.id AND rc.status = 'active') as closure_count
    FROM roads r
    ORDER BY r.priority ASC, r.road_level ASC`;
  const params = [event_id || null];
  const result = await query(sql, params);

  const roadIds = result.rows.map((r) => r.id);
  let closuresMap = {};
  if (roadIds.length > 0) {
    const placeholders = roadIds.map((_, i) => `$${i + 1}`).join(',');
    const closuresResult = await query(
      `SELECT rc.*, r.road_name
       FROM road_closures rc
       JOIN roads r ON r.id = rc.road_id
       WHERE rc.road_id IN (${placeholders}) AND rc.status = 'active'
       ORDER BY rc.start_time DESC`,
      roadIds
    );
    for (const c of closuresResult.rows) {
      if (!closuresMap[c.road_id]) closuresMap[c.road_id] = [];
      closuresMap[c.road_id].push(c);
    }
  }

  const enriched = result.rows.map((r) => ({
    ...r,
    active_closures: closuresMap[r.id] || [],
    has_police_closure: (closuresMap[r.id] || []).some((c) => c.closure_type === 'police'),
  }));

  success(ctx, enriched);
};
