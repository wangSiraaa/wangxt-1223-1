import { query, transaction } from '../utils/db.js';
import { success, error, badRequest, notFound } from '../utils/response.js';
import { generateCode } from '../utils/helpers.js';
import { replanMissionsOnRoadClosure } from '../services/dispatchRules.js';

export const getClosures = async (ctx) => {
  const { road_id, event_id, status } = ctx.query;
  let sql = `
    SELECT rc.*, r.road_name, r.road_code, r.road_level, r.length_km,
           e.event_name, e.event_code
    FROM road_closures rc
    LEFT JOIN roads r ON r.id = rc.road_id
    LEFT JOIN snow_events e ON e.id = rc.event_id
    WHERE 1=1`;
  const params = [];
  if (road_id) { params.push(road_id); sql += ` AND rc.road_id = $${params.length}`; }
  if (event_id) { params.push(event_id); sql += ` AND rc.event_id = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND rc.status = $${params.length}`; }
  sql += ' ORDER BY rc.start_time DESC';
  const result = await query(sql, params);
  success(ctx, result.rows);
};

export const getClosureById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query(
    `SELECT rc.*, r.road_name, r.road_code, r.road_level, e.event_name
     FROM road_closures rc
     LEFT JOIN roads r ON r.id = rc.road_id
     LEFT JOIN snow_events e ON e.id = rc.event_id
     WHERE rc.id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    notFound(ctx, '封控记录不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const createClosure = async (ctx) => {
  const body = ctx.request.body;
  if (!body.road_id || !body.closure_type || !body.closure_reason) {
    badRequest(ctx, '道路ID、封控类型、封控原因为必填项');
    return;
  }
  await transaction(async (client) => {
    const existingActive = await client.query(
      `SELECT COUNT(*) FROM road_closures WHERE road_id = $1 AND status = 'active'`,
      [body.road_id]
    );
    if (parseInt(existingActive.rows[0].count) > 0) {
      return badRequest(ctx, '该道路已有进行中的封控');
    }
    const code = generateCode('CLS');
    const result = await client.query(
      `INSERT INTO road_closures
       (closure_code, road_id, event_id, closure_type, closure_reason, closed_by,
        start_time, detour_suggestion, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        code, body.road_id, body.event_id || null,
        body.closure_type, body.closure_reason,
        body.closed_by || null,
        body.start_time || new Date(),
        body.detour_suggestion || null,
        'active',
      ]
    );
    await client.query(
      "UPDATE roads SET status = 'closed' WHERE id = $1",
      [body.road_id]
    );
    const updatedMissions = await replanMissionsOnRoadClosure(
      client,
      body.road_id,
      body.event_id || null,
      body.closure_reason
    );
    success(ctx, {
      closure: result.rows[0],
      replanned_missions: updatedMissions,
    }, '封控记录创建成功');
    return null;
  }).catch((e) => {
    error(ctx, e.message || '封控记录创建失败');
  });
};

export const liftClosure = async (ctx) => {
  const { id } = ctx.params;
  const check = await query('SELECT * FROM road_closures WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '封控记录不存在');
    return;
  }
  const closure = check.rows[0];
  if (closure.status === 'lifted') {
    return badRequest(ctx, '该封控已解除');
  }
  await transaction(async (client) => {
    const result = await client.query(
      `UPDATE road_closures
       SET status = 'lifted', end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id]
    );
    await client.query(
      "UPDATE roads SET status = 'normal' WHERE id = $1 AND status = 'closed'",
      [closure.road_id]
    );
    success(ctx, result.rows[0], '封控已解除');
    return null;
  });
};

export const updateClosure = async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body;
  const check = await query('SELECT id FROM road_closures WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '封控记录不存在');
    return;
  }
  const updates = [];
  const params = [id];
  const fields = ['closure_reason', 'closed_by', 'detour_suggestion', 'start_time', 'end_time', 'status'];
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
    `UPDATE road_closures SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  success(ctx, result.rows[0], '封控记录更新成功');
};
