import Router from 'koa-router';
import * as closures from '../controllers/closuresController.js';

const router = new Router({ prefix: '/api/closures' });

router.get('/', closures.getClosures);
router.get('/impact/summary', closures.getImpactSummary);
router.get('/:id', closures.getClosureById);
router.post('/', closures.createClosure);
router.put('/:id', closures.updateClosure);
router.put('/:id/lift', closures.liftClosure);

export default router;
