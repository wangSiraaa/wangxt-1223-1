import Router from 'koa-router';
import * as missions from '../controllers/missionsController.js';

const router = new Router({ prefix: '/api/missions' });

router.get('/', missions.getMissions);
router.post('/validate', missions.validateMission);
router.get('/:id', missions.getMissionById);
router.post('/', missions.createMission);
router.put('/:id', missions.updateMission);
router.put('/:id/cancel', missions.cancelMission);
router.put('/:id/start', missions.markMissionStarted);
router.put('/:id/complete', missions.markMissionCompleted);

export default router;
