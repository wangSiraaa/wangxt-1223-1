# 市政扫雪融冰调度系统 (Municipal Snow & Ice Dispatch System)

按**道路等级**、**车辆载盐量**和**交警封控**智能调度扫雪除冰作业。支持三大角色分工协作、业务规则引擎、预警机制与地图可视化调度。

## 🏗️ 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | **SvelteKit** (文件路由) + **Tailwind CSS** |
| 前端地图 | 静态 GeoJSON + 原生 SVG（无需额外依赖） |
| 后端 | **Koa 2** + koa-router + koa-bodyparser |
| 数据库 | **PostgreSQL** 14+ (pg 连接池) |
| ID | uuid (UUID v4) |

## 📁 目录结构

```
1223/
├── backend/                    # Koa 后端 (端口 3001)
│   ├── db/
│   │   ├── init.sql           # 10 张数据库表初始化
│   │   └── seed.sql           # 种子数据 (3 角色 + 12 道路 + 8 车辆 + 3 仓库 + 示例事件)
│   ├── src/
│   │   ├── controllers/        # 8 个 REST 控制器
│   │   ├── routes/            # 按模块拆分的路由
│   │   ├── services/
│   │   │   └── dispatchRules.js   # 核心调度业务规则引擎 ⭐
│   │   ├── utils/             # db / response / helpers
│   │   └── server.js          # Koa 入口
│   └── package.json
└── frontend/                   # SvelteKit 前端 (端口 5173)
    ├── static/geojson/        # 道路 / 点位 GeoJSON 地图数据
    ├── src/
    │   ├── routes/            # 文件式路由
    │   │   ├── dashboard/
    │   │   ├── events/        # 指挥中心-降雪事件
    │   │   ├── missions/      # 车队长-路线任务调度 ⭐
    │   │   ├── vehicles/
    │   │   ├── roads/
    │   │   ├── closures/      # 交警封控管理
    │   │   ├── warehouse/
    │   │   ├── inventory/     # 仓库管理员-融雪剂出入库
    │   │   ├── alerts/        # 预警中心
    │   │   └── map/           # 地图调度台
    │   ├── lib/
    │   │   ├── api/           # API 封装 + 标签映射
    │   │   ├── stores/        # Svelte 全局状态
    │   │   └── components/    # Sidebar / Header / Modal / Toast ...
    │   └── app.css            # 全局 Tailwind 样式
    └── package.json
```

## 🧑‍💼 角色与分工

| 角色 | 账号 (username) | 密码 | 职责 |
|---|---|---|---|
| 指挥中心 | `commander` | `123456` | 创建降雪事件、查看总览、处理预警 |
| 车队长 | `fleet` | `123456` | 分配路线任务、调度车辆、封控重规划 |
| 仓库管理员 | `warehouse` | `123456` | 登记融雪剂出入库、车辆装盐 |

## 🔑 核心业务规则（在 `dispatchRules.js` 实现）

```
1. 重点道路 ⭐ 未派车预警
   → 创建降雪事件后自动扫描，生成 key_route_unassigned 预警

2. 车辆载盐量约束
   requiredSalt = length_km × salt_per_km × (1 + (lanes - 2) × 0.1)
   → 若载盐量不足则禁止领取长路线任务

3. 交警封控路段联动
   → 创建封控后自动：
   · 将道路状态标为 closed
   · 该路上的已分配任务标为 replan_required
   · 生成 road_closed 预警
   · 车队长需重新规划路线

4. 出库事务一致性
   → 扣减库存 + 更新车辆载盐量 + 更新任务状态 包裹在事务中
   → 使用 FOR UPDATE 行级锁防止并发超卖
```

## 🚀 快速启动

### 第 1 步：初始化 PostgreSQL 数据库

```bash
# 创建数据库
createdb snow_dispatch -U postgres

# 建表 + 插入种子数据
cd backend
psql -U postgres -d snow_dispatch -f db/init.sql
psql -U postgres -d snow_dispatch -f db/seed.sql
```

