import type { FastifyInstance } from 'fastify';
import * as spotify from './spotify';
import * as game from './game';
import { hostCookieHeader, isHostRequest, isLoopback } from './net';

const PORT = Number(process.env.PORT ?? 5178);
// Registered once in the Spotify dashboard, exactly this — Spotify only permits HTTP
// for the literal loopback IP, and 'localhost' is explicitly disallowed.
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
// The UI can be Vite's dev server (:5173) or this server itself (prod) — Spotify
// always redirects to REDIRECT_URI, then this sends the browser on to wherever the
// UI actually lives.
const UI_ORIGIN = process.env.UI_ORIGIN ?? `http://127.0.0.1:${PORT}`;

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true }));

  // Only the host ever completes this — REDIRECT_URI is fixed to 127.0.0.1, so a
  // phone that opens this link gets sent back to itself and the flow just fails.
  app.get('/auth/login', async (_req, reply) => {
    reply.redirect(spotify.loginUrl(REDIRECT_URI));
  });

  app.get('/callback', async (req, reply) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    if (error || !code || !state) {
      reply.redirect(`${UI_ORIGIN}/host?error=${encodeURIComponent(error ?? 'login_failed')}`);
      return;
    }
    const result = await spotify.handleCallback(code, state);
    if (!result.ok) {
      reply.redirect(`${UI_ORIGIN}/host?error=${encodeURIComponent(result.message)}`);
      return;
    }
    reply.header('Set-Cookie', hostCookieHeader(result.sessionToken));
    reply.redirect(`${UI_ORIGIN}/host`);
  });

  app.get('/api/host/status', async () => ({ authed: spotify.isAuthed(), user: spotify.getHostUser() }));

  // Gated on both the host cookie AND a loopback source (net.isHostRequest) — a phone
  // on the LAN gets a 403, never a token, even if it somehow read the cookie.
  app.get('/api/host/token', async (req, reply) => {
    if (!isHostRequest(req)) {
      reply.code(403);
      return { error: 'Forbidden' };
    }
    try {
      return { accessToken: await spotify.getAccessToken() };
    } catch {
      reply.code(401);
      return { error: 'Not authenticated with Spotify' };
    }
  });

  // Runs on the host's token so the whole room can search without ever logging in
  // themselves. Guarded so a device on the LAN can't use it as a free token proxy.
  app.get('/api/search', async (req, reply) => {
    const { q, token } = req.query as { q?: string; token?: string };
    const authed = isLoopback(req.ip) || (!!token && game.isValidPlayerToken(token));
    if (!authed) {
      reply.code(403);
      return { error: 'Forbidden' };
    }
    if (!q || !q.trim()) return { tracks: [] };
    try {
      return { tracks: await spotify.search(q.trim().slice(0, 100)) };
    } catch {
      reply.code(502);
      return { error: 'Spotify search failed' };
    }
  });
}
