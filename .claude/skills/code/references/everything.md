# everything — all modes in one pass

Lenses: `correctness`, `design`, `conventions`, `performance`, `security`, `tests`, `docs` (7 agents per
shard: 4 `review-reader`, 3 `review-runner`), plus `change-safety` when triggered. On `--all` the `design` lens
also runs its Architecture section over the whole scope. The fast path does not apply: it is for a single
`quality` run.

## Cost first

`run init --modes everything <scope>` prints the plan: `7 lenses × <S> shards = <U> units` (8 lenses when
change-safety is triggered), minus any finished units it reused. **Ask to confirm when the units to dispatch
are above about 12**, and offer to stop after the riskiest 3 shards. On a small `--changes` scope that is 7
runs and needs no confirmation. This is the expensive mode, and the one a usage limit most often interrupts:
for a quick check use `quality`, and when usage is the constraint add `--bundle` (2 agents per shard instead
of 7, each file read once, shards half the size). It dispatches in waves of 4 and resumes from the ledger.

## Before the agents

Every deterministic check from the other playbooks, run once and shared: `run prep` does `prefilter`, `deps`,
`dependents`, `entrypoints`, `domains`, `history`, `tests-map`, `coverage`, `names` and `doclinks` and addresses
each output to the lenses that need it, so each lens gets only the leads and outputs it needs. You run the fast
gates, the test gate when fast (twice, for flakiness), and the dependency audit (reported `unavailable` if it
cannot run).

## De-duplicate across lenses, then verify once

The same line is often flagged by two or three lenses. `run merge` collapses them (same place, highest severity,
the union of the lenses, the agreement noted); where one lens clearly owns the finding (a vulnerability stays the
security lens's) fix the record with `run edit`. Then `run verify-plan` sends the merged Critical and Important
findings to the `verify` units once. The security lens's trailing blocks, the recon and coverage-critic units on
a large `--all` run follow [security.md](security.md); `run merge` keeps the `needs-validation:`, `hardening:` and
`traced:` blocks out of the findings.

## Report emphasis

One verdict, then a one-line verdict per mode (quality, performance, security, tests, docs), the gates table,
and the findings grouped by mode, Critical first inside each. Over about 15 findings the full report goes to the
scratchpad. Excluded-item conflicts and tension axes as in the main report.

## Next

The mode with the worst verdict, with `--fix` if the user wants it applied.
