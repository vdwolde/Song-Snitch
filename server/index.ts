import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import { ROOT } from './db';
import { registerRoutes } from './routes';

const PORT = Number(process.env.PORT ?? 5178);
// Single-user local tool: stay loopback-only unless a platform injects PORT.
const HOST = process.env.HOST ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1');

const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 });

await app.register(fastifyCompress, { global: true, encodings: ['br', 'gzip'] });
await registerRoutes(app);

// Serve the built SPA (production). In dev, Vite serves the frontend and proxies
// /api here, so dist/ may not exist yet.
const distDir = join(ROOT, 'dist');
if (existsSync(distDir)) {
  await app.register(fastifyStatic, {
    root: distDir,
    prefix: '/',
    setHeaders(reply, path) {
      if (path.endsWith('index.html')) {
        reply.header('Cache-Control', 'no-cache');
      } else if (path.replace(/\\/g, '/').includes('/assets/')) {
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url && req.raw.url.startsWith('/api')) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    reply.sendFile('index.html');
  });
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'win32'
      ? `cmd /c start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  import('node:child_process').then((cp) => cp.exec(cmd)).catch(() => {});
}

try {
  await app.listen({ port: PORT, host: HOST });
  const url = `http://localhost:${PORT}`;
  const mode = existsSync(distDir) ? '' : ' (API only — run the Vite dev server for the UI)';
  // eslint-disable-next-line no-console
  console.log(`\n  Song Snitch — ${url}${mode}\n`);
  if (process.env.OPEN_BROWSER === '1') openBrowser(url);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
