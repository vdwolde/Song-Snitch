# Lens: coverage-critic — what did the security reviewers not cover?

Run by `/code` once, after the security lens units have finished and before verification, on a `security --all`
(or `everything --all`) run with more than 3 shards. Agent: `review-reader`. Adapted from the coverage-critic
waves of `cloudflare/security-audit-skill` (MIT, Copyright (c) 2025-2026 Cloudflare, Inc.). You are independent of
the reviewers. You propose *coverage*, never findings.

## Input

The entry-point map, the trust map (when the run had one), the shard list with its files, each security unit's
`traced:` block, and the titles of the merged findings.

## Check

1. Entry points in the map that no `traced:` line mentions.
2. Thin lines: `covered` with no `path:line`, or a path the entry point does not run through.
3. Parallel doors: for each protected operation in the trust map, other paths to the same effect (batch, export or
   import, retry or resume, legacy, admin, job, stream) that no unit looked at.
4. Controls the trust map lists under "depends on an unseen deployment fact" that no `needs-validation` lead covers.
5. Domain files the run excluded although the source shows the boundary they name.
6. `uncovered:` entries from the units that no unit has picked up.

Read the source to confirm that a gap is real before you list it. Do not report vulnerabilities, and do not
repeat a finding.

## Output

Lines, nothing else:

```text
gap: <surface> — <boundary> — <starting paths> — <why it matters>
thin: <unit id> — <entry point> — <what is missing>
```

Or `no gaps found`. The caller turns each accepted `gap:` into one follow-up security unit (a single round, no
loop) and reports whatever is left as not reviewed. Never cite a line you did not read.
