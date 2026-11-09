import express from 'express';
import type { Pool } from 'pg';
import { ApiError } from './Errors/ApiError.js';
import { errorHandler } from './Middlewares/errorHandler.js';
import { ProductController } from './Controllers/ProductController.js';
import { OrderController } from './Controllers/OrderController.js';
import { ProductService } from './Services/ProductService.js';
import { OrderService } from './Services/OrderService.js';
import { productRoutes } from './Routes/productRoutes.js';
import { orderRoutes } from './Routes/orderRoutes.js';

export function createApp(db: Pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.use(
    '/products',
    productRoutes(new ProductController(new ProductService(db))),
  );
  app.use('/orders', orderRoutes(new OrderController(new OrderService(db))));
  app.use((_req, _res, next) =>
    next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Route introuvable.')),
  );
  app.use(errorHandler);
  return app;
}
