import { query, transaction } from '../utils/db.js';
import { success, notFound, badRequest } from '../utils/response.js';
import { checkKeyRoutesUnassigned, createAlert, generateAlertsForEvent, checkInventoryLow } from '../services/dispatchRules.js';

export const getAlerts = async (ctx) => {
  const { alert_type, severity, is_read, is_resolved, event_id, page = 1, pageSize = 50 } = ctx.query;
  let sql = `
    SELECT a.*, r.road_name, r.road_code, e.event_name, m.mission_code,
           v.plate_number, w.warehouse_name, u.full_name as resolved_by_name
    FROM alerts a
    LEFT JOIN roads r ON r.id = a.road_id
    LEFT JOIN snow_events e ON e.id = a.event_id
    LEFT JOIN missions m ON m.id = a.mission_id
    LEFT JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN warehouses w ON w.id = a.warehouse_id
    LEFT JOIN users u ON u.id = a.resolved_by
    WHERE 1=1`;
  const params = [];
  if (alert_type) { params.push(alert_type); sql += ` AND a.alert_type = $${params.length}`; }
  if (severity) { params.push(severity); sql += ` AND a.severity = $${params.length}`; }
  if (is_read !== undefined) { params.push(is_read === 'true' || is_read === true); sql += ` AND a.is_read = $${params.length}`; }
  if (is_resolved !== undefined) { params.push(is_resolved === 'true' || is_resolved === true); sql += ` AND a.is_resolved = $${params.length}`; }
  if (event_id) { params.push(event_id); sql += ` AND a.event_id = $${params.length}`; }
  sql += ` ORDER BY
             CASE a.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END ASC,
             a.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));
  const result = await query(sql, params);
  const countParams = [];
  let countSql = 'SELECT COUNT(*) FROM alerts WHERE 1=1';
  if (alert_type) { countParams.push(alert_type); countSql += ` AND alert_type = $${countParams.length}`; }
  if (severity) { countParams.push(severity); countSql += ` AND severity = $${countParams.length}`; }
  if (is_read !== undefined) { countParams.push(is_read === 'true' || is_read === true); countSql += ` AND is_read = $${countParams.length}`; }
  if (is_resolved !== undefined) { countParams.push(is_resolved === 'true' || is_resolved === true); countSql += ` AND is_resolved = $${countParams.length}`; }
  if (event_id) { countParams.push(event_id); countSql += ` AND event_id = $${countParams.length}`; }
  const countResult = await query(countSql, countParams);
  success(ctx, {
    list: result.rows,
    total: parseInt(countResult.rows[0].count),
    page: Number(page),
    pageSize: Number(pageSize),
  });
};

export const getAlertById = async (ctx) => {
  const { id } = ctx.params;
  const result = await query('SELECT * FROM alerts WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    notFound(ctx, '预警不存在');
    return;
  }
  success(ctx, result.rows[0]);
};

export const markAlertRead = async (ctx) => {
  const { id } = ctx.params;
  const check = await query('SELECT id FROM alerts WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '预警不存在');
    return;
  }
  const result = await query(
    "UPDATE alerts SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
    [id]
  );
  success(ctx, result.rows[0], '预警已标记为已读');
};

export const markAllAlertsRead = async (ctx) => {
  const { event_id } = ctx.query;
  let sql = "UPDATE alerts SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP WHERE is_read = FALSE";
  const params = [];
  if (event_id) {
    params.push(event_id);
    sql += ` AND event_id = $1`;
  }
  await query(sql, params);
  success(ctx, null, '所有预警已标记为已读');
};

export const resolveAlert = async (ctx) => {
  const { id } = ctx.params;
  const { resolved_by, resolution_note } = ctx.request.body;
  const check = await query('SELECT id FROM alerts WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    notFound(ctx, '预警不存在');
    return;
  }
  const result = await query(
    `UPDATE alerts
     SET is_resolved = TRUE, resolved_at = CURRENT_TIMESTAMP,
         resolved_by = $1, resolution_note = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 RETURNING *`,
    [resolved_by || null, resolution_note || null, id]
  );
  success(ctx, result.rows[0], '预警已标记为已解决');
};

export const runAlertChecks = async (ctx) => {
  const { event_id } = ctx.query;
  const newAlerts = [];
  await transaction(async (client) => {
    if (event_id) {
      const unassigned = await checkKeyRoutesUnassigned(event_id);
      for (const road of unassigned) {
        const existing = await client.query(
          `SELECT id FROM alerts WHERE alert_type = 'key_route_unassigned'
           AND road_id = $1 AND event_id = $2 AND is_resolved = FALSE
           LIMIT 1`,
          [road.id, event_id]
        );
        if (existing.rows.length === 0) {
          const alert = await createAlert(client, {
            alert_type: 'key_route_unassigned',
            severity: road.priority <= 1 ? 'critical' : 'warning',
            title: `重点道路未派车：${road.road_name}`,
            description: `${road.road_name}为重点道路，当前降雪事件下尚未安排作业车辆，优先级：${road.priority}`,
            event_id,
            road_id: road.id,
          });
          newAlerts.push(alert);
        }
      }
    }
    const lowInventory = await checkInventoryLow();
    for (const inv of lowInventory) {
      const existing = await client.query(
        `SELECT id FROM alerts WHERE alert_type = 'inventory_low'
         AND warehouse_id = $1 AND is_resolved = FALSE
         LIMIT 1`,
        [inv.warehouse_id]
      );
      if (existing.rows.length === 0) {
        const alert = await createAlert(client, {
          alert_type: 'inventory_low',
          severity: inv.quantity_ton < 5 ? 'critical' : 'warning',
          title: `库存预警：${inv.warehouse_name}`,
          description: `${inv.warehouse_name} ${inv.salt_type} 库存仅剩 ${inv.quantity_ton} 吨`,
          warehouse_id: inv.warehouse_id,
        });
        newAlerts.push(alert);
      }
    }
    return null;
  });
  success(ctx, { new_alerts: newAlerts, total_checked: newAlerts.length }, '预警检查完成');
};

export const getAlertStats = async (ctx) => {
  const { event_id } = ctx.query;
  const params = [];
  let where = 'WHERE 1=1';
  if (event_id) { params.push(event_id); where += ' AND event_id = $1'; }
  const byType = await query(
    `SELECT alert_type, COUNT(*) as count,
            COUNT(*) FILTER (WHERE is_resolved = FALSE) as unresolved
     FROM alerts ${where} GROUP BY alert_type`,
    params
  );
  const bySeverity = await query(
    `SELECT severity, COUNT(*) as count,
            COUNT(*) FILTER (WHERE is_resolved = FALSE) as unresolved
     FROM alerts ${where} GROUP BY severity`,
    params
  );
  const totals = await query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_read = FALSE) as unread,
            COUNT(*) FILTER (WHERE is_resolved = FALSE) as unresolved,
            COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = FALSE) as critical_unresolved
     FROM alerts ${where}`,
    params
  );
  success(ctx, {
    by_type: byType.rows,
    by_severity: bySeverity.rows,
    totals: totals.rows[0],
  });
};
