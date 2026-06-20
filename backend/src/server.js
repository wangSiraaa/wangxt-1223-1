import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import logger from 'koa-logger';
import eventsRouter from './routes/events.js';
import roadsRouter from './routes/roads.js';
import vehiclesRouter from './routes/vehicles.js';
import missionsRouter from './routes/missions.js';
import warehouseRouter from './routes/warehouse.js';
import closuresRouter from './routes/closures.js';
import alertsRouter from './routes/alerts.js';
import dashboardRouter from './routes/dashboard.js';
import { error } from './utils/response.js';

const app = new Koa();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(async (ctx, next) => {
  try {
    await next();
    if (ctx.status === 404 && !ctx.body) {
      error(ctx, 'API 接口不存在', 404, 404);
    }
  } catch (err) {
    console.error('[Server Error]', err);
    error(ctx, err.message || '服务器内部错误', err.code || 500, err.statusCode || 500);
  }
});

app.use(logger());
app.use(bodyParser({
  jsonLimit: '10mb',
}));

app.use(async (ctx, next) => {
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
  ctx.set('X-XSS-Protection', '1; mode=block');
  await next();
});

app.use(async (ctx, next) => {
  if (ctx.path === '/api/health' && ctx.method === 'GET') {
    ctx.body = {
      status: 'ok',
      service: 'snow-dispatch-backend',
      timestamp: new Date().toISOString(),
    };
    return;
  }
  await next();
});

app.use(dashboardRouter.routes()).use(dashboardRouter.allowedMethods());
app.use(eventsRouter.routes()).use(eventsRouter.allowedMethods());
app.use(roadsRouter.routes()).use(roadsRouter.allowedMethods());
app.use(vehiclesRouter.routes()).use(vehiclesRouter.allowedMethods());
app.use(missionsRouter.routes()).use(missionsRouter.allowedMethods());
app.use(warehouseRouter.routes()).use(warehouseRouter.allowedMethods());
app.use(closuresRouter.routes()).use(closuresRouter.allowedMethods());
app.use(alertsRouter.routes()).use(alertsRouter.allowedMethods());

app.listen(PORT, () => {
  console.log(`
  ======================================================
  市政扫雪融冰调度系统 - Koa 后端服务
  ======================================================
  服务地址: http://localhost:${PORT}
  健康检查: http://localhost:${PORT}/api/health
  启动时间: ${new Date().toLocaleString('zh-CN')}
  ======================================================
  `);
});

export default app;