> 如需修改数据库连接，编辑 `backend/src/utils/db.js` 中的连接配置（或设置环境变量 `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`）。

### 第 2 步：启动 Koa 后端 (端口 3001)

```bash
cd backend
npm install
npm run dev      # 开发模式，监听 3001
# 或
npm start        # 生产模式
```

健康检查：访问 http://localhost:3001/api/health

### 第 3 步：启动 SvelteKit 前端 (端口 5173)

```bash
cd frontend
npm install
npm run dev      # 开发模式，监听 5173
```

访问 http://localhost:5173 → 直接选择角色登录即可体验。

Vite 开发服务器已配置：将 `/api/**` 代理到 `http://localhost:3001`。

### 第 4 步：生产构建（可选）

```bash
# 前端
cd frontend && npm run build && npm run preview

# 后端（使用 pm2 守护）
npm i -g pm2
cd backend && pm2 start src/server.js --name snow-backend
```

## 🧭 功能导航

| 模块 | 路径 | 主要功能 |
|---|---|---|
| 调度总览 | `/` | 事件卡、统计、预警面板、道路进度、封控提示 |
| 降雪事件 | `/events` | 指挥中心：创建事件、设为当前事件 |
| 路线调度 | `/missions` | 车队长：分配任务、载盐量校验、封控检查、状态流转 |
| 车辆管理 | `/vehicles` | 车辆信息、载盐量进度条 |
| 道路管理 | `/roads` | 道路等级/优先级/重点路标识、作业车辆数 |
| 封控管理 | `/closures` | 交警封控登记、自动触发重规划 |
| 仓库管理 | `/warehouse` | 仓库、库存、流水三Tab |
| 物资出入库 | `/inventory` | 出入库登记、待装盐车辆一键装车 |
| 预警中心 | `/alerts` | 重点路未派车/盐不足/封控预警处理 |
| 地图调度 | `/map` | GeoJSON SVG 地图 + 路段颜色 + 车辆动态点位 |

## 🧠 API 快速参考

所有接口统一前缀 `/api`，响应格式：

```json
{ "code": 0, "message": "success", "data": { ... }, "timestamp": 1700000000000 }
```

| 模块 | 主要端点 |
|---|---|
| 登录 | `POST /auth/login` |
| Dashboard | `GET /dashboard/stats`、`GET /dashboard/map`、`GET /dashboard/activity`、`GET /dashboard/search` |
| 事件 | `GET/POST/PUT/DELETE /events`、`GET /events/:id/stats` |
| 道路 | `GET /roads`、`GET /roads/with-missions` |
| 车辆 | `GET/POST/PUT/DELETE /vehicles`、`POST /vehicles/:id/salt` |
| 任务 | `GET/POST/PUT/DELETE /missions`、`POST /missions/validate`、`POST /missions/:id/start`、`POST /missions/:id/complete` |
| 仓库 | `GET /warehouse/*`、`POST /warehouse/outbound`、`POST /warehouse/inbound` |
| 封控 | `GET/POST /closures`、`POST /closures/:id/lift` |
| 预警 | `GET /alerts`、`POST /alerts/check`、`POST /alerts/:id/read`、`POST /alerts/:id/resolve` |

## ✅ 快速自检清单

- [ ] PostgreSQL 运行中并已执行 init.sql + seed.sql
- [ ] 后端 `npm run dev` 启动后 `/api/health` 返回正常
- [ ] 前端 `npm run dev` 启动后 5173 可访问
- [ ] 登录页可点任一角色快速登录
- [ ] Dashboard 显示示例事件和统计数据
- [ ] Missions 页"新建任务"弹窗可实时看到封控/载盐量/里程校验

## 📝 扩展建议

- 将数据库密码改为环境变量读取
- 接入真实 Leaflet / Mapbox / 高德 API 替换静态 SVG 地图
- 加上 WebSocket 实时推送预警与状态变更
- 对接 OA / 审批流系统
- 根据实时天气 API 自动触发降雪事件
