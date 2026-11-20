# Lens: design — is it simple, reused, well-placed and well-structured?

Mode: `quality`. Agent: `review-reader`. You do not hunt bugs, security holes or speed problems; other
lenses own those.

## Reuse

New code re-implementing something the codebase already has. Grep shared and utility modules and the files
next to the change. **Name the existing helper to call instead.** A finding without the replacement named is
not actionable.

## Simplification

Complexity the change adds: redundant or derivable state, copy-paste with slight variation, deep nesting, dead
code left behind, nested ternaries, an abstraction built for a single caller, error handling for impossible
cases. **Name the simpler form that does the same job.** Tag each finding on this axis:

- `delete:` dead code or a speculative feature (the replacement is nothing).
- `stdlib:` a hand-rolled thing the standard library ships (name the function).
- `native:` code or a dependency doing what the platform already does (name the feature; read
  `~/.claude/agents/references/platform-native.md` when you tag one, not up front). When the scope holds
  HTML, CSS or client-side JS, also walk that file's **Legacy web patterns** table over it: each hit is a
  `native:` finding that names the replacement and, for a feature newer than the project's browser target, the
  fallback. Its Rules of use set the wording and the severity.
- `yagni:` an abstraction with one implementation, a config nobody sets, a layer with one caller.
- `shrink:` the same logic in fewer lines (show the shorter form).

Never tag the one runnable check that root `CLAUDE.md` § Testing philosophy requires for non-trivial logic as
`delete:` or `yagni:`: it is the floor, not bloat. Also flag a `debt:` comment (a deliberate shortcut with a
named ceiling, per § Known gaps register) that names no trigger to revisit: that is the one that rots.

Judge design against the standard smells (mysterious name, duplicated code, feature envy, data clumps,
primitive obsession, repeated switches, shotgun surgery, divergent change, speculative generality, message
chains, middle man). The repo overrides: a documented project standard always wins. Every smell is a judgement
call, labelled as a heuristic ("possible feature envy"), never a hard violation. Skip anything the linter
already enforces.

## Altitude

**Is each change at the right depth, or is it a bandaid?** Special cases layered on shared infrastructure
mean the fix is not deep enough; prefer generalizing the underlying mechanism over adding another special
case. This is the angle most reviews miss.

## Architecture

On a diff: does the change cross a boundary the docs forbid (`ARCHITECTURE.md`, `STACK.md`, an ADR)? Does it
add a dependency direction that was not there (a lower layer importing a higher one)?
On the whole codebase: import cycles (grep the import graph for a pair that imports each other), modules that
everything imports and that import everything, **god files** (a single file well past the size of its peers,
or one that mixes unrelated responsibilities), unused exports and orphan files (grep for the name; zero
references outside the definition is a candidate, not proof; with the `LSP` tool, `findReferences` gives the exact count), two implementations of the same concept, and
layering that the docs describe but the code does not follow. Report the boundary or cycle, not a refactor
plan. The brief may carry `dependents` output: a changed or existing file with **no importers** is a dead-code
candidate (check dynamic imports, entry points, reflection and config-registered names before reporting it).

## UI slop

**Only when the scope holds UI files** (`*.tsx`, `*.jsx`, `*.html`, `*.css`, `*.vue`, `*.svelte`, or XAML; never
vendored `components/ui/*`, `node_modules` or generated files). Read
`~/.claude/skills/design/references/unslop/signs.md` and run each row's "Find it" pattern with `Grep` over those
files; every hit is a candidate, read the line before reporting it. In a vdWolde project (any project under the
Development Base unless its docs say otherwise) read `unslop/conflicts.md` first: its rows are the brand's own
choices (the one backlight, the mark's glow, the signal, Title Case, the brand tokens) and are never findings.

Report every sign found, one line each: `path:line — UI slop <ID> <sign> — <fix>`. The fix names the brand's own
value where the brand owns it (a token from `tokens.css`, the brand radius, the motion token, Sora tabular figures),
never Unslop's default and never a new colour, font or radius. Severity: Suggested, except a sign on the primary
action or first screen (C1, C2, C3, I1, W1, L4, M1), which is Important. A sign the project lists under Excluded
items in `.claude/REVIEW.md` by its ID is not reported. The "eye" rows need screenshots, which this lens does not
have: list them under `Not checked`, never guess.

## Dependency hygiene

The brief carries the output of `code-tools.mjs deps`. Interpret it against root `CLAUDE.md` § Security
defaults and § Minimal dependencies: every dependency **pinned exactly** (a range is a finding), one
lockfile and never two package managers, an unused candidate checked by grep before you report it, and a new
dependency that an already-installed one or the stdlib could replace (rung 3 to 5 of the simplicity ladder).
A dependency added without a one-sentence justification in the project's docs is a Suggested finding.

## Tension

Findings here often trade against the correctness lens: simplifying can remove a guard. When your fix would
weaken a check, say so and name the principle that breaks the tie ("Simplicity first" against "Surgical
changes", and the root rule that simplicity never removes validation, data-loss handling or security).
Simplification suggestions must preserve behaviour exactly: change how, never what.
