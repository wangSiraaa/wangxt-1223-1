INSERT INTO users (username, role, full_name, phone) VALUES
('commander01', 'commander', '张伟（指挥中心主任）', '13800000001'),
('fleet01', 'fleet_manager', '李强（车队长）', '13800000002'),
('warehouse01', 'warehouse_manager', '王芳（仓库管理员）', '13800000003');

INSERT INTO roads (road_code, road_name, road_level, length_km, lanes, salt_per_km, priority, is_key_route, start_point, end_point, status) VALUES
('RD001', '城市快速路-东二环', 'express', 18.5, 8, 0.8, 1, true, '东二环南起点', '东二环北终点', 'normal'),
('RD002', '主干道-中山大道', 'main', 12.3, 6, 0.6, 1, true, '中山大道西', '中山大道东', 'normal'),
('RD003', '主干道-人民大街', 'main', 9.8, 6, 0.6, 2, true, '人民大街南', '人民大街北', 'normal'),
('RD004', '主干道-解放大道', 'main', 8.5, 4, 0.6, 2, false, '解放大道西', '解放大道东', 'normal'),
('RD005', '次干道-文化路', 'secondary', 5.2, 4, 0.4, 3, false, '文化路西', '文化路东', 'normal'),
('RD006', '次干道-学府路', 'secondary', 6.8, 4, 0.4, 3, false, '学府路南', '学府路北', 'normal'),
('RD007', '次干道-建设路', 'secondary', 4.5, 2, 0.4, 3, false, '建设路西', '建设路东', 'normal'),
('RD008', '城市快速路-西三环', 'express', 22.0, 8, 0.8, 1, true, '西三环南', '西三环北', 'normal'),
('RD009', '支路-幸福街', 'branch', 2.1, 2, 0.3, 4, false, '幸福街西口', '幸福街东口', 'normal'),
('RD010', '支路-安康路', 'branch', 1.8, 2, 0.3, 5, false, '安康路北', '安康路南', 'normal'),
('RD011', '主干道-环城北路', 'main', 15.0, 6, 0.6, 1, true, '环城北路西', '环城北路东', 'normal'),
('RD012', '次干道-和平路', 'secondary', 7.3, 4, 0.4, 3, false, '和平路南', '和平路北', 'normal');

INSERT INTO vehicles (plate_number, vehicle_type, salt_capacity_ton, current_salt_ton, driver_name, driver_phone, status, current_location, fleet_team, max_route_km) VALUES
('京A10001', '大型撒布车', 12.0, 0, '赵师傅', '13900000001', 'idle', '第一车队停车场', '第一车队', 40),
('京A10002', '大型撒布车', 12.0, 12.0, '钱师傅', '13900000002', 'idle', '第一车队停车场', '第一车队', 40),
('京A10003', '中型撒布车', 8.0, 8.0, '孙师傅', '13900000003', 'idle', '第一车队停车场', '第一车队', 25),
('京A20001', '大型撒布车', 12.0, 0, '周师傅', '13900000004', 'idle', '第二车队停车场', '第二车队', 40),
('京A20002', '中型撒布车', 8.0, 0, '吴师傅', '13900000005', 'idle', '第二车队停车场', '第二车队', 25),
('京A20003', '小型撒布车', 4.0, 4.0, '郑师傅', '13900000006', 'idle', '第二车队停车场', '第二车队', 15),
('京A30001', '铲雪车', 6.0, 0, '冯师傅', '13900000007', 'maintenance', '维修厂', '第三车队', 30),
('京A30002', '大型撒布车', 12.0, 6.0, '陈师傅', '13900000008', 'working', '东二环作业中', '第三车队', 40);

INSERT INTO warehouses (warehouse_code, warehouse_name, address, manager_name, manager_phone, capacity_ton) VALUES
('WH001', '城东融雪剂仓库', '城东区工业路88号', '王芳', '13800000011', 500),
('WH002', '城西融雪剂仓库', '城西区货运大道12号', '李明', '13800000012', 300),
('WH003', '城北应急仓库', '城北区应急中心院内', '张华', '13800000013', 200);

INSERT INTO salt_inventory (warehouse_id, salt_type, quantity_ton, unit_price) VALUES
((SELECT id FROM warehouses WHERE warehouse_code='WH001'), 'sodium_chloride', 280.5, 850.00),
((SELECT id FROM warehouses WHERE warehouse_code='WH001'), 'calcium_chloride', 45.0, 1200.00),
((SELECT id FROM warehouses WHERE warehouse_code='WH002'), 'sodium_chloride', 156.8, 850.00),
((SELECT id FROM warehouses WHERE warehouse_code='WH003'), 'sodium_chloride', 98.2, 850.00),
((SELECT id FROM warehouses WHERE warehouse_code='WH003'), 'mixed_salt', 30.0, 1000.00);

INSERT INTO snow_events (event_code, event_name, snow_level, start_time, affected_areas, description, status, created_by) VALUES
('EVT2026011501', '2026年1月15日全市中到大雪', 'heavy', '2026-01-15 06:00:00', '东城区、西城区、北城区', '气象预报全市将出现中到大雪，预计持续8小时，最低气温-8℃', 'active', (SELECT id FROM users WHERE username='commander01')),
('EVT2026011001', '2026年1月10日小雪天气', 'light', '2026-01-10 22:00:00', '全市范围', '局地小雪，累计降雪量1-3cm', 'completed', (SELECT id FROM users WHERE username='commander01'));

INSERT INTO road_closures (closure_code, road_id, event_id, closure_type, closure_reason, closed_by, detour_suggestion, status) VALUES
('CLS2026011501', (SELECT id FROM roads WHERE road_code='RD004'), (SELECT id FROM snow_events WHERE event_code='EVT2026011501'), 'police', '解放大道西段发生多车追尾事故，交警实施全段封控', '交警支队一大队', '建议绕行建设路或学府路', 'active'),
('CLS2026011502', (SELECT id FROM roads WHERE road_code='RD009'), (SELECT id FROM snow_events WHERE event_code='EVT2026011501'), 'weather', '幸福街道路结冰严重，存在重大安全隐患', '市政巡查组', '可绕行相邻安康路', 'active');
