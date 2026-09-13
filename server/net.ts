// LAN/loopback network guard. This server intentionally binds 0.0.0.0 (phones must
// reach it), so this file is what makes that defensible: reject anything whose Host
// header isn't a private-LAN or loopback address, and gate host-only actions on the
// request actually originating from loopback.
import { networkInterfaces } from 'node:os';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as spotify from './spotify';

const HOST_COOKIE = 'songsnitch_host';

function stripPort(hostHeader: string): string {
  if (hostHeader.startsWith('[')) return hostHeader.slice(1, hostHeader.indexOf(']'));
  const lastColon = hostHeader.lastIndexOf(':');
  const isHostPort = lastColon > 0 && hostHeader.indexOf(':') === lastColon;
  return isHostPort ? hostHeader.slice(0, lastColon) : hostHeader;
}

export function isPrivateHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = stripPort(hostHeader);
  if (host === 'localhost' || host === '::1') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isLoopback(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

export function primaryLanUrl(port: number): string {
  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return `http://${addr.address}:${port}`;
    }
  }
  return `http://127.0.0.1:${port}`;
}

export function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export function hostCookieHeader(sessionToken: string): string {
  return `${HOST_COOKIE}=${sessionToken}; HttpOnly; SameSite=Lax; Path=/`;
}

// Both the host cookie AND a loopback source are required — a phone on the LAN can
// never pass this, even if it somehow learned the cookie value.
export function isHostRequest(req: FastifyRequest): boolean {
  const cookie = parseCookie(req.headers.cookie, HOST_COOKIE);
  return isLoopback(req.ip) && spotify.isHostSession(cookie);
}

export function registerGuard(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (!isPrivateHost(req.headers.host)) {
      reply.code(403).send({ error: 'Forbidden' });
      return reply;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        if (!isPrivateHost(new URL(origin).host)) {
          reply.code(403).send({ error: 'Forbidden' });
          return reply;
        }
      } catch {
        reply.code(403).send({ error: 'Forbidden' });
        return reply;
      }
    }
    const url = req.raw.url ?? '';
    // The host screen is a shared-room display and Spotify's own token endpoint —
    // physically unreachable from a phone, not just hidden.
    if ((url === '/host' || url.startsWith('/host/') || url === '/api/host/token') && !isLoopback(req.ip)) {
      reply.code(403).send({ error: 'Forbidden' });
      return reply;
    }
  });
}
