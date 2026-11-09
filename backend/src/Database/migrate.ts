import { pool } from '../Config/database.js';
import { migration } from './schema.js';

try {
  await pool.query(migration);
  console.log('Schéma Ziko prêt. Aucune donnée existante supprimée.');
} catch {
  console.error(
    'Migration impossible. Vérifier PostgreSQL et les droits de création de schéma.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
