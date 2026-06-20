import Router from 'koa-router';
import * as warehouse from '../controllers/warehouseController.js';

const router = new Router({ prefix: '/api/warehouse' });

router.get('/warehouses', warehouse.getWarehouses);
router.get('/warehouses/:id', warehouse.getWarehouseById);
router.post('/warehouses', warehouse.createWarehouse);
router.get('/inventory', warehouse.getInventory);
router.get('/transactions', warehouse.getTransactions);
router.post('/outbound', warehouse.outboundSalt);
router.post('/inbound', warehouse.inboundSalt);

export default router;
