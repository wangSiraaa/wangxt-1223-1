import { query } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';

export const getVehicles = async (ctx) => {
  const { status, fleet_team } = ctx.query;
  let sql = 'SELECT * FROM vehicles WHERE 1=1';
  const params = [];
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  if (fleet_team) {
    params.push(fleet_team);
    sql += ` AND fleet_team = $${params.length}`;
  }
  sql += ' ORDER BY fleet_team ASC, plate_number ASC';
  const result = await query(sql, params);
  success(ctx, result.rows);
};

export const getVehicleById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query('SELECT * FROM vehicles WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    notFound(ctx, '车辆不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const createVehicle = async (ctx) => {
  const body = ctx.request.body;
  if (!body.plate_number || !body.vehicle_type || !body.salt_capacity_ton) {
    badRequest(ctx, '车牌号、车型、载盐容量为必填项');
    return;
  }
  const result = await query(
    `INSERT INTO vehicles
     (plate_number, vehicle_type, salt_capacity_ton, current_salt_ton, driver_name, driver_phone, status, current_location, fleet_team, max_route_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      body.plate_number,
      body.vehicle_type,
      body.salt_capacity_ton,
      body.current_salt_ton || 0,
      body.driver_name || null,
      body.driver_phone || null,
      body.status || 'idle',
      body.current_location || null,
      body.fleet_team || null,
      body.max_route_km || null,
    ]
  );
  success(ctx, result.rows[0], '车辆创建成功');
};

export const updateVehicle = async (ctx) => {
  const { id } = ctx.params;
  const body = ctx.request.body;
  const check = await query('SELECT id FROM vehicles WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '车辆不存在');
    return;
  }
  const updates = [];
  const params = [id];
  const fields = ['vehicle_type', 'salt_capacity_ton', 'current_salt_ton', 'driver_name', 'driver_phone', 'status', 'current_location', 'fleet_team', 'max_route_km'];
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
    `UPDATE vehicles SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  success(ctx, result.rows[0], '车辆更新成功');
};

export const deleteVehicle = async (ctx) => {
  const { id } = ctx.params;
  await query('DELETE FROM vehicles WHERE id = $1', [id]);
  success(ctx, null, '车辆删除成功');
};

export const updateVehicleSalt = async (ctx) => {
  const { id } = ctx.params;
  const { current_salt_ton, operation } = ctx.request.body;
  const vehicleCheck = await query('SELECT * FROM vehicles WHERE id = $1', [id]);
  if (vehicleCheck.rows.length === 0) {
    notFound(ctx, '车辆不存在');
    return;
  }
  const vehicle = vehicleCheck.rows[0];
  let newSalt = Number(current_salt_ton);
  if (operation === 'add') {
    newSalt = Number(vehicle.current_salt_ton) + Number(current_salt_ton);
  } else if (operation === 'subtract') {
    newSalt = Number(vehicle.current_salt_ton) - Number(current_salt_ton);
  }
  if (newSalt < 0) {
    badRequest(ctx, '载盐量不能为负数');
    return;
  }
  if (newSalt > Number(vehicle.salt_capacity_ton)) {
    badRequest(ctx, `载盐量不能超过车辆最大容量${vehicle.salt_capacity_ton}吨`);
    return;
  }
  const result = await query(
    'UPDATE vehicles SET current_salt_ton = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [newSalt, id]
  );
  success(ctx, result.rows[0], '车辆载盐量更新成功');
};
