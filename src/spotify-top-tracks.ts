// Phone-side of top-tracks mode: the player's OWN Spotify PKCE login, routed through
// the shared GitHub Pages bounce page (a phone on the LAN can't be a redirect_uri —
// see .claude/DECISIONS.md ADR-005), then a top-tracks fetch turned into a ranked
// submission list. The access token lives only in this module's memory — it is never
// sent to the server, never stored — see .claude/SECURITY.md.
import { PAGES_URL, type TrackInfo } from '../shared/types';
import { buildPool, orderByWeightedRandom, toTrackInfo, type RankedTracks, type SpotifyTrackLike, type TimeRange } from '../shared/top-tracks';
import { apiBase } from './net';

// The one redirect_uri registered in the Spotify dashboard, shared with the host's own
// login (server/routes.ts) — see .claude/DECISIONS.md ADR-005.
const REDIRECT_URI = `${PAGES_URL}/callback.html`;
const SESSION_KEY = 'songsnitch-pkce';
const RECENT_KEY_PREFIX = 'songsnitch-recent-';
const RECENT_LIMIT = 30;
const RANGES: TimeRange[] = ['short_term', 'medium_term', 'long_term'];

interface PendingAuth {
  verifier: string;
  nonce: string;
  clientId: string;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function saveSession(pending: PendingAuth): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(pending));
  } catch {
    // sessionStorage unavailable (private browsing) — verification below just fails cleanly
  }
}

function loadSession(): PendingAuth | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PendingAuth) : null;
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function recentKey(spotifyUserId: string): string {
  return `${RECENT_KEY_PREFIX}${spotifyUserId}`;
}

function loadRecentlyUsed(spotifyUserId: string): string[] {
  try {
    const raw = localStorage.getItem(recentKey(spotifyUserId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// Called once the server confirms what actually got submitted (not at import time) —
// see src/PlayerApp.tsx — so a player who bails out mid-import, or whose picks lose the
// room-wide duplicate race, doesn't get songs excluded from their NEXT game that never
// actually played in this one.
export function rememberSubmitted(spotifyUserId: string, trackIds: string[]): void {
  try {
    const prior = loadRecentlyUsed(spotifyUserId);
    const merged = [...prior, ...trackIds.filter((id) => !prior.includes(id))].slice(-RECENT_LIMIT);
    localStorage.setItem(recentKey(spotifyUserId), JSON.stringify(merged));
  } catch {
    // localStorage unavailable (private browsing) — variety just resets each game
  }
}

// True once Spotify has bounced back with a code (a #code=&state= fragment) — check
// this on load before deciding whether to show the "Connect Spotify" button.
export function hasAuthReturn(): boolean {
  return location.hash.includes('code=');
}

// Kicks off the flow — navigates the tab away, so nothing after the returned promise
// resolves actually runs on this page.
export async function startImport(): Promise<void> {
  const res = await fetch(`${apiBase()}/api/pkce`);
  if (!res.ok) throw new Error('Could not reach the server to start Spotify login.');
  const { clientId, verifier, challenge } = (await res.json()) as { clientId: string; verifier: string; challenge: string };
  const nonce = randomNonce();
  saveSession({ verifier, nonce, clientId });
  // origin + pathname, not just origin: the app lives under /Song-Snitch/, not at the
  // bare vdwolde.github.io root, so the bounce page needs the full path to send us back to.
  const state = JSON.stringify({ r: location.origin + location.pathname, n: nonce });
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: 'user-top-read',
  });
  location.href = `https://accounts.spotify.com/authorize?${params}`;
}

// Completes the flow after the bounce page sends the tab back: verifies the
// round-tripped nonce, exchanges the code, pulls top tracks across all three ranges,
// and returns them ordered by the variety picker with this account's recently-used
// tracks already excluded (see .claude/DOMAIN.md).
export async function completeImport(): Promise<{ candidates: TrackInfo[]; spotifyUserId: string }> {
  const hash = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname); // strip the code immediately — it's single-use
  const code = hash.get('code');
  const rawState = hash.get('state');
  const pending = loadSession();
  clearSession();
  if (!code || !rawState || !pending) throw new Error('Spotify login expired — try connecting again.');

  let state: { n: string };
  try {
    state = JSON.parse(rawState) as { n: string };
  } catch {
    throw new Error('Spotify login could not be verified — try again.');
  }
  if (state.n !== pending.nonce) throw new Error('Spotify login could not be verified — try again.');

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: pending.clientId,
      code_verifier: pending.verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error('Spotify login failed — try again.');
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!meRes.ok) throw new Error('Could not read your Spotify profile.');
  const me = (await meRes.json()) as { id: string };

  const ranked: RankedTracks[] = [];
  for (const range of RANGES) {
    const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${range}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) continue; // e.g. no listening history yet in this range (new account)
    const data = (await res.json()) as { items: SpotifyTrackLike[] };
    ranked.push({ range, tracks: data.items.map(toTrackInfo) });
  }

  const excludeIds = new Set(loadRecentlyUsed(me.id));
  const pool = buildPool(ranked, excludeIds);
  const candidates = orderByWeightedRandom(pool, Math.random).slice(0, 50);
  return { candidates, spotifyUserId: me.id };
}
