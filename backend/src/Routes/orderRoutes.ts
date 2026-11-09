import { Router } from 'express';
import type { OrderController } from '../Controllers/OrderController.js';

export function orderRoutes(controller: OrderController) {
  const router = Router();
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/:id/pay', controller.pay);
  return router;
}
