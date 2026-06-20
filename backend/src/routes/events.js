import Router from 'koa-router';
import * as events from '../controllers/eventsController.js';

const router = new Router({ prefix: '/api/events' });

router.get('/', events.getEvents);
router.get('/stats/:id', events.getEventStats);
router.get('/:id', events.getEventById);
router.post('/', events.createEvent);
router.put('/:id', events.updateEvent);
router.delete('/:id', events.deleteEvent);

export default router;
