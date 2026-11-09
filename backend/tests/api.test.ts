import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/Config/database.js';
import { migration } from '../src/Database/schema.js';

const server = createApp(pool).listen(0, '127.0.0.1');
let api: ReturnType<typeof request>;
const products: string[] = [];
before(async () => {
  if (!server.listening) {
    await once(server, 'listening');
  }
  api = request(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  await pool.query(migration);
});
after(async () => {
  try {
    // Ne supprimer que les données créées par cette exécution, jamais TRUNCATE.
    await pool.query(
      'DELETE FROM ziko.orders WHERE product_id = ANY($1::uuid[])',
      [products],
    );
    await pool.query('DELETE FROM ziko.products WHERE id = ANY($1::uuid[])', [
      products,
    ]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
async function product(stock = 10, price = 2500) {
  const response = await api
    .post('/products')
    .send({
      name: `Test ${randomUUID()}`,
      price,
      stock,
    })
    .expect(201);
  products.push(response.body.id);
  return response.body;
}
async function order(productId: string, quantity = 2) {
  return (
    await api
      .post('/orders')
      .send({
        productId,
        quantity,
      })
      .expect(201)
  ).body;
}
const pay = (id: string, paymentId: string) => {
  return api.post(`/orders/${id}/pay`).send({ paymentId });
};
async function stock(id: string) {
  return (await pool.query('SELECT stock FROM ziko.products WHERE id=$1', [id]))
    .rows[0].stock;
}

test('parcours complet, prix entier CDF, commande en attente puis payée et rejeu', async () => {
  const p = await product();
  assert.ok(
    (await api.get('/products').expect(200)).body.some(
      (x: { id: string }) => x.id === p.id,
    ),
  );
  const o = await order(p.id);
  assert.equal(o.status, 'pending');
  assert.equal(o.totalPrice, '5000');
  assert.equal(await stock(p.id), 10);
  const paymentId = randomUUID();
  const first = (await pay(o.id, paymentId).expect(200)).body;
  const replay = (await pay(o.id, paymentId).expect(200)).body;
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.order, first.order);
  assert.equal(await stock(p.id), 8);
  assert.equal(
    (await api.get(`/orders/${o.id}`).expect(200)).body.status,
    'paid',
  );
});

test('liste des commandes : produit, montants, statuts et ordre chronologique', async () => {
  const p = await product();
  const pending = await order(p.id, 1);
  const paid = await order(p.id, 2);
  const paymentId = randomUUID();
  await pay(paid.id, paymentId).expect(200);
  const list = (await api.get('/orders').expect(200)).body;
  const a = list.find((item: { id: string }) => item.id === pending.id);
  const b = list.find((item: { id: string }) => item.id === paid.id);
  assert.equal(a.status, 'pending');
  assert.equal(a.paymentId, null);
  assert.equal(a.productName, p.name);
  assert.equal(a.totalPrice, '2500');
  assert.equal(b.status, 'paid');
  assert.equal(b.paymentId, paymentId);
  assert.equal(b.totalPrice, '5000');
  assert.equal(b.quantity, 2);
  for (let i = 1; i < list.length; i++) {
    assert.ok(
      Date.parse(list[i - 1].createdAt) >= Date.parse(list[i].createdAt),
    );
  }
  const detail = (await api.get(`/orders/${paid.id}`).expect(200)).body;
  const { productName: _name, ...listedDetail } = b;
  assert.deepEqual(listedDetail, detail);
});

test('vingt paiements identiques simultanés : un seul changement', async () => {
  const p = await product();
  const o = await order(p.id);
  const id = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => pay(o.id, id)),
  );
  assert.ok(responses.every((r) => r.status === 200));
  assert.equal(responses.filter((r) => !r.body.replayed).length, 1);
  assert.equal(await stock(p.id), 8);
});

test('deux identifiants différents simultanés sur la même commande', async () => {
  const p = await product();
  const o = await order(p.id);
  const results = await Promise.all([
    pay(o.id, randomUUID()),
    pay(o.id, randomUUID()),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    results.find((r) => r.status === 409)?.body.error.code,
    'ORDER_ALREADY_PAID',
  );
  assert.equal(await stock(p.id), 8);
});

test('identifiant unique entre deux commandes et deux produits, même en concurrence', async () => {
  const p = await product();
  const q = await product();
  const a = await order(p.id);
  const b = await order(q.id);
  const id = randomUUID();
  const results = await Promise.all([pay(a.id, id), pay(b.id, id)]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    results.find((r) => r.status === 409)?.body.error.code,
    'PAYMENT_ID_ALREADY_USED',
  );
  assert.equal((await stock(p.id)) + (await stock(q.id)), 18);
  const loser = results[0].status === 409 ? a : b;
  assert.equal((await api.get(`/orders/${loser.id}`)).body.status, 'pending');
});

test('deux commandes concurrentes pour le dernier stock : une seule réussit', async () => {
  const p = await product(2);
  const a = await order(p.id);
  const b = await order(p.id);
  const ids = [randomUUID(), randomUUID()];
  const results = await Promise.all([pay(a.id, ids[0]), pay(b.id, ids[1])]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    results.find((r) => r.status === 409)?.body.error.code,
    'INSUFFICIENT_STOCK',
  );
  assert.equal(await stock(p.id), 0);
  const loserIndex = results[0].status === 409 ? 0 : 1;
  const loser = loserIndex === 0 ? a : b;
  const pending = (await api.get(`/orders/${loser.id}`)).body;
  assert.equal(pending.status, 'pending');
  assert.equal(pending.paymentId, null);
  assert.equal(pending.paidAt, null);
  // Le paiement échoué n'a pas consommé l'identifiant ; nouvelle tentative possible.
  await pool.query('UPDATE ziko.products SET stock=2 WHERE id=$1', [p.id]);
  await pay(loser.id, ids[loserIndex]).expect(200);
  assert.equal(await stock(p.id), 0);
});

test('stock insuffisant à la création : aucune commande ajoutée', async () => {
  const p = await product(0);
  const response = await api
    .post('/orders')
    .send({
      productId: p.id,
      quantity: 1,
    })
    .expect(409);
  assert.equal(response.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(
    (
      await pool.query('SELECT count(*) FROM ziko.orders WHERE product_id=$1', [
        p.id,
      ])
    ).rows[0].count,
    '0',
  );
});

test('validation : prix, stock, quantité, champs inconnus et JSON', async () => {
  for (const override of [
    { price: 1.5 },
    { price: -1 },
    { price: 0 },
    { price: '100' },
    { price: 2147483648 },
    { stock: -1 },
    { stock: 0.5 },
    { name: '  ' },
    { extra: true },
  ]) {
    await api
      .post('/products')
      .send({
        name: 'Produit',
        price: 100,
        stock: 3,
        ...override,
      })
      .expect(400);
  }
  for (const quantity of [0, -1, 1.5, '2', 2147483648]) {
    await api
      .post('/orders')
      .send({
        productId: randomUUID(),
        quantity,
      })
      .expect(400);
  }
  for (const paymentId of ['', ' ', 'a b', 42, 'x'.repeat(101)]) {
    await pay(randomUUID(), paymentId as string).expect(400);
  }
  await api
    .post('/products')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  await api
    .post('/products')
    .send({ name: 'x'.repeat(17000) })
    .expect(413);
  await api
    .post('/orders')
    .send({
      productId: 'invalid',
      quantity: 1,
    })
    .expect(400);
  await api.get('/orders/invalid').expect(400);
});

test('ressources inexistantes et route inconnue', async () => {
  assert.equal(
    (await api.get(`/orders/${randomUUID()}`).expect(404)).body.error.code,
    'ORDER_NOT_FOUND',
  );
  await pay(randomUUID(), randomUUID()).expect(404);
  assert.equal(
    (
      await api
        .post('/orders')
        .send({
          productId: randomUUID(),
          quantity: 1,
        })
        .expect(404)
    ).body.error.code,
    'PRODUCT_NOT_FOUND',
  );
  await api.get('/missing').expect(404);
  await api.get('/health').expect(200);
});

test('la base refuse directement un stock négatif et un statut incohérent', async () => {
  const p = await product();
  const o = await order(p.id);
  await assert.rejects(
    pool.query('UPDATE ziko.products SET stock=-1 WHERE id=$1', [p.id]),
    {
      code: '23514',
    },
  );
  await assert.rejects(
    pool.query("UPDATE ziko.orders SET status='paid' WHERE id=$1", [o.id]),
    {
      code: '23514',
    },
  );
});

test('montant total exact au-delà de la précision entière de JavaScript', async () => {
  const p = await product(2147483647, 2147483647);
  const o = await order(p.id, 2147483647);
  assert.equal(o.totalPrice, '4611686014132420609');
});
