# API

Every route this project exposes — HTTP **and** the WebSocket protocol, which is where
almost all real traffic actually happens. Read this before adding or changing either;
add the row in the same change. For auth see [SECURITY.md](SECURITY.md).

## Response envelope

No single envelope — this isn't a CRUD/REST-shaped app. Every HTTP route returns a small
ad hoc JSON object (see the tables below); errors return `{ error: string }` with a
non-2xx status. The real API is the WebSocket protocol: every message is
`{ t: '<verb>', ... }`-tagged, and `ClientMsg`/`ServerMsg` in `shared/types.ts` are
exhaustive discriminated unions on `t`.

## Conventions

- Every HTTP route is `GET` — no request body, query params only.
- The origin/host guard (`server/net.ts::registerGuard`) runs before every HTTP and WS
  request; a request whose `Host` header isn't loopback or a private-LAN address never
  reaches a route handler at all.
- Errors never leak internals — a caught exception becomes a generic message and status.

## Page routes

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/host` | Host screen (shared display) | Loopback source only — a phone gets a 403 before the JS even loads |
| GET | `/` | Player screen | None |

`github-pages/callback.html` is a separate static page published to GitHub Pages (not
served by this server at all) — the Spotify OAuth bounce page for a top-tracks-mode
player's own login. See [DECISIONS.md](DECISIONS.md) ADR-006.

## HTTP API routes

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/api/health` | Liveness check; also the launcher's single-instance detector — don't change the response shape without updating `Start-Project.bat` | None |
| GET | `/auth/login` | Redirects to Spotify's consent screen (PKCE) | Self-limiting: the registered `redirect_uri` is fixed to `127.0.0.1`, so only a request that originated there can ever complete |
| GET | `/callback` | Spotify's OAuth redirect target — exchanges the code, verifies Premium, sets the host cookie | Must match the `redirect_uri` used to start the flow, exactly |
| GET | `/api/host/status` | `{ authed: boolean, user: string \| null }` | None |
| GET | `/api/host/token` | `{ accessToken: string }` — a short-lived Spotify token for the Web Playback SDK | Host cookie **and** loopback source, both required |
| GET | `/api/search?q=&token=` | `{ tracks: TrackInfo[] }` — Spotify catalog search, run on the host's token | Loopback, **or** a valid player token for the current room |
| GET | `/api/pkce` | `{ clientId, verifier, challenge }` — a fresh, stateless PKCE pair for a player's own Spotify login in `top-tracks` mode (see [DECISIONS.md](DECISIONS.md) ADR-004); the server never stores or uses this itself | None — a client id isn't a secret in PKCE, and this hands out no session or token |

## WebSocket protocol — `/ws`

Full state snapshots, not deltas — see `server/ws.ts`. On open, a connection has no role
until its first message; `host:*` messages are gated the same way as `/api/host/token`
(host cookie + loopback), enforced per-connection in `server/ws.ts::handle`.

### Client → server (`ClientMsg`)

| `t` | Sent by | Payload | Effect |
| --- | --- | --- | --- |
| `host:hello` | host | — | Replies with the current `host:state`, plus a pending `reveal` if one is in flight |
| `host:createRoom` | host | `{ songsPerPlayer, mode }` | Replaces the room wholesale; `mode` is `'manual'` or `'top-tracks'` |
| `host:deviceReady` | host | `{ deviceId }` | Records the Web Playback SDK device; resumes playback at the correct offset if reconnecting mid-round |
| `host:start` | host | — | Builds and shuffles rounds, starts round 0 |
| `host:skip` | host | — | Ends the current round with reason `skipped` |
| `host:trackEnded` | host | — | Reported by the SDK; debounced against the spurious post-`play()` signal |
| `host:next` | host | — | Advances out of `reveal`, or to `finished` after the last round |
| `player:join` | player | `{ code, name, colour }` | Validates uniqueness/capacity; on success, claims this connection as that player |
| `player:rejoin` | player | `{ code, token }` | Reattaches an existing player identity (from `sessionStorage`) to this connection |
| `player:submit` | player | `{ track }` | Lobby only; rejects past `songsPerPlayer` or a track already submitted room-wide |
| `player:unsubmit` | player | `{ trackId }` | Lobby only, your own submissions only; rejected in `top-tracks` mode — there's nothing to remove an auto-import FOR |
| `player:autoSubmit` | player | `{ candidates }` | `top-tracks` mode, lobby only — the player's own ordered Spotify top-tracks list (built client-side, see [DECISIONS.md](DECISIONS.md) ADR-004); the server takes the first `songsPerPlayer` that are playable in the host's market and not already submitted room-wide |
| `player:vote` | player | `{ guessId }` | `playing` only; first vote wins; can't vote for yourself or your own track's submitter |

### Server → client (`ServerMsg`)

| `t` | Sent to | Notes |
| --- | --- | --- |
| `error` | The one socket that triggered it | `{ code, message }` — `code` is one of `bad-room \| name-taken \| colour-taken \| room-full \| game-in-progress \| not-host \| not-premium \| spotify \| submit-rejected`. `bad-room` means the client's identity/session itself is invalid (the client clears it and returns to the join screen); every other code — including `submit-rejected` — means only that one action failed and the client stays exactly as it was. |
| `player:identity` | The joining socket only | `{ playerId, token }` — the only message that ever carries a player's token |
| `host:state` | Every host connection | `HostState` — no `submitterId` field exists on this type, ever, by construction |
| `player:state` | Each player, individually built | `PlayerState` — carries only that recipient's own submissions/vote |
| `reveal` | Every connection, identical payload | `Reveal` — the **only** type on the wire that carries `submitterId` |

## Health check

`GET /api/health` → `{ "ok": true }`. `Start-Project.bat` polls this exact shape to
detect an already-running instance before starting a second one — don't change it
without updating the launcher too.
