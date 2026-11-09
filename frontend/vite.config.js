import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';

export default defineConfig(() => {
  const environmentFile = new URL('../backend/.env', import.meta.url);
  // Read only the API port. Do not import backend NODE_ENV into the Vite build.
  const port = existsSync(environmentFile)
    ? readFileSync(environmentFile, 'utf8').match(
        /^\s*PORT\s*=\s*["']?(\d+)/m,
      )?.[1] || '3000'
    : '3000';
  const proxy = {
    '/api': {
      target: `http://127.0.0.1:${port}`,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  };
  return {
    server: { port: 5173, strictPort: true, proxy },
    preview: { proxy },
  };
});
