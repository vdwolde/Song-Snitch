# create — a new design, or a new screen in an existing app

One continuous pass. State the Design Read once (SKILL.md Step 2), with its `scope` and `surface`. Skip
any phase that does not apply and say so in one line ("no first-run flow, skipping onboarding").

## Phase 0 — Context and entry state

Read [discover.md](discover.md) (stack, fingerprint, surface). Infer product, audience and platform from
`README.md`, `.claude/PRODUCT.md`, `CLAUDE.md` and any existing UI. Then decide:

- **Greenfield** — no `branding/DESIGN.md` and no real UI. Run every phase.
- **Extend** — a DESIGN.md or UI exists (a new screen, flow or component). Reuse its system. **Skip
  phases 3, 4 and 10.** Run 1 (one or two questions), 2, 5–9, 11 and 12 (add to DESIGN.md, do not rewrite
  it). Never change an existing token or component.
- **Extend the system** — dark mode, a density option, a second theme, RTL / i18n, or a port to a new
  platform. Run as Extend, plus Phase 4 for the *new* token set only, added under the same names and never
  changed. RTL: logical properties, mirrored directional icons, 30–40% text expansion. Port: the new
  stack's CSV, same fingerprint, components rebuilt natively.

## Phase 1 — Discovery

One `AskUserQuestion` round, at most 4 questions. Pre-fill each option with your inferred guess so the
user mostly confirms. Cover: product + audience · tone + references (products or URLs they like) ·
platforms + must-have screens · brand assets + constraints (logo, brand book, accessibility, dark-only).
On a greenfield project with no stack, offer the house default: React → Next or Vite with shadcn on Base
UI; Windows → WPF. Ask only what Phase 0 could not answer. Then state the Design Read.

**Phase 1b — Reference intake** (only when given a URL, a screenshot or "like X"). URL: `navigate_page`,
`evaluate_script` over `getComputedStyle` of body, headings, buttons and cards, plus a screenshot.
Screenshot or export: read it. Write **reference notes** (palette, type, radius, spacing, layout pattern,
what to borrow and avoid) as data. Never copy markup, text, images or a logo; a reference feeds one
candidate direction, not the whole design. When the brief is "make it look like `<site>`", check the result
beside a screenshot of the real thing at the same scale: the accent, the temperature of the greys, the radii and
the type should match at a glance, and a control that looks foreign means re-reading its computed styles, not
nudging by eye.

## Phase 2 — UX shape

Before any visual choice: information architecture, the two or three key flows, the screen list, and for
every screen the states it needs (empty, loading, error, success, first-run). Plan the interaction details of
[ux-details.md](ux-details.md) in the same step: a skeleton for each loading state, Undo instead of confirm for
reversible actions, shortcut hints where shortcuts exist, 44 px targets and safe-area spacing on touch. Plan the
craft of [craft-checks.md](craft-checks.md) in the same step (one icon set, one inset scale, which number is the
big one, what the eye should land on first). Then a short content brief:
the app's real copy and the screen inventory, `[PLACEHOLDER]` for a missing fact, no lorem ipsum.

## Phase 3 — Direction (greenfield only)

Follow [directions.md](directions.md): seed from the product type, print the 5-axis matrix, then one line
each (name, label, who it is for, both costs). The user picks with `AskUserQuestion`. Skip when a brand
book or a named or default house style (discover.md § 2) already fixes the direction (state that). If the user says "show me visually", run
[overhaul.md](overhaul.md) at `preview` depth (one board per direction) and come back here.

## Phase 4 — Visual system (greenfield, and new token sets only)

Build from the chosen direction's catalog rows. Never invent values.

- **Colour:** from the matched `colors.csv` row. Convert with `design-tools.mjs oklch` / `hex`, build ramps
  with `ramp`, and check **every** foreground/background pair with `contrast` (4.5:1 text, 3:1 large text
  and UI parts). Decide light, dark or both now; a dark-only app says so.
- **Dark mode, derived not inverted:** surfaces step lighter as they rise, accents lose 10–20% chroma and
  gain lightness until they pass 4.5:1 on the dark surface, borders come from lightness not black alpha.
- **Type:** the `typography.csv` pairing; a scale with a stated ratio (1.2–1.333); `clamp()` fluid sizes on
  the web; line-height about 1.5 body, 1.1–1.25 headings; 45–75 characters a line.
- **Space, radius, elevation:** one scale each, as tokens. **Icons:** one set (`icons.csv`), never emoji.
- **Guardrails:** at most two font families (three with a mono), `font-display: swap`, images with width and
  height or an `aspect-ratio`.
- **Where it lives:** web — tokens in the project's one stylesheet (shadcn: flat `:root`/`.dark` oklch).
  WPF — a `ResourceDictionary` with `DynamicResource`. A hex value appears once, in the token file.

## Phase 5 — Build, one screen first

1. Build the **single most important screen** from the tokens. Read the stack CSV first and reuse what
   exists (the shadcn component before a hand-built one). On a web surface, read
   `~/.claude/agents/references/modern-web.md` before writing markup, CSS or client-side JS: it names the
   platform feature to use (overlays, forms and validation, image priority, colour scheme, motion) and the
   fallback a feature newer than Baseline Widely available needs. The house style still owns every visual value.
