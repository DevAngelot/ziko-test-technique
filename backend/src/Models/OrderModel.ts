import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface Order {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: string;
  status: 'pending' | 'paid';
  paymentId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}
export type CreateOrder = Pick<Order, 'productId' | 'quantity'>;
const columns = `id, product_id AS "productId", quantity, unit_price AS "unitPrice",
  (quantity::bigint * unit_price)::text AS "totalPrice", status,
  payment_id AS "paymentId", paid_at AS "paidAt", created_at AS "createdAt"`;

export class OrderModel {
  async findAll(db: Pool): Promise<(Order & { productName: string })[]> {
    const result = await db.query<Order & { productName: string }>(
      `SELECT ${columns},
        (SELECT name FROM ziko.products WHERE products.id = orders.product_id) AS "productName"
       FROM ziko.orders ORDER BY created_at DESC, id DESC`,
    );
    return result.rows;
  }

  async create(
    db: PoolClient,
    input: CreateOrder,
    unitPrice: number,
  ): Promise<Order> {
    const result = await db.query<Order>(
      `INSERT INTO ziko.orders (id, product_id, quantity, unit_price)
      VALUES ($1,$2,$3,$4)
      RETURNING ${columns}`,
      [randomUUID(), input.productId, input.quantity, unitPrice],
    );

    return result.rows[0];
  }

  async findById(db: Pool, id: string): Promise<Order | undefined> {
    const result = await db.query<Order>(
      `SELECT ${columns}
      FROM ziko.orders
      WHERE id=$1`,
      [id],
    );

    return result.rows[0];
  }

  async findByIdForUpdate(
    db: PoolClient,
    id: string,
  ): Promise<Order | undefined> {
    const result = await db.query<Order>(
      `SELECT ${columns}
      FROM ziko.orders
      WHERE id=$1 FOR UPDATE`,
      [id],
    );

    return result.rows[0];
  }

  async markPaid(
    db: PoolClient,
    id: string,
    paymentId: string,
  ): Promise<Order> {
    const result = await db.query<Order>(
      `UPDATE ziko.orders SET status='paid', payment_id=$2, paid_at=now() WHERE id=$1 RETURNING ${columns}`,
      [id, paymentId],
    );

    return result.rows[0];
  }
}
