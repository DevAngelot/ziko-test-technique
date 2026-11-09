import { createApp } from './app.js';
import { config } from './Config/environment.js';
import { pool } from './Config/database.js';

try {
  await pool.query('SELECT 1');
  const server = createApp(pool).listen(config.PORT, '0.0.0.0', () => {
    console.log(`API Ziko : http://localhost:${config.PORT}`);
  });
  server.on('error', async () => {
    console.error('Impossible de démarrer le serveur HTTP. Vérifier le port.');
    await pool.end();
    process.exitCode = 1;
  });
  const stop = () => {
    server.close(() => {
      void pool.end();
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch {
  console.error(
    'Connexion PostgreSQL impossible. Vérifier le fichier .env et le serveur PostgreSQL.',
  );
  await pool.end();
  process.exitCode = 1;
}
