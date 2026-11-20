# evals — the maintainer's walk-through (not read at runtime)

After any edit to this skill, its lenses or its helper, walk each request below on paper against `SKILL.md`,
`scopes.md`, the playbooks and the lens files. Every row must still route as written and every "must hold"
must still be written down. `/code` itself is never run to test this (root `CLAUDE.md` hard rule 11); the helper
is tested with `node tools/code-tools.mjs --self-test`.

| # | Request (project) | Route | Must hold |
|---|---|---|---|
| 1 | "check my changes before I commit" (any) | quality, `--changes` | the helper resolves the scope and lists changed ranges; fast gates run with a time limit and are reported in four states; three lenses (or one fast-path agent for 300 or fewer changed lines, said aloud); the security net is listed, not investigated |
| 2 | "review my code" (any) | one `AskUserQuestion` with two questions (mode, scope) | the scope is never defaulted; `--changes` is marked recommended; nothing is dispatched before the answers |
| 3 | `/code security --all` (a 40-module repo) | security, whole codebase | shards announced, riskiest first; agent runs = shards × 1, confirmed above about 12 with a "riskiest 3" offer; audit gate `unavailable` when offline, never "clean" |
| 4 | `/code quality --changes main` (a feature branch) | quality, this branch against main | the merge-base is used; uncommitted work is included; hunks only |
| 5 | `/code security --all src/api` | security, a path | only that folder is read; the entry-point map covers it |
| 6 | "why is this page slow" (a web app) | performance | the ladder is climbed and each finding names its rung; production build only; three traces, median; no speedup claimed without a measurement; project budgets used if present |
| 7 | "is this safe to expose on the LAN" (Song Snitch) | security | the open bind and the `exec` found by the helper and the lens; the entry-point map and history leads in the brief; Critical only with a traced path and a `verify` confirmation; "no Critical or Important found", never "secure" |
| 8 | "do we have tests for this change" (any) | tests | the test map and coverage of the changed lines; the fast suite run twice; a table of yes, weak or no; nothing written without `--fix` |
| 9 | "I renamed the script, are the docs right" (Development) | docs | `names` and `doclinks` outputs in the brief; the whole repo grepped for old names; doc line paired with code line |
| 10 | `/code quality,tests --changes` | combined modes | one scope, one run, the union of the lenses, de-duplicated, one verdict |
| 11 | a diff that adds `migrations/002_drop_col.sql` | quality | the helper reports "change-safety lens: TRIGGERED"; a column drop in the same migration as the new shape is Critical |
| 12 | `/code everything --all` (a large repo) | everything | the plan printed first (`7 × S = R`); confirm above about 12; one verify run; one verdict plus one per mode; the full report in the scratchpad above about 15 findings |
| 13 | `/code quality --fix` after a failing typecheck | quality with fixes | only confirmed findings with a fix, one at a time, the gate after each, a fix that breaks the gate undone; nothing committed; unverified if no fast gate exists |
| 14 | `/code --commit`, `/code --session`, `/code main` | aliases | they mean `--changes`, `--changes` limited to this conversation's files, and `--changes main` |
| 15 | `/code` with a clean tree and nothing unpushed | any mode | the helper stops the run with "empty scope"; no agent starts; no work is invented |
| 16 | `/code --changes no-such-branch` | any mode | "ref does not resolve"; no agent starts |
| 17 | a REVIEW.md Excluded Item tagged `[quality]` that would hide a Critical security finding | security | the finding is reported anyway and the conflict named; the tag never applies to the security lens |
| 18 | `/code help` | help | prints the mode and scope tables and stops |
| 19 | `/code everything --all` on a large repo, a usage limit hits during wave 2 | everything, halted | waves of 4, each result stored with `run done` the moment it returns; the first limit error is `run fail` (halts), no further wave, no retry loop; the report states coverage ("N of M shards") and the exact resume line; no "ready to ship" for the whole scope |
| 20 | `/code resume` in a new usage window | resume | no mode or scope question; `run status` gives the resume line; `run init` reuses every finished unit and dispatches only the rest; the shared context is not rebuilt |
| 21 | `/code quality --changes` repeated after editing one file, with an earlier finished run | quality | only units whose shard contains the edited file re-run; the others are reported as reused; `--fresh` reuses nothing |
| 22 | `/code everything --changes --bundle` | everything, bundled | two agents per shard (reader, runner) instead of seven, shards half the usual size, said aloud in the plan; each lens still a separate pass, findings labelled by lens |
| 23 | an agent returns "You've hit your usage limit" as its whole reply | any | never stored as a result (`run done` refuses it); `run fail` halts the run |
| 24 | a reviewer on a `.cs` or `.ps1` file with the `LSP` tool in its tools | quality | the `LSP` call errors (no server); the reviewer falls back to Grep and Read once, without retrying, and still cites only lines it read |
| 25 | `/code security --all` on a web app whose dev server is running on `localhost:3000` | security, live check | `probe http://localhost:3000` runs (GET and OPTIONS only); its output is in the shared `## security` section and the gates table lists the live check; a `fail` on foreign `Host` or a non-loopback bind is Critical; a missing header on a loopback tool is Suggested at most |
| 26 | the same request, but nothing is listening | security | the live check is `unavailable` and says so in the report; the app is never started to probe it; the report never says the headers are fine |
| 27 | "scan my-site.com" / `/code security` with a public URL, no ownership said | security | the helper refuses (`not on this machine`) and nothing is sent; the agent asks for the ownership confirmation in that turn before `--owned`; a well-known third-party domain is refused even if asked |
| 28 | `/code security --fix` on a finding that came from a `probe` check or a `prefilter` lead | security with fixes | the same check is run again after the fix; the fix counts only when it no longer fires; a `probe` re-check is the user's step (restart the app) and the fix is reported as unverified until then |
| 29 | a finding whose remedy is rotating a leaked key or renewing a certificate | security with fixes | tagged `owner action`; `--fix` never attempts it |
| 30 | `/code security --all` on a Next.js app with `app/api/contact/route.ts` that sends email, no auth, no limiter | security | the route is on the entry-point map with guard none and effect email, and appears under trust leads; the lens confirms or clears it against any global hook; it is not missed because the handler is `export async function POST` |
| 31 | `/code security --all` on a repo that vendors `jquery.min.js` | security | `deps` lists the library and version as not covered by any audit gate; the lens states a version and advisory or `unverified`, never "no known vulnerabilities" from memory |
| 32 | `/code security --all` on a Next.js app with a Stripe webhook route | security, domain selection | `domains` lists `web-auth`, `client-side` and `webhooks-abuse` with evidence; the run confirms each against the boundary it names and writes `Domain files:` plus one `Excluded: <id> — <reason>` line per rejected candidate into the shared `## security` section; each security unit reads only those files; an unsigned webhook route is also a trust lead on the entry-point map |
| 33 | a security reviewer finds nothing in its shard | security | its reply is `nothing found` followed by a `traced:` block with a `path:line` for every entry point in the shard; the report's attack surface is counted from those lines, never from the map alone |
| 34 | a route trusts `X-Forwarded-User` and the repo does not show the proxy that sets it | security | a `needs-validation:` entry with the exact blocker and a safe owner check, no severity, not counted in the verdict; `verify` keeps it `PLAUSIBLE`, or promotes it if the source answers it |
| 35 | a finding cites `src/a.ts:900` in a 200-line file | security | `cite-check` lists it as unresolved; it is dropped before verification and the report says "1 citation unresolved" |
| 36 | `/code security` in a clone of someone else's repo (origin owner not the user's, not under `Projects`) | security | `scope` shows the origin; tests, build, lint config and benchmarks are `blocked: target not verified as yours`; the static helpers still run; the user saying the code is theirs lifts the block |
| 37 | `/code security --all` over more than 3 shards | security, large | `recon1` runs alone first (`run next --kind recon`) and its trust map is in the shared section before the first wave; after the wave `crit1` runs once and each accepted `gap:` becomes one follow-up unit, one round only; what is left is reported as not reviewed and coverage is never called complete; a resume after a cut-off finds the `recon1` brief again |
| 38 | `/code quality --changes` that produces an Important finding | quality | the Important finding is verified like a Critical (batched with the others); the verdict wording stays the quality one |
| 39 | `/code security --all` in a project that carries a vendored toolkit (`.claude/toolkit/MANIFEST.json`) | security | `scope` says how many vendored files it left out; none of them is in a shard, on the entry-point map or among the prefilter leads |

