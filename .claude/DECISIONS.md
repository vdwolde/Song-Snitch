# DECISIONS

Architecture Decision Records. Each entry captures a deliberate choice so agents don't
"fix" intentional design. **Newest first. Add a new record rather than editing history** —
if a decision is reversed, write the new ADR and mark the old one superseded.

Write one when a choice would be re-litigated later: a stack pick, a concurrency model, a
storage shape, an accepted trade-off, or anything you had to argue yourself out of.

---

## ADR-002 — `<the decision in one line>`

- **Decision:** what was chosen, concretely enough to check the code against it.
- **Context:** what forced the choice — the constraint, the incident, the cost.
- **Consequence:** what this costs, including the ugly parts and what it rules out later.
- **Rejected:** each alternative, with the reason it lost. *This is the field that earns
  the document its keep* — without it the next agent re-proposes the thing you already
  rejected.

## ADR-001 — Documentation lives in `.claude/`, rooted at CLAUDE.md

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
