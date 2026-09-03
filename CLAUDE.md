# Song Snitch — agent instructions

<!-- One or two sentences: what this is, the stack, the package manager. Then the
     one-line flow, e.g.:
     **Flow:** Form (`POST /submit`) → background task → external API → database →
     polled by `/report/{id}`. -->

This file is always loaded (Claude Code reads it automatically from the project root).
It is a **router**: it holds the coding principles and points to the one document that
owns each topic, in `.claude/`. Read the relevant document *before* changing that area —
do not duplicate its content here.

## Hard rules

<!-- Numbered. The things that must never be violated silently — the ones that would
     make you reject a PR outright. Keep this list short enough that it's actually read.
     Examples from the projects this template is drawn from:
     - Never write back to a source system, never modify an uploaded file.
     - Never fabricate a value; mark inferred data and let the user override it.
     - Vendored/engine files marked #do-not-modify.
     - No `any` / no unchecked type escapes.
     - Secrets never reach the client and are never logged. -->

1. …

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

<!-- Three to six concrete "task → document (+ skill)" lines. These are what make the
     index usable; a table alone gets skimmed. Examples:
- Changing the database schema → .claude/DOMAIN.md + the write-migration skill.
- Adding an endpoint → .claude/API.md + .claude/STACK.md.
- Changing styling → .claude/DESIGN.md.
- Reviewing code you just wrote → /code --commit. -->

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

<!-- The commands that must pass before a change is done. Name them explicitly — an
     agent can't infer your gate. E.g.:
- Package manager is **uv** — never `pip`.
- `npm run typecheck` must stay clean.
- Lint/format runs via pre-commit (`uvx pre-commit install` once).
- Tests: `<command>`. -->

- **After any code change, run `/code --commit`** before considering the task done. The
  engine is user-level (`~/.claude/`); this project supplies only
  [.claude/REVIEW.md](.claude/REVIEW.md) — its quality gate and excluded items.

## Pull requests

<!-- Branch model, who reviews, what a PR description must contain. Environment mapping
     lives in README.md — link to it, don't restate it. -->

## Security must-knows

Full detail in [.claude/SECURITY.md](.claude/SECURITY.md). Non-negotiable:

<!-- Three to five lines. The rules an agent could plausibly break without noticing. -->

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
