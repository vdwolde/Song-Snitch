# SECURITY

The security model and the controls **actually in the code** — keep this in sync with
reality, not with aspiration. Rationale for trust-boundary choices belongs in
[DECISIONS.md](DECISIONS.md).

## Threat model

LAN-only, semi-trusted, for the actual game server: the realistic "attacker" is a
curious or competitive player on the same home WiFi, not an internet adversary. The
server binds `0.0.0.0` only when `Start-Project.bat` sets `BIND_LAN=1`; a bare
`npm run serve` stays loopback-only. The game server itself is never deployed anywhere
(see [ARCHITECTURE.md](ARCHITECTURE.md)).

The one thing that IS now internet-exposed is the static client shell (host/player
screens, the OAuth bounce page), published to GitHub Pages — see
[DECISIONS.md](DECISIONS.md) ADR-005. That's plain static HTML/JS/CSS with no server
logic and no secret embedded in it (the Spotify client id is not a secret under PKCE);
it changes nothing about the threat model above, since reaching the actual game still
requires being on the host's own WiFi to talk to the WebSocket.

## Authentication & authorization

The **host** authenticates via Spotify's Authorization Code + PKCE flow, completed at
`POST /api/host/complete-login` (loopback-gated, same-origin to the host's own server —
see [DECISIONS.md](DECISIONS.md) ADR-005 for why login now completes client-side
instead of a server-rendered `/callback` redirect). The source of truth for "is this
the host" is **two things together**, both required (`server/net.ts::isHostRequest`):
an `HttpOnly; SameSite=Lax` `songsnitch_host` cookie set there, **and** the request
originating from `127.0.0.1`. Neither alone is trusted — a phone that somehow read the
cookie still can't pass the loopback check.

Players have no account of Song Snitch's own. A player's identity is a random
32-hex-char token (`crypto.randomBytes(16)`), minted server-side at join and never
client-supplied for authentication — only echoed back for reconnect (`player:rejoin`).

In `top-tracks` mode only (see [DECISIONS.md](DECISIONS.md) ADR-004/ADR-005), a player
additionally authenticates **directly with Spotify, entirely client-side** —
`src/spotify-top-tracks.ts` completes its own PKCE exchange and calls the Spotify Web
API from the phone's browser. This is unrelated to Song Snitch's own player identity
above: the resulting Spotify access token never reaches `server/`, is used only to
build the ordered candidate list sent via `player:autoSubmit`, and is discarded once
that message is sent.

## Security controls

| Layer | Mechanism | Notes |
| --- | --- | --- |
| Authentication | Spotify PKCE, host only | No client secret anywhere in this project — see Secrets below |
| Authorization | `HttpOnly` cookie + loopback source | Gates every `host:*` WS message, `/api/host/token`, and `/api/host/complete-login` |
| CSRF | Not meaningfully exploitable | `/api/host/complete-login` is a side-effecting `POST`, but forging one buys an attacker nothing: it's loopback-gated (a remote site can't reach it at all), and a forged request without a genuine Spotify `code` matching the server's own pending PKCE state just gets "Login attempt expired" |
| Cross-origin access | Exact-origin allowlist | `server/net.ts::registerGuard` allows `https://vdwolde.github.io` (the published client, ADR-005) alongside private-LAN/loopback origins; the `Host` header must still be a private/loopback address regardless — the allowlist alone can't reach a LAN server it isn't already on the same network as. No cookie-gated route accepts this origin, so no `Access-Control-Allow-Credentials` is ever sent |
| Rate limiting | None | Threat model doesn't call for it — see Known accepted gaps |
| Input validation | Name/colour/track/vote validated server-side in `server/game.ts` | Client-side checks are a UX affordance only |
| Output escaping | React's default JSX escaping | No `dangerouslySetInnerHTML` anywhere in this project |
| Transport | Plain HTTP over the LAN | Accepted — see Known accepted gaps |
| Payload limit | 64 KB Fastify `bodyLimit` | Every route is `GET` + query params; nothing needs more |
| PII in logs | None logged | Spotify tokens and player names never reach a `console.log` |

## Trust boundaries

- **Browser → server:** every WS message is revalidated server-side in `game.ts`,
  regardless of what the client claims (its own `phase`, its own `songsPerPlayer`, etc.).
- **Public origin → LAN server:** the player client is now served from a public origin
  (GitHub Pages, ADR-005), a different one than the LAN server it must still reach for
  actual gameplay. `server/net.ts::registerGuard` allowlists exactly that one origin
  for the WS handshake and the unauthenticated `/api/search`/`/api/pkce` GETs — never
  for anything cookie-gated, and never loosening the separate `Host`-header check that
  requires the request's actual DESTINATION to be a private/loopback address regardless
  of where the page asking for it came from.
- **Server → Spotify:** only the host's short-lived access token ever leaves the server
  process. `/api/host/token` and `/api/search`'s loopback path both require a loopback
  source; a phone gets a valid `/api/search` response only with a real player token for
  the *current* room.
