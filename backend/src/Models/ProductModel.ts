import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
}
export type CreateProduct = Pick<Product, 'name' | 'price' | 'stock'>;
const columns = 'id, name, price, stock, created_at AS "createdAt"';

// Modèle SQL avec pg, sans ORM. Le service fournit la connexion transactionnelle.
export class ProductModel {
  async create(db: Pool, input: CreateProduct): Promise<Product> {
    const result = await db.query<Product>(
      `INSERT INTO ziko.products (id, name, price, stock)
      VALUES ($1,$2,$3,$4)
      RETURNING ${columns}`,
      [randomUUID(), input.name, input.price, input.stock],
    );

    return result.rows[0];
  }

  async findAll(db: Pool): Promise<Product[]> {
    const result = await db.query<Product>(`SELECT ${columns}
      FROM ziko.products
      ORDER BY created_at, id`);

    return result.rows;
  }

  async findForOrder(db: PoolClient, id: string) {
    const result = await db.query<Pick<Product, 'price' | 'stock'>>(
      `SELECT price, stock
      FROM ziko.products
      WHERE id=$1 FOR SHARE`,
      [id],
    );

    return result.rows[0];
  }

  async decreaseStock(
    db: PoolClient,
    id: string,
    quantity: number,
  ): Promise<boolean> {
    const result = await db.query(
      `UPDATE ziko.products
      SET stock=stock-$2
      WHERE id=$1 AND stock >= $2
      RETURNING stock`,
      [id, quantity],
    );
    return result.rowCount === 1;
  }
}
