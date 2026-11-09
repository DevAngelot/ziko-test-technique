import { Router } from 'express';
import type { ProductController } from '../Controllers/ProductController.js';

export function productRoutes(controller: ProductController) {
  const router = Router();
  router.post('/', controller.create);
  router.get('/', controller.list);
  return router;
}
