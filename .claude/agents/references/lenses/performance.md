# Lens: performance — is it cheap to run?

Mode: `performance`. Agent: `review-runner`. You do not hunt correctness bugs, security holes or style;
other lenses own those.

## Label every finding

- **measured** — you ran something and have the number (raw values, the command, what it ran against).
- **likely** — reasoned from the code with a stated trigger and scale ("N+1 over the 200 rows on this page").
- **theoretical** — true only at a scale this project does not have.

**Never claim a speedup you did not measure.** Root `CLAUDE.md` § Claiming a measurement applies: a baseline
that was actually measured, no borrowed benchmark, a file size is not a speed. If the win is theoretical,
say "likely" and name what would confirm it. A theoretical finding is Suggested at most.

## What to look for

**Algorithmic and repeated work.** Work inside a loop that belongs outside it, quadratic scans over data that
grows, the same computation or read repeated per call, independent operations run one after another that
could run together, sorting or filtering done after a fetch that the database could do.

**I/O and data access.** N+1 queries, `SELECT *` on wide tables, missing indexes on a filtered or joined
column, unbounded result sets, loading everything to filter in memory, repeated file reads, sync I/O on a hot
path or at startup, chatty network calls with no batching, no timeout.

**Memory.** Unbounded growth (caches with no limit or eviction, listeners never removed, growing arrays),
long-lived objects built from closures that keep a large scope alive (prefer a class that copies only the
fields it needs), large objects copied on every call.

**Startup and payload (web).** Heavy libraries imported whole instead of by module, code that could load on
demand (editors, charts below the fold, export libraries), a vendor bundle that changes every deploy, images
without dimensions or in an old format, render-blocking assets, missing compression, hashed assets without
`immutable` and an HTML entry without `no-cache`, animation that is not compositor-only (`transform` and
`opacity`), unnecessary re-renders, long lists without virtualization. Loading priority: the LCP image
lazy-loaded, absent from the server HTML or without a priority hint (`fetchpriority="high"`, `priority` on
`next/image`); more than two high-priority images; `srcset` without `sizes`; a CSS `@import` chain; a
parser-blocking script in `<head>`; `content-visibility: auto` without `contain-intrinsic-size`, or on a small
page; `Cache-Control: no-store` on a page that holds nothing private (it disables the back/forward cache). Name
the replacement from `~/.claude/agents/references/platform-native.md` § Legacy web patterns; these are
"likely" until a trace shows the cost.

**Desktop (static pass, no running app needed).** Large lists not virtualised (`VirtualizingStackPanel`),
brushes and geometries not frozen (`Freeze()`), `DropShadowEffect` or other effects on large or animated areas,
deep layout nesting, binding work done on the UI thread, timers firing faster than they need to.

**Concurrency.** Blocking calls on a UI or request thread, unbounded parallelism, a lock held across slow work,
polling where an event exists.

## The measurement ladder

Take the highest rung that exists for the finding, and label it accordingly: **(1)** an existing benchmark or
profile script; **(2)** timings from the project's test run; **(3)** a profile or trace the parent captured
(browser traces from a production build, three runs, median); **(4)** a query plan; **(5)** reasoning from the
code with a stated trigger and scale. Rungs 1 to 4 can support "measured"; rung 5 is "likely" or
"theoretical". Profilers (a Node CPU profile, `py-spy`, `dotnet-trace`) are optional: name the one that would
confirm a finding, but never install one.

**Budgets.** If `.claude/REVIEW.md` has a `## Performance budgets` section, judge measured numbers against
**the project's own** budget and say which one was exceeded. Never invent a budget.

## How to measure

Use what exists, read-only, and say what you ran. The existing test run with timings, an existing benchmark or
profile script, `EXPLAIN` or `EXPLAIN QUERY PLAN` on a read query against a local copy (never write, never a
live source system), bundle output sizes from an existing build. The brief carries any browser-trace numbers
the parent captured (Core Web Vitals from a production build, never the dev server); you cannot drive the
browser yourself, so without them a web finding is "likely". Never launch an elevated app. If you cannot
measure, the finding is "likely" or "theoretical", and that is fine.

## Reject optimizations that cost more than they save

Fragile build coupling, silent footguns, a dependency whose upkeep exceeds the win, a micro-optimization that
measurably hurts readability for under 1% gain. Say so in the report instead of staying silent.

## Tension

Speed often trades against clarity and against the correctness lens (a cache can serve stale data). When your
fix would weaken a check or hurt readability, say so and name the principle that breaks the tie. A cache is
only acceptable under a key that includes everything it derives from, so a stale entry is impossible rather
than unlikely.
