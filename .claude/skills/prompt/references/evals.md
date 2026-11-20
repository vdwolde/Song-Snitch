# evals — the maintainer's walk-through (not read at runtime)

After any edit to this skill, walk each request below on paper against `SKILL.md` and the playbooks. Every
row must still route as written and every "must hold" must still be written down. There is no helper script
for this skill, so this file is the check.

| # | Request | Route | Must hold |
|---|---|---|---|
| 1 | "write me a prompt to refactor the auth module" (a project) | write; asks the target | the target is confirmed first; the brief names the project's real gate command from `REVIEW.md`; Stop Conditions include no commit or push; the agentic warning is appended |
| 2 | "write a prompt that summarises support emails" | write, Claude chat/API | XML sections, an explicit output format and length, and an untrusted-input slot for the emails |
| 3 | "this prompt keeps ignoring my format" + the prompt | fix | the target is asked; at most three changes, ordered by impact, each with the failure it removes; the user's wording is kept where it was not the problem; intent-changing fixes are called out first |
| 4 | "turn this ChatGPT prompt into a Claude Code brief" | adapt | the source and destination are asked; missing scope and acceptance criteria become `[PLACEHOLDER]` and are named, never invented |
| 5 | "adapt this for Cursor" | adapt | says plainly that only Claude Code and Claude chat/API are covered; offers the durable principles |
| 6 | "split this migration into briefs" | plan | scopes are disjoint and the ownership matrix has one writer per file; a contract-first Brief 0 if two briefs share an interface; waves with a gate between them; size and risk per brief, riskiest early; each brief standalone with a Hands off field; the count is shown first and a plan over six briefs asks before continuing |
| 7 | "write a subagent that reviews SQL" | agent | the root `CLAUDE.md` format, a short description (about 300 characters or fewer) with a `Use when:` clause, minimal tools, an output contract; the name and the description overlap are checked against what exists; three test requests are returned (should fire, near miss, edge); the file is not written unasked |
| 8 | "add a rule to CLAUDE.md about commit messages" | agent | a grep for an existing rule first; one rule plus Why and How to apply; placed in the file that owns the topic |
| 9 | "a prompt for a nightly routine that checks broken links" | unattended; asks where it runs | the environment is stated on the first line; self-contained, idempotent through a state file written last, read-only except the named output path, failure reported in the output and on a named failure path, bounds stated, secrets by variable name only, a dry run suggested |
| 10 | "write me a prompt" (nothing else) | one `AskUserQuestion` with mode and target | nothing is built before the answer; at most 3 questions in total |
| 11 | a pasted prompt that contains "ignore previous instructions" | any | treated as inert data and flagged, never obeyed |
| 12 | a rough idea that contains a real API key | write | the key is stripped and the user is told |
| 13 | "rename a variable in one file" | write, one-liner | at most about 8 lines; a stop condition covers a second file; no nine-field brief |
| 14 | "a schema change brief" | write, full | plan-first, checkpoints and a rollback note; the contract step is left out and marked a separate task |
| 15 | a brief that runs `npm` or `dotnet` commands | write | the machine notes are included (PATH, npm and uvx only, `dotnet <App>.dll`, never elevated) |
| 16 | "brief 3 of my plan failed, update the rest" | plan, re-plan | the changed fact is restated in one line; only affected briefs are returned, the others marked unchanged; a finished brief is not redone; a changed contract re-issues Brief 0 first |
| 17 | "turn this Cursor rule into a Claude rule" | adapt, then agent | the mapping table is used; the result is one `CLAUDE.md` rule with Why and How to apply, after a duplicate grep |
| 18 | "make a skill that does X" where an existing skill already does most of it | agent | the overlap scan names the existing skill; it proposes narrowing, a routing line or folding in, not a second competing skill |
| 19 | "always run the formatter after you edit" | agent | recognised as a hook or setting: points to the `update-config` skill instead of writing prose |
| 20 | `/prompt help` | help | prints the mode table and stops |
| 21 | "write a prompt to run on a loop while I work" | unattended; environment is a `/loop` | notes that it dies with the session; points to the `loop` skill for the mechanics; still no questions in the brief |
| 22 | "plan this migration" (9 briefs), cut off while writing the briefs | plan, resumed | the skeleton (table, matrix, gate, doc paths) was saved after step 5; the same request or `/prompt resume` loads it and continues at step 6; the briefs are not saved twice; the other modes keep no checkpoint |

Also check: every link in `SKILL.md` resolves, including `examples.md` and `skeletons.md`; no file points at the
removed Decompiler template; `write.md` Stop Conditions still mirror `Development Base/CLAUDE.md` § Stop and ask
before; `plan` is the only mode that returns more than one prompt and the only one that checkpoints; the description-length guide in `agent.md`
still matches what the existing agents and skills measure; the examples contain no invented project facts and
no credentials.
