# resume — runs that survive a usage limit

Why this exists: a review can be cut off by a usage limit. Before the ledger, every agent was dispatched at once,
so a limit cut them all mid-read, and the findings existed only in the main conversation, whose cache lapses
before the limit resets. The ledger keeps finished work on disk so a cut costs one wave at most.

## What is stored, and where

`%LOCALAPPDATA%\claude-code-review\<project>-<hash>\` (override with `CODE_REVIEW_STATE`). Never inside the
repo: `SyncProjects.ps1` commits a dirty tree. Plain files, safe to delete by hand.

| Path | Holds |
|---|---|
| `runs/<id>/run.json` | the ledger: scope, shards (files, content hashes, ranges), units and their status, a halt marker |
| `runs/<id>/briefs/<unit>.md` | each unit's brief, written when it is dispatched (it carries the core rules, the lens, the checklists and the shared context), so a dispatch is one short prompt |
| `runs/<id>/inbox/` | replies the stop hook stored that `run` has not yet folded into the ledger (`<unit>.md`, or `<unit>.fail`); every `run` command folds them in first |
| `runs/<id>/artifacts/` | `prep.md` (generated shared context), `shared.md` (what you saved: gates, trust sketch), `merged.md` (the open findings), `report.md` |
| `runs/<id>/merged.json` | the merged findings (F-ids, verdicts, drops, leads), which `run merge`, `edit`, `verify-plan`, `verdicts` and `report` read and write |
| `runs/<id>/results/<unit>.md` | results of verify, second-look and gap units |
| `results/<key>.md` | results of lens units, named by their key (below), shared by every run in this project |
| `archive/` | runs set aside by `--fresh` |

The run id is a hash of the modes, the scope arguments and the flags, so the same request finds its own run.

## Units and keys

A **unit** is one agent run: a shard crossed with a lens, or, bundled, with one agent type's lens group. Its
**key** is a hash of the agent, the lens files, `review-core.md`, the project's `CLAUDE.md` and
`.claude/REVIEW.md`, and the shard's file contents and changed ranges. A stored result is reused only while
the key is unchanged and the result is under 14 days old. Edit a file, a lens or a rule and exactly the units
that depended on it re-run. Not in the key: the shared context and the leads, which derive from the same files.

On a re-init, shard groups whose files are all unchanged are kept as they were, and only the changed or new
files are re-sharded, so one edit does not reshuffle every shard and throw away finished units.

## The loop

`run init` → `run prep` → gates and `run save shared --append` → `run next --fill 6` → dispatch → the stop hook
stores each reply, and `run next --fill 6 --returned <unit>` folds it in and refills the window → `run merge` →
`run verify-plan` (verify units and the second look) → dispatch again → `run verdicts` → `run report`.
`run done` / `run fail` by hand are the fallback when a unit comes back `NOT STORED`.

- `run fail` with a limit-shaped reason (or `--limit`), or a limit-shaped reply stored by the hook, **halts** the
  run: `run next` then refuses. A limit that cuts agents already in flight loses only those agents; their units
  go back to pending.
- Units left `running` by a dead session are pending again at the next `run init`.
- A unit that fails for another reason is retried up to three attempts, then reported as failed.
- `run status` prints coverage (shards fully reviewed by every lens), the halt, and the resume command.
  `run list` shows every run for the project, unfinished ones marked.

## What this cannot do

It cannot save an agent that is cut off mid-read: that unit re-runs from the start, and the prompt cache does
not survive a limit reset. Smaller shards and bundling decisions trade this: more, smaller units lose less per
cut but read shared context more often. Reuse is by content, so it cannot see a change in a file the reviewer
only read for context (a caller, a type); the 14-day cap and `--fresh` are the guard.
