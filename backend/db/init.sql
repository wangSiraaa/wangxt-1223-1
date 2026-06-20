CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS salt_transactions CASCADE;
DROP TABLE IF EXISTS missions CASCADE;
DROP TABLE IF EXISTS road_closures CASCADE;
DROP TABLE IF EXISTS snow_events CASCADE;
DROP TABLE IF EXISTS salt_inventory CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS roads CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL DEFAULT '123456',
    role VARCHAR(20) NOT NULL CHECK (role IN ('commander', 'fleet_manager', 'warehouse_manager')),
    full_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    road_code VARCHAR(50) UNIQUE NOT NULL,
    road_name VARCHAR(200) NOT NULL,
    road_level VARCHAR(10) NOT NULL CHECK (road_level IN ('express', 'main', 'secondary', 'branch')),
    length_km NUMERIC(10,2) NOT NULL CHECK (length_km > 0),
    lanes INTEGER NOT NULL DEFAULT 2,
    salt_per_km NUMERIC(10,2) NOT NULL DEFAULT 0.5,
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    is_key_route BOOLEAN NOT NULL DEFAULT FALSE,
    start_point VARCHAR(200),
    end_point VARCHAR(200),
    geojson_feature JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'closed', 'processing', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    salt_capacity_ton NUMERIC(10,2) NOT NULL CHECK (salt_capacity_ton > 0),
    current_salt_ton NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (current_salt_ton >= 0),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'loading', 'working', 'returning', 'maintenance')),
    current_location VARCHAR(200),
    fleet_team VARCHAR(50),
    max_route_km NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_name VARCHAR(200) NOT NULL,
    address VARCHAR(500),
    manager_name VARCHAR(100),
    manager_phone VARCHAR(20),
    capacity_ton NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salt_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    salt_type VARCHAR(50) NOT NULL DEFAULT 'sodium_chloride',
    quantity_ton NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (quantity_ton >= 0),
    unit_price NUMERIC(12,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, salt_type)
);

CREATE TABLE snow_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_code VARCHAR(50) UNIQUE NOT NULL,
    event_name VARCHAR(200) NOT NULL,
    snow_level VARCHAR(20) NOT NULL CHECK (snow_level IN ('light', 'moderate', 'heavy', 'blizzard')),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    affected_areas TEXT,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'monitoring', 'completed', 'cancelled')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE road_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    closure_code VARCHAR(50) UNIQUE NOT NULL,
    road_id UUID NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    event_id UUID REFERENCES snow_events(id) ON DELETE SET NULL,
    closure_type VARCHAR(20) NOT NULL CHECK (closure_type IN ('police', 'weather', 'accident', 'construction')),
    closure_reason TEXT NOT NULL,
    closed_by VARCHAR(100),
    start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    detour_suggestion TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'lifted')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_code VARCHAR(50) UNIQUE NOT NULL,
    event_id UUID REFERENCES snow_events(id) ON DELETE SET NULL,
    road_id UUID NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES users(id),
    assigned_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    planned_start_time TIMESTAMP,
    actual_start_time TIMESTAMP,
    completion_time TIMESTAMP,
    allocated_salt_ton NUMERIC(10,2) NOT NULL CHECK (allocated_salt_ton > 0),
    used_salt_ton NUMERIC(10,2) NOT NULL DEFAULT 0,
    route_km NUMERIC(10,2),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'salt_loaded', 'in_progress', 'completed', 'cancelled', 'replan_required')),
    remarks TEXT,
    replan_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salt_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trans_code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
    trans_type VARCHAR(20) NOT NULL CHECK (trans_type IN ('inbound', 'outbound', 'adjust')),
    salt_type VARCHAR(50) NOT NULL DEFAULT 'sodium_chloride',
    quantity_ton NUMERIC(10,2) NOT NULL CHECK (quantity_ton <> 0),
    balance_after NUMERIC(10,2),
    operator_id UUID REFERENCES users(id),
    vehicle_id UUID REFERENCES vehicles(id),
    supplier VARCHAR(200),
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_code VARCHAR(50) UNIQUE NOT NULL,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('key_route_unassigned', 'salt_insufficient', 'road_closed', 'mission_delay', 'inventory_low')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_id UUID REFERENCES snow_events(id) ON DELETE SET NULL,
    road_id UUID REFERENCES roads(id) ON DELETE SET NULL,
    mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    related_data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roads_level ON roads(road_level);
CREATE INDEX idx_roads_key ON roads(is_key_route) WHERE is_key_route = TRUE;
CREATE INDEX idx_roads_status ON roads(status);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_events_status ON snow_events(status);
CREATE INDEX idx_closures_status ON road_closures(status);
CREATE INDEX idx_closures_road ON road_closures(road_id);
CREATE INDEX idx_missions_event ON missions(event_id);
CREATE INDEX idx_missions_road ON missions(road_id);
CREATE INDEX idx_missions_vehicle ON missions(vehicle_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_alerts_unread ON alerts(is_read, is_resolved);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_trans_warehouse ON salt_transactions(warehouse_id);
CREATE INDEX idx_trans_mission ON salt_transactions(mission_id);
CREATE INDEX idx_inventory_warehouse ON salt_inventory(warehouse_id);
