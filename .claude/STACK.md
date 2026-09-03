# STACK

Technologies, conventions, and code patterns. Read this before writing or changing code.
For system structure see [ARCHITECTURE.md](ARCHITECTURE.md); for endpoints see
[API.md](API.md); for secrets see [SECURITY.md](SECURITY.md).

## Languages & runtime

<!-- Pinned language/runtime versions and where they're pinned. -->

## Dependencies

| Concern | Choice | Version |
| --- | --- | --- |
| … | … | … |

Pin exact versions — no ranges. Commit the lockfile. Justify any new dependency in one
sentence in this table, in the same change that adds it.

**Not in the stack:** <!-- what this project deliberately avoids — no ORM, no UI library,
no test framework, no state library — so nobody adds one by reflex. -->

Package manager: <!-- uv / npm / yarn — and "never <the other one>". -->

## Directory conventions

<!-- Where configuration and constants live, so they don't get scattered. -->

## Naming conventions

<!-- Project-specific naming that isn't obvious from the language: blueprint/module
     suffixes, id formats, storage keys, config tuple shapes. -->

## Import patterns

<!-- The canonical import block for a new file in this project. Copy-pasteable. -->

## Code patterns

<!-- The two to five patterns that every new file must follow — the response helper, the
     logger, the decorator, the wrapper. Show real code, not prose. An agent copies what
     it sees far more reliably than what it's told. -->

## Commands

```text
<!-- dev / build / test / lint / migrate -->
```

## Quality gates (required before merge)

<!-- Numbered, each with the exact command. An agent cannot infer when it's done. -->

1. …
2. **`/code --commit`** run after any code change (see [../CLAUDE.md](../CLAUDE.md)).

## Coding principles in practice

Concrete anti-pattern → fix examples of the four
[coding principles](../CLAUDE.md#coding-principles). The overcomplicated versions below are
not obviously wrong — they follow real design patterns. The problem is **timing**: they
add complexity before it is needed.

### 1. Think before coding — surface assumptions, don't invent them

For "add a feature to export user data", don't silently decide scope, destination, format,
and fields. List the open questions and propose the simplest concrete option first:
*"Scope — all users or a filtered subset (privacy)? Delivery — browser download,
background job, or an endpoint? Which fields (some are sensitive)? Simplest approach: a
paginated JSON endpoint — is that what you want?"* Same for "make the search faster":
name the interpretations (latency vs. throughput vs. perceived speed) and ask which one
matters, rather than optimizing all three.

### 2. Simplicity first — one function until the complexity is real

"Add a function to calculate discount" is one multiply, not an abstract `DiscountStrategy`
hierarchy with a config object and a calculator class. "Save user preferences" is one
statement, not a `PreferenceManager` with caching, validation, merging, and notifications
nobody asked for. Add caching when performance actually hurts; add validation when bad
data actually appears.

### 3. Surgical changes — change only the lines the task needs

Fixing "empty emails crash the validator" means fixing *that*. Not, in the same diff:
tightening unrelated email rules, adding a length check, rewriting comments, adding a
docstring, swapping quote style, or adding type hints. When adding logging to a function,
add the logging and match the file's existing style — don't reformat the body.

### 4. Goal-driven execution — verifiable steps, reproduce before you fix

Replace "I'll review and improve the code" with a plan whose steps each name a check:

```text
1. Failing test that pins the intended tie-break order  → verify: test fails for the right reason
2. Fix with a stable, explicit sort key                 → verify: test passes
3. Re-run the suite                                     → verify: no adjacent regression
```

### Anti-pattern summary

| Principle | Anti-pattern | Fix |
| --- | --- | --- |
| Think before coding | Silently assumes format, fields, scope | List assumptions, ask before coding |
| Simplicity first | Strategy pattern for one calculation | One function until complexity is real |
| Surgical changes | Reformats quotes / adds type hints while fixing a bug | Change only the lines that fix the issue |
| Goal-driven | "I'll review and improve the code" | "Failing test for X → make it pass → check no regression" |

**Key insight:** good code solves today's problem simply, not tomorrow's problem
prematurely. Simple versions are faster to write, easier to test, and can be refactored
*when* the complexity is genuinely needed.
