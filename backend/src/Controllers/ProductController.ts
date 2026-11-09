import type { Request, Response } from 'express';
import type { ProductService } from '../Services/ProductService.js';
import { productInput } from '../Validators/requestSchemas.js';

export class ProductController {
  constructor(private service: ProductService) {}

  create = async (req: Request, res: Response) => {
    res
      .status(201)
      .json(await this.service.create(productInput.parse(req.body)));
  };
  list = async (_req: Request, res: Response) => {
    res.json(await this.service.list());
  };
}
