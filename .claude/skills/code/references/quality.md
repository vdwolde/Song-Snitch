# quality — bugs, standards, formatting, architecture, dependency hygiene

Lenses: `correctness`, `design`, `conventions` (all `review-reader`), plus **`change-safety`** when the scope
line says it is triggered (migrations, schema, `.sql`, OpenAPI or schema files, a public API). With 300 or fewer
changed lines, one `review-reader` carries the lens files in turn (the fast path; see `SKILL.md`).

## Before the agents

1. The gates, fast ones: lint, format check, typecheck. Run the tests too when the gate is fast; otherwise ask,
   or report the test gate `unavailable`. Save the results to the `conventions` lens (it reports a `fail`).
2. `run prep` does the rest, once, and addresses each output to its lenses: `prefilter --mode quality` leads to
   `correctness` and `design`; `deps` (dependency hygiene) to `design`; `dependents` (the direct importers of up to
   15 changed files, read-only context for `correctness`: does anything that calls this still work?, and
   dead-code candidates for `design`). Reviewers with the `LSP` tool can get the exact version with
   `findReferences`; `dependents` stays because it needs no server and also covers C# and PowerShell.
3. **Security net, cheap.** `prep` also runs `prefilter --mode security`. If it returns Critical-shaped leads
   (`known-token-shape`, `hardcoded-secret`, `shell-exec`, `sql-concat`, `dynamic-eval`, `tracked-env-file`),
   do not investigate them here: list them at the end of the report and suggest `/code security`.

## Web front ends

When the scope holds HTML, CSS or client-side JS, say so in the `design` lens brief: it then walks
`~/.claude/agents/references/platform-native.md` § Legacy web patterns and reports each legacy pattern with the
modern replacement named (and the fallback, when the feature is newer than the project's browser target, which
is Baseline Widely available unless `.claude/STACK.md` says otherwise). Pass the project's browser-support line
if it has one.

## Architecture

On `--all`, or changes spanning many modules, tell the `design` lens to run its **Architecture** section over
the whole scope (boundaries, cycles, dead modules, god files). On a small change it only checks that the change
does not cross a boundary the docs forbid.

## Report emphasis

Critical is a hard-rule violation, a bug, or a data-loss or integrity risk. Important is a correctness risk, a
convention violation, a failed gate, or a breaking change. Suggested is naming, small simplifications and doc
touch-ups. Lead with the gates table, because a failing typecheck outranks most opinions.

## Next

`/code tests` if changed logic has no check. `/code docs` after a rename or removal. `/code security` if the
security net found leads. For `quality,tests` together, say `/code quality,tests`.
