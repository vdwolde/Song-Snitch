// The only file in this project that knows a Spotify URL. Host-only Authorization
// Code + PKCE (no client secret exists anywhere in this project — see
// .claude/SECURITY.md), token refresh with rotation, catalog search, and playback.
import { createHash, randomBytes } from 'node:crypto';
import type { TrackInfo } from '../shared/types';

// A function, not a top-level constant: ES module imports evaluate before index.ts's
// own top-level code (including its .env load) runs, so a constant read here would
// capture an empty string. Reading it lazily, at call time, is always after the env is loaded.
function clientId(): string {
  return process.env.SPOTIFY_CLIENT_ID ?? '';
}
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
// user-read-playback-state is deliberately NOT requested — the host tab reports state
// via the SDK, so the server never polls.
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state';

interface TokenRecord {
  access: string;
  refresh: string;
  expiresAt: number;
}
interface PendingAuth {
  verifier: string;
  state: string;
  redirectUri: string;
}

let token: TokenRecord | null = null; // in-memory only — never persisted, never logged
let hostUser: string | null = null;
let hostSessionToken: string | null = null; // the songsnitch_host cookie value
let pending: PendingAuth | null = null;

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function loginUrl(redirectUri: string): string {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = base64url(randomBytes(12));
  pending = { verifier, state, redirectUri };
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SCOPES,
  });
  return `${AUTH_URL}?${params}`;
}

export async function handleCallback(
  code: string,
  state: string,
): Promise<{ ok: true; sessionToken: string } | { ok: false; message: string }> {
  if (!pending || pending.state !== state) return { ok: false, message: 'Login attempt expired — try again.' };
  const { verifier, redirectUri } = pending;
  pending = null;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId(),
    code_verifier: verifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return { ok: false, message: `Spotify login failed (${res.status})` };
  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  token = { access: data.access_token, refresh: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 };

  const me = await spotifyFetch('/me');
  if (!me.ok) {
    token = null;
    return { ok: false, message: 'Could not read the Spotify profile.' };
  }
  const profile = (await me.json()) as { display_name: string | null; product: string };
  if (profile.product !== 'premium') {
    token = null;
    return { ok: false, message: 'Spotify Premium is required to host — this account is not Premium.' };
  }
  hostUser = profile.display_name ?? 'Host';
  hostSessionToken = base64url(randomBytes(16));
  return { ok: true, sessionToken: hostSessionToken };
}

export function isHostSession(cookieToken: string | undefined): boolean {
  return hostSessionToken !== null && cookieToken === hostSessionToken;
}

export function getHostUser(): string | null {
  return hostUser;
}

export function isAuthed(): boolean {
  return token !== null;
}

async function refresh(): Promise<void> {
  if (!token) throw new Error('not-authed');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: token.refresh,
    client_id: clientId(),
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    token = null;
    throw new Error(`Spotify token refresh failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  // Spotify rotates the refresh token on every PKCE refresh and doesn't always return
  // one — keep the previous one when it's absent, or the next refresh silently breaks.
  token = {
    access: data.access_token,
    refresh: data.refresh_token ?? token.refresh,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function getAccessToken(): Promise<string> {
  if (!token) throw new Error('not-authed');
  if (Date.now() > token.expiresAt - 60_000) await refresh();
  return token.access;
}

async function spotifyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${access}` },
  });
  if (res.status === 401) {
    await refresh();
    const retryAccess = await getAccessToken();
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${retryAccess}` },
    });
  }
  return res;
}

interface SpotifyApiTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  is_playable?: boolean;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

// Uses the host's own user token rather than a client-credentials app token: it needs
// no client secret, carries the host's market so results are actually playable on the
// host's device, and reuses the one token manager instead of a second refresh path.
export async function search(q: string): Promise<TrackInfo[]> {
  const params = new URLSearchParams({ q, type: 'track', limit: '12' });
  const res = await spotifyFetch(`/search?${params}`);
  if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
  const data = (await res.json()) as { tracks: { items: SpotifyApiTrack[] } };
  return data.tracks.items
    .filter((t) => t.is_playable !== false)
    .map((t) => ({
      id: t.id,
      uri: t.uri,
      name: t.name,
      artists: t.artists.map((a) => a.name).join(', '),
      albumArt: t.album.images[t.album.images.length - 1]?.url ?? null,
      durationMs: t.duration_ms,
    }));
}

export async function play(deviceId: string, uri: string, positionMs = 0): Promise<void> {
  const res = await spotifyFetch(`/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
  });
  if (!res.ok && res.status !== 204) throw new Error(`Spotify play failed (${res.status})`);
}

export async function pause(deviceId: string | null): Promise<void> {
  if (!deviceId) return;
  // Fire-and-forget from the caller's perspective: a reveal must never wait on Spotify.
  await spotifyFetch(`/me/player/pause?device_id=${deviceId}`, { method: 'PUT' }).catch(() => {});
}
