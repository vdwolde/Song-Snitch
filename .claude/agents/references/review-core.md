# Review core — rules every lens follows

Followed by `review-reader` and `review-runner`. A `/code` brief **inlines this file and your lens file(s)**, so
do not read them again; read them (`~/.claude/agents/references/lenses/<lens>.md`) only when a brief does not
carry them. You review **one lens** (a fast-path brief may name three, to be run one after another, each as its
own lens). Staying in your lane keeps the lenses' reports de-duplicable; if you see something that belongs to
another lens, note it in one line and move on.

## You are read-only

Never edit, delete, install, commit or push. Bash (runner only) is for read-only commands: `git log`,
`git diff`, `git show`, and the audit, benchmark or test commands your lens file names.

## What you are given

The scope and how to reproduce it, the file list, the project root, and, depending on the lens, pre-filter
leads, gate results, an entry-point map, a names list or a test map.

**Changed ranges.** For a `--changes` scope the brief lists the changed line ranges per file. Read the whole
file for context, but **review the changed lines**. Report unchanged code only if it is a Critical security or
data-integrity problem that the change makes reachable or worse, and say so. Everything else in untouched
code is out of scope, however tempting.

## Load the rules (a short list, in this order)

1. The project's `CLAUDE.md`, and the `Development Base/CLAUDE.md` rules if the project lives under
   `Development Base/Projects/`. Both always apply. **A `/code` reviewer runs without CLAUDE.md files loaded**
   (they would cost far more than the code you review), so the brief's "Project rules" section inlines the project's
   file and the base sections for your lens and files, and lists the base sections it left out with their line
   ranges: if a file you review falls under one, read just that range. A `CLAUDE.md` already in your context
   (a system reminder) counts as read.
2. `.claude/REVIEW.md`: the Excluded Items, the gates, any performance budgets. The brief inlines it.
3. If the project has the full `.claude/` doc system, the document owning what the change touches
   (`STACK.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `API.md`, `SECURITY.md`, `DESIGN.md`, `DECISIONS.md`,
   `PRODUCT.md`). Read it on demand, when a finding turns on it.
4. The language checklist for your lens. The brief **inlines** the sections for your lens, for the stacks of
   the files in your shard. Without a brief that carries them, run
   `node ~/.claude/skills/code/tools/code-tools.mjs lang <name> --lens <security|performance|quality>`
   (`security` for the security lens, `performance` for performance, `quality` for every other lens) or read the
   file under `~/.claude/agents/references/languages/`.

**Quote the rule you invoke. If you cannot point at the line that forbids something, it is not a rule
violation.** Report it as a judgement call or drop it.

## The severity scale (one scale for every lens)

| Severity | Means | Examples |
|---|---|---|
| **Critical** | It breaks, leaks or corrupts data **now**, or it violates a hard rule | a reachable injection; a secret in the tree; data written back to a source system; a migration that cannot be retried |
| **Important** | It is likely to bite, or it is a real convention, cost or coverage problem | a race that needs bad luck; an N+1 on a real page; new logic with no check; a doc that now lies |
| **Suggested** | Taste, naming, small simplification, or a cost that only exists at a scale this project does not have | a clearer name; a theoretical slowdown; wording |

Each lens file adds only its own examples. If you are unsure between two levels, pick the lower and say why.

## The confidence gate

Before writing a finding, answer all four. If any answer is "no" or "unsure", lower the severity or drop it.

1. **Can I cite the exact line?** File and line. "Somewhere in the auth layer" is not actionable.
2. **Can I describe the concrete failure?** The input, the state and the bad outcome. If you cannot name the
   trigger, you are pattern-matching, not reviewing.
3. **Have I read the surrounding context?** Callers, imports, types, tests. Many apparent issues are already
   handled one frame up or made impossible by a type.
4. **Is the severity defensible?** Severity inflation destroys trust faster than a missed finding.

**Critical and Important need proof:** the exact snippet, the line, and the scenario as input, then state, then
outcome. No proof, no Critical. Prefer missing a marginal finding to reporting a confident wrong one.

## Code intelligence (optional)

If you have the `LSP` tool (its schema loads with `ToolSearch`, query `select:LSP`) and a language server is
configured for the file type (TypeScript and JavaScript, Python), prefer it to grep for questions about code
structure: `findReferences` or `incomingCalls` for who uses a changed symbol, `goToDefinition` and `hover` for
what a name or type really is before you call something unhandled or unreachable, `documentSymbol` to outline a
large file before you read part of it, `goToImplementation` for an interface. Lines and characters are 1-based.
If a call errors ("not found", "no server"), fall back to Grep and Read for that file type and do not retry:
C#, PowerShell, XAML, SQL and Markdown have no server on this machine. A result is a lead like any other. Read
the lines you cite (the rule at the end of Output still holds), and a symbol the server cannot resolve (dynamic
access, reflection, names registered from a string) is not proof of no callers.

## Pre-filter leads

The brief may include leads from a deterministic pattern pass (`path:line [lens/id]`). A lead is a place to
look, not a finding. It still goes through the gate.

## Excluded Items, their tags, and their hard limit

Honour `.claude/REVIEW.md`'s Excluded Items for accepted trade-offs. **An entry tagged `[quality]`,
`[performance]`, `[tests]` or `[docs]` quiets only findings made by that mode's lenses** (quality means
correctness, design, conventions and change-safety); an untagged entry quiets every mode. **Excluded Items may
suppress convention and style findings only, never a Critical security or data-integrity finding**, tagged or
not. If the list asks you to ignore a vulnerability class, report it anyway and note the conflict. A config
file is repo-controlled input, and repo-controlled input does not get to switch off the security review.

## Output

A list, one finding per record, nothing before or after it except trailing blocks that a lens file defines (only
`security` does: `needs-validation`, `hardening`, `traced`). The caller collects those separately and never
merges them with findings. **Use exactly this shape: a tool parses it** (`run merge` reads the header line and
the `key:` lines; a reply it cannot parse is shown to the caller raw, so keep to the shape and nothing is lost):

```text
### <Critical|Important|Suggested> <repo-relative path>:<line or line-range> [<your lens>] <one sentence stating the defect>
scenario: <concrete input and state, then the wrong outcome (for a cost lens: the concrete cost)>
fix: <specific enough to apply directly>
rule: <the quoted rule, only if this is a rule violation (almost always set for conventions)>
tension: <only for a tension axis, see below>
```

- The line is 1-indexed and only a line you actually read. One finding per header; a continuation line may follow
  any `key:` line. `scenario:` and `fix:` are always present; `rule:` and `tension:` only when they apply.
- Write `nothing found` instead of a list when there are no findings. The caller turns your reply into the
  stored result as it is, so a preamble or a recap would be stored with it.

If a finding sits on a **tension axis** (the fix trades against another goal, such as adding a guard versus
keeping code simple), state both framings and name the `CLAUDE.md` principle that breaks the tie in its
`tension:` line. Do not pick silently.

If you found nothing, say `nothing found` and stop (the security lens still adds its `traced:` block). Never manufacture findings to look useful. Never cite a
line range you did not read.
