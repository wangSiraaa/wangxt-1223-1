import { query, transaction } from '../utils/db.js';
import { success, error, badRequest, notFound } from '../utils/response.js';
import { generateCode } from '../utils/helpers.js';
import {
  validateVehicleSaltCapacity,
  validateVehicleCanHandleRoute,
  checkRoadClosed,
  createAlert,
  calculateRequiredSalt,
} from '../services/dispatchRules.js';

export const getMissions = async (ctx) => {
  const { event_id, road_id, vehicle_id, status, page = 1, pageSize = 50 } = ctx.query;
  let sql = `
    SELECT m.*, r.road_name, r.road_code, r.road_level, r.length_km, r.is_key_route,
           v.plate_number, v.vehicle_type, v.salt_capacity_ton, v.current_salt_ton, v.status as vehicle_status,
           w.warehouse_name,
           u.full_name as assigned_by_name
    FROM missions m
    LEFT JOIN roads r ON r.id = m.road_id
    LEFT JOIN vehicles v ON v.id = m.vehicle_id
    LEFT JOIN warehouses w ON w.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.assigned_by
    WHERE 1=1`;
  const params = [];
  if (event_id) { params.push(event_id); sql += ` AND m.event_id = $${params.length}`; }
  if (road_id) { params.push(road_id); sql += ` AND m.road_id = $${params.length}`; }
  if (vehicle_id) { params.push(vehicle_id); sql += ` AND m.vehicle_id = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND m.status = $${params.length}`; }
  sql += ` ORDER BY m.priority ASC, m.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
  const result = await query(sql, params);
  const countSql = 'SELECT COUNT(*) FROM missions WHERE 1=1' +
    (event_id ? ' AND event_id = $1' : '') +
    (road_id ? (event_id ? ' AND road_id = $2' : ' AND road_id = $1') : '') +
    (vehicle_id ? ` AND vehicle_id = $${event_id && road_id ? '3' : event_id || road_id ? '2' : '1'}` : '') +
    (status ? ` AND status = $${(event_id ? 1 : 0) + (road_id ? 1 : 0) + (vehicle_id ? 1 : 0) + 1}` : '');
  const countParams = [];
  if (event_id) countParams.push(event_id);
  if (road_id) countParams.push(road_id);
  if (vehicle_id) countParams.push(vehicle_id);
  if (status) countParams.push(status);
  const countResult = await query(countSql, countParams);
  success(ctx, {
    list: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: Number(page),
    pageSize: Number(pageSize),
  });
};

export const getMissionById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query(
    `SELECT m.*, r.road_name, r.road_code, r.road_level, r.length_km, r.salt_per_km, r.lanes, r.is_key_route,
            v.plate_number, v.vehicle_type, v.salt_capacity_ton, v.current_salt_ton,
            w.warehouse_name
     FROM missions m
     LEFT JOIN roads r ON r.id = m.road_id
     LEFT JOIN vehicles v ON v.id = m.vehicle_id
     LEFT JOIN warehouses w ON w.id = m.warehouse_id
     WHERE m.id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    notFound(ctx, '任务不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const validateMission = async (ctx) => {
  const { vehicle_id, road_id } = ctx.request.body;
  if (!vehicle_id || !road_id) {
    badRequest(ctx, '车辆ID和道路ID为必填项');
    return;
  }
  const roadResult = await query('SELECT * FROM roads WHERE id = $1', [road_id]);
  if (roadResult.rows.length === 0) {
    notFound(ctx, '道路不存在');
    return;
  }
  const road = roadResult.rows[0];
  const closureCheck = await checkRoadClosed(road_id);
  const capacityCheck = await validateVehicleSaltCapacity(
    vehicle_id,
    road.length_km,
    road.salt_per_km,
    road.lanes
  );
  const rangeCheck = await validateVehicleCanHandleRoute(vehicle_id, road.length_km);
  const requiredSalt = calculateRequiredSalt(road.length_km, road.salt_per_km, road.lanes);
  success(ctx, {
    valid: capacityCheck.valid && rangeCheck.valid && !closureCheck.closed,
    required_salt: requiredSalt,
    road_closed: closureCheck.closed,
    closures: closureCheck.closures,
    salt_check: capacityCheck,
    range_check: rangeCheck,
  });
};

export const createMission = async (ctx) => {
  const body = ctx.request.body;
  if (!body.road_id || !body.vehicle_id) {
    badRequest(ctx, '道路ID和车辆ID为必填项');
    return;
  }
  await transaction(async (client) => {
    const roadResult = await client.query('SELECT * FROM roads WHERE id = $1', [body.road_id]);
    if (roadResult.rows.length === 0) {
      return badRequest(ctx, '道路不存在');
    }
    const road = roadResult.rows[0];
    const closureCheck = await checkRoadClosed(body.road_id, client);
    if (closureCheck.closed) {
      return badRequest(ctx, `道路已被封控，请重新规划。原因：${closureCheck.closures[0]?.closure_reason || '未知'}`);
    }
    const requiredSalt = calculateRequiredSalt(road.length_km, road.salt_per_km, road.lanes);
    const capacityCheck = await validateVehicleSaltCapacity(
      body.vehicle_id,
      road.length_km,
      road.salt_per_km,
      road.lanes,
      client
    );
    if (!capacityCheck.valid) {
      await createAlert(client, {
        alert_type: 'salt_insufficient',
        severity: 'warning',
        title: `车辆载盐量不足：${capacityCheck.vehicle?.plate_number || ''}`,
        description: capacityCheck.reason + `，尝试分配道路：${road.road_name}。请先到仓库装盐。`,
        event_id: body.event_id || null,
        road_id: body.road_id,
        vehicle_id: body.vehicle_id,
      });
      return badRequest(ctx, capacityCheck.reason + '，请先到仓库装盐或更换车辆');
    }
    const rangeCheck = await validateVehicleCanHandleRoute(body.vehicle_id, road.length_km, client);
    if (!rangeCheck.valid) {
      return badRequest(ctx, rangeCheck.reason);
    }
    const activeMissions = await client.query(
      `SELECT COUNT(*) FROM missions
       WHERE vehicle_id = $1 AND status IN ('assigned', 'salt_loaded', 'in_progress')`,
      [body.vehicle_id]
    );
    if (parseInt(activeMissions.rows[0].count) > 0) {
      return badRequest(ctx, '该车辆当前有未完成任务，请先完成或取消原有任务');
    }
    const code = generateCode('MSN');
    const result = await client.query(
      `INSERT INTO missions
       (mission_code, event_id, road_id, vehicle_id, warehouse_id, assigned_by, assigned_time,
        planned_start_time, actual_start_time, completion_time, allocated_salt_ton, used_salt_ton,
        route_km, priority, status, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        code,
        body.event_id || null,
        body.road_id,
        body.vehicle_id,
        body.warehouse_id || null,
        body.assigned_by || null,
        new Date(),
        body.planned_start_time || null,
        null,
        null,
        Number(body.allocated_salt_ton || requiredSalt),
        0,
        Number(road.length_km),
        Number(body.priority || road.priority || 3),
        'assigned',
        body.remarks || null,
      ]
    );
    await client.query(
      "UPDATE roads SET status = 'processing' WHERE id = $1 AND status = 'normal'",
      [body.road_id]
    );
    await client.query(
      "UPDATE vehicles SET status = 'loading' WHERE id = $1 AND status = 'idle'",
      [body.vehicle_id]
    );
    success(ctx, result.rows[0], '任务创建成功');
    return null;
  }).catch((e) => {
    error(ctx, e.message || '任务创建失败');
  });
};

export const updateMission = async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body;
  const check = await query('SELECT * FROM missions WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '任务不存在');
    return;
  }
  const updates = [];
  const params = [id];
  const fields = ['warehouse_id', 'planned_start_time', 'actual_start_time', 'completion_time',
    'allocated_salt_ton', 'used_salt_ton', 'priority', 'status', 'remarks', 'replan_reason'];
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
    `UPDATE missions SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  if (body.status === 'completed') {
    await query(
      "UPDATE roads SET status = 'completed' WHERE id = $1 AND (SELECT COUNT(*) FROM missions m WHERE m.road_id = roads.id AND m.status IN ('assigned', 'salt_loaded', 'in_progress')) = 0",
      [check.rows[0].road_id]
    );
    await query(
      "UPDATE vehicles SET status = 'returning' WHERE id = $1",
      [check.rows[0].vehicle_id]
    );
  }
  if (body.status === 'cancelled') {
    await query(
      "UPDATE vehicles SET status = 'idle' WHERE id = $1",
      [check.rows[0].vehicle_id]
    );
  }
  success(ctx, result.rows[0], '任务更新成功');
};

export const cancelMission = async (ctx) => {
  const { id } = ctx.params;
  const check = await query('SELECT * FROM missions WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '任务不存在');
    return;
  }
  const mission = check.rows[0];
  if (mission.status === 'completed') {
    return badRequest(ctx, '已完成的任务不能取消');
  }
  await transaction(async (client) => {
    await client.query(
      "UPDATE missions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );
    await client.query(
      "UPDATE vehicles SET status = 'idle' WHERE id = $1",
      [mission.vehicle_id]
    );
    const remainingMissions = await client.query(
      `SELECT COUNT(*) FROM missions
       WHERE road_id = $1 AND status IN ('assigned', 'salt_loaded', 'in_progress')`,
      [mission.road_id]
    );
    if (parseInt(remainingMissions.rows[0].count) === 0) {
      await client.query(
        "UPDATE roads SET status = 'normal' WHERE id = $1",
        [mission.road_id]
      );
    }
    success(ctx, null, '任务取消成功');
    return null;
  });
};

export const markMissionStarted = async (ctx) => {
  const { id } = ctx.params;
  const check = await query('SELECT * FROM missions WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '任务不存在');
    return;
  }
  const mission = check.rows[0];
  if (mission.status !== 'salt_loaded') {
    return badRequest(ctx, '只有已装盐状态的任务才能开始作业');
  }
  const result = await query(
    `UPDATE missions
     SET status = 'in_progress', actual_start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id]
  );
  await query(
    "UPDATE vehicles SET status = 'working' WHERE id = $1",
    [mission.vehicle_id]
  );
  success(ctx, result.rows[0], '任务已开始作业');
};

export const markMissionCompleted = async (ctx) => {
  const { id } = ctx.params;
  const { used_salt_ton } = ctx.request.body;
  const check = await query('SELECT * FROM missions WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '任务不存在');
    return;
  }
  const mission = check.rows[0];
  if (mission.status !== 'in_progress') {
    return badRequest(ctx, '只有作业中的任务才能标记完成');
  }
  await transaction(async (client) => {
    const finalUsed = used_salt_ton || mission.allocated_salt_ton;
    const result = await client.query(
      `UPDATE missions
       SET status = 'completed', completion_time = CURRENT_TIMESTAMP,
           used_salt_ton = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [finalUsed, id]
    );
    const remainingSalt = Number(mission.allocated_salt_ton) - Number(finalUsed);
    const currentVehicle = await client.query('SELECT * FROM vehicles WHERE id = $1', [mission.vehicle_id]);
    const vehicleSalt = Math.max(0, Number(currentVehicle.rows[0].current_salt_ton) - Number(finalUsed));
    await client.query(
      'UPDATE vehicles SET current_salt_ton = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [vehicleSalt, 'idle', mission.vehicle_id]
    );
    const remainingActiveMissions = await client.query(
      `SELECT COUNT(*) FROM missions
       WHERE road_id = $1 AND status IN ('assigned', 'salt_loaded', 'in_progress')`,
      [mission.road_id]
    );
    if (parseInt(remainingActiveMissions.rows[0].count) === 0) {
      await client.query(
        "UPDATE roads SET status = 'completed' WHERE id = $1",
        [mission.road_id]
      );
    }
    success(ctx, result.rows[0], '任务已完成');
    return null;
  });
};