- **Host browser ← Web Playback SDK:** an accepted exception to "tokens stay
  server-side" — the SDK requires a bearer token inside the host tab; there is no
  server-side alternative. Bounded by: only the access token ever leaves the server
  (never the refresh token, which stays in `server/spotify.ts` alone); it reaches the
  tab only through the same cookie+loopback-gated `/api/host/token`; it's held in a
  closure in `src/spotify-player.ts`, never `localStorage`, never a URL, never logged.
- **Player browser ← Spotify, in `top-tracks` mode:** the second accepted exception,
  and a different shape — this token is never issued by `server/spotify.ts` at all.
  `src/spotify-top-tracks.ts` runs its own PKCE flow (via the stateless
  `GET /api/pkce` helper, which only ever hands out a fresh verifier/challenge — never a
  token) and talks to `accounts.spotify.com`/`api.spotify.com` directly from the phone.
  Bounded by: read-only scope (`user-top-read`); held in memory only, for the duration
  of one import; never sent to Song Snitch's own server, never `localStorage` (only the
  resulting track ids are, for the recently-used exclusion list), never logged. See
  [DECISIONS.md](DECISIONS.md) ADR-004.
- **The submitter → everyone else, before a reveal:** the hard constraint this codebase
  is built around. `submitterId` exists in exactly two type positions —
  `Round.submitterId` (server-internal, never exported) and `Reveal.submitterId`
  (`shared/types.ts`) — and `Reveal` is constructed in exactly one place,
  `server/game.ts::endRound`, the same function that flips `phase` to `'reveal'`.
  `hostState()`/`playerState()` build their wire objects field by field; **never spread
  (`...`) a `Room`, `Player`, or `Round` into a wire type** — that's the rule that keeps
  this true as the code changes. Verified by `server/game.test.ts`'s differential test
  (mutating the current round's `submitterId` must not change `hostState()`'s output at
  all) rather than a substring search — every player id is legitimately public via the
  roster, so a naive "does the id string appear anywhere" check is not a valid test here.

## Secrets

- `SPOTIFY_CLIENT_ID` only. PKCE needs no client secret at all — that's a stronger
  guarantee than handling one carefully, and it's why none exists in this project.
- Spotify's access/refresh tokens live in memory only (`server/spotify.ts`), never
  persisted to disk, never logged — a server restart requires the host to log in again.
- `.env` is gitignored; `.env.example` documents `SPOTIFY_CLIENT_ID` with a blank value.

## Rules for agents

- Enforce every gate **on the server**. A client-side check (a greyed-out colour swatch,
  a disabled Start button) is a UX affordance, not a boundary.
- Never spread a `Room`/`Player`/`Round` into a client-facing type — see Trust boundaries.
- Never log a Spotify token or a player's name/score at more than a length/existence check.
- Never build a Spotify API call from `server/` outside `server/spotify.ts`. A
  browser-side Spotify call is permitted only where the token itself must live in the
  browser — today that's `src/spotify-player.ts` (the Web Playback SDK) and
  `src/spotify-top-tracks.ts` (a player's own top-tracks import, top-tracks mode only).
  Don't add a third without a documented reason (see [DECISIONS.md](DECISIONS.md)).

## Known accepted gaps

- **No HTTPS on the LAN, in manual mode.** Accepted because per-player Spotify login —
  the thing that would have required it — was cut for `manual` mode: Spotify rejects
  private-LAN redirect URIs even over HTTPS (see ADR-001, ADR-002). Nothing else on the
  wire is sensitive enough to justify the mkcert/cert-install friction for a
  living-room game. `top-tracks` mode's player-Spotify traffic goes over real HTTPS,
  direct from the phone to Spotify (see ADR-004/ADR-005) — the LAN itself still carries
  no HTTPS, but the sensitive leg (the login) never crosses it in the first place. Same
  reasoning is why the host's own login stays same-origin/loopback rather than moving
  to GitHub Pages too — a `SameSite=None` cookie needed for cross-origin auth requires
  `Secure`, which requires HTTPS, which the LAN server doesn't have (ADR-005).
- **The GitHub Pages origin allowlist can't distinguish repos.** An `Origin` header
  never carries a path, so `https://vdwolde.github.io` is indistinguishable from any
  OTHER public repo this account also publishes to GitHub Pages — any of them could
  also reach a LAN Song Snitch server the same way Song Snitch's own client does.
  Accepted (ADR-005): the threat model is already "someone on the same WiFi," and nothing
  this grants isn't already reachable from that same network some other way.
- **No rate limiting on `/api/search`.** It proxies the host's Spotify token, but is
  gated to loopback or a valid player token for the *current* room — a room only ever
  has as many valid tokens as players who joined it.
- **No CSRF protection.** No cookie-authenticated endpoint mutates state.
- **The room code is 4 characters from a 24-character alphabet** (`ABCDEFGHJKLMNPQRSTUVWXYZ`,
  no `I`/`O`) — guessable in principle by someone else on the same WiFi during the
  room's lifetime. The WiFi password is already the real access boundary for a LAN
  party game; this isn't hardened further.
