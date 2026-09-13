# STACK

Technologies, conventions, and code patterns. Read this before writing or changing code.
For system structure see [ARCHITECTURE.md](ARCHITECTURE.md); for endpoints see
[API.md](API.md); for secrets see [SECURITY.md](SECURITY.md).

## Languages & runtime

TypeScript (ESM) across the whole stack — one language, no compile step for
development (`tsx` runs `.ts`/`.tsx` directly). Node `>=22.5` (pinned in
`package.json`'s `engines`, needed for `process.loadEnvFile()`). React 19, Vite 6 for
the client build.

## Dependencies

| Concern | Choice | Version |
| --- | --- | --- |
| HTTP server | `fastify` | `5.12.0` |
| Static file serving (built client) | `@fastify/static` | `10.1.3` |
| Response compression | `@fastify/compress` | `9.2.0` |
| WebSocket transport | `@fastify/websocket` | `11.3.0` — runs inside Fastify's own lifecycle, so the origin guard covers the upgrade for free |
| Room-join QR code | `qrcode` | `1.5.4` — the one real friction point in a LAN party game is typing an IP into eight phones |
| UI | `react` / `react-dom` | `19.2.8` |
| Dev server / build | `vite` + `@vitejs/plugin-react` | `6.0.11` / `4.3.4` |
| Run TypeScript directly | `tsx` | `4.23.12` |
| Concurrent dev processes | `concurrently` | `10.0.5` |
| Cross-platform env vars in scripts | `cross-env` | `10.1.0` |
| Spotify Web Playback SDK types | `@types/spotify-web-playback-sdk` (dev) | `0.1.19` — the SDK is a global injected by a `<script>` tag; without this, `window.Spotify` is `any` at the riskiest boundary |

Pin exact versions — no ranges. Commit the lockfile. Justify any new dependency in one
sentence in this table, in the same change that adds it.

**Not in the stack:** no database (game state is in-memory, see ADR-001), no ORM, no
router (the whole client "route" is `location.pathname.startsWith('/host')`, see
`src/main.tsx`), no state-management library (the server's next broadcast is the only
source of truth — see `.claude/DESIGN.md`), no CSS framework (`src/styles.css` is one
hand-written file), no test framework beyond Node's built-in `node:test`, no client
Spotify SDK dependency beyond the SDK's own script tag (`src/spotify-player.ts` loads
it directly — no npm wrapper package), no HTTP client library for the top-tracks
player-side Spotify calls either (`src/spotify-top-tracks.ts` uses plain `fetch`).

Package manager: **npm** — never yarn/pnpm in this project.

## Directory conventions

```text
shared/
  types.ts        The wire contract — types shared between server and client, dependency-free
  top-tracks.ts   Pure, RNG-injected top-tracks picker + the Spotify track -> TrackInfo mapper
server/
  net.ts          LAN/loopback guard, cookie parsing, primaryLanUrl(), playerJoinUrl()
  spotify.ts      The only SERVER file that knows a Spotify URL — PKCE auth, search, play/pause, playableIds
  game.ts         The one Room; every state transition; hostState()/playerState() view builders
  ws.ts           /ws route: socket<->identity registry, message dispatch, broadcast
  routes.ts       HTTP routes: health, auth, host login completion, search, pkce
  index.ts        Fastify bootstrap: env, bind, register everything, serve dist/
  game.test.ts    node:test over the pure state transitions
  top-tracks.test.ts  node:test over the picker in shared/top-tracks.ts
src/
  main.tsx        The whole router (host vs. player) + the attribution footer
  HostApp.tsx     Shared-screen display — one file, all phases
  PlayerApp.tsx   Phone screen — one file, all phases
  net.ts          useRoom() — WS connect/reconnect/send; apiBase()/wsHost() resolve the
                  game server's address from a ?server= param (see ADR-005)
  spotify-player.ts     Web Playback SDK singleton loader (host tab)
  spotify-top-tracks.ts A player's own Spotify PKCE login + top-tracks import (top-tracks mode only)
  styles.css      All styling; the 8 player-colour tokens live here (see .claude/DESIGN.md)
public/
  callback.html   The one shared Spotify OAuth bounce page — Vite copies this verbatim
                  into every build, so it publishes to GitHub Pages automatically; see
                  .claude/DECISIONS.md ADR-005
.github/workflows/
  ci.yml          typecheck + build on every push/PR
  pages.yml       Builds the client (npm run build:pages) and deploys dist-pages/ to
                  GitHub Pages on push to main — see ADR-005
```

No `config/` directory — the config-shaped constants (`DEFAULT_SONGS_PER_PLAYER`,
`PLAYER_COLOURS`, `PAGES_URL`) live in `shared/types.ts`, where both server and client
already need them.

## Naming conventions

- WebSocket message `t` values are `role:verb` (`host:createRoom`, `player:vote`) — the
  prefix is also the authorization boundary `server/ws.ts` checks against.
