import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

const base =
  process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const pause = Number(process.env.DEMO_PAUSE_MS ?? 0);
async function call(label: string, path: string, body?: object) {
  console.log(`\n${label}\n${body ? 'POST' : 'GET'} ${path}`);
  if (body) {
    console.log(JSON.stringify(body, null, 2));
  }
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  console.log(`HTTP ${response.status}`, JSON.stringify(data, null, 2));
  if (!response.ok) {
    throw new Error(`Échec de la démonstration : HTTP ${response.status}`);
  }
  if (pause > 0) {
    await setTimeout(pause);
  }
  return data;
}
const product = await call(
  '1. Créer un produit : 2 500 CDF, stock 10',
  '/products',
  {
    name: 'Café de Kinshasa',
    price: 2500,
    stock: 10,
  },
);
const order = await call('2. Commander deux unités', '/orders', {
  productId: product.id,
  quantity: 2,
});
const paymentId = `MM-${randomUUID()}`;
const first = await call('3. Payer la commande', `/orders/${order.id}/pay`, {
  paymentId,
});
const replay = await call(
  '4. Renvoyer exactement le même paiement',
  `/orders/${order.id}/pay`,
  {
    paymentId,
  },
);
assert.equal(first.replayed, false);
assert.equal(replay.replayed, true);
await call('5. Vérifier le statut payé', `/orders/${order.id}`);
const products = await call(
  '6. Vérifier le stock : 8, après les deux appels',
  '/products',
);
assert.equal(
  products.find((p: { id: string }) => p.id === product.id).stock,
  8,
);
console.log(
  '\nDémonstration réussie : le paiement répété n’a pas diminué le stock une seconde fois.',
);
