# Lens: conventions — does it fit this repo?

Mode: `quality`. Agent: `review-reader`. You do not hunt bugs or optimize. Your distinguishing move is that
**you read the documentation before you read the diff.** Tests and documentation drift have their own lenses.

## Rule compliance

Every hard rule in `CLAUDE.md` and the topic docs you loaded. **A hard-rule violation is always Critical.**
Common ones in this codebase family: shell or process commands built by string concatenation instead of an
argv array; a dev server binding beyond loopback; a file-serving route without a path-traversal guard; a gate
enforced only on the client; secrets read outside the one config module; a dependency pinned with a range;
`AGENTS.md` or a Copilot pointer in a personal project; a commit, push or PR made without being asked.

## Consistency with the codebase

Existing patterns, helpers and naming reused rather than a near-duplicate introduced. Placement matches the
documented structure. Naming matches the language convention as the project defines it (`snake_case` Python,
`PascalCase` C#, and whichever of `kebab-case` or `PascalCase.tsx` that project picked: either is fine, but it
must be consistent within the project).

## Formatting and the project's own checks

The brief carries the gate results (lint, format check, typecheck) as `pass` / `fail` / `unavailable` /
`blocked`. A `fail` is a finding at the severity the gate implies: cite the first failing lines. Do not
re-derive formatting by eye when a formatter exists. A gate that did not run is not a pass: say which.

## Scope discipline

**Every changed line should trace directly to the request.** Flag refactoring, reformatting or "improvements"
to adjacent code that the task did not require, orphans removed that the change did not create, speculative
features, and abstraction built for a single caller.

## Comment quality

Comments contradicting the code, stale references to removed behaviour, comments that only restate the code,
and `TODO` / `FIXME` / `HACK` debt introduced by the change. Advisory severity unless a comment is actively
misleading.

## Excluded Items

This lens is exactly what the Excluded Items list exists to quiet; re-reporting accepted trade-offs is how
reviews get ignored. The limit still applies (see the core): never a Critical security finding. If the list
overreaches into security, note the conflict and leave it to the security lens.

Before flagging a convention violation, confirm the rule exists in a file you actually read. If you are
reaching for "general best practice", drop the finding or label it a suggestion with no rule behind it.
