# DECISIONS

Architecture Decision Records. Each entry captures a deliberate choice so agents don't
"fix" intentional design. **Newest first. Add a new record rather than editing history** —
if a decision is reversed, write the new ADR and mark the old one superseded.

Write one when a choice would be re-litigated later: a stack pick, a concurrency model, a
storage shape, an accepted trade-off, or anything you had to argue yourself out of.

---

## ADR-005 — Player client served from GitHub Pages; host+player OAuth unified onto one bounce page

- **Decision:** The built client (host and player screens) is now published to GitHub
  Pages at `https://vdwolde.github.io/Song-Snitch/` via `.github/workflows/pages.yml`
  (`npm run build:pages`, a `vite build --base=/Song-Snitch/` variant of the existing
  build, `outDir: dist-pages` so it never collides with the host's own local `dist/`).
  Players are expected to load the app from there instead of from the host's own
  Fastify server. The game SERVER (WebSocket, in-memory `Room`, Spotify playback) is
  unchanged — it still only ever runs on the host's own laptop; nothing about gameplay
  is deployed anywhere. **This partially supersedes ADR-004**: the bounce page moved
  from `vdwolde.com` (retired) to `public/callback.html`, published as part of this
  same Pages deploy (Vite copies `public/` into the build verbatim, so it needs no
  separate hand-upload).
  Additionally, the **host's own login is unified onto the same bounce page** —
  `http://127.0.0.1:5178/callback` is retired; there is now exactly ONE registered
  Spotify redirect URI (`https://vdwolde.github.io/Song-Snitch/callback.html`) for both
  the host and top-tracks-mode players, satisfying an explicit ask to stop referencing
  any localhost/loopback address in the Spotify dashboard at all.
- **Context:** GitHub Pages was already enabled for this repo but misconfigured
  ("legacy" branch-root mode, serving the raw, unbuilt `index.html` — which references
  `/src/main.tsx` directly, so the live page loaded but rendered nothing, since a
  browser can't execute raw TypeScript/JSX). Fixing that to serve a real build, given
  the domain was already public and reachable from any phone with internet, made
  hosting the actual player-facing app there worth doing, not just a landing page.
  Two hard technical walls shaped the design:
  1. **The player's browser and the game server are now different origins.** The
     WebSocket (`src/net.ts`) and any `/api/*` call (search, PKCE) can no longer assume
     same-origin. Fixed by a `?server=<bare LAN address>` query param on the join
     link — cached into `sessionStorage` on first load (mirroring how player identity
     already survives the top-tracks OAuth round trip) so an OAuth redirect stripping
     the URL doesn't lose it — read by `src/net.ts::apiBase()`/`wsHost()` to build
     absolute `http://`/`ws://` URLs instead of relative ones. `HostState.lanUrl`
     (a bare LAN address) became `HostState.joinUrl` (the full Pages link carrying that
     param) — `server/net.ts::playerJoinUrl` builds it, and it's what's shown/QR-encoded
     on the host screen. `server/net.ts::registerGuard`'s origin check — which
     previously rejected any non-private `Origin` outright, by design, to keep the LAN
     server unreachable from a public page — now allowlists exactly this one public
     origin (`https://vdwolde.github.io`) alongside the existing private-LAN/loopback
     allowance; the `Host` header check (is this request actually AIMED at a private
     address) is untouched, so the allowlist alone can't reach a LAN server that isn't
     already on the same network. The allowed origin also gets
     `Access-Control-Allow-Origin` on responses (with no `Access-Control-Allow-Credentials`
     — nothing cookie-gated accepts this origin, see point 2), since a browser needs
     that on the RESPONSE, not just permission to make the request.
  2. **Cookie-based auth cannot survive becoming cross-origin over plain HTTP.** The
     host's session cookie is `SameSite=Lax`, which browsers refuse to attach to a
     cross-site `fetch`/XHR at all (only a top-level navigation) — and the fix,
     `SameSite=None`, requires `Secure`, which requires HTTPS, which the LAN server
     doesn't have and — per ADR-002's own rejected alternatives — isn't worth adding
     (mkcert/cert-install friction for a living-room game). So the host's actual
     `/api/host/*` traffic (status, the SDK's own token, and now login completion)
     stays same-origin: the host still opens their OWN Fastify server's copy of the app
     (`Start-Project.bat` is UNCHANGED, still opens `http://127.0.0.1:5178/host`) —
     only the redirect_uri Spotify itself bounces through moved, not where the host's
     browser tab lives day-to-day. The unification is achieved a different way: since
     Spotify sends the browser to `public/callback.html` for EITHER flow, and that page
     already validates + forwards to whatever origin/path started the flow (a private
     LAN/loopback address, or now also its own exact origin, since players can safely
     be sent back to themselves), the SAME bounce mechanism serves both. Only the
     *destination* differs: the host's `returnTo` is `${UI_ORIGIN}/host` (loopback), a
     player's is `location.origin + location.pathname` (the Pages URL, same-origin to
     the bounce page). The code+state land in a URL **fragment**, invisible to any
     server; `HostApp.tsx` now reads it client-side (same pattern
     `src/spotify-top-tracks.ts` already used for players) and POSTs it to a new
     `POST /api/host/complete-login` (loopback-gated like `/api/host/token`) — same-origin
     to whichever server served that page, so `SameSite=Lax` works exactly as before.
     The old `GET /callback` route is gone; `spotify.loginUrl`/`handleCallback` now
     embed/parse a `{r, n}` JSON `state` (matching the player flow's shape) instead of
     a bare nonce, so the bounce page can read `.r` regardless of which flow it's
     serving.
- **Consequence:** The player-facing app now loads from a public CDN instead of the
  LAN, which is faster/more reliable to reach and removes any need to know a domain at
  all beyond scanning the host's QR code — but real GAMEPLAY reachability is unchanged:
  a player still needs to be on the host's own WiFi, because the WebSocket still only
  ever connects to the host's own LAN-bound Fastify server. The pre-existing fallback
  of opening the host's own LAN address directly (no `?server=` param, so `apiBase()`/
  `wsHost()` fall back to same-origin) still works unmodified — useful if a phone has no
  internet to reach GitHub Pages but IS on the party's WiFi. One precision gap in the
  origin allowlist: `Origin` never carries a path, so `https://vdwolde.github.io` is
  allowed regardless of *which* repo's Pages site made the request — any other public
  repo this GitHub account hosts on Pages could also reach a LAN Song Snitch server.
  Accepted: the threat model is already "a curious/competitive player on the same
  WiFi," not an internet adversary (see SECURITY.md), and this doesn't grant access to
  anything the Host-header check wasn't already going to allow from that same network.
- **Rejected:** Keeping the client served only by the host's own Fastify server and
  using GitHub Pages purely for the OAuth bounce page (smaller, avoids the whole
  cross-origin/CORS/allowlist surface area entirely) — the simpler option, explicitly
  turned down in favor of actually fixing the broken live Pages deployment. Serving the
  HOST's screen from GitHub Pages too, with a bearer-token auth model replacing the
  session cookie (removes the SameSite wall by design) — rejected as a bigger,
  separately-warranted security redesign (trading an `HttpOnly` cookie, invisible to
  JS, for a token JS must hold) not asked for here. Adding HTTPS to the LAN server
  (mkcert) so `SameSite=None` could just work cross-origin — same friction ADR-002
  already rejected once, still not worth it for a living-room game.

## ADR-004 — Top-tracks mode: players log into Spotify after all, via a static bounce page

> **Partially superseded by [ADR-005](#adr-005--player-client-served-from-github-pages-hostplayer-oauth-unified-onto-one-bounce-page).**
> The bounce page moved from `vdwolde.com` to `public/callback.html` (published via
> GitHub Pages), and the host's login now shares it too — `http://127.0.0.1:5178/callback`
> no longer exists. The core decision below — that top-tracks mode requires player
> login, and how the bounce-and-forward mechanism works — still stands.

- **Decision:** A second room mode, `top-tracks` (`shared/types.ts::RoomMode`), lets
  each player connect their OWN Spotify account so their most-played tracks are
  auto-submitted instead of hand-picked. This **supersedes ADR-002**'s "players never
  log into Spotify" for this mode only — manual mode is untouched and stays the
  default. OAuth routes through a static page at `https://vdwolde.com/snitch.html`
  (kept in this repo at `public-callback/snitch.html`, deployed by hand — it has no
  build step and isn't part of `npm run build`), registered as a second Spotify
  redirect URI alongside the host's existing loopback one. Spotify redirects there
  (a real HTTPS host it will accept); the page validates the return address against a
  private-LAN/loopback allowlist (mirroring `server/net.ts::isPrivateHost`, to avoid
  being an open redirector on a real personal domain) and hands the phone a
  user-clickable link back to itself with the code in the URL **fragment**, never the
  query string, so it can't reach a server log.
- **Context:** The original request asked for each player's own listening history,
  which is structurally impossible without each player authenticating — ADR-002's
  constraint (Spotify rejects a LAN IP as a redirect URI) hasn't changed, but a static
  page on a domain already owned works around it without needing a public tunnel or a
  cert on the LAN itself. Two more constraints surfaced during implementation:
  `crypto.subtle` (needed for the PKCE S256 challenge) is unavailable outside a secure
  context, and a plain-HTTP LAN page isn't one — so the verifier/challenge pair is still
  generated server-side (`server/spotify.ts::newPkcePair`, exposed statelessly via
  `GET /api/pkce`, since several phones can be mid-flow at once unlike the host's single
  `pending` slot) even though the token EXCHANGE itself now happens entirely on the
  phone. Separately, `/v1/me/top/tracks` returns tracks in the *player's* Spotify
  market, not the host's — but the host's device is what actually plays them — so
  `server/spotify.ts::playableIds` re-checks every candidate against the **host's**
  market before it's accepted (`server/game.ts::autoSubmit`); skipping this would let a
  friend on a foreign account submit a track that 403s at playback and silently hangs
  the round (`armRound`'s catch swallows playback failures by design).
- **Consequence:** Top-tracks mode needs internet on every phone (vdwolde.com +
  Spotify) — "LAN-only party game" no longer holds for this mode specifically, which is
  why manual mode stays the default at room creation. The player's Spotify access token
  lives only in the phone's own memory (`src/spotify-top-tracks.ts`) — never sent to the
  server, never persisted — the second accepted exception (after the host's Web
  Playback SDK token) to "tokens stay server-side," bounded the same way: the token
  never leaves the browser process that holds it, and the scope requested
  (`user-top-read`) is read-only. Repeat games avoid repeating the same songs via a
  weighted-random picker (`shared/top-tracks.ts`) that excludes a rolling recently-used
  list kept in the phone's `localStorage`, keyed by Spotify user id — which means that
  list resets if the host's LAN IP changes (a new DHCP lease, or running `npm run dev`
  instead of `npm start`) since nothing else identifies "the same game server" to the
  phone. A low-history or heavily-excluded account can come up short of
  `songsPerPlayer`; rather than leaving the room unstartable, the player falls back to
  the pre-existing manual search UI for the remainder.
- **Rejected:** Routing every player's login through the host's own laptop (no new
  infrastructure, but means guests type their Spotify password on someone else's
  device, passed hand-to-hand around the room). A copy-paste flow (redirect to the
  host's loopback address, let the browser fail to load it, have the player copy the
  broken URL back into Song Snitch by hand) — works with zero infrastructure but is a
  visibly broken-looking step repeated once per player. Doing the PKCE crypto in the
  bounce page instead of server-side — would have let the phone skip a round trip to
  `/api/pkce`, but moves security-relevant code outside this repo's `typecheck`/`test`
  coverage and into a second deploy target, for a small saving.

## ADR-003 — `HostState`'s round readiness is a count, never a per-player list

- **Decision:** `HostState.round` carries `votedCount`/`expectedVoters` (two numbers),
  never a list of which specific players have voted or are "ready."
- **Context:** The original design seeded a `readyPlayerIds: string[]` field with the
  current round's submitter (so their avatar showed "ready" without ever voting,
  preventing the room from spotting them as the one avatar that never ticks). This
  shipped, and `server/game.test.ts`'s leak-check caught it immediately: at round start,
  before anyone can have voted, that array contains *only* the submitter's id — a direct
  identification, not the "nothing inferable" the code comment claimed. Worse, the
  underlying approach is unfixable: the round can only end once every non-submitter has
  voted, so **any** per-player readiness set converges to naming the one who didn't, by
  construction, regardless of how it's seeded.
- **Consequence:** The host screen shows "3/4 voted" instead of per-avatar ready ticks —
  a small UX downgrade. In exchange, the property is provably true rather than merely
  intended: `server/game.test.ts` diffs `hostState()` before and after mutating the
  current round's `submitterId`, proving the shared screen's output cannot depend on who
  submitted the track. `PlayerState` never had this problem — it already used
  `votedCount`/`expectedVoters` from the start.
- **Rejected:** Per-player ready list with the submitter excluded until they'd normally
  vote (this is the *original* problem — they'd be the last id to never tick, revealed
  by elimination the moment the round ends). Per-player ready list seeded at round start
  (this ADR's bug — revealed immediately instead of at the end). Delaying the
  submitter's "ready" tick to a random point mid-round (adds real complexity to disguise
  a signal that a pure count removes for free).

## ADR-002 — Only the host authenticates with Spotify; players search through the host's token

> **Superseded by [ADR-004](#adr-004--top-tracks-mode-players-log-into-spotify-after-all-via-a-static-bounce-page)
> for `top-tracks` mode only** — that mode's players do now log into Spotify. This
> decision still governs the default `manual` mode unchanged.

- **Decision:** Players never log into Spotify. Song search runs server-side
  (`server/spotify.ts::search`) using the host's own PKCE user token; the client only
  ever sends a room-scoped player token to authorize the proxied request.
- **Context:** The original brief called for every player to connect their own Spotify
  account. Spotify's redirect-URI rules make that impossible for a phone on a LAN:
  HTTPS is required except for the literal loopback IP (`http://127.0.0.1:PORT`),
  `localhost` is explicitly disallowed, and private-LAN IPs (`192.168.x.x`) appear to be
  rejected even over HTTPS (an open Spotify community feature request asks for exactly
  this support). A phone can structurally never complete OAuth against its own LAN address.
- **Consequence:** No player ever needs a Spotify account, which turned out to be a
  product improvement, not just a workaround — anyone can join and play. Cost: results
  are scoped to the host's market/library visibility, and "browse your own playlists" is
  a real, documented non-goal (see `.claude/PRODUCT.md`) rather than a missing feature.
- **Rejected:** mkcert-issued HTTPS cert for the LAN IP + per-player login (Spotify's
  own private-IP rejection likely defeats this regardless of the cert; untested but not
  worth the CA-install friction to find out). A named Cloudflare tunnel for a stable
  public HTTPS hostname (works, but turns "local party game" into "needs internet and a
  domain," and was explicitly rejected when offered).

## ADR-001 — One in-memory `Room`, no persistence, no multi-room support

- **Decision:** Game state (`Room`, `Player`, `Round`) lives in a single module-level
  variable in `server/game.ts`. No database, no file persistence, and only ever one room
  at a time — never a `Map<code, Room>`.
- **Context:** This is a single-evening party game run by one host on their own laptop.
  One host account means one Spotify Premium subscription and one physical playback
  device (a shared speaker); two concurrent rooms would fight over that one device for
  no product benefit. Persisting state across a restart would only matter if the server
  crashed mid-game — at which point the host re-launching it *is* the recovery path, and
  a rebuilt in-memory room costs nothing extra to reach.
- **Consequence:** A server restart loses everything — the room, every score, and the
  host's Spotify session (tracked in `.claude/PRODUCT.md`'s known-gaps table, not hidden).
  In exchange: no schema, no migration, no data file to gitignore, and the state
  transitions in `server/game.ts` stay simple functions over one object instead of a
  keyed store.
- **Rejected:** `Map<code, Room>` for multiple simultaneous games (adds a real dimension
  of complexity — which room does a given Spotify device belong to? — for a feature this
  product has no use for; promoting to a Map later is a small, well-contained change if
  ever needed). SQLite/file persistence for crash recovery (the parts worth recovering —
  scores, submitted songs — are exactly the parts that stop mattering the moment
  everyone's already mid-conversation waiting for the host to relaunch the app).

## ADR-000 — Documentation lives in `.claude/`, rooted at CLAUDE.md

- **Decision:** Agent-facing docs live in `.claude/`, split one file per topic, routed by
  a root [CLAUDE.md](../CLAUDE.md), which Claude Code loads automatically — no separate
  pointer file needed.
- **Context:** A single mega-file gets skimmed and goes stale; two full copies in two
  locations diverge silently; the legacy GitHub Copilot convention needed a
  `copilot-instructions.md` pointer *and* a root `AGENTS.md` pointer to route to
  `.github/AGENTS.md` — two extra files that existed only to route, and could themselves
  drift.
- **Consequence:** Every fact has exactly one owner, so an agent knows where to change it,
  and the root `CLAUDE.md` is both the router and the thing Claude Code reads by default —
  one file, one job. Cost: more files, and the index in `CLAUDE.md` must be kept honest.
- **Rejected:** One root `CLAUDE.md` holding everything (unreadable past ~300 lines, fine
  for a lean project but not one with real users); duplicating the full doc in both `/`
  and `.claude/` (two files to keep in sync forever); keeping the legacy `.github/` +
  `AGENTS.md` + `copilot-instructions.md` three-file routing scheme (AIRA and Sales
  Intelligence Dashboard still use it — frozen production systems, not migrated — but it's
  not the convention for new projects).
