# polish — finish it, make it consistent, make the system the best it can be

One continuous pass. State the Design Read once, with its `scope`: **whole app** (default), **named
screens**, or **the diff** (files changed this session, or since a ref: `git diff --name-only <ref>`).
**Contract:** no new routes, screens or features. Missing *states* of an existing feature may be added. A
token value changes only to fix a defect (a failed contrast pair, near-duplicate values). The twenty UX
details in [ux-details.md](ux-details.md) are behaviour of existing features, so they are in scope. If the user asked
only for `audit`, run Phases 1 and 4 plus the look ([verify.md](verify.md)), edit nothing, and return the
findings list.

Read `branding/DESIGN.md` first; it owns the system. If it has no fingerprint, infer one
([discover.md](discover.md) § 2), mark it `inferred`, and add it in Phase 9.

**Checkpoints** (SKILL.md § Checkpoints): items `phase-1` … `phase-9`, minus the ones you skip. Phases 1 to 3
are re-entrant (re-run `inventory` and it shows what is left), so a cut there costs only the phase being run.
`save findings` after Phase 4 (and again after Phase 6 if it adds any) with the finding list in the Phase 4
format: it is the long-lived result of the pass, and for an `audit` it is the whole result.

## Phase 1 — Consistency inventory

Run `node ~/.claude/skills/design/tools/design-tools.mjs inventory <paths in scope>`. It finds colour,
font-size, radius, shadow, duration and z-index literals outside token definitions (CSS, markup, JS/TS,
XAML, Tailwind arbitrary values), clusters near-duplicate colours, and lists duplicate tokens, unused-token
candidates and similar components. Every result is a **candidate**: read it before acting. The script does
not see XAML `Margin` / `Padding` or ResourceDictionary keys, so Grep those (`Margin="`, `CornerRadius=`,
styles redefined per control). Hundreds of hits are fine: the script already counts and groups them.

## Phase 2 — Normalise

- Replace literals and near-duplicates with the existing token. Add a token only for a value that recurs
  and has no home.
- **Token hygiene:** one naming grammar; two names for one value become one; an unused token is removed
  only after a grep for utility use (a Tailwind `bg-primary` hides `--color-primary`).
- **Make similar elements the same in structure and style:** read each pair the script flagged as similar.
  The same markup shape (all card headers, all form rows, all empty states) becomes one component or one
  style. Fix it once where every caller routes through, rather than in each caller.
- Deleting a file or a component that becomes unused: **ask first.**

## Phase 3 — Harden

Stress each screen in scope with: a 60-character unbroken string, empty / one / 1,000 items, a missing
image, a slow and a failing request, RTL, 200% text zoom, 320px width, nl and en locale formats, very large
numbers, and the minimum window with text that expands 30–40% in translation. Missing or `null` data shows
"n/a", never a plausible zero. Fix what breaks, ordered by the stack CSV's Severity column. **A narrow layout is
a second design, not a squeeze:** a desktop screen scaled into a phone passes the overflow check while its text
becomes unreadable. Crop closer, stack, drop secondary anatomy, keep the action and the result whole, keep text
at its real size (10 px at 320 wide is the floor); `ui-audit.js` at 390 and 320 finds the small text and cut words.

## Phase 4 — Audit

Run [verify.md](verify.md) § 2 (web) or § 3 (desktop). Beyond contrast (4.5:1 text, 3:1 large text and UI
parts), a visible `:focus-visible` and a complete keyboard path, check the WCAG 2.2 AA items: target size
at least 24×24px (2.5.8), focus not hidden behind sticky UI (2.4.11), a non-drag alternative to any drag
(2.5.7), no loss of content at 200% zoom, colour never the only signal, real `<button>` / `<a>` / label
elements, icon-only buttons named, a global reduced-motion rule.

**Then walk [ux-details.md](ux-details.md):** decide for each of the twenty whether it fits this app, report every
fitting detail that is missing as a finding in the same format, and (unless this is an `audit`) build them one
at a time with the project's gates after each. Fix what is in scope; log the rest (Phase 9). Use the finding
format of verify.md § 4.

