# Lens: docs — do the docs still tell the truth?

Mode: `docs`. Agent: `review-reader`. You read the documentation as the claim and the code as the evidence.
You do not hunt bugs or optimize.

**Docs drift silently. That is the failure mode this lens exists for.** Root `CLAUDE.md` records the worked
example: a project's docs said in three places that it had no automated test suite while `tests/` held a
pytest suite that pre-commit ran on every commit. Nobody was careless; the docs were true once.

## What to check

1. **Statements the change made false.** Re-read every doc the change relies on and flag any sentence the
   change just made untrue. This is the real prize.
2. **Renamed, moved or deleted things still cited elsewhere.** For every name the change touched (a script, a
   command, a file, a function, an env var), grep the **whole repo** for the old name, docs and project docs
   included. The structural checklist in root `CLAUDE.md` § Docs-first is the method.
3. **Copied numbers, paths and claims.** A count, a path or a version copied from somewhere else is a
   second-hand claim. Re-verify it against the source.
4. **Each owner doc against its code.** `STACK.md` (every dependency and command real), `ARCHITECTURE.md`
   (structure and data flow as built), `API.md` (every endpoint present, none missing), `README.md` (setup
   steps, environment variable table, scripts and ports match the code and launcher), `DESIGN.md` (tokens and
   components match), `DECISIONS.md` (a new decision has an ADR with a **Rejected** field), `PRODUCT.md` (a
   gap found during the change is in the known-gaps table).
5. **One owner per fact.** The same fact stated in two places will diverge. Flag the duplicate and name which
   file should own it.
6. **A new or renamed project** has its row in the manifest and in the README's project table (root
   `CLAUDE.md` § Docs-first), and the project count in any tagline is updated.
7. **Comments.** Comments contradicting the code, referring to removed behaviour, or only restating the code;
   `TODO` / `FIXME` / `HACK` debt introduced by the change.
8. **README convention** (root `CLAUDE.md` § The README convention): a placeholder presented as finished
   content instead of a `[!WARNING]`.

## What the brief carries

- **Names list** (from `names`): files renamed, moved or deleted in this scope, each with the places that still
  cite the old name. Every reference listed is a candidate stale statement; read it and decide. It cannot see a
  renamed function, variable or environment variable: read the diff for those and grep for them yourself.
- **Link problems** (from `doclinks`): relative links that point nowhere, anchors with no heading, and
  `npm run` targets that are not scripts. Confirm each against the file before reporting it.

## Method

List the claims in the docs that touch the changed area, then check each against the code with a grep or a
read. Quote the doc line and the code line side by side. A claim you could not check is not a finding.

## Severity

Critical: a doc that would make an agent or a person do the wrong thing (a wrong command, a wrong safety
claim, a rule that no longer exists). Important: a stale fact that misleads. Suggested: wording and
duplication.
