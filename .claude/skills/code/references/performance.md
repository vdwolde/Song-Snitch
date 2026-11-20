# performance — anything about speed and resource cost

Lens: `performance` (1 agent per shard, `review-runner`).

## Before the agent: climb the measurement ladder as far as it goes

Take the highest rung that exists and pass what you got in the brief; the reviewer cannot drive a browser.

1. **An existing benchmark or profile script** in the project. Run it if its gate is fast.
2. **The test run with timings** (the project's own command), if fast.
3. **A browser trace** for a runnable website: only on a **production build**, never the dev server.
   chrome-devtools: `performance_start_trace` with a reload, `performance_stop_trace`,
   `performance_analyze_insight`; three runs, the median of each metric with the raw values.
   (`lighthouse_audit` excludes performance.)
4. **A query plan:** `EXPLAIN` or `EXPLAIN QUERY PLAN` on read queries against a local copy. Never write; never a
   live source system.
5. **Static reasoning.** Desktop apps have nothing to run; the reviewer does the static pass and any *measured*
   number is `unavailable`. Never launch an elevated app to measure it.

Optional profilers (a Node CPU profile, `py-spy`, `dotnet-trace`) are named in the report as the way to confirm
a finding; none is installed without asking.

`run prep` runs `prefilter <scope> --mode performance` for leads. On `--all`, the shards come riskiest first (recent churn,
fix commits, size): start there. For a web front end, name the page's likely LCP element in the brief when you
know it (the lens checks its loading priority against `platform-native.md` § Legacy web patterns). If `.claude/REVIEW.md` has `## Performance budgets`, pass them: findings are
judged against the project's own numbers.

## Report emphasis

Every finding is labelled **measured**, **likely** or **theoretical**, with the rung it stands on, and a
theoretical one is Suggested at most. Open with the single slowest thing and how we know. Order the rest by
impact times confidence. State a speedup only as a before and after you measured, with the command. Say which
suggestions trade against correctness (caches, shortcuts) so the user chooses.

## Next

`/code tests` before applying a risky optimization. `/code quality` after a `--fix`.
