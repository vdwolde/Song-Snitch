# plan — one big task becomes an ordered set of briefs

For a task too big for one brief: several files or areas, several stages, or parts that could run in parallel.
Target: Claude Code. This is the one mode that returns more than one prompt. It also handles the second half
of the job: a brief that failed or changed an assumption, and the rest of the plan has to follow (see
**Re-plan**).

## Process

1. **Read what owns the facts** by path, not by copy: `.claude/STACK.md`, `DECISIONS.md`, `PRODUCT.md` and
   the project's `REVIEW.md` (for the gate). Ask at most the questions the plan cannot go on without.
2. **Cut by disjoint scope, not by topic.** Each brief owns a set of files that no other brief touches. Build
   the ownership matrix (below) and fix every file that has two owners: give it one owner and make the other
   brief read it only, or merge the two briefs. If two parts cannot be separated, they are one brief.
3. **Contract first.** If two briefs share an interface (a type, an API shape, a schema, a file format, a
   function signature), write **Brief 0** that produces only that contract (the types, the schema, a stub),
   and make every brief that uses it depend on Brief 0. After wave 0 the contract is frozen: a later brief
   that wants to change it stops and asks, and the plan is re-planned.
4. **Order into waves.** A wave is the briefs that can run at the same time because they depend on nothing in
   the same wave. Put a checkpoint between waves: the project's gate command, run once, before the next wave
   starts.
5. **Size and risk each brief.** Size: **S** (about 3 files or fewer), **M** (up to about 8), **L** (more: split
   it). Risk: **high** when it touches a schema or migration, a security path, a deletion or a public
   interface; **medium** when it changes behaviour other code relies on; otherwise **low**. Put high-risk
   briefs as early as their dependencies allow, so a surprise arrives while the rest can still change, and
   write each of them in the **Full** size from [write.md](write.md) (plan first, checkpoints, rollback).
   **Checkpoint the skeleton.** Steps 1 to 5 are the expensive thinking (reading the owning docs, cutting by
   scope, the matrix, the waves, sizes and risks), and the briefs in step 6 are mostly a rewrite of it. So
   once step 5 is done, `start prompt "plan:<task in a few words>" --root <project>` and `save skeleton` the
   table, the ownership matrix, the gate command and the paths of the docs you read (pointers, not copies)
   (`node ~/.claude/tools/checkpoint.mjs`, state in `%LOCALAPPDATA%\claude-checkpoints`). If a usage limit cuts
   the briefs short, the same request, or `/prompt resume` (`list prompt`, latest `OPEN` job), loads the
   skeleton and goes straight to step 6. The briefs themselves are not saved: they would be written twice.
   `finish prompt` after delivering. The other modes are one response each and need no checkpoint.
6. **Write each brief standalone**, in the Task Brief shape from [write.md](write.md): Objective, Context
   (pointers, plus what the earlier briefs produced and where), Target State, Scope (work only in, do not
   touch), Constraints, Acceptance Criteria, Stop Conditions, Progress. Add one field: **Hands off**, what it
   leaves for the next brief (the files, names or contracts the next brief relies on). A brief must make sense
   with no other brief and no conversation open next to it.
7. **Carry state between sessions in `.claude/HANDOFF.md`**, the project's own convention (template:
   `Development Base/Templates/docs/HANDOFF.md`). Each brief's Scope lists `.claude/HANDOFF.md` as writable, and its
   last step appends one entry: what changed, and what the next brief relies on (its Hands off). Each later
   brief's Context begins "Read `.claude/HANDOFF.md` first". For a project with no `.claude/`, drop this and
   let the user paste the Hands off lines forward.
8. **Show the count first.** If the plan has more than six briefs, say so and ask whether to continue or to
   merge, before writing them all out.

## The ownership matrix

One row per file or folder, one column per brief. `W` means the brief writes it, `R` means it only reads it.
**Every row has exactly one `W`.** Print the matrix with the plan, because it is what lets the briefs run in
parallel without colliding.

```text
| File or folder        | B0 | B1 | B2 | B3 |
|-----------------------|----|----|----|----|
| src/types.ts          | W  | R  | R  | R  |
| src/api/              |    | W  |    | R  |
| src/ui/               |    | R  | W  |    |
| package.json, lockfile|    |    |    | W  |
```

Files every brief tends to want (a lockfile, a routes table, an index that re-exports, a README) get one named
owner: usually the **last** brief of a wave, or a small wiring brief at the end.

## Output

```text
Plan: <n> briefs in <w> waves. Gate between waves: <command>.

| # | Brief | Wave | Size | Risk | Depends on | Writes | Reads |
|---|---|---|---|---|---|---|---|
| 0 | <contract> | 0 | S | low | none | <paths> | none |

Ownership matrix: <the matrix above>

Briefs, in run order:
### Brief 0: <name>
[the full brief]

How to run it: <see below>
```

## How to run it (suggest, never start)

Default: one session per brief, in order, with the gate between waves. Briefs in the same wave touch disjoint
files, so they can run as parallel subagents, each in its own git worktree if the user wants isolation. Use a
Workflow script only if the user has asked for multi-agent orchestration in their own words. Never launch any
of this: the user does.

## Re-plan: a brief failed, or a fact changed

The user pastes what happened (the result, the `HANDOFF.md` entry, or a summary of the diff). Then:

1. **Restate the changed fact in one line** and say whether it was a failure, a surprise in the code or a change
   of mind.
2. **Find what it touches** with the ownership matrix and the Depends on column: which later briefs read or
   write what changed.
3. **Return only the changed briefs** and the updated table, marking the others `unchanged`. A finished brief
   is a fact: do not redo it. A failed one is rewritten smaller, or split.
4. If the **contract** changed, re-issue Brief 0 first and re-check everything that depends on it.
5. Any brief already run that now conflicts becomes a small **repair brief**, in its own wave, rather than a
   rewrite of history.

## Rules

Every brief carries its own Stop Conditions, including never committing or pushing. No brief assumes a
decision another brief has not made yet. If a brief is still too big (more than about one screen of Target
State), split it again.

## Next

For a brief that will run with nobody watching, suggest `unattended`.
