import Router from 'koa-router';
import * as vehicles from '../controllers/vehiclesController.js';

const router = new Router({ prefix: '/api/vehicles' });

router.get('/', vehicles.getVehicles);
router.get('/:id', vehicles.getVehicleById);
router.post('/', vehicles.createVehicle);
router.put('/:id', vehicles.updateVehicle);
router.patch('/:id/salt', vehicles.updateVehicleSalt);
router.delete('/:id', vehicles.deleteVehicle);

export default router;
