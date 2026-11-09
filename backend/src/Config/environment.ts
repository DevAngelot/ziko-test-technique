import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.enum(['true', 'false']).default('false'),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Afficher les noms des paramètres incorrects, jamais leurs valeurs.
  throw new Error(
    `Configuration invalide : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
  );
}
export const config = parsed.data;
