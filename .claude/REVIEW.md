# Review configuration — Song Snitch

Read by the user-level review engine (`~/.claude/agents/review-*.md`, dispatched by
`/code`). The engine lives once on this machine; this file is the only per-project part.

Keep it short. Everything here is loaded on every review, so anything that isn't
project-specific belongs in the engine, not here.

---

## Quality gate

The command that must stay clean. The engine runs it after applying any fix.

```text
<!-- e.g. npm run typecheck   |   ruff check .   |   dotnet build   |   yarn lint -->
```

---

## Excluded items — do NOT flag these

Accepted trade-offs. **Without this list the reviewer re-reports the same decisions every
run, and you stop reading the reviews** — that is the failure mode this section prevents.

Each entry: the thing, and one clause on why it's intentional.

<!-- Examples:
- In-memory rate limiting (per-process, accepted at current scale).
- CSRF token in localStorage rather than an HttpOnly cookie (documented trade-off, ADR-004).
- The absence of a test suite as a *blocker* (still flag untested new logic).
- Hardcoded port 8765 (matched by Start-Project.bat; changing it needs both).
-->

- …

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

<!-- stack: csharp -->

---

## Project-specific checks (optional)

Rules that are real here but aren't in `CLAUDE.md` or the `.claude/` docs. Anything already
written down there is found automatically — don't duplicate it.

<!-- e.g. Every ProcessRunner call must pass an argv array, never a joined string. -->

- …
