---
name: code
description: Code review in six modes — quality (bugs, standards, formatting, architecture, dependency hygiene), performance, security, tests, docs, and everything (modes combine, e.g. quality,tests) — over two scopes, --changes (everything not on the remote yet) or --all (the whole codebase), optionally narrowed by a path. Parallel read-only reviewers dispatched on a resumable run ledger (`/code resume` continues after a usage limit), every Critical independently verified before it is reported. Use when: review my code, check my changes, before commit, is this secure, why is this slow, do we have tests for this, are the docs still right, full review.
---

# /code

A review you steer by **mode** (what to look for) and **scope** (where to look). Reviewers run as parallel
subagents, so their file reading happens in their own context windows and only findings come back. Every mode
is a review pass, so it runs only when the user asks for it in that turn (root `CLAUDE.md` hard rule 11).
`/code help` prints the two tables below and stops.

## Step 1 — Pick the mode and the scope. Never assume the scope.

| Mode | Use it when | Playbook | Lenses |
|---|---|---|---|
| `quality` | Before a commit, "check my changes" | [quality.md](references/quality.md) | correctness, design, conventions (+ change-safety when triggered) |
| `performance` | "It's slow", a hot path | [performance.md](references/performance.md) | performance |
| `security` | "Is this safe?", before exposing something | [security.md](references/security.md) | security |
| `tests` | "Is this covered?" | [tests.md](references/tests.md) | tests |
| `docs` | After a rename, or a change that touches docs | [docs.md](references/docs.md) | docs |
| `everything` | Before a release, or inherited code | [everything.md](references/everything.md) | all of them |

**Modes combine:** `/code quality,tests` or `security,performance` runs the union of the lenses and gates once,
de-duplicated, with one verdict. `everything` is all of them. **Scopes** (full detail in
[scopes.md](references/scopes.md), read it only when a scope question comes up): `--changes` is everything that
changed and is not on the remote yet (unpushed commits, staged, unstaged and new files); `--all` is the whole
codebase; a path after either narrows it (`/code security --all src/api`); `--changes <ref>` compares with a
branch, tag or commit. Old flags `--commit`, `--session` and a bare ref still work as aliases. Add `--fix` to
apply confirmed findings.

**If the request clearly fits a mode, start it.** Hints: "check my changes", "before I commit", "lint",
"standards", "bugs" → quality. "Slow", "optimize", "memory" → performance. "Secure", "vulnerable", "exposed",
"secrets" → security. "Covered", "tests for this" → tests. "Stale docs", "after the rename" → docs. "Full
review", "before release", "inherited" → everything. **If the mode or the scope is missing, ask once:** one
`AskUserQuestion` call with up to two questions, skipping any already answered. Mode options: quality,
performance, security, everything (tests, docs and combinations by naming them or "Other"). Scope options:
`--changes` (marked recommended for most modes), `--all`, and "Other" for a path or a ref. Never default the
scope or guess it from context.

## The helper, in one line each

