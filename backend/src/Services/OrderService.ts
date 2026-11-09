import type { Pool } from 'pg';
import { ApiError } from '../Errors/ApiError.js';
import { OrderModel, type CreateOrder } from '../Models/OrderModel.js';
import { ProductModel } from '../Models/ProductModel.js';

export class OrderService {
  private orders = new OrderModel();
  private products = new ProductModel();
  constructor(private db: Pool) {}

  list() {
    return this.orders.findAll(this.db);
  }

  async create(input: CreateOrder) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const product = await this.products.findForOrder(client, input.productId);
      if (!product) {
        throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
      }
      if (product.stock < input.quantity) {
        throw new ApiError(
          409,
          'INSUFFICIENT_STOCK',
          'Stock insuffisant pour cette commande.',
        );
      }
      const order = await this.orders.create(client, input, product.price);
      await client.query('COMMIT');
      return order;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async get(id: string) {
    const order = await this.orders.findById(this.db, id);
    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
    }
    return order;
  }

  async pay(id: string, paymentId: string) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      // Le verrou sérialise les paiements d'une même commande.
      const order = await this.orders.findByIdForUpdate(client, id);
      if (!order) {
        throw new ApiError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
      }
      if (order.status === 'paid') {
        if (order.paymentId !== paymentId) {
          throw new ApiError(
            409,
            'ORDER_ALREADY_PAID',
            'Commande déjà payée avec un autre identifiant.',
          );
        }
        await client.query('COMMIT');
        return {
          order,
          replayed: true,
          message: 'Paiement déjà enregistré. Aucun nouveau décompte.',
        };
      }
      // UNIQUE protège aussi deux commandes distinctes utilisant le même paiement.
      const paid = await this.orders.markPaid(client, id, paymentId);
      const decreased = await this.products.decreaseStock(
        client,
        order.productId,
        order.quantity,
      );
      if (!decreased) {
        throw new ApiError(
          409,
          'INSUFFICIENT_STOCK',
          'Stock insuffisant au paiement. La commande reste en attente.',
        );
      }
      await client.query('COMMIT');
      return {
        order: paid,
        replayed: false,
        message: 'Paiement enregistré. Stock diminué une seule fois.',
      };
    } catch (error) {
      // Annule également le statut et l'identifiant si le stock manque.
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') {
        throw new ApiError(
          409,
          'PAYMENT_ID_ALREADY_USED',
          'Cet identifiant de paiement est déjà utilisé pour une autre commande.',
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
