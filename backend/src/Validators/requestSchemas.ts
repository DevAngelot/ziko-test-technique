import { z } from 'zod';

// PostgreSQL INTEGER : borne explicite ; aucun nombre décimal ou chaîne numérique.
const positiveInteger = z.number().int().min(1).max(2147483647);
export const productInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    price: positiveInteger,
    stock: z.number().int().min(0).max(2147483647),
  })
  .strict();
export const orderInput = z
  .object({
    productId: z.uuid(),
    quantity: positiveInteger,
  })
  .strict();
export const paymentInput = z
  .object({
    paymentId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();
export const idInput = z.uuid();
