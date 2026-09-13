# Song Snitch — agent instructions

A local-network party game: friends submit songs from Spotify, a host laptop plays each
one out loud, everyone guesses who added it on their own phone. TypeScript (ESM)
throughout, Fastify + WebSocket server, React client, npm.

**Flow:** Host connects Spotify (PKCE) → creates a room → players join and submit songs
(server-side Spotify search, no player login — or, in top-tracks mode, each player
connects their own Spotify and their most-played songs are auto-submitted) → host
starts → per round, the host plays a track while phones vote "who added this?" →
reveal → final leaderboard. Everything runs on the host's own laptop; nothing is
deployed anywhere except one static page unrelated to gameplay (a top-tracks player's
Spotify login bounce, `github-pages/callback.html`) — see
[.claude/DECISIONS.md](.claude/DECISIONS.md) ADR-006.

This file is always loaded (Claude Code reads it automatically from the project root).
It is a **router**: it holds the coding principles and points to the one document that
owns each topic, in `.claude/`. Read the relevant document *before* changing that area —
do not duplicate its content here.

## Hard rules

1. Never spread (`...`) a `Room`, `Player`, or `Round` into a client-facing type in
   `server/game.ts` — build `HostState`/`PlayerState` field by field. This is what keeps
   the submitter hidden until a reveal; see [.claude/SECURITY.md](.claude/SECURITY.md).
2. A round ends only through `server/game.ts::endRound` — never set `room.phase =
   'reveal'` anywhere else.
3. Every Spotify API call the **server** makes lives in `server/spotify.ts` — no other
   server file makes one. A browser-side Spotify call is permitted only where the token
   itself must live in the browser — today that's `src/spotify-player.ts` (the Web
   Playback SDK) and `src/spotify-top-tracks.ts` (a player's own top-tracks import, see
   [.claude/DECISIONS.md](.claude/DECISIONS.md) ADR-004) — never add a third without a
   documented reason.
4. The Spotify client secret never exists in this project (PKCE only); the access token
   never reaches a client except through the loopback+cookie-gated `/api/host/token`,
   and never the refresh token, ever.
5. Server binds `0.0.0.0` only via the explicit `BIND_LAN=1` opt-in — never as a side
   effect of `PORT` being set.
6. Never log a Spotify token or a player's name/score beyond a length/existence check.

**Attribution (every personal project):** the front-end and README must carry the
`By vdWolde` credit — see root `Development/CLAUDE.md` § Attribution for the canonical
values and where each variant belongs. `Scripts/CreateNewProject.ps1` already stamped
`Thomas van der Wolde`/`vdWolde`/`https://vdwolde.com/` into this project's README; add the
front-end notice yourself once there's a front-end to add it to.

## Coding principles

Apply to every task. These bias toward caution; use judgment on trivial changes.

1. **Think before coding.** State assumptions; if uncertain, ask. Surface tradeoffs and
   simpler alternatives instead of silently picking one.
2. **Simplicity first.** Write the minimum code that solves the problem. No speculative
   features, no abstraction for a single caller, no error handling for impossible cases.
   If 200 lines could be 50, rewrite it. Stop at the first rung that holds: **1.** Does
   this need to exist at all? (YAGNI) — **2.** Does it already exist in this codebase?
   Reuse it. — **3.** Does the stdlib do it? — **4.** Does a native platform feature
   cover it? — **5.** Does an already-installed dependency solve it? — **6.** Can it be
   one line? — **7.** Only then: the minimum code that works. The ladder runs *after* you
   understand the problem, never instead of it.
3. **Surgical changes.** Touch only what the task requires. Don't refactor, reformat, or
   "improve" adjacent code. Match existing style. Remove only the orphans *your* change
   created. A bug report names a symptom: before editing, grep every caller of the
   function you're about to touch and fix it once where they all route through — a
   smaller diff than a guard in every caller.
