import pg from 'pg';
import { config } from './environment.js';

export const pool = new pg.Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  ssl: config.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
pool.on('error', () =>
  console.error('Connexion PostgreSQL inactive interrompue.'),
);
