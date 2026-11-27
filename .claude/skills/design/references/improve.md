# improve — same design language, made better

One continuous pass. State the Design Read once, with its `scope` (whole app, named screens, or one
component). Everything stays inside the **language fingerprint** (SKILL.md): style, type pairing, colour
strategy and layout archetype are locked; token values and motion tier are free. If `branding/DESIGN.md`
has no fingerprint, infer it ([discover.md](discover.md) § 2), mark it `inferred`, and show it before
editing. **Collateral lock:** the diff touches style, token, copy and motion files only. Structural markup
changes are limited to `distill` removals.

**Checkpoints** (SKILL.md § Checkpoints): items `phase-0` … `phase-5`. `save dials` at the end of Phase 1 (the
answers) and again after Phase 2 (the old → new value list), so a resume applies the same dials instead of
asking again.

## Phase 0 — Look first

Web: capture "before" screenshots of the screens in scope ([verify.md](verify.md) § 1–2). Desktop: ask the
user for one. Note the current value of every token you expect to change.

## Phase 1 — Intake

If the user named what they want ("quieter", "make the buttons teal"), pre-answer it and ask only what is
left. Otherwise one `AskUserQuestion` call with four questions:

1. **Intensity:** bolder / quieter / leave as is
2. **Effects:** overdrive / distill / leave as is
3. **Specific elements** (multi-select): colours · motion · type · layout, spacing and shape. A named
   component goes in "Other".
4. **Words and personality** (multi-select, independent): clarify the copy · add delight

If the user says what bothers them, use it to choose the levers; a short "Other" answer is enough. Each
opposing pair has a "leave as is" option, so asking for both sides cannot happen. `bolder` with `distill`
is fine (bold and minimal). `quieter` with `overdrive` pull against each other: ask which one wins, in one
line.

## Phase 2 — Apply the dials

Each dial is a set of real changes, not a mood, and each moves **one clear step**. The numbers anchor the
step; they are not rules.

| Dial | What changes |
|---|---|
| **bolder** | More contrast between hierarchy levels (type-scale ratio up a step, heavier headings), higher accent chroma (stay in gamut), larger primary actions, one confident focal element per screen (one number gets to be big; the heaviest mark sits on what the screen is for). |
| **quieter** | The reverse: ratio down, lighter weights, lower chroma, softer borders and shadows, more whitespace, fewer colours at once. Keep the polish; remove the volume. |
| **overdrive** | Motion tier up one step (cap at Complex): scroll-driven reveals, spring easing, one signature moment. CSS first; GSAP or shaders need a dependency, so ask. Keep the global reduced-motion rule. |
| **distill** | Remove what is not earning its place: duplicate actions, decorative borders and shadows, redundant labels, motion with no function. Prefer deleting markup and CSS to adding any. Motion tier down. **Remove only what stays reachable another way. Never remove a function, route or data path. List every removal; ask before deleting a file.** |
| **clarify** | Rewrite UI copy: labels as verbs, errors say what happened and what to do, empty states say the next step. No invented facts. |
| **delight** | One or two earned moments (success, first-run, empty state) in the tone of the Design Read. One-shot, never a loop, never on a frequent action. |
| **density** | Compact: spacing and row heights down one step. Comfortable: up one step. Touch-target floor stays. |
| **shape** | The radius family one step sharper or rounder, changed through the radius tokens everywhere at once. Never mix two families. |
| **warmth** | Rotate the hue of neutrals and accent toward warm or cool by up to 20° in oklch, keeping lightness and chroma; recheck contrast. |
| **readability** | Body text up a step (at least 16px on the web), line-height about 1.5, no more than 75 characters a line, body weight at least 400. |
| **speed** | Durations 25–40% shorter or longer; easing unchanged. |

**Recolouring is computed, never hand-picked.** "Make the accent teal": `design-tools.mjs retint
<current accent> <teal>` keeps the lightness and chroma relationships; `ramp` rebuilds the scale; recompute
the `on-` colours; then run `contrast` on every pair the accent touches (4.5:1 text, 3:1 large text and UI
parts). Specific elements change only what was named, and only inside the lock. Type changes size, weight
and scale, never the pairing. Layout changes spacing and density, never the archetype.

## Phase 3 — Stay inside the lock

If a request would change style, type pairing, colour strategy or layout archetype ("use a serif", "put
the nav on the left", "add a second brand colour"), stop and ask with three answers:

- **Overhaul** — the whole language changes: switch to `/design overhaul`.
- **Stay inside** — drop that part of the request and carry on.
- **Amend one line** — the user confirms that exactly one fingerprint line changes. Apply just that, update
  the fingerprint, and add the changelog line `fingerprint amended: <line>, <old> → <new>`. Two lines at
  once is an overhaul: say so.

Do not silently widen the pass and do not silently refuse.

## Phase 4 — Verify and offer one more step

- [ ] The result moved the way the user asked. A `quieter` that came out louder is fixed, not shipped.
- [ ] Look at the screens in scope ([verify.md](verify.md)) and compare with the "before" screenshots, one
  beside the other at the same scale: say the one difference, and check the squint test (what does the eye land
  on first, and is it what the screen is for?). Run the geometry audit (verify.md § 2 step 10) on what changed.
- [ ] No dial added a sign from [unslop/signs.md](unslop/signs.md) (a `bolder` that reached for a glow, a gradient
  headline or 800-weight type; an `overdrive` that loops): run its patterns over the changed files.
- [ ] List every token and value changed, old → new. This is the diff the user reviews.
- [ ] The four locked fingerprint lines are unchanged (or amended, with the changelog line).
- [ ] Reduced-motion still collapses all motion. No new infinite loops.
- [ ] Project quality gate reported as `pass` / `fail` / `unavailable` / `blocked`.

Then offer **one more step**, **back off one step** (using the recorded old values) or **keep it**.

## Phase 5 — Document

Update the changed token values in `branding/DESIGN.md` (or link `.claude/instructions/styling.md` if it
owns them), update the motion tier line if it moved, and add a one-line dated changelog entry. Add any
remaining design gap to `.claude/PRODUCT.md`. If the result looks ready to ship, suggest `/design polish`.
Suggest only.
