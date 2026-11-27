---
name: design
description: Frontend and UI design in four modes — create (new design, new screen, or a system extension such as dark mode), overhaul (three different design directions on a Claude canvas to choose from), improve (keep the look, make it bolder, quieter or richer), polish (consistency, audit, harden, optimize, document). Web, Windows desktop (WPF, WinUI, Avalonia) and tray utilities. Named house styles win over keyword matching: vdWolde (Brand Guide v1.1) is the DEFAULT for every project in this base and needs no name; Liquid Glass and its aliases glassmorphism 2.0, gel glass apply only when named. Use when: design a UI, new screen, add dark mode, redesign, different look, make it bolder, make it quieter, improve the design, polish, audit or review the design, pick a palette, choose fonts, vdWolde brand, Liquid Glass, in Liquid Glass, Liquid Glass look, named house style, unslop, looks AI-generated, vibecoded.
---

# /design

Four modes, each a single continuous pass: state the Design Read once, work through the mode's phases in
order, verify once at the end. Never run a mode as a chain of steps that each re-read the project. Covers
web *and* Windows desktop UI.

## Step 1 — Pick the mode

| Mode | Use it when | Playbook |
|---|---|---|
| `create` | No design yet, or a new screen, flow or system extension (dark mode, a theme, RTL) in an existing app | [create.md](references/create.md) |
| `overhaul` | The user wants a *different* look: analyse, then 3 distinct options on a Claude canvas to choose from | [overhaul.md](references/overhaul.md) |
| `improve` | The user likes the look and wants it better: bolder, quieter, new colours, density, more or less motion | [improve.md](references/improve.md) |
| `polish` | About to ship, or a pass over what changed: consistency, audit, harden, optimize, document | [polish.md](references/polish.md) |

**If the request clearly fits one mode, start it.** Hints: "new page", "add dark mode", "make it look like
`<site>`" → create. "Redesign", "refresh", "I hate this look", "show me options" → overhaul. "Bolder",
"quieter", "change the accent to teal", "tighten the spacing", "redesign this button" → improve. "Tidy up",
"make it consistent", "ready to ship", "review my UI" → polish ("review" and "audit" mean report only).
"Unslop", "looks AI-generated", "vibecoded" → polish, run as [unslop/passes.md](references/unslop/passes.md) says
(audit, stop with the signs, then the nine passes); a request for a new look on top of that is overhaul.
**If it is vague** ("make it better", "design this"), ask once with `AskUserQuestion`: the four modes as
the options, each "use it when" line as its description. Never guess a mode for a vague request and never
run several on one request; two modes run in sequence, each with its own Design Read.

**The default house style is `vdwolde`** (Brand Guide v1.1, `references/styles/vdwolde/`): in any project under the Development Base (and any new vdWolde project, app, tool or site) it applies without being named, for `create`, `improve`, `polish` and `overhaul` alike. The spec points at `branding/brand.json`; follow it, do not re-derive a look from the catalog. It is skipped only for client sites, vdwolde.com, vendored third-party templates and frozen work projects, or when the user names another house style or an explicit departure.

**A named house style takes precedence over catalog keyword matching** (today `vdwolde`, the default, and
`liquid-glass`, which answers to "in Liquid Glass", "glassmorphism 2.0", "gel glass"). Load its spec before
choosing anything and follow [discover.md](references/discover.md) § 2, which owns the rule: a house style is a
brand book (`create` and `overhaul` skip their direction-picking), "apply it to this app" is an overhaul-class
change, and a vague "make it glassy" is not a name.

Old verbs still work as shortcuts: `bolder`, `quieter`, `overdrive`, `distill`, `delight`, `clarify` mean
`improve` with that dial answered; `audit` means `polish`, report only (edit nothing).

### What each mode may not do

- **create** — in an existing app, never change existing tokens or components; add to them.
- **overhaul** — changes nothing in the codebase until the user picks an option *and* says apply now.
- **improve** — stays inside the **language fingerprint**. Token values change; the language does not.
- **polish** — adds no routes, screens or features (missing *states* are fine). A token value changes only
  to fix a defect (failed contrast, near-duplicate values).