Everything below runs through `node ~/.claude/skills/code/tools/code-tools.mjs <command> [--root <dir>]` (if `node`
is not found, prepend `C:\Program Files\nodejs` to PATH). The commands you use, in order:
`scope` → `run init` → `run prep` → *(your gates)* → `run next --fill 6` (repeat) → `run merge` →
`run verify-plan` → `run next --fill 6` (repeat) → `run verdicts` → `run report`. State lives outside the repo
in `%LOCALAPPDATA%\claude-code-review\`, so a usage limit cannot lose finished work. Details of the ledger are in
[resume.md](references/resume.md), read it only for a resume or a ledger question.

## Step 2 — Resolve the scope, then plan a resumable run

`scope <scope>` lists the files, the **changed line ranges**, the `origin:`, whether the fast path applies and
whether the `change-safety` lens is triggered. It **stops the run** on an empty scope or a ref that does not
resolve, before any agent starts. For `--session`, intersect with your own list of touched files.

Then `run init --modes <modes> <scope>`. It shards the scope (riskiest first), builds the **units** (one agent
run each: a shard crossed with a lens) and opens the **run ledger**. **Agent runs = units to dispatch**, as `init`
prints them. `init` **reuses any finished unit** whose inputs are unchanged (same lens files, rules, checklists,
file contents and changed ranges, under 14 days old), so repeating a command or resuming after a limit dispatches
only what is missing.

- **Fast path:** a `quality` run with 300 or fewer changed lines is one bundled `review-reader` carrying the
  lens files in turn (say so; `--independent` turns it off).
- **`--bundle`:** one agent per agent type per shard, carrying that type's lenses in turn, so each file is read
  once instead of once per lens (roughly a third of the reading for `everything`). Shards halve automatically
  because a longer agent run loses more when cut. Lenses stay separate passes, but they are no longer separate
  contexts; use it when usage, not independence, is the constraint. Never bundled by default outside the fast path.
- **`--fresh`** archives the old run and reuses nothing (a deliberate second opinion).
- **Ask first above about 12 units to dispatch:** run everything, or stop after the riskiest 3 shards
  (`run next --shards 3`). Stopping is lossless either way: what finished is kept.
- **`/code resume`** asks no mode or scope question: `run status` (or `run list`) shows the latest unfinished
  run with a `resume:` line; run that line and continue at Step 4. A resume after a limit is a continuation of
  a review the user already asked for, not a new one.

## Step 3 — Cheap deterministic checks, before any agent

- **`run prep`** runs the helpers the mode needs, once, in-process, and writes them as the run's shared context,
  each under the lenses that should see it: `prefilter`, `deps`, `dependents` (quality) · `prefilter` (performance) ·
  `entrypoints`, `domains`, `history`, `prefilter` (security) · `tests-map`, `coverage` (tests) · `names`, `doclinks`
  (docs). Its printed summary is short: the Critical-shaped security leads (list them at the end of the report, do
  not investigate them here), the domain candidates, the trust leads. Language checklists are not a step any more:
  each brief carries the ones for the stacks of its own shard's files. Skip `prep` on a resume when `run status`
  lists `prep` among the artifacts.
- **Gates are yours.** `gates` lists the project's own commands (`.claude/REVIEW.md` first). Run the **fast** ones
  the mode needs (lint, format check, typecheck; tests too when fast) **as parallel Bash calls in one message, with
  a time limit, keeping only the first failing lines**, and report each as `pass` / `fail` / `unavailable` /
  `blocked`. A gate that did not run did not pass. Ask before a slow one on a large repo. Use trusted host
  processes (`uvx ruff`, `npx`, `dotnet`); `yarn` and `pnpm` are not installed. Never run a command that writes.
  **Running a gate runs the project's code, so check whose it is:** `scope` prints the `origin:`; a target that is
  not verifiably the user's own gets static helpers only and its gates are `blocked` (step 0 of
  [security.md](references/security.md)).
- `security` with a running server: `probe <url>`, a passive live check (GET and OPTIONS only, no payload). A
  loopback URL needs nothing; any other host needs the user's ownership confirmation in that turn, then
  `--owned`. Never start the app to probe it. Details in [security.md](references/security.md).
- **Save what only you can judge:** `run save shared --append` with sections headed `## all` or `## <lens>` (a
  heading may name several lenses): the gate results (to `conventions`, which reports a `fail`), the security
  trust sketch, the `Domain files:` and `Excluded:` lines. Save it **before the first `run next`**: a brief is
  written at dispatch and carries what is saved by then.

## Step 4 — Dispatch with a rolling window, results stored by a hook

1. `run next --fill 6` hands out units until 6 are in flight (the session allows 20). It prints each unit's
   brief path and marks it running. It refuses once the run is halted.
2. **One message, one background `Agent` call per unit** (`run_in_background: true`), with `subagent_type` as
   listed (`review-reader` runs correctness, design, conventions, docs, change-safety, verify, recon and
   coverage-critic; `review-runner` runs performance, security and tests and may run read-only commands) and the
   prompt `Read your brief at <path> and follow it exactly.` The brief carries everything: the core rules, the
   lens, the rules, the checklists, the shared context, the file list with the changed ranges. **Crafted context
   only, never this conversation's history**: a fresh reviewer is the point.
3. **The reviewer's reply is stored by a hook** (`run hook`, declared in the two agents) in the run's inbox; you do
   not copy it. Each time an agent returns, call `run next --fill 6 --returned <unit>`: it folds the stored
   results into the ledger, refills the window with the next unit, and says `NOT STORED` if that unit's result
   did not arrive. **Then, and only then, pipe the reply yourself:** `run done <unit>` with the text on stdin (a
   limit message or an error: `run fail <unit> --reason "<its text>"`; `run done` refuses text that looks like a
   limit error). An agent that returns an error, an empty reply or a usage-limit message did not review anything.
4. **On the first usage-limit, rate-limit or overloaded error, stop.** `run fail` (or the hook, which files a
   limit-shaped reply as a failure) halts the run, so do not dispatch more and do not retry in a loop. Let the
   agents in flight finish and be stored, then go to Step 6 with a partial report and tell the user to resume
   with `/code resume` once the limit resets. A unit that failed for another reason goes back to pending and is
   retried, three attempts at most.

Stop when `run next` reports nothing pending and nothing running. A cut-off must cost the agents in flight at
most, never the run.

## Step 5 — Merge, verify independently, and take a second look

