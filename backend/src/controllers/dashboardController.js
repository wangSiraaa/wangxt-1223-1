import { query } from '../utils/db.js';
import { success, badRequest } from '../utils/response.js';

export const getDashboardStats = async (ctx) => {
  const { event_id } = ctx.query;

  const eventWhere = event_id ? 'WHERE m.event_id = $1' : '';
  const eventParams = event_id ? [event_id] : [];

  const events = await query(
    `SELECT status, COUNT(*) as count FROM snow_events GROUP BY status`
  );
  const missionsByStatus = await query(
    `SELECT status, COUNT(*) as count FROM missions ${eventWhere} GROUP BY status`,
    eventParams
  );
  const vehiclesByStatus = await query(
    `SELECT status, COUNT(*) as count, SUM(current_salt_ton) as total_salt_ton
     FROM vehicles GROUP BY status`
  );
  const roadsByStatus = await query(
    `SELECT status, COUNT(*) as count,
            COUNT(*) FILTER (WHERE is_key_route = TRUE) as key_count
     FROM roads GROUP BY status`
  );
  const closures = await query(
    `SELECT status, COUNT(*) as count FROM road_closures GROUP BY status`
  );
  const inventory = await query(
    `SELECT salt_type, SUM(quantity_ton) as total_ton
     FROM salt_inventory GROUP BY salt_type`
  );
  const alertsSummary = await query(
    `SELECT
       COUNT(*) FILTER (WHERE is_resolved = FALSE) as unresolved,
       COUNT(*) FILTER (WHERE is_read = FALSE) as unread,
       COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = FALSE) as critical,
       COUNT(*) FILTER (WHERE severity = 'warning' AND is_resolved = FALSE) as warning,
       COUNT(*) FILTER (WHERE alert_type = 'key_route_unassigned' AND is_resolved = FALSE) as key_route_unassigned,
       COUNT(*) FILTER (WHERE alert_type = 'salt_insufficient' AND is_resolved = FALSE) as salt_insufficient,
       COUNT(*) FILTER (WHERE alert_type = 'road_closed' AND is_resolved = FALSE) as road_closed
     FROM alerts`
  );
  const saltUsage = event_id ? await query(
    `SELECT COALESCE(SUM(allocated_salt_ton), 0) as allocated,
            COALESCE(SUM(used_salt_ton), 0) as used,
            COUNT(DISTINCT vehicle_id) as vehicles_used,
            COUNT(DISTINCT road_id) as roads_served
     FROM missions WHERE event_id = $1 AND status != 'cancelled'`,
    [event_id]
  ) : { rows: [{ allocated: 0, used: 0, vehicles_used: 0, roads_served: 0 }] };

  success(ctx, {
    events: events.rows,
    missions: missionsByStatus.rows,
    vehicles: vehiclesByStatus.rows,
    roads: roadsByStatus.rows,
    closures: closures.rows,
    inventory: inventory.rows,
    alerts: alertsSummary.rows[0],
    salt_usage: saltUsage.rows[0],
  });
};

export const getActivityTimeline = async (ctx) => {
  const { limit = 30 } = ctx.query;
  const result = await query(
    `WITH activities AS (
       SELECT 'mission' as type, mission_code as code, status as title,
              created_at, null as extra FROM missions
       UNION ALL
       SELECT 'event' as type, event_code as code, status as title,
              created_at, affected_areas as extra FROM snow_events
       UNION ALL
       SELECT 'closure' as type, closure_code as code,
              closure_type || ': ' || status as title, start_time as created_at,
              closure_reason as extra FROM road_closures
       UNION ALL
       SELECT 'alert' as type, alert_code as code,
              severity || ': ' || alert_type as title, created_at,
              title as extra FROM alerts
       UNION ALL
       SELECT 'salt' as type, trans_code as code, trans_type as title,
              created_at, ABS(quantity_ton)::text || '吨' as extra FROM salt_transactions
     )
     SELECT * FROM activities ORDER BY created_at DESC LIMIT $1`,
    [Number(limit)]
  );
  success(ctx, result.rows);
};

export const getMapData = async (ctx) => {
  const roads = await query(
    `SELECT r.*,
            (SELECT json_agg(
               json_build_object(
                 'mission_id', m.id,
                 'mission_code', m.mission_code,
                 'status', m.status,
                 'priority', m.priority,
                 'vehicle_id', m.vehicle_id,
                 'plate_number', v.plate_number,
                 'allocated_salt_ton', m.allocated_salt_ton
               )
             )
             FROM missions m
             LEFT JOIN vehicles v ON v.id = m.vehicle_id
             WHERE m.road_id = r.id AND m.status IN ('assigned', 'salt_loaded', 'in_progress')) as missions
     FROM roads r`
  );
  const closures = await query(
    `SELECT rc.*, r.road_name, r.road_code
     FROM road_closures rc
     JOIN roads r ON r.id = rc.road_id
     WHERE rc.status = 'active'`
  );
  const vehicles = await query(
    `SELECT v.*,
            (SELECT json_agg(
               json_build_object(
                 'mission_id', m.id,
                 'mission_code', m.mission_code,
                 'status', m.status,
                 'road_id', m.road_id,
                 'road_name', r.road_name
               )
             )
             FROM missions m
             LEFT JOIN roads r ON r.id = m.road_id
             WHERE m.vehicle_id = v.id AND m.status IN ('assigned', 'salt_loaded', 'in_progress')) as current_missions
     FROM vehicles v`
  );
  success(ctx, {
    roads: roads.rows,
    closures: closures.rows,
    vehicles: vehicles.rows,
  });
};

export const searchAll = async (ctx) => {
  const { q } = ctx.query;
  if (!q || q.length < 2) {
    return success(ctx, { roads: [], vehicles: [], events: [], missions: [] });
  }
  const searchTerm = `%${q}%`;
  const roads = await query(
    `SELECT id, road_code, road_name, road_level, status FROM roads
     WHERE road_code ILIKE $1 OR road_name ILIKE $1 LIMIT 10`,
    [searchTerm]
  );
  const vehicles = await query(
    `SELECT id, plate_number, vehicle_type, status FROM vehicles
     WHERE plate_number ILIKE $1 OR driver_name ILIKE $1 LIMIT 10`,
    [searchTerm]
  );
  const events = await query(
    `SELECT id, event_code, event_name, snow_level, status FROM snow_events
     WHERE event_code ILIKE $1 OR event_name ILIKE $1 LIMIT 10`,
    [searchTerm]
  );
  const missions = await query(
    `SELECT id, mission_code, status FROM missions
     WHERE mission_code ILIKE $1 LIMIT 10`,
    [searchTerm]
  );
  success(ctx, {
    roads: roads.rows,
    vehicles: vehicles.rows,
    events: events.rows,
    missions: missions.rows,
  });
};

export const getUsers = async (ctx) => {
  const result = await query(
    'SELECT id, username, role, full_name, phone, created_at FROM users ORDER BY username ASC'
  );
  success(ctx, result.rows);
};

export const login = async (ctx) => {
  const { username, password } = ctx.request.body;
  if (!username || !password) {
    return badRequest(ctx, '用户名和密码必填');
  }
  const result = await query(
    'SELECT id, username, role, full_name, phone FROM users WHERE username = $1 AND password = $2',
    [username, password]
  );
  if (result.rows.length === 0) {
    return badRequest(ctx, '用户名或密码错误');
  }
  success(ctx, result.rows[0], '登录成功');
};
