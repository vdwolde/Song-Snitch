// The only file in this project that knows a Spotify URL. Host-only Authorization
// Code + PKCE (no client secret exists anywhere in this project — see
// .claude/SECURITY.md), token refresh with rotation, catalog search, and playback.
import { createHash, randomBytes } from 'node:crypto';
import type { TrackInfo } from '../shared/types';
import { toTrackInfo, type SpotifyTrackLike } from '../shared/top-tracks';

// A function, not a top-level constant: ES module imports evaluate before index.ts's
// own top-level code (including its .env load) runs, so a constant read here would
// capture an empty string. Reading it lazily, at call time, is always after the env is loaded.
// Exported: the phone's own PKCE exchange (top-tracks mode, src/spotify-top-tracks.ts)
// needs the client id too — PKCE needs no client secret, so this was never sensitive.
export function clientId(): string {
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
let hostCountry: string | null = null; // the host's Spotify market, for playability checks
let hostSessionToken: string | null = null; // the songsnitch_host cookie value
let pending: PendingAuth | null = null;

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Stateless on purpose — unlike the host's single `pending` slot below, several phones
// can be mid-PKCE-flow at once in top-tracks mode (src/spotify-top-tracks.ts), so
// nothing here is stored server-side; the caller hands the verifier to the phone and
// this function forgets it immediately.
export function newPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// redirectUri now points at the shared GitHub Pages bounce page (public/callback.html,
// see ADR-005), not at this server directly — so `state` carries the return address
// (`returnTo`, e.g. this server's own `${UI_ORIGIN}/host`) the same way the player
// flow's does (src/spotify-top-tracks.ts), and the bounce page sends the browser back
// there with the code in a URL FRAGMENT. A fragment never reaches this server, so the
// login is completed client-side by HostApp.tsx posting {code, state} to
// /api/host/complete-login — see server/routes.ts.
export function loginUrl(redirectUri: string, returnTo: string): string {
  const { verifier, challenge } = newPkcePair();
  const nonce = base64url(randomBytes(12));
  pending = { verifier, state: nonce, redirectUri };
  const state = JSON.stringify({ r: returnTo, n: nonce });
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
  rawState: string,
): Promise<{ ok: true; sessionToken: string } | { ok: false; message: string }> {
  let nonce: string | undefined;
  try {
    nonce = (JSON.parse(rawState) as { n?: string }).n;
  } catch {
    // malformed state — nonce stays undefined, falls through to the mismatch check below
  }
  if (!pending || !nonce || pending.state !== nonce) {
    return { ok: false, message: 'Login attempt expired — try again.' };
  }
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
  const profile = (await me.json()) as { display_name: string | null; product: string; country: string };
  if (profile.product !== 'premium') {
    token = null;
    return { ok: false, message: 'Spotify Premium is required to host — this account is not Premium.' };
  }
  hostUser = profile.display_name ?? 'Host';
  hostCountry = profile.country ?? null;
  hostSessionToken = base64url(randomBytes(16));
  return { ok: true, sessionToken: hostSessionToken };
}

export function isHostSession(cookieToken: string | undefined): boolean {
  return hostSessionToken !== null && cookieToken === hostSessionToken;
}

export function getHostUser(): string | null {
  return hostUser;
}

// Top-tracks candidates carry the PLAYER's market, not the host's — but the host's
// device is what actually plays them (server/game.ts::armRound). Used to filter
// candidates down to what's playable in the host's market before submission.
export function getHostCountry(): string | null {
  return hostCountry;
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

// Uses the host's own user token rather than a client-credentials app token: it needs
// no client secret, carries the host's market so results are actually playable on the
// host's device, and reuses the one token manager instead of a second refresh path.
export async function search(q: string): Promise<TrackInfo[]> {
  const params = new URLSearchParams({ q, type: 'track', limit: '10' });
  const res = await spotifyFetch(`/search?${params}`);
  if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
  const data = (await res.json()) as { tracks: { items: (SpotifyTrackLike & { is_playable?: boolean })[] } };
  return data.tracks.items.filter((t) => t.is_playable !== false).map(toTrackInfo);
}

// Top-tracks candidates come from the PLAYER's own token/market (src/spotify-top-tracks.ts),
// so unlike search() above, is_playable there is never populated. Re-checks each
// candidate id against the HOST's market (whose device actually plays it) before a
// player's auto-imported songs are accepted — see server/game.ts::autoSubmit. On any
// failure this fails OPEN (assumes playable): a party game shouldn't hang on a
// transient Spotify blip, and a genuine 403 at playback still falls back to the host's
// existing Skip button.
export async function playableIds(ids: string[], market: string | null): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const params = new URLSearchParams({ ids: ids.join(',') });
  if (market) params.set('market', market);
  const res = await spotifyFetch(`/tracks?${params}`);
  if (!res.ok) return new Set(ids);
  const data = (await res.json()) as { tracks: ({ id: string; is_playable?: boolean } | null)[] };
  return new Set(
    data.tracks.filter((t): t is { id: string; is_playable?: boolean } => t !== null && t.is_playable !== false).map((t) => t.id),
  );
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
