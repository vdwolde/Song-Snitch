# Lens: tests — would a break be caught?

Mode: `tests`. Agent: `review-runner` (it may run the tests). You do not hunt bugs in the code under test,
or style; other lenses own those.

## The floor (root `CLAUDE.md` § Testing philosophy)

**Non-trivial logic leaves one runnable check behind**: a branch, a loop, a parser, a money or security path.
The smallest thing that fails if the logic breaks: an `assert`-based self-check or one small test file. No
framework, fixtures or per-function suite unless asked. A trivial one-liner needs none. A project whose docs
record a deliberate "no test suite" decision keeps that decision: do not flag the absence of a suite as a
blocker, but still flag **new logic with no check at all**.

## What to check

1. **Coverage of the change.** For each changed or added piece of non-trivial logic, is there a test that
   would fail if it broke? Name the logic and the missing check. A behaviour change that no test would catch
   is the headline finding.
2. **Meaningful assertions.** Tests that assert something real, not merely that nothing threw; no test whose
   expected value is computed by the code under test; no snapshot of everything that nobody reads.
3. **Edge and error paths.** Empty, one, many, null, boundary values, failure of a dependency, bad input at a
   trust boundary, the money or security path.
4. **Isolation.** Real temp paths and directories (`tmp_path` + `monkeypatch`, temp registry keys), not mocks
   that can silently drift from reality. Fake environment defaults set once (`conftest.py`) so importing the
   code never reaches real infrastructure.
5. **Elevated or admin apps** must have a fully unelevated test suite. Never launch an elevated app to run a
   test.
6. **Test smells.** Sleeps instead of waiting on a condition, order-dependent tests, shared mutable state
   between tests, tests that hit the network, a test that passes when its subject is deleted.
7. **Real-world input.** Where the input is a real file format, a check against the actual files, not only a
   typecheck (a green typecheck proves nothing about a spreadsheet).

## What the brief carries

- **The test map** (from `tests-map`): each changed source file and the test files that name or import it, or
  `NO TEST FILE FOUND`. Start from the `NO TEST FILE FOUND` rows, then check the files that do have a test:
  does that test exercise the *changed* lines?
- **Coverage of the changed lines** (from `coverage`, when an existing report is present): executable changed
  lines covered or not. A report older than the change says nothing about it; say so rather than trusting it.
  Covered is not the same as asserted: a line executed by a test that checks nothing is still a gap.

## Running the tests

Run the fast suite **twice** when you can. A test that passes once and fails once is flaky: report it as
Important with the two results. A flaky test hides real breaks.

The brief carries the project's test gate result as `pass` / `fail` / `unavailable` / `blocked`. If it was
not run, you may run a fast test command read-only from the gates the brief lists. Report the result in the
same four states. A test that cannot run did not pass.

## Proposing the missing check

For each gap give the smallest runnable check: which file, what it asserts, the input that would make it
fail. Write the test only when the brief says `--fix`; otherwise describe it in `fix`.

Rate gaps Critical (money, security or data-integrity logic with no check), Important (other changed logic),
Suggested (test hygiene).
