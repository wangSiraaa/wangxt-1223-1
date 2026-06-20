import { query, transaction } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';
import { generateCode } from '../utils/helpers.js';
import { createAlert } from '../services/dispatchRules.js';

export const getWarehouses = async (ctx) => {
  const result = await query(
    `SELECT w.*,
            (SELECT SUM(quantity_ton) FROM salt_inventory i WHERE i.warehouse_id = w.id) as total_inventory_ton
     FROM warehouses w
     ORDER BY w.warehouse_code ASC`
  );
  success(ctx, result.rows);
};

export const getWarehouseById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query(
    `SELECT w.*,
            (SELECT json_agg(json_build_object(
               'salt_type', i.salt_type,
               'quantity_ton', i.quantity_ton,
               'unit_price', i.unit_price
             )) FROM salt_inventory i WHERE i.warehouse_id = w.id) as inventory
     FROM warehouses w WHERE w.id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    notFound(ctx, '仓库不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const getInventory = async (ctx) => {
  const { warehouse_id } = ctx.query;
  let sql = `
    SELECT i.*, w.warehouse_name, w.warehouse_code
    FROM salt_inventory i
    LEFT JOIN warehouses w ON w.id = i.warehouse_id
    WHERE 1=1`;
  const params = [];
  if (warehouse_id) { params.push(warehouse_id); sql += ` AND i.warehouse_id = $${params.length}`; }
  sql += ' ORDER BY w.warehouse_code ASC, i.salt_type ASC';
  const result = await query(sql, params);
  success(ctx, result.rows);
};

export const getTransactions = async (ctx) => {
  const { warehouse_id, mission_id, trans_type, page = 1, pageSize = 50 } = ctx.query;
  let sql = `
    SELECT t.*, w.warehouse_name, m.mission_code, v.plate_number, u.full_name as operator_name
    FROM salt_transactions t
    LEFT JOIN warehouses w ON w.id = t.warehouse_id
    LEFT JOIN missions m ON m.id = t.mission_id
    LEFT JOIN vehicles v ON v.id = t.vehicle_id
    LEFT JOIN users u ON u.id = t.operator_id
    WHERE 1=1`;
  const params = [];
  if (warehouse_id) { params.push(warehouse_id); sql += ` AND t.warehouse_id = $${params.length}`; }
  if (mission_id) { params.push(mission_id); sql += ` AND t.mission_id = $${params.length}`; }
  if (trans_type) { params.push(trans_type); sql += ` AND t.trans_type = $${params.length}`; }
  sql += ` ORDER BY t.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
  const result = await query(sql, params);
  const countParams = [];
  let countSql = 'SELECT COUNT(*) FROM salt_transactions WHERE 1=1';
  if (warehouse_id) { countParams.push(warehouse_id); countSql += ` AND warehouse_id = $${countParams.length}`; }
  if (mission_id) { countParams.push(mission_id); countSql += ` AND mission_id = $${countParams.length}`; }
  if (trans_type) { countParams.push(trans_type); countSql += ` AND trans_type = $${countParams.length}`; }
  const countResult = await query(countSql, countParams);
  success(ctx, {
    list: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: Number(page),
    pageSize: Number(pageSize),
  });
};

