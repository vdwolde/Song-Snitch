# DECISIONS

Architecture Decision Records. Each entry captures a deliberate choice so agents don't
"fix" intentional design. **Newest first. Add a new record rather than editing history** —
if a decision is reversed, write the new ADR and mark the old one superseded.

Write one when a choice would be re-litigated later: a stack pick, a concurrency model, a
storage shape, an accepted trade-off, or anything you had to argue yourself out of.

---

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