**Then the craft pass.** Run the geometry audit (verify.md § 2 step 10) at each width and in dark mode, read each
candidate against its screenshot, and walk [craft-checks.md](craft-checks.md): the spacing, alignment, type, icon,
colour and hierarchy details, each with the number and the fix, and its § 7, the Unslop sign list
([unslop/signs.md](unslop/signs.md); fixes land in [unslop/passes.md](unslop/passes.md)'s pass order). Report what fits and is wrong in the same
finding format; unless this is an `audit`, fix them (Phase 7 is where the small ones land). `save findings` again
after it. **Whole-app scope, and not an `audit` unless asked:** finish with the fresh-eye review of [review.md](review.md)
on the two or three screens that matter most, and fold its ranked list into the findings. A diff-scope pass or
an audit skips the review and says so.

## Phase 5 — Optimize

- **Web:** measure on a **production build**, never the dev server. Performance comes from traces, **not**
  `lighthouse_audit` (it excludes performance): `performance_start_trace` with a reload,
  `performance_stop_trace`, `performance_analyze_insight`. Do three runs before and three after; report the
  median of each metric (LCP, CLS, INP or the nearest the trace gives) with the raw values. Then fix the
  real cost: image weight, format and missing dimensions (layout shift), font loading and subsetting,
  render-blocking assets, animation that is not compositor-only (`transform` and `opacity`), icon imports
  that are not tree-shaken, bundle size. **Find the animations by measuring**, not by grep alone:
  [tools/motion-probe.js](../tools/motion-probe.js) (verify.md § 2 step 11) lists every animation it sees,
  with infinite loops and animated layout properties flagged; walk [motion-checks.md](motion-checks.md) for the
  quality of what exists (10 KB: skip it when the probe and `inventory` find nothing that moves).
- **Desktop / no runnable build:** do the static pass in verify.md § 3 (virtualisation, frozen brushes,
  effect cost, layout depth). Any *measured* number is `unavailable`: do not estimate one, and never launch
  an elevated app to measure it.

## Phase 6 — Completeness check

The "best it can ever be" test. Output a **table**, component by state: default, hover, focus, active,
disabled, loading (a skeleton, [ux-details.md](ux-details.md) § 1), error, empty, with light / dark parity as an extra column when the app has a dark mode.
One icon style, one density, one radius family, one elevation scale. Add missing *states*, not features. Where
a component animates between states, its row also records the motion checks that apply
([motion-checks.md](motion-checks.md): enters and leaves, changes on itself, holds its anchor).

## Phase 7 — Micro-polish

Last among visual changes, because Phases 3–5 are the likeliest to move things. Alignment to the grid and
spacing rhythm, baseline alignment of text beside icons, optical corrections, icon size and stroke
consistency (the numbers are in [craft-checks.md](craft-checks.md): words 12 px inside an edge, title and
subtitle 4 to 6 px of ink apart, outer radius = inner radius + padding, a button 8 to 12 px under its field),
`text-wrap: balance` on headings and `pretty` on paragraphs, tabular numerals for figures, one
date and currency format, truncation with a tooltip, cursor styles, selection colour, scrollbar styling,
`color-scheme` and `theme-color`, and the 404 and error pages.

## Phase 8 — Lock it in (offer; ask first)

A rule the code keeps breaking becomes a check. Offer, at minimum, a line in `.claude/REVIEW.md` ("no
colour literal outside the token file; run `design-tools.mjs inventory`"). A lint rule (stylelint,
an ESLint Tailwind rule) adds a dependency, so ask before adding one.

## Phase 9 — Document

1. Update `branding/DESIGN.md`: the `Read:` line, the final token set (or a link to
   `.claude/instructions/styling.md`), the fingerprint, **Components** (name, variants, states, location),
   **Extending this system** (the recipe an agent follows for a new screen), the Do/Don't table with any
   rule this pass revealed, and a dated changelog line.
2. Every finding not fixed goes into `.claude/PRODUCT.md`'s known-gaps table with its severity.
3. A recurring pattern extracted into a component is named in DESIGN.md's component section.

## Report

A full polish returns counts, then the gates. An `audit` returns the **ranked findings list** instead
(`path:line — claim — severity — fix`, no preamble), then the gates.

- Inventory: `<n>` literals found, `<n>` merged into tokens, `<n>` near-duplicate clusters resolved.
- Harden / audit: `<n>` fixed, `<n>` logged (each with severity).
- Gates, each as `pass` / `fail` / `unavailable` / `blocked` with the reason: project quality gate,
  contrast, keyboard path, console, reduced motion, accessibility score, geometry audit, performance
  before → after (median of 3, raw values).
- Findings in the order to fix them: structure and hierarchy, then spacing, then motion, then polish.
- `Not checked:` the states, widths, modes and interactions you did not look at, and whether the fresh-eye
  review ran (verify.md § 6).

## Done when

- [ ] No literal that should be a token remains, or each is listed with a reason.
- [ ] Similar elements share structure and style.
- [ ] No route, screen or feature was added.
- [ ] Every unfixed finding is in the known-gaps table.
- [ ] DESIGN.md matches the code.