Also check: every link in `SKILL.md` resolves; each lens file named in a playbook exists under
`~/.claude/agents/references/lenses/`; `review-reader` and `review-runner` cover all eleven lenses (seven plus
change-safety, verify, recon and coverage-critic); each id in the playbook's domain table has a file under
`~/.claude/agents/references/security-domains/`, and so does every id `domains` can print (the self-test asserts
it); no file uses "High" or "Medium" as a severity; the security lens's trailing blocks are named the same
everywhere (`needs-validation:`, `hardening:`, `traced:`), and `coverage:` stays reserved for the `run status`
line; no file mentions the removed agents `review-correctness`, `review-performance` or
`review-conventions`; no language checklist points at a skill, agent or command that does not exist on this
machine; the helper's `--self-test` passes (it covers the run ledger: waves, limit refusal, halt, resume, per-shard
invalidation, `--fresh`, retries, later-phase units, the `--kind` filter and a pending unit's brief surviving a
resume; the live `probe` rules against a bad and a good in-process server, the refusal of a foreign host, and the
Windows bind check; the Next.js route map and webhook lead, the added prefilter patterns, `domains`, `cite-check`,
the credential-free `origin:` line and the vendored-library listing). Every `run` subcommand named in `SKILL.md`
exists in the helper's usage line, and so do `probe`, `domains` and `cite-check`.

