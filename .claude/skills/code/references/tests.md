# tests — would a break be caught?

Lens: `tests` (1 agent per shard, `review-runner`).

## Before the agent

`run prep` runs `tests-map` and `coverage` and addresses both to the `tests` lens. What they are:

1. `tests-map <scope>`: each changed source file and the test files that name or import it, or
   `NO TEST FILE FOUND`.
2. `coverage <scope>`: the coverage of the **changed lines** from an existing `lcov.info` or Cobertura report.
   It never runs the tests with coverage on its own; if there is no report, say so. A report older than the
   change says nothing about it.
3. The test gate from `gates`, when it is fast, run **twice**: a test that passes once and fails once is flaky.
   Pass both results in the four states.

## Report emphasis

A table first: changed or added non-trivial logic, whether a test would fail if it broke (`yes` / `weak` /
`no`), and the smallest check that would. Critical is money, security or data-integrity logic with no check.
A project whose docs record "no test suite" on purpose is not flagged for the absence, only for new logic with
no check at all. Executed is not asserted: covered lines in a test that checks nothing are still a gap.

## `--fix`

Write the smallest missing check for each `no`: one small test file or an `assert`-based self-check, using real
temporary directories and no framework or fixtures unless the project already uses them. Run it; it must pass
now. Never delete or loosen an existing test to get green, and write nothing you cannot run.

## Next

`/code quality` if the tests exposed a bug.