4. **Goal-driven execution.** Turn tasks into verifiable goals ("write a failing test
   that reproduces the bug, then make it pass"). For multi-step work, state a plan where
   each step names its verification check. For anything multi-file or handed to a
   subagent, shape the plan as a brief — objective, scope lock, acceptance criteria, stop
   conditions — the `/prompt` skill produces this shape on request.

Every changed line should trace directly to the request. For worked anti-pattern → fix
examples, see [.claude/STACK.md § Coding principles in practice](.claude/STACK.md#coding-principles-in-practice).

You are applying these well when diffs contain fewer unnecessary changes, work needs
fewer rewrites for overcomplication, and clarifying questions come *before* implementation
rather than after mistakes.

## Documentation index

Delete the rows this project doesn't have; don't create an empty file to fill a row.

| Read this | When you are… |
| --- | --- |
| [.claude/PRODUCT.md](.claude/PRODUCT.md) | Changing user-facing behavior, features, scope, or goals |
| [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md) | Changing system structure, concurrency, request/data flow, deployment |
| [.claude/DOMAIN.md](.claude/DOMAIN.md) | Changing business rules, data model, validation, or an entity's lifecycle |
| [.claude/STACK.md](.claude/STACK.md) | Writing code — conventions, imports, patterns, commands, quality gates |
| [.claude/API.md](.claude/API.md) | Adding or changing an endpoint |
| [.claude/SECURITY.md](.claude/SECURITY.md) | Touching auth, validation, rate limiting, input handling, logging, secrets |
| [.claude/DESIGN.md](.claude/DESIGN.md) | Changing templates, styling, or client-side UX |
| [.claude/DECISIONS.md](.claude/DECISIONS.md) | Questioning why something is built a certain way (ADR log) |
| [.claude/GLOSSARY.md](.claude/GLOSSARY.md) | Unsure what a term means |
| [.claude/REVIEW.md](.claude/REVIEW.md) | Running `/code` — this project's quality gate and excluded items |
| [README.md](README.md) | Setting up locally, env vars, branch workflow, deployment |

### Routing examples

- Adding a new WebSocket message → [.claude/API.md](.claude/API.md) (protocol table) +
  [.claude/STACK.md](.claude/STACK.md) (the field-by-field wire-object pattern).
- Changing scoring or round-end rules → [.claude/DOMAIN.md](.claude/DOMAIN.md).
- Adding a Spotify API call the server makes → [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md)
  (integration points) — it belongs in `server/spotify.ts` only; see Hard rule 3 for the
  narrow browser-side exceptions.
- Changing the host or player screen's layout/colours →
  [.claude/DESIGN.md](.claude/DESIGN.md).
- Questioning why players don't log into Spotify, or why there's no database →
  [.claude/DECISIONS.md](.claude/DECISIONS.md).

## How to approach…

- **New features** — Read [.claude/PRODUCT.md](.claude/PRODUCT.md) for intent and
  non-goals, then [.claude/ARCHITECTURE.md](.claude/ARCHITECTURE.md) /
  [.claude/DOMAIN.md](.claude/DOMAIN.md) for where it fits. Follow
  [.claude/STACK.md](.claude/STACK.md) patterns. Don't expand scope beyond the request.
- **Bug fixes** — Reproduce first. Fix the root cause with the smallest change. Verify
  the original symptom is gone and nothing adjacent regressed.
- **Refactors** — Preserve behavior exactly. Change *how*, never *what*. Verify before
  and after.

### Stop and ask before

- Deleting any file.
- Adding or removing a dependency.
- Changing a database schema or migration.
- Touching anything outside the scope of the current task.
- Taking an irreversible or high-blast-radius action not already covered by an explicit,
  pre-approved instruction.
- Running `git commit`, `git push`, or opening a PR. **Never commit or push on your own** —
  unless the user asks in that same turn. Finishing a task means the working tree is left
  clean-but-uncommitted. `/code --commit` is a review *scope*, not a commit instruction.

## Workflow & quality gates

- Package manager is **npm** — never yarn/pnpm.
- `npm run typecheck && npm test` must stay clean — see
  [.claude/STACK.md](.claude/STACK.md) for the full command set.
- **`/code`, `/code-review`, `/security-review`, `/simplify`, and `/design` review modes
  run only when the user asks for one, that same turn** — never automatically after a
  change, never as a self-imposed finishing touch (see root
  `Development/CLAUDE.md` § Briefing an agent). The engine is user-level
  (`~/.claude/`); this project supplies only [.claude/REVIEW.md](.claude/REVIEW.md) —
  its quality gate and excluded items.

## Pull requests

Solo personal project, no branch model beyond `main` — see root `Development/CLAUDE.md`
§ Git. No PR review process; changes land directly.

## Security must-knows

Full detail in [.claude/SECURITY.md](.claude/SECURITY.md). Non-negotiable:

- No Spotify client secret exists anywhere in this project (PKCE only) — never add one.
- Only the host authenticates; a phone must never obtain the host's Spotify token —
  `/api/host/token` requires both the host cookie and a loopback source.
- The submitter of the currently-playing track must never reach any client before its
  `Reveal` — see Hard rules above and [.claude/SECURITY.md](.claude/SECURITY.md).
- Every gate is enforced server-side; a client-side check is a UX affordance only.

## Maintaining these docs

In the **same turn** as the change that caused them:

- New or upgraded dependency → [.claude/STACK.md](.claude/STACK.md).
- New endpoint → [.claude/API.md](.claude/API.md).
- New decision → [.claude/DECISIONS.md](.claude/DECISIONS.md), with the alternatives you
  rejected and why.
- A gap or blocker you discovered but did not fix → the known-gaps table in
  [.claude/PRODUCT.md](.claude/PRODUCT.md).

---

**Before relying on any rule above, read the section — or linked document — it lives
in.** Restated: never violate a Hard rule silently; brief multi-step work with a scope
lock and stop conditions; run the quality gate before calling anything done.
