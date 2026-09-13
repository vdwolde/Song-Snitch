import type { FastifyInstance } from 'fastify';
import * as spotify from './spotify';
import * as game from './game';
import { hostCookieHeader, isHostRequest, isLoopback } from './net';
import { PAGES_URL } from '../shared/types';

// Registered once in the Spotify dashboard, exactly this — the shared GitHub Pages
// bounce page, used by BOTH the host and top-tracks-mode players (see
// .claude/DECISIONS.md ADR-005). Spotify no longer redirects to this server directly
// at all: it can't (a LAN address isn't a valid redirect_uri), so this is a real HTTPS
// host the bounce page then forwards back down to whichever loopback/LAN address
// actually started the flow.
const REDIRECT_URI = `${PAGES_URL}/callback.html`;
// Where the bounce page sends the host's browser back to after Spotify — this server's
// own origin. The UI can be Vite's dev server (:5173) or this server itself (prod).
const UI_ORIGIN = process.env.UI_ORIGIN ?? `http://127.0.0.1:${Number(process.env.PORT ?? 5178)}`;

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => ({ ok: true }));

  // Only the host ever completes this — the bounce page validates the return address
  // is private/loopback before sending anyone back, so a phone that opens this link
  // gets nowhere useful.
  app.get('/auth/login', async (_req, reply) => {
    reply.redirect(spotify.loginUrl(REDIRECT_URI, `${UI_ORIGIN}/host`));
  });

  app.get('/api/host/status', async () => ({ authed: spotify.isAuthed(), user: spotify.getHostUser() }));

  // Completes the host's login. The bounce page returns the code+state in a URL
  // FRAGMENT (never reaches a server), so HostApp.tsx reads it client-side and POSTs it
  // here instead of Spotify ever redirecting straight to a GET route. Loopback-gated
  // like /api/host/token — this sets the host session cookie, so a phone on the LAN
  // must never be able to call it.
  app.post('/api/host/complete-login', async (req, reply) => {
    if (!isLoopback(req.ip)) {
      reply.code(403);
      return { error: 'Forbidden' };
    }
    const { code, state } = (req.body ?? {}) as { code?: string; state?: string };
    if (!code || !state) {
      reply.code(400);
      return { ok: false, message: 'Missing login data — try connecting again.' };
    }
    const result = await spotify.handleCallback(code, state);
    if (!result.ok) return result;
    reply.header('Set-Cookie', hostCookieHeader(result.sessionToken));
    return { ok: true };
  });

  // top-tracks mode: a player's own phone completes its own PKCE exchange (never the
  // server — see .claude/SECURITY.md), so it needs a fresh verifier/challenge pair.
  // Unauthenticated on purpose, like /api/host/status — a client id is not a secret in
  // PKCE, and this hands out no session or token of any kind.
  app.get('/api/pkce', async () => {
    const { verifier, challenge } = spotify.newPkcePair();
    return { clientId: spotify.clientId(), verifier, challenge };
  });

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