export const createWarehouse = async (ctx) => {
  const body = ctx.request.body;
  if (!body.warehouse_code || !body.warehouse_name) {
    badRequest(ctx, '仓库编码和名称为必填项');
    return;
  }
  const result = await query(
    `INSERT INTO warehouses (warehouse_code, warehouse_name, address, manager_name, manager_phone, capacity_ton)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      body.warehouse_code, body.warehouse_name,
      body.address || null, body.manager_name || null,
      body.manager_phone || null, body.capacity_ton || null,
    ]
  );
  success(ctx, result.rows[0], '仓库创建成功');
};

export const outboundSalt = async (ctx) => {
  const body = ctx.request.body;
  if (!body.warehouse_id || !body.quantity_ton || !body.vehicle_id) {
    badRequest(ctx, '仓库ID、出库数量、车辆ID为必填项');
    return;
  }
  if (Number(body.quantity_ton) <= 0) {
    badRequest(ctx, '出库数量必须大于0');
    return;
  }
  await transaction(async (client) => {
    const inventoryResult = await client.query(
      `SELECT * FROM salt_inventory WHERE warehouse_id = $1 AND salt_type = $2 FOR UPDATE`,
      [body.warehouse_id, body.salt_type || 'sodium_chloride']
    );
    if (inventoryResult.rows.length === 0) {
      return badRequest(ctx, '仓库中没有该类型盐库存');
    }
    const inventory = inventoryResult.rows[0];
    const outQuantity = Number(body.quantity_ton);
    if (Number(inventory.quantity_ton) < outQuantity) {
      return badRequest(ctx, `库存不足，当前库存: ${inventory.quantity_ton}吨`);
    }
    const newBalance = Number(inventory.quantity_ton) - outQuantity;
    await client.query(
      `UPDATE salt_inventory SET quantity_ton = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newBalance, inventory.id]
    );
    const vehicleResult = await client.query('SELECT * FROM vehicles WHERE id = $1', [body.vehicle_id]);
    if (vehicleResult.rows.length === 0) {
      return badRequest(ctx, '车辆不存在');
    }
    const vehicle = vehicleResult.rows[0];
    const newVehicleSalt = Number(vehicle.current_salt_ton) + outQuantity;
    if (newVehicleSalt > Number(vehicle.salt_capacity_ton)) {
      return badRequest(ctx, `装盐后超过车辆最大容量${vehicle.salt_capacity_ton}吨`);
    }
    await client.query(
      `UPDATE vehicles SET current_salt_ton = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [newVehicleSalt, 'idle', body.vehicle_id]
    );
    const code = generateCode('OUT');
    const trans = await client.query(
      `INSERT INTO salt_transactions
       (trans_code, warehouse_id, mission_id, trans_type, salt_type, quantity_ton, balance_after,
        operator_id, vehicle_id, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        code, body.warehouse_id, body.mission_id || null,
        'outbound', body.salt_type || 'sodium_chloride',
        -outQuantity, newBalance, body.operator_id || null,
        body.vehicle_id, body.remark || null,
      ]
    );
    if (body.mission_id) {
      await client.query(
        `UPDATE missions SET status = 'salt_loaded', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [body.mission_id]
      );
    }
    if (newBalance < 20) {
      await createAlert(client, {
        alert_type: 'inventory_low',
        severity: newBalance < 5 ? 'critical' : 'warning',
        title: `库存不足：${body.warehouse_name || ''}仓库`,
        description: `仓库${body.salt_type || 'sodium_chloride'}库存仅剩${newBalance}吨，低于预警阈值20吨`,
        warehouse_id: body.warehouse_id,
      });
    }
    success(ctx, {
      transaction: trans.rows[0],
      warehouse_balance: newBalance,
      vehicle_salt: newVehicleSalt,
    }, '出库登记成功');
    return null;
  }).catch((e) => {
    error(ctx, e.message || '出库登记失败');
  });
};

export const inboundSalt = async (ctx) => {
  const body = ctx.request.body;
  if (!body.warehouse_id || !body.quantity_ton) {
    badRequest(ctx, '仓库ID和入库数量为必填项');
    return;
  }
  if (Number(body.quantity_ton) <= 0) {
    badRequest(ctx, '入库数量必须大于0');
    return;
  }
  await transaction(async (client) => {
    const inventoryResult = await client.query(
      `SELECT * FROM salt_inventory WHERE warehouse_id = $1 AND salt_type = $2 FOR UPDATE`,
      [body.warehouse_id, body.salt_type || 'sodium_chloride']
    );
    const inQuantity = Number(body.quantity_ton);
    let newBalance;
    if (inventoryResult.rows.length === 0) {
      newBalance = inQuantity;
      await client.query(
        `INSERT INTO salt_inventory (warehouse_id, salt_type, quantity_ton, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [body.warehouse_id, body.salt_type || 'sodium_chloride', inQuantity, body.unit_price || null]
      );
    } else {
      newBalance = Number(inventoryResult.rows[0].quantity_ton) + inQuantity;
      await client.query(
        `UPDATE salt_inventory SET quantity_ton = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newBalance, inventoryResult.rows[0].id]
      );
    }
    const code = generateCode('INB');
    const trans = await client.query(
      `INSERT INTO salt_transactions
       (trans_code, warehouse_id, mission_id, trans_type, salt_type, quantity_ton, balance_after,
        operator_id, vehicle_id, supplier, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        code, body.warehouse_id, null,
        'inbound', body.salt_type || 'sodium_chloride',
        inQuantity, newBalance, body.operator_id || null,
        null, body.supplier || null, body.remark || null,
      ]
    );
    success(ctx, {
      transaction: trans.rows[0],
      warehouse_balance: newBalance,
    }, '入库登记成功');
    return null;
  }).catch((e) => {
    error(ctx, e.message || '入库登记失败');
  });
};