Added 2026-11-08 with the self-contained briefs, the stop hook and the findings pipeline (the helper tests cover each
of these in `--self-test`; walk them on paper too):

| # | Request | Route | Must hold |
|---|---|---|---|
| 32 | any run | dispatch | a lens brief inlines the core rules, the lens file, `REVIEW.md`, the language checklists for the stacks **of that shard's files**, and only the shared sections headed `all` or naming its lenses; the reviewer is not told to read those files again |
| 33 | `run next --fill 6`, an agent returns | rolling dispatch | `run next --fill 6 --returned <unit>` folds in what the hook stored and refills the window; a returned unit whose result did not arrive is reported `NOT STORED` and the fallback (`run done` with the reply on stdin) is used; nothing is dispatched once the run is halted |
| 34 | a reviewer's reply is a limit message | any | the hook files it as `.fail`, `run next` reports `FAILED (limit: run halted)`, and the run halts exactly as with `run fail` |
| 35 | a reviewer's reply does not follow the finding format | merge | `run merge` lists the reply raw as `NOT PARSED, merge by hand`; it is never dropped, and `run report` says it was not merged |
| 36 | two lenses flag the same line | merge | one finding, the highest severity, both lenses, the other wording kept as `also:`; two findings 1 to 3 lines apart from the same lens stay separate |
| 37 | a Critical comes back `PLAUSIBLE`, or has no verdict | verdicts, report | reported as Important with the reason; never as an unverified Critical; `REFUTED` is dropped and listed |
| 38 | a scope with files that write data or run processes | verify-plan | `look1` is planned in the same wave as the verify units, told the titles already reported; a second `verify-plan` plans nothing twice |
| 39 | a finding cites a file or line that does not exist | merge | dropped, counted and listed with the reason; `run edit <id> --restore` undoes it |

One environment limit: the Windows bind assertion in the `probe` self-test (`a 127.0.0.1 listener is loopback only`)
needs `netstat` to list a listener Node has just opened. In a shell where `netstat` does not (confirmed on
2026-10-30 in both the Bash and PowerShell tools of a Claude Code session, with the committed script too), the
self-test stops there with exit 1 and everything after it is unrun. That is the machine, not the helper: run it
from a normal terminal, or report the gate as `unavailable`, never as `pass`.
