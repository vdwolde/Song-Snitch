// Characterization tests for the LAN/loopback guard in server/net.ts: the pure
// helpers, and the onRequest hook driven through Fastify's inject() so no port opens.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { hostCookieHeader, isLoopback, isPrivateHost, parseCookie, registerGuard } from './net';

test('isPrivateHost accepts loopback and RFC 1918 hosts, with or without a port', () => {
  for (const h of ['localhost', 'localhost:5178', '127.0.0.1:5178', '[::1]:5178', '::1', '10.1.2.3', '172.16.0.1', '172.31.255.255:80', '192.168.1.5:5178']) {
    assert.equal(isPrivateHost(h), true, h);
  }
});

test('isPrivateHost rejects public, malformed and missing hosts', () => {
  for (const h of [undefined, '', 'example.com', '8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', 'evil.127.0.0.1.nip.io']) {
    assert.equal(isPrivateHost(h), false, String(h));
  }
});

test('isLoopback knows the three loopback spellings only', () => {
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('::1'), true);
  assert.equal(isLoopback('::ffff:127.0.0.1'), true);
  assert.equal(isLoopback('127.0.0.2'), false);
  assert.equal(isLoopback('192.168.1.5'), false);
});

test('parseCookie finds a named cookie and decodes it', () => {
  assert.equal(parseCookie('a=1; songsnitch_host=x%20y; b=2', 'songsnitch_host'), 'x y');
  assert.equal(parseCookie('a=1; b=2', 'songsnitch_host'), undefined);
  assert.equal(parseCookie(undefined, 'songsnitch_host'), undefined);
  assert.equal(parseCookie('novalue; a=1', 'a'), '1');
});

test('hostCookieHeader is HttpOnly, SameSite=Lax, site-wide', () => {
  assert.equal(hostCookieHeader('tok'), 'songsnitch_host=tok; HttpOnly; SameSite=Lax; Path=/');
});

async function guarded() {
  const app = Fastify();
  registerGuard(app);
  app.get('/*', async () => ({ ok: true }));
  await app.ready();
  return app;
}

const LAN = { host: '192.168.1.5:5178' };
const PHONE = '192.168.1.20';

test('guard: a public Host or Origin header is refused', async () => {
  const app = await guarded();
  assert.equal((await app.inject({ url: '/', headers: { host: 'example.com' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/', headers: { ...LAN, origin: 'https://example.com' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/', headers: { ...LAN, origin: 'not a url' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/', headers: { ...LAN, origin: 'http://192.168.1.5:5178' } })).statusCode, 200);
});

test('guard: host screen and token endpoint are loopback-only', async () => {
  const app = await guarded();
  for (const url of ['/host', '/host/x', '/api/host/token']) {
    assert.equal((await app.inject({ url, headers: LAN, remoteAddress: PHONE })).statusCode, 403, url);
    assert.equal((await app.inject({ url, headers: LAN, remoteAddress: '127.0.0.1' })).statusCode, 200, url);
  }
  // A phone may reach the player screen and the rest of the API.
  assert.equal((await app.inject({ url: '/', headers: LAN, remoteAddress: PHONE })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/search', headers: LAN, remoteAddress: PHONE })).statusCode, 200);
});

test('guard: a query string does not get a phone past the loopback-only check', async () => {
  const app = await guarded();
  for (const url of ['/host?error=x', '/api/host/token?x=1']) {
    assert.equal((await app.inject({ url, headers: LAN, remoteAddress: PHONE })).statusCode, 403, url);
    assert.equal((await app.inject({ url, headers: LAN, remoteAddress: '127.0.0.1' })).statusCode, 200, url);
  }
});