1. `run merge` parses every finished lens result (the shape is in `review-core.md`), collapses findings at the same
   place (same line, or within 3 lines when another lens says the same thing in similar words), keeps the highest
   severity and the union of the lenses (**agreement raises confidence**), keeps a differing wording as `also:`,
   drops findings whose cited file or line does not exist (counted and listed, restorable), and numbers the rest
   `F1..Fn`. A result it cannot parse is printed raw, marked `NOT PARSED, merge by hand`: read it and add its
   findings with `run edit new ...`. Never skip it.
2. Judgement calls are short commands, not retyped lists: `run edit F3 --join F7` (same root cause: for `security`
   one missing guard behind five routes is one finding), `--severity`, `--fix`, `--drop "reason"`, `--restore`.
3. `run verify-plan` creates the `verify` units for every Critical and Important (and every `needs-validation`
   lead), about 8 per unit, **and the second look** (`look1`: a fresh reader of the highest-risk files, told what
   is already reported) when the scope has files touching auth, input handling, money, data writes or process
   execution. Dispatch them together as in Step 4. The verify lens
   ([verify.md](../../agents/references/lenses/verify.md)) tries to refute and answers `<id> — CONFIRMED |
   PLAUSIBLE | REFUTED — evidence`. A `measured` performance finding is re-run once.
4. `run verdicts` applies them: refuted findings are dropped, a `PLAUSIBLE` Critical is reported as Important, and
   **an unverified Critical is never reported as Critical.** If `look1` found anything, `run merge` and
   `run verify-plan` again: only what is new gets planned.

**`security` adds steps here** (all in [security.md](references/security.md)): the lens also returns trailing
`needs-validation:`, `hardening:` and `traced:` blocks, which `run merge` keeps out of the findings; consolidate by
root cause with `run edit --join`; and on a `--all` run with more than 3 shards add the `recon` unit before the
wave and the `coverage-critic` unit after it.

## Step 6 — Report

`run report` renders the findings by severity (`path:line — claim — severity — fix — lenses — CONFIRMED /
PLAUSIBLE`, with the scenario for Critical and Important), the coverage line, what was dropped or never verified,
and for `security` the needs-validation table, the attack surface counted from the `traced:` lines and the
hardening notes. **Over 15 findings it writes the full report to a file** and prints the Critical and Important
lines and the path. You add, above it: the **verdict** (*ready to ship*, *ship after Critical fixes*, or *needs
rework*; for `security`, "no Critical or Important found in the reviewed scope", never "secure"), the gates table
(including gates that were `unavailable` or `blocked`), the Critical-shaped security leads from `prep`; and below
it the **tension axes** (show both framings and the `CLAUDE.md` principle; let the user choose),
**excluded-item conflicts** (a Critical security finding is never suppressed), and the **next** mode worth running
(suggest, never start). If nothing was found, say so plainly. **Never manufacture findings to look thorough.**

**A partial run still reports, and says so.** If the run halted or stopped early, put the `coverage:` line from
`run status` directly under the verdict ("5 of 14 shards fully reviewed, riskiest first; 9 not reviewed"). The
verdict covers only the reviewed shards: never "ready to ship" or "no Critical or Important found" for the whole
scope. Verify what you have (Step 5 works on partial results), list the shards not reviewed, and end with the exact
resume command from `run status`. Findings already stored are never discarded, so the resume continues the same
report.

## Applying fixes (`--fix`, or when the user asks)

Reporting is the default. When asked: only `CONFIRMED` findings with a concrete fix; Critical and Important by
default, `--fix all` adds Suggested. One at a time, run the fast gate after each, and **undo that one edit if
the gate fails**. If the project has no fast gate, say the fixes would be unverified and ask first. Skip a fix
that would change intended behaviour or reach outside the scope, and note it. In `tests` mode a fix writes the
smallest missing check. **When a deterministic check produced the finding** (a `prefilter` lead, a `probe`
check, the audit gate), run that same check again after the fix: the fix counts as done only when the check no
longer fires, otherwise report it as unverified (a `probe` re-check needs the app restarted, which is the
user's step). A finding tagged `owner action` (rotate a secret, renew a certificate, change a DNS or hosting
setting) is never attempted: report it and leave it to the user. Never commit or push.

## Stop and ask before

A slow gate on a large repo · more than about 12 units to dispatch · adding or removing a dependency · deleting a
file · touching anything outside the reviewed scope · launching an app to check it (never an elevated one) ·
probing a URL that is not on this machine (needs the user's ownership confirmation in that turn) · checking out
another branch · committing, pushing or opening a PR.

## Related

`/code-review ultra` is a billed cloud review of a branch or PR, user-triggered only. `/security-review` and
`/simplify` are the built-in quick versions; this skill is the deeper local, unbilled one and needs no GitHub
remote.
