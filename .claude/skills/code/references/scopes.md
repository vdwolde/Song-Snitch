# scopes — where to look

Two flags and an optional path. The scope says *where* to look; the mode says *what* to look for. Resolve it
with the helper, never by guessing: `node ~/.claude/skills/code/tools/code-tools.mjs scope <scope>`.

| You say | It reviews |
|---|---|
| `--changes` | **Everything that changed and is not on the remote yet:** unpushed commits, staged, unstaged and new files. Only the **changed lines**, with the rest of the file read for context |
| `--all` | **The whole codebase**, in even shards, riskiest first |
| a path after either flag | Narrows it to a folder, file or glob: `/code security --all src/api`, `/code quality --changes src/api`. A path with no flag means `--all` inside that path |
| `--changes <ref>` | Everything different from that branch, tag or commit, plus anything uncommitted. `/code quality --changes main` is "this branch against main" |

**Aliases, so old habits keep working:** `--commit` is `--changes`. `--session` is `--changes`; intersect the
file list with the files this conversation touched, because the helper cannot see them. `--ref <r>` and a bare
ref (`/code main`) are `--changes <r>`. To review a PR, check out its branch and use `--changes main`.

## How `--changes` finds its base

The upstream branch if there is one, else `origin/HEAD`, `origin/main`, `origin/master`, `main` or `master`,
whichever resolves first, using the merge-base so only this line of work counts. With no base at all (a new
repo, no remote) it reviews the working tree and says so. If the working tree is clean and nothing is
unpushed, the scope is **empty and the run stops** before any agent starts: do not invent work.

## What each mode does with the scope

Nothing else is a flag. Each mode adds what it needs by itself:

| Mode | Added automatically |
|---|---|
| `quality` | The direct importers of the changed files (`dependents`) as read-only context; the `change-safety` lens when the helper says it is triggered; the project's stacks (`stack`) so the right checklists are read |
| `performance` | On `--all`, shards ordered by risk (recent churn, fix commits, size); the project's budgets from `REVIEW.md` |
| `security` | The entry-point map (`entrypoints`), secrets in recent history (`history`), install scripts and non-registry dependencies (`deps`) |
| `tests` | The test file for each changed file (`tests-map`) and the coverage of the changed lines (`coverage`) if a report exists |
| `docs` | The names the change renamed, moved or deleted, each searched across the repo (`names`); broken links and anchors in the markdown (`doclinks`) |
| `everything` | All of the above |

## Recommended scope per mode (the picker marks it)

`--changes` for `quality`, `performance`, `tests` and `docs`. `--changes` for `security` day to day, `--all` for
an audit. `--changes` for `everything` before a release, `--all` on inherited code.

## Cost, shards and the fast path

- **Shards.** `run init` splits by changed lines for `--changes` (budget 1500) and by lines for `--all`
  (budget 6000), riskiest shard first; `shards <scope>` previews the split. **Units = shards × the mode's
  lenses** (or × agent types when bundled), and `init` prints how many are left to dispatch after reusing
  finished ones. **Ask first above about 12**, and offer "stop after the riskiest 3 shards"
  (`run next --shards 3`); a run stopped early keeps what finished (see [resume.md](resume.md)).
- **Fast path.** If the scope line says "fast-path eligible for quality: yes" (300 or fewer changed lines),
  `quality` runs as **one** bundled `review-reader` agent given the lens files in turn (correctness, design,
  conventions, plus change-safety when triggered), not three agents. Say so in the plan. `--independent` turns
  it off.
- **Bundling (`--bundle`).** One agent per agent type per shard carries that type's lenses in turn, so each
  file is read once. Shards are half the size (750 changed lines, 3000 lines) to keep each agent run short.
  Opt-in outside the fast path.
- **Combined modes.** `/code quality,tests` runs the union of the lenses and gates once. `everything` is all of
  them.