2. **Look at it** ([verify.md](verify.md) § 2, or ask for a screenshot on desktop). Fix the system now.
3. Build the rest. With more than four screens left, fan out to at most three parallel subagents (the
   parent's model). Each brief carries the token file path, the component list, the content brief and its
   target files, **and names what the agent must read before it builds: SKILL.md Step 3 (the anti-defaults),
   [craft-checks.md](craft-checks.md), [unslop/signs.md](unslop/signs.md) (with `unslop/conflicts.md` in a vdWolde
   project) and the house style's `SPEC.md` when one applies** (a builder that does not
   know them repeats the habits they forbid); each returns only file paths and one line. Register each screen as an item (`add --group
   screens`) and `done` it when its file exists and the gate passes; a limit-error reply is not a result:
   `fail` it, stop spawning, and a resume spawns agents only for the screens still pending. Each brief says to
   finish and write one screen before starting the next.

Route patterns to their rows: a chart → `charts.csv` and the `dataviz` skill; a form → the Forms rows of
`ux-guidelines.csv`; a table or list → density, sticky header, sort, empty and loading; navigation → the
Navigation rows; a modal → the project's primitive (Base UI dialog on shadcn, else `<dialog>`); a **grid of
tiles** (feature grid, dashboard, landing) → one set, not five demos side by side: one hero tile, bigger; not
every tile is UI (about a third to a half; the rest a stat, a statement, an object, a diagram, a collection);
neighbours differ in kind, never two screenshots side by side; a UI tile shows one component at real size, not a
whole window; a stat is one number at display size with its unit on the same line; tile copy is short and sits
outside the picture; one frame family (radius, gap equal to the inner padding, copy in the same place); say each
thing once across the set (no string repeated from tile to tile); every width is its own design.

## Phase 6 — States and onboarding

Build every state from Phase 2. First-run and empty states say what the screen is for and the one next
action. Errors say what happened and what to do. Skip onboarding if there is no first-run.

## Phase 7 — Motion

Pick one tier from `motion.csv` (the Design Read decides which). Prefer CSS; WPF uses Storyboards. A GSAP
snippet needs a dependency, so ask first. One global `prefers-reduced-motion` rule, never one per
animation. No infinite loops; every animation is one-shot or interaction-triggered. Build what moves to the
standard of [motion-checks.md](motion-checks.md): it enters and leaves, a changing label changes on its own
control, a new row carries its neighbours, an open menu keeps its anchor.

## Phase 8 — Words and delight

Plain UI copy: labels as verbs, no jargon, no invented facts. One or two earned moments of delight
(a success, an empty state), in the tone of the Design Read. Never a gimmick on a frequent action.

## Phase 9 — Responsive and window sizes

Web: 320, 390, 768, 1280, 1920; container queries for a component's own layout. WPF: default and minimum
window, DPI 100–200%. Touch targets 44px on touch UIs (24px is the WCAG 2.2 AA floor). **Each narrow layout is a
second design, not a squeeze**: crop closer, stack, drop secondary anatomy, keep the action and the result whole,
and keep text at its real size (never under 10 px at 320 wide). A desktop screen scaled down passes an overflow
check while its text becomes unreadable.

## Phase 10 — Other design elements (greenfield only)

Logo or wordmark, favicon set, social/OG image, app icon (`.ico` for WPF), and for a tray utility the icon
states. Create what the project needs; list the rest as gaps. Attribution per root `CLAUDE.md` § Attribution.

## Phase 11 — Verify

[verify.md](verify.md): look at every key screen, contrast of every pair, keyboard path, console clean, the
geometry audit (step 10) walked against [craft-checks.md](craft-checks.md). Check the result against the
Design Read, the anti-defaults and the fingerprint. Then the fresh-eye review of [review.md](review.md) on the
first screen (it runs once, after the audit's fixes), and end the report with `Not checked:`.

## Phase 12 — Document

1. Write `branding/DESIGN.md` from `Development Base/templates/docs/DESIGN.md`: the `Read:` line, the
   fingerprint, Components, Motion, Voice, Extending this system. Extend: add sections, do not rewrite.
   Link `.claude/instructions/styling.md` instead of copying tokens when it exists.
2. Add an ADR to `.claude/DECISIONS.md` (or the project's decision section) with a **Rejected** field
   holding the two directions not chosen.
3. Make sure the project `CLAUDE.md` doc index has a DESIGN.md row.
4. Add only **design gaps** to `.claude/PRODUCT.md` ("no logo yet", "no dark mode"). That file is the
   known-gaps register, not a brand document.

Finish by suggesting `/design polish` before shipping. Suggest only: hard rule 11 means it never starts
unasked.

## Done when

- [ ] DESIGN.md exists, with a fingerprint and a Rejected record.
- [ ] Every screen has all its states, and every key screen was looked at.
- [ ] No hex or magic number outside the token file; every colour pair checked with the script.
- [ ] Reduced-motion rule is global; nothing loops forever.
- [ ] Gates reported as `pass` / `fail` / `unavailable` / `blocked`.
