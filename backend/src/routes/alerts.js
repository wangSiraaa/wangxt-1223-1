import Router from 'koa-router';
import * as alerts from '../controllers/alertsController.js';

const router = new Router({ prefix: '/api/alerts' });

router.get('/', alerts.getAlerts);
router.get('/stats', alerts.getAlertStats);
router.post('/check', alerts.runAlertChecks);
router.get('/:id', alerts.getAlertById);
router.put('/:id/read', alerts.markAlertRead);
router.put('/read-all', alerts.markAllAlertsRead);
router.put('/:id/resolve', alerts.resolveAlert);

export default router;
