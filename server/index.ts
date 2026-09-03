import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import fastifyWebsocket from '@fastify/websocket';
import { registerRoutes } from './routes';
import { registerWs } from './ws';
import { primaryLanUrl, registerGuard } from './net';

try {
  process.loadEnvFile(); // reads .env if present; no error if it doesn't exist
} catch {
  // no .env file — fine, real deployments set env vars directly
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5178);
// Phones must reach this, so binding is a deliberate opt-in, not a PORT side effect —
// server/net.ts's origin guard (registered below) is what makes 0.0.0.0 defensible.
const HOST = process.env.BIND_LAN === '1' ? '0.0.0.0' : '127.0.0.1';

const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

registerGuard(app);
await app.register(fastifyCompress, { global: true, encodings: ['br', 'gzip'] });
await app.register(fastifyWebsocket);
await registerRoutes(app);
registerWs(app);

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
  const url = `http://127.0.0.1:${PORT}`;
  const mode = existsSync(distDir) ? '' : ' (API only — run the Vite dev server for the UI)';
  // eslint-disable-next-line no-console
  console.log(`\n  Song Snitch\n  Host screen : ${url}/host${mode}`);
  if (HOST === '0.0.0.0') {
    // eslint-disable-next-line no-console
    console.log(`  Players join: ${primaryLanUrl(PORT)}\n`);
  } else {
    // eslint-disable-next-line no-console
    console.log('');
  }
  if (process.env.OPEN_BROWSER === '1') openBrowser(`${url}/host`);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
