// Un schéma dédié évite de toucher aux éventuelles tables existantes de la base.
export const migration = `
CREATE SCHEMA IF NOT EXISTS ziko;

CREATE TABLE IF NOT EXISTS ziko.products (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL CHECK (length(trim(name)) > 0),
  price INTEGER NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ziko.orders (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES ziko.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payment_id VARCHAR(100) UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'pending' AND payment_id IS NULL AND paid_at IS NULL)
      OR (status = 'paid' AND payment_id IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS orders_product_id_idx ON ziko.orders(product_id);
`;