**Where DESIGN.md lives.** `branding/DESIGN.md`. A project outside the Development Base, or a generated build (Website
Builder's `builds/`), may keep it at `.claude/DESIGN.md`: use the one that exists, never make a second.
In a project with `branding/README.md`, update that overview when you add, move or remove a design file.

**The fingerprint** is five lines in `branding/DESIGN.md` under `## Design language`: style, type pairing,
colour strategy, layout archetype, motion tier. `improve` may change the motion tier and every token value,
accent hue included, but not the other four; to cross the line it asks (overhaul, stay inside, or amend
one line). With none on file, infer one with evidence ([discover.md](references/discover.md) § 2), mark it
`inferred`, and show it before editing. Never invent one silently.

## Step 2 — State the Design Read before touching anything

Load context first ([discover.md](references/discover.md): stack, fingerprint, surface). Then, before any
code, infer and **state in one line**:

> "Reading this as: `<page/app kind>` for `<audience>`, with a `<vibe>` language, leaning toward
> `<design system or aesthetic family>`. Scope: `<whole app | named screens | one component | the diff>`."

The "leaning toward" slot is filled by the house-style lookup first (discover.md § 2): a named house style is
stated as such ("leaning toward vdWolde, house style" or "leaning toward Liquid Glass, house style"), never replaced by a catalog guess.

The audience picks the aesthetic, not your taste; brand assets and quiet constraints (accessibility-first,
regulated, public-sector) **override** it. If the read genuinely diverges, ask **one** question. Record the
line as `Read:` in DESIGN.md so the next pass starts from it.

## Checkpoints — a cut-off costs one phase, never the pass

A mode runs long, and until its last phase nothing it learned is written down: the Design Read, the
fingerprint, the findings and the chosen direction exist only in the conversation, whose cache lapses before a
usage limit resets. So every mode keeps its progress outside the conversation and outside the repo, with the
shared helper (`node ~/.claude/tools/checkpoint.mjs <command> design ... --root <project>`; state in
`%LOCALAPPDATA%\claude-checkpoints`; `--self-test`):

1. **Start or resume.** Right after the mode and scope are known: `start design "<mode>:<scope>" --title
   "<app>, <mode>"`. The same request finds the same job and prints `RESUMED` with what is done. `/design
   resume` asks no question: `list design`, take the latest `OPEN` job, `start` it by its key. A job untouched
   for 7 days is set aside (the code has moved on); `--fresh` does it on demand.
2. **Phases are items.** `add` the playbook's phases that apply as `phase-N` (a skipped phase is never added).
   `begin phase-N` when it starts; `done phase-N --note "<what changed, which files>"` when it ends.
3. **Save what is expensive to re-derive,** at once: `save read` (the Design Read line, the fingerprint and
   what discover found: stack CSV, surface) right after Step 2; the playbook names the rest (findings, the
   direction matrix, the content brief, the canvas link, the chosen option).
4. **On a resume:** `load read` instead of re-running discover, skip the done phases, and for a phase left
   `doing` read `git status` and `git diff` first to see what landed, then finish it rather than redo it. The
   phases are re-entrant: polish's inventory and normalise phases are driven by `inventory`, so re-running it
   shows exactly what is left.
5. **On a usage-limit error:** `fail`, stop, and report what is done and how to resume (repeat the request).
   A limit never means retrying in a loop. Where the mode ends by updating `branding/DESIGN.md` and it did not
   get that far, say "DESIGN.md not yet updated"; the resume writes it.
6. **When the last phase is done:** `finish design`.

A resumed pass states "Resumed: phases a, b done; continuing at c" in one line instead of a new Design Read.

## Step 3 — Anti-default discipline

The model's habits, and why generated UI looks generated. Avoid them unless the brief or a brand asks, and
check your own output against this list in Step 6: AI-purple gradients · a centered hero over a dark mesh ·
three equal feature cards · bento grids for their own sake · glassmorphism on everything · glow orbs ·
gradient headline text · sparkle icons for "AI" · infinite-loop micro-animations · Inter + slate-900 ·
`rounded-2xl` + `shadow-lg` on everything · a full-width CTA band in a contrasting colour · emoji as icons ·
cream background + serif display + clay accent · cards with a coloured left-border stripe · a flat screen where
every object has the same weight in the same bordered card · cards inside cards with every border competing · a
hero outlined with an accent ring to point at it · a dot or badge beside a label that means nothing · an
invented logo (a letter in a coloured square beside a real company's name) · tracked caps on every heading and
label · 9 to 10 px text to fit more in · metadata on every row so that every row is the subject · a glow or
gradient that serves nothing. The checks for these live in [craft-checks.md](references/craft-checks.md); the full
sign list, with a search pattern per sign and the order to fix them in, is [references/unslop/](references/unslop/README.md)
(harvested from Unslop, CC BY 4.0; the Brand Guide wins, see its `conflicts.md`)

## Step 4 — Use the catalog

`references/ui-catalog/` is a local, offline data set; never invent values. **Look rows up with the helper, do not
read a CSV whole** (`styles.csv` is 154 KB): `node ~/.claude/skills/design/tools/design-tools.mjs catalog <file>
--q "<words>" [--where Column=regex] [--cols A,B] [--limit N]` prints only the matching rows (`--list` shows the names,
`--full` stops the 240-character clipping). The same helper prints a long reference by heading: `toc <md file>` then
`section <md file> "<heading regex>"` (paths relative to this skill folder; Liquid Glass `SPEC.md` is 95 KB and
`anywhere.md` 72 KB, so read the section the Design Read needs, not the file). `stacks/<stack>.csv`
(22; read the one matching the project; WPF/WinUI/Avalonia ones outrank web advice) · `products.csv` +
`ui-reasoning.csv` (per product type: styles, pattern, palette focus, anti-patterns; a seed, not truth) ·
`colors.csv` (192 palettes, one per *product type*) · `typography.csv` (74 pairings) · `styles.csv` (89; use
`active`) · `ux-guidelines.csv` (119, with Severity) · `motion.csv` (17 presets in 3 tiers; snippets are
GSAP, prefer CSS) · `landing.csv` (site layouts; `app-interface.csv` is mobile guidelines, not layouts) ·
`charts.csv`, `icons.csv`, `react-performance.csv`. A React web project here is Tailwind v4 + shadcn/ui on
Base UI (`base`, never `radix`; root `CLAUDE.md` § Web UI baseline). Palettes are hex and shadcn v4 tokens
are oklch: convert with the helper. For charts also load `dataviz`; for an Artifact, `artifact-design`.

## Step 5 — Run the playbook

Read **only** the chosen mode's file; its first phase reads [discover.md](references/discover.md).
`create` and `overhaul` also read [directions.md](references/directions.md), unless a house style applies (the
default here): its direction-picking steps are skipped then, so skip the file too. `create`, `improve` and
`polish` end with [verify.md](references/verify.md). `create` (Phase 2) and `polish` (Phase 4) also read
[ux-details.md](references/ux-details.md): twenty interaction details (skeletons, undo instead of confirm, optimistic updates,
command menu, hit targets, safe area, idempotency and more) to check, report and build. `create` (Phases 2
and 11) and `polish` (Phases 4 and 7) also read [craft-checks.md](references/craft-checks.md): the spacing,
alignment, type, icon, colour and hierarchy details a careful designer sends back, with numbers and the audit
check that finds each. `polish` (Phases 5 and 6) and `create` (Phase 7) read
[motion-checks.md](references/motion-checks.md): the quality of motion that exists. `create`, `improve` and `polish`
read [unslop/signs.md](references/unslop/signs.md) and [unslop/passes.md](references/unslop/passes.md) (plus
`conflicts.md` in a vdWolde project): `create` builds against the sign list, `improve` keeps a dial from adding a sign,
`polish` audits against it and fixes in its pass order ([craft-checks.md](references/craft-checks.md) § 7). `create` (Phase 11) and a
whole-app `polish` (Phase 4) end with [review.md](references/review.md): a fresh-eye reviewer who sees only
screenshots. Each playbook skips phases that do not apply and says so in one line.

**Helper:** `node ~/.claude/skills/design/tools/design-tools.mjs` (`contrast`, `oklch`, `hex`, `ramp`,
`retint`, `inventory`) does the maths a model gets wrong. Use it, never an estimate. It only reads and prints,
except `snapshot` (a page as one HTML file plus a `.live.png`; before and after shots into the project's `.state/`)
and `story` (the before-to-after video, [unslop/story.md](references/unslop/story.md)), which need Playwright.
Three browser-side scripts run through chrome-devtools `evaluate_script` (`sourcePath`): `tools/ui-audit.js`
(geometry: insets, clipping, uneven padding, rows, icons, targets; verify.md § 2 step 10),
`tools/motion-probe.js` (animations, jumps, pops, anchor drift; step 11) and `tools/contrast-probe.js` (the text
colour pairs a page renders, for `design-tools.mjs contrast`; step 6). They read the page and report
candidates, never verdicts; `tools/fixtures/` holds the self-check pages of the first two.

## Step 6 — Verify and document

Check the result against the Design Read, the mode's rule above and Step 3. Report each gate as `pass`,
`fail`, `unavailable` or `blocked`; a gate that could not run did not pass. Every mode ends (unless cut off,
see Checkpoints) by updating
`branding/DESIGN.md` (template: `Development Base/templates/docs/DESIGN.md`). **Code owns values, DESIGN.md owns
meaning**; if `.claude/instructions/styling.md` exists, link it instead of copying tokens. Remaining design
gaps go in `.claude/PRODUCT.md`'s known-gaps table, never only in chat. A mode may *suggest* the next one
(create → polish), never start it: hard rule 11.

**How hard to press.** Judge the result as the most exacting designer you know would, the one who screenshots
the single wrong thing and sends it back with "what is this?": a word against a card edge, a title sitting on its
subtitle, a menu that hops. If you can picture that screenshot, you have found the next fix. Fix the largest
visible fault first (structure and hierarchy, then spacing, then motion, then polish), and end every report
with a `Not checked:` line ([verify.md](references/verify.md) § 6); a clean tool run is not approval.

## Stop and ask before

Adding or removing a dependency (GSAP, a font or icon package, a lint library) · deleting a file · touching
anything outside the stated scope · committing, pushing or opening a PR · launching an app to "check" it
(never a WPF app; Computer Cleaner is elevated and the user does the double-click) · running
`npx shadcn init` against a stylesheet that already has content (scratch project, hand-merge). Prefer CSS
(WPF: Storyboards) over a library.
