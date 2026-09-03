# SECURITY

The security model and the controls **actually in the code** — keep this in sync with
reality, not with aspiration. Rationale for trust-boundary choices belongs in
[DECISIONS.md](DECISIONS.md).

## Threat model

LAN-only, semi-trusted: the realistic "attacker" is a curious or competitive player on
the same home WiFi, not an internet adversary. The server binds `0.0.0.0` only when
`Start-Project.bat` sets `BIND_LAN=1`; a bare `npm run serve` stays loopback-only. Never
internet-exposed — there is no deployment target (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## Authentication & authorization

Only the **host** authenticates, via Spotify's Authorization Code + PKCE flow. The
source of truth for "is this the host" is **two things together**, both required
(`server/net.ts::isHostRequest`): an `HttpOnly; SameSite=Lax` `songsnitch_host` cookie
set at `/callback`, **and** the request originating from `127.0.0.1`. Neither alone is
trusted — a phone that somehow read the cookie still can't pass the loopback check.

Players have no account. A player's identity is a random 32-hex-char token
(`crypto.randomBytes(16)`), minted server-side at join and never client-supplied for
authentication — only echoed back for reconnect (`player:rejoin`).

## Security controls

| Layer | Mechanism | Notes |
| --- | --- | --- |
| Authentication | Spotify PKCE, host only | No client secret anywhere in this project — see Secrets below |
| Authorization | `HttpOnly` cookie + loopback source | Gates every `host:*` WS message and `/api/host/token` |
| CSRF | Not applicable | The only cookie-gated route is a side-effect-free `GET` |
| Rate limiting | None | Threat model doesn't call for it — see Known accepted gaps |
| Input validation | Name/colour/track/vote validated server-side in `server/game.ts` | Client-side checks are a UX affordance only |
| Output escaping | React's default JSX escaping | No `dangerouslySetInnerHTML` anywhere in this project |
| Transport | Plain HTTP over the LAN | Accepted — see Known accepted gaps |
| Payload limit | 64 KB Fastify `bodyLimit` | Every route is `GET` + query params; nothing needs more |
| PII in logs | None logged | Spotify tokens and player names never reach a `console.log` |

## Trust boundaries

- **Browser → server:** every WS message is revalidated server-side in `game.ts`,
  regardless of what the client claims (its own `phase`, its own `songsPerPlayer`, etc.).
- **Server → Spotify:** only the host's short-lived access token ever leaves the server
  process. `/api/host/token` and `/api/search`'s loopback path both require a loopback
  source; a phone gets a valid `/api/search` response only with a real player token for
  the *current* room.
- **Host browser ← Web Playback SDK:** the one accepted exception to "tokens stay
  server-side" — the SDK requires a bearer token inside the host tab; there is no
  server-side alternative. Bounded by: only the access token ever leaves the server
  (never the refresh token, which stays in `server/spotify.ts` alone); it reaches the
  tab only through the same cookie+loopback-gated `/api/host/token`; it's held in a
  closure in `src/spotify-player.ts`, never `localStorage`, never a URL, never logged.
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
- Never build a Spotify API call outside `server/spotify.ts`.

## Known accepted gaps

- **No HTTPS on the LAN.** Accepted because the thing that would have required it —
  per-player Spotify login — was cut for the same underlying reason: Spotify rejects
  private-LAN redirect URIs even over HTTPS (see ADR-001). Nothing else on the wire is
  sensitive enough to justify the mkcert/cert-install friction for a living-room game.
- **No rate limiting on `/api/search`.** It proxies the host's Spotify token, but is
  gated to loopback or a valid player token for the *current* room — a room only ever
  has as many valid tokens as players who joined it.
- **No CSRF protection.** No cookie-authenticated endpoint mutates state.
- **The room code is 4 characters from a 24-character alphabet** (`ABCDEFGHJKLMNPQRSTUVWXYZ`,
  no `I`/`O`) — guessable in principle by someone else on the same WiFi during the
  room's lifetime. The WiFi password is already the real access boundary for a LAN
  party game; this isn't hardened further.
