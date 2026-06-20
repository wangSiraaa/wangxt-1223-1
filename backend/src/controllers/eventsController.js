import { query } from '../utils/db.js';
import { success, error, badRequest, notFound } from '../utils/response.js';
import { generateCode } from '../utils/helpers.js';
import { generateAlertsForEvent } from '../services/dispatchRules.js';

export const getEvents = async (ctx) => {
  const { status, page = 1, pageSize = 20 } = ctx.query;
  let sql = 'SELECT * FROM snow_events WHERE 1=1';
  const params = [];
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
  const result = await query(sql, params);
  const countResult = await query(
    'SELECT COUNT(*) FROM snow_events' + (status ? ' WHERE status = $1' : ''),
    status ? [status] : []
  );
  success(ctx, {
    list: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: Number(page),
    pageSize: Number(pageSize),
  });
};

export const getEventById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query('SELECT * FROM snow_events WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    notFound(ctx, '降雪事件不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const createEvent = async (ctx) => {
  const body = ctx.request.body;
  if (!body.event_name || !body.snow_level || !body.start_time) {
    badRequest(ctx, '事件名称、降雪等级、开始时间为必填项');
    return;
  }
  const code = generateCode('EVT');
  const result = await query(
    `INSERT INTO snow_events
     (event_code, event_name, snow_level, start_time, end_time, affected_areas, description, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      code,
      body.event_name,
      body.snow_level,
      body.start_time,
      body.end_time || null,
      body.affected_areas || null,
      body.description || null,
      body.status || 'active',
      body.created_by || null,
    ]
  );
  const event = result.rows[0];
  await generateAlertsForEvent(event.id);
  success(ctx, event, '降雪事件创建成功');
};

export const updateEvent = async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body;
  const check = await query('SELECT id FROM snow_events WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '降雪事件不存在');
    return;
  }
  const updates = [];
  const params = [id];
  const fields = ['event_name', 'snow_level', 'start_time', 'end_time', 'affected_areas', 'description', 'status'];
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
    `UPDATE snow_events SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  if (body.status === 'active') {
    await generateAlertsForEvent(id);
  }
  success(ctx, result.rows[0], '降雪事件更新成功');
};

export const deleteEvent = async (ctx) => {
  const { id } = ctx.params;
  const check = await query('SELECT id FROM snow_events WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '降雪事件不存在');
    return;
  }
  await query('DELETE FROM snow_events WHERE id = $1', [id]);
  success(ctx, null, '降雪事件删除成功');
};

export const getEventStats = async (ctx) => {
  const { id } = ctx.params;
  const missionsCount = await query(
    `SELECT status, COUNT(*) as count
     FROM missions
     WHERE event_id = $1
     GROUP BY status`,
    [id]
  );
  const roadsCoverage = await query(
    `SELECT COUNT(DISTINCT m.road_id) as assigned_roads,
            (SELECT COUNT(*) FROM roads WHERE is_key_route = TRUE) as total_key_roads,
            COUNT(DISTINCT CASE WHEN r.is_key_route = TRUE THEN m.road_id END) as assigned_key_roads
     FROM missions m
     LEFT JOIN roads r ON r.id = m.road_id
     WHERE m.event_id = $1 AND m.status NOT IN ('cancelled')`,
    [id]
  );
  const activeClosures = await query(
    `SELECT COUNT(*) FROM road_closures WHERE event_id = $1 AND status = 'active'`,
    [id]
  );
  const saltUsed = await query(
    `SELECT SUM(allocated_salt_ton) as total_allocated,
            SUM(used_salt_ton) as total_used
     FROM missions
     WHERE event_id = $1 AND status NOT IN ('cancelled')`,
    [id]
  );
  success(ctx, {
    missionsByStatus: missionsCount.rows,
    roadsCoverage: roadsCoverage.rows[0],
    activeClosures: parseInt(activeClosures.rows[0].count),
    salt: saltUsed.rows[0],
  });
};
