import type { Pool } from 'pg';
import { ProductModel, type CreateProduct } from '../Models/ProductModel.js';

export class ProductService {
  private products = new ProductModel();
  constructor(private db: Pool) {}

  create(input: CreateProduct) {
    return this.products.create(this.db, input);
  }

  list() {
    return this.products.findAll(this.db);
  }
}