- A player's `id` is `'p_' + 4 random bytes as hex` (e.g. `p_a1b2c3d4`); a player's
  `token` is 16 random bytes as hex — never derived from anything client-supplied.
- Room codes are 4 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ` (no `I`/`O` — easy to read
  aloud and unambiguous over a noisy room).

## Import patterns

```ts
// server/*.ts
import type { FastifyInstance } from 'fastify';
import * as game from './game';
import type { TrackInfo } from '../shared/types';

// src/*.tsx
import { useCallback, useState } from 'react';
import type { HostState, ServerMsg } from '../shared/types';
import { useRoom } from './net';
```

## Code patterns

**Server → client state is built field-by-field, never spread.** This is the mechanism
that keeps the submitter hidden until a reveal — see `.claude/SECURITY.md`.

```ts
// server/game.ts — correct
export function playerState(playerId: string): PlayerState | null {
  const you = room?.players.get(playerId);
  if (!you) return null;
  return { code: room.code, phase: room.phase, you: { id: you.id, name: you.name, ... }, ... };
}

// NEVER do this — a Room/Player/Round object carries fields (tokens, submitterId) that
// must never reach a client:
// return { ...room, you };
```

**Every server mutation returns a `Result`, never throws, for anything caused by client
input:**

```ts
type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };
```

**A round only ever ends through one synchronous function** — see `server/game.ts::endRound`
and `.claude/ARCHITECTURE.md`'s concurrency model. Never call `room.phase = 'reveal'`
anywhere else.

## Commands

```text
npm run dev         # Vite on :5173 + Fastify on :5178, concurrently
npm run build       # vite build -> dist/ (base '/', served by the host's own server)
npm run build:pages # vite build --base=/Song-Snitch/ -> dist-pages/ (GitHub Pages deploy)
npm run serve       # tsx server/index.ts (serves the built dist/)
npm start           # build then serve
npm run typecheck   # tsc --noEmit — the real gate, run after every edit
npm test            # tsx --test server/*.test.ts (Node's built-in test runner)
```

Node may not be on PATH in a fresh shell:
`$env:Path = "$env:ProgramFiles\nodejs;" + $env:Path`

## Quality gates (required before merge)

1. `npm run typecheck` — must stay clean.
2. `npm test` — must stay green, including the differential leak-check in
   `server/game.test.ts` (see ADR-003).
3. `npm run build` succeeds.
4. `/code --commit` (config: [REVIEW.md](REVIEW.md)) — run only when the user asks for
   a review in that turn, never automatically after a change (see root
   `Development/CLAUDE.md` § Briefing an agent).

## Coding principles in practice

Concrete anti-pattern → fix examples of the four
[coding principles](../CLAUDE.md#coding-principles). The overcomplicated versions below are
not obviously wrong — they follow real design patterns. The problem is **timing**: they
add complexity before it is needed.

### 1. Think before coding — surface assumptions, don't invent them

For "add a feature to export user data", don't silently decide scope, destination, format,
and fields. List the open questions and propose the simplest concrete option first:
*"Scope — all users or a filtered subset (privacy)? Delivery — browser download,
background job, or an endpoint? Which fields (some are sensitive)? Simplest approach: a
paginated JSON endpoint — is that what you want?"* Same for "make the search faster":
name the interpretations (latency vs. throughput vs. perceived speed) and ask which one
matters, rather than optimizing all three.

### 2. Simplicity first — one function until the complexity is real

"Add a function to calculate discount" is one multiply, not an abstract `DiscountStrategy`
hierarchy with a config object and a calculator class. "Save user preferences" is one
statement, not a `PreferenceManager` with caching, validation, merging, and notifications
nobody asked for. Add caching when performance actually hurts; add validation when bad
data actually appears.

### 3. Surgical changes — change only the lines the task needs

Fixing "empty emails crash the validator" means fixing *that*. Not, in the same diff:
tightening unrelated email rules, adding a length check, rewriting comments, adding a
docstring, swapping quote style, or adding type hints. When adding logging to a function,
add the logging and match the file's existing style — don't reformat the body.

### 4. Goal-driven execution — verifiable steps, reproduce before you fix

Replace "I'll review and improve the code" with a plan whose steps each name a check:

```text
1. Failing test that pins the intended tie-break order  → verify: test fails for the right reason
2. Fix with a stable, explicit sort key                 → verify: test passes
3. Re-run the suite                                     → verify: no adjacent regression
```

### Anti-pattern summary

| Principle | Anti-pattern | Fix |
| --- | --- | --- |
| Think before coding | Silently assumes format, fields, scope | List assumptions, ask before coding |
| Simplicity first | Strategy pattern for one calculation | One function until complexity is real |
| Surgical changes | Reformats quotes / adds type hints while fixing a bug | Change only the lines that fix the issue |
| Goal-driven | "I'll review and improve the code" | "Failing test for X → make it pass → check no regression" |

**Key insight:** good code solves today's problem simply, not tomorrow's problem
prematurely. Simple versions are faster to write, easier to test, and can be refactored
*when* the complexity is genuinely needed.
