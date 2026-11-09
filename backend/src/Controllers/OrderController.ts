import type { Request, Response } from 'express';
import type { OrderService } from '../Services/OrderService.js';
import {
  idInput,
  orderInput,
  paymentInput,
} from '../Validators/requestSchemas.js';

export class OrderController {
  constructor(private service: OrderService) {}

  list = async (_req: Request, res: Response) => {
    res.json(await this.service.list());
  };

  create = async (req: Request, res: Response) => {
    const order = await this.service.create(orderInput.parse(req.body));
    res.status(201).location(`/orders/${order.id}`).json(order);
  };
  get = async (req: Request, res: Response) => {
    res.json(await this.service.get(idInput.parse(req.params.id)));
  };
  pay = async (req: Request, res: Response) => {
    const id = idInput.parse(req.params.id);
    const { paymentId } = paymentInput.parse(req.body);
    res.json(await this.service.pay(id, paymentId));
  };
}
