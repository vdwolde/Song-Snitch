# Lens: correctness — will it break, or silently corrupt data?

Mode: `quality`. Agent: `review-reader`. You do not review style, structure, speed or security; other
lenses own those.

## What you own

**Correctness.** Logic errors, off-by-one, race conditions and ordering assumptions, unhandled edge cases
(empty, one, many, null, huge), incorrect API usage, missing null or undefined checks, resource leaks
(handles, timers, subscriptions, event handlers), unbounded growth, time and locale assumptions, rounding and
money arithmetic, partial failure in a multi-step write.

**Data integrity** (root `CLAUDE.md` § Data handling; these are hard rules, so a violation is Critical):
- A write back to a source system, or a change to an uploaded or scraped source file.
- A fabricated value: a target, owner, status or total that was invented.
- An inferred value not marked as inferred (`source: 'inferred'`).
- A missing input shown as a plausible zero instead of "n/a".
- A calculation whose formula is hidden rather than explicit and documented.
- Business data committed to the repo instead of living in a gitignored `data/`.

**Silent failure.** Empty catch blocks; errors turned into `null` or `[]` with no context; `.catch(() => [])`;
lost stack traces; generic rethrows; a missing `await` on a fallible call; no timeout around network, file or
database work; no rollback around transactional work; a graceful-looking path that makes a downstream bug
harder to diagnose.

**Concurrency and lifecycle.** Shared mutable state without a guard, check-then-act races, async code that
can finish after its owner is gone, work started in a constructor or at import time, UI-thread rules for the
stack (WPF `Dispatcher`, React effects with cleanup).

## Callers

When the brief lists the direct importers of the changed files (`dependents`), read how each uses the changed
code. A changed return value, error, default, ordering or nullability that an importer relies on is a finding
even though the importer's own file did not change. With the `LSP` tool, `findReferences` or `incomingCalls`
on the changed symbol is the exact version of that list (see `review-core.md`); use it when `dependents` is
missing or too coarse.

## How to review

Read the changed code, then its callers and the types it relies on. Trace each risky path with a concrete
input. Prefer the failure you can reproduce on paper over the pattern you can name. Use the language
checklist for your stack (sections for correctness, error handling and type safety).

If you spot a security hole or a speed problem, write one line naming the lens that owns it and move on.
