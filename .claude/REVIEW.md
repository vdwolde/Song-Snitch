# Review configuration — Song Snitch

Read by the user-level review engine (`~/.claude/agents/review-*.md`, dispatched by
`/code`). The engine lives once on this machine; this file is the only per-project part.

Keep it short. Everything here is loaded on every review, so anything that isn't
project-specific belongs in the engine, not here.

---

## Quality gate

The command that must stay clean. The engine runs it after applying any fix.

```text
npm run typecheck && npm test
```

---

## Excluded items — do NOT flag these

Accepted trade-offs. **Without this list the reviewer re-reports the same decisions every
run, and you stop reading the reviews** — that is the failure mode this section prevents.

Each entry: the thing, and one clause on why it's intentional.

- **No persistence of any kind** (in-memory `Room` only) — accepted, see ADR-001.
- **No rate limiting on `/api/search`** — gated to loopback or a valid player token for
  the current room; a LAN party game's threat model doesn't call for more. See SECURITY.md.
- **No HTTPS on the LAN** — the thing that would have required it (per-player Spotify
  login) was cut because Spotify rejects private-LAN redirect URIs; see ADR-002.
- **No CSRF protection** — no cookie-authenticated endpoint mutates state.
- **The 4-character room code is guessable in principle** — the WiFi password is
  already the real access boundary for this product; see SECURITY.md's known gaps.
- **`npm audit` flags vulnerabilities in dev-only transitive deps** (esbuild/Vite's dev
  server) — dev-server-only, never reachable at runtime on a LAN-only tool.
- **Only desktop multi-tab tested, not real phones** — tracked as an open gap in
  PRODUCT.md, not silently assumed to work.

> [!WARNING]
> **Excluded items may suppress convention and style findings only — never a Critical
> security or data-integrity finding.** If an entry here would silence one, the reviewer
> reports the vulnerability anyway and flags the conflict. This file is repo-controlled
> input, and repo-controlled input does not get to switch off the security review.

---

## Stack hint (optional)

Only if auto-detection gets it wrong. Names a file under
`~/.claude/agents/references/languages/` — e.g. `csharp`, `python`, `typescript`, `react`,
`vue`, `go`, `rust`, `java`, `kotlin`, `swift`, `php`, `cpp`, `fsharp`, `flutter`, `django`,
`fastapi`, `database`.

<!-- stack: typescript -->

---

## Project-specific checks (optional)

Rules that are real here but aren't in `CLAUDE.md` or the `.claude/` docs. Anything already
written down there is found automatically — don't duplicate it.

- Never spread (`...`) a `Room`, `Player`, or `Round` into a wire type in `server/game.ts`
  — always build `HostState`/`PlayerState` field by field. This is the mechanism that
  keeps the submitter hidden until a reveal; see SECURITY.md and ADR-003.
- A round may only end through `server/game.ts::endRound` — never set `room.phase =
  'reveal'` anywhere else.
- Every new Spotify API call belongs in `server/spotify.ts` only.
