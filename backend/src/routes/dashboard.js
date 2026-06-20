import Router from 'koa-router';
import * as dashboard from '../controllers/dashboardController.js';

const router = new Router({ prefix: '/api' });

router.get('/dashboard', dashboard.getDashboardStats);
router.get('/timeline', dashboard.getActivityTimeline);
router.get('/map-data', dashboard.getMapData);
router.get('/search', dashboard.searchAll);
router.get('/users', dashboard.getUsers);
router.post('/login', dashboard.login);

export default router;
