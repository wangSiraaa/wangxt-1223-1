import { query, transaction } from '../utils/db.js';
import { generateCode } from '../utils/helpers.js';

const execQuery = async (client, sql, params) => {
  if (client) {
    return await client.query(sql, params);
  }
  return await query(sql, params);
};

export const validateVehicleSaltCapacity = async (vehicleId, roadLengthKm, saltPerKm, lanes, client = null) => {
  const vehicleResult = await execQuery(
    client,
    'SELECT * FROM vehicles WHERE id = $1',
    [vehicleId]
  );
  if (vehicleResult.rows.length === 0) {
    return { valid: false, reason: '车辆不存在', required: 0, available: 0 };
  }
  const vehicle = vehicleResult.rows[0];
  const requiredSalt = Number(roadLengthKm) * Number(saltPerKm) * (1 + (Number(lanes) - 2) * 0.1);
  const availableSalt = Number(vehicle.current_salt_ton);
  if (availableSalt < requiredSalt) {
    return {
      valid: false,
      reason: `车辆当前载盐量不足：需${requiredSalt.toFixed(2)}吨，现有${availableSalt.toFixed(2)}吨`,
      required: requiredSalt,
      available: availableSalt,
      vehicle,
    };
  }
  return {
    valid: true,
    required: requiredSalt,
    available: availableSalt,
    vehicle,
  };
};

export const validateVehicleCanHandleRoute = async (vehicleId, roadLengthKm, client = null) => {
  const vehicleResult = await execQuery(
    client,
    'SELECT * FROM vehicles WHERE id = $1',
    [vehicleId]
  );
  if (vehicleResult.rows.length === 0) {
    return { valid: false, reason: '车辆不存在' };
  }
  const vehicle = vehicleResult.rows[0];
  if (vehicle.max_route_km && Number(roadLengthKm) > Number(vehicle.max_route_km)) {
    return {
      valid: false,
      reason: `路线里程${roadLengthKm}km超过车辆最大作业里程${vehicle.max_route_km}km`,
    };
  }
  return { valid: true };
};

export const checkRoadClosed = async (roadId, client = null) => {
  const closures = await execQuery(
    client,
    `SELECT rc.*, r.road_name, u.username as closed_by_name
     FROM road_closures rc
     JOIN roads r ON r.id = rc.road_id
     LEFT JOIN users u ON u.username = rc.closed_by
     WHERE rc.road_id = $1 AND rc.status = 'active'`,
    [roadId]
  );
  return closures.rows.length > 0
    ? { closed: true, closures: closures.rows }
    : { closed: false, closures: [] };
};

export const checkKeyRoutesUnassigned = async (eventId, client = null) => {
  const result = await execQuery(
    client,
    `SELECT r.*
     FROM roads r
     LEFT JOIN missions m ON m.road_id = r.id
       AND m.event_id = $1
       AND m.status NOT IN ('completed', 'cancelled')
     WHERE r.is_key_route = TRUE
       AND r.status != 'closed'
       AND (m.id IS NULL
        OR m.status = 'replan_required')
     GROUP BY r.id
     HAVING COUNT(m.id) FILTER (WHERE m.status IN ('assigned', 'salt_loaded', 'in_progress')) = 0
     ORDER BY r.priority ASC, r.road_level ASC`,
    [eventId]
  );
  return result.rows;
};

export const createAlert = async (client, alertData) => {
  const code = generateCode('ALT');
  const result = await client.query(
    `INSERT INTO alerts
     (alert_code, alert_type, severity, title, description, event_id, road_id, mission_id, vehicle_id, warehouse_id, related_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      code,
      alertData.alert_type,
      alertData.severity,
      alertData.title,
      alertData.description,
      alertData.event_id || null,
      alertData.road_id || null,
      alertData.mission_id || null,
      alertData.vehicle_id || null,
      alertData.warehouse_id || null,
      alertData.related_data || null,
    ]
  );
  return result.rows[0];
};

export const generateAlertsForEvent = async (eventId) => {
  return await transaction(async (client) => {
    const unassignedKeyRoutes = await checkKeyRoutesUnassigned(eventId, client);
    const createdAlerts = [];
    for (const road of unassignedKeyRoutes) {
      const alert = await createAlert(client, {
        alert_type: 'key_route_unassigned',
        severity: road.priority <= 1 ? 'critical' : 'warning',
        title: `重点道路未派车：${road.road_name}`,
        description: `道路: ${road.road_name} 为重点道路，当前降雪事件下尚未安排作业车辆，请尽快调度。优先级: ${road.priority}`,
        event_id: eventId,
        road_id: road.id,
        related_data: {
          road_code: road.road_code,
          road_level: road.road_level,
          length_km: road.length_km,
          priority: road.priority,
        },
      });
      createdAlerts.push(alert);
    }
    return createdAlerts;
  });
};

export const checkInventoryLow = async (client = null) => {
  const result = await execQuery(
    client,
    `SELECT w.id as warehouse_id, w.warehouse_name, i.salt_type, i.quantity_ton, w.capacity_ton,
     CASE WHEN w.capacity_ton IS NOT NULL AND i.quantity_ton / w.capacity_ton < 0.15 THEN TRUE
          WHEN i.quantity_ton < 20 THEN TRUE
          ELSE FALSE END as is_low
     FROM salt_inventory i
     JOIN warehouses w ON w.id = i.warehouse_id
     WHERE i.quantity_ton < 20
        OR (w.capacity_ton IS NOT NULL AND i.quantity_ton / w.capacity_ton < 0.15)`
  );
  return result.rows;
};

export const calculateRequiredSalt = (roadLengthKm, saltPerKm, lanes) => {
  const laneMultiplier = 1 + (Number(lanes) - 2) * 0.1;
  return Number(roadLengthKm) * Number(saltPerKm) * laneMultiplier;
};

export const replanMissionsOnRoadClosure = async (client, roadId, eventId, closureReason) => {
  const missions = await client.query(
    `SELECT m.*, r.road_name, v.plate_number
     FROM missions m
     JOIN roads r ON r.id = m.road_id
     JOIN vehicles v ON v.id = m.vehicle_id
     WHERE m.road_id = $1
       AND m.status IN ('assigned', 'salt_loaded')
       ${eventId ? 'AND m.event_id = $2' : ''}`,
    eventId ? [roadId, eventId] : [roadId]
  );

  const updatedMissions = [];
  for (const mission of missions.rows) {
    const updated = await client.query(
      `UPDATE missions
       SET status = 'replan_required',
           replan_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [`道路封控需重新规划：${closureReason || '交警封控'}`, mission.id]
    );
    updatedMissions.push(updated.rows[0]);

    await createAlert(client, {
      alert_type: 'road_closed',
      severity: 'critical',
      title: `道路封控：${mission.road_name}`,
      description: `任务[${mission.mission_code}] 因道路封控需重新规划。车辆：${mission.plate_number}。原因：${closureReason || '交警封控'}`,
      event_id: eventId || mission.event_id,
      mission_id: mission.id,
      road_id: roadId,
      vehicle_id: mission.vehicle_id,
    });
  }

  return updatedMissions;
};
