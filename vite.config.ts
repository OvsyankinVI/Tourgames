import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';

// Repository name taken from the existing origin. Change here for another repo.
const PAGES_BASE = '/Tourgames/';

// Local, sanitized snapshot is accessible only in dev, never copied into dist.
function localSnapshot(): Plugin {
  return {
    name: 'local-sanitized-snapshot',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== `${PAGES_BASE}__local/tournaments`) return next();
        try {
          const body = await readFile(new URL('./.local/tournaments.json', import.meta.url), 'utf8');
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end('{}');
        }
      });
    },
  };
}

export default defineConfig({ base: PAGES_BASE, plugins: [react(), localSnapshot()] });
