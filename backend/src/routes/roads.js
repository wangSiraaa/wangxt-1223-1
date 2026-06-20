import Router from 'koa-router';
import * as roads from '../controllers/roadsController.js';

const router = new Router({ prefix: '/api/roads' });

router.get('/', roads.getRoads);
router.get('/with-missions', roads.getRoadsWithMissions);
router.get('/:id', roads.getRoadById);
router.post('/', roads.createRoad);
router.put('/:id', roads.updateRoad);
router.delete('/:id', roads.deleteRoad);

export default router;
