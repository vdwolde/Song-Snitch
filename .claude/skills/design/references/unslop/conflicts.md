# Conflicts with the vdWolde Brand Guide

Unslop is written for a product with no brand, or a weak one, and tells the agent to invent a direction. A vdWolde
project already has one: the Brand Guide v1.1 (`Branding/brand.json`, applied through
[../styles/vdwolde/SPEC.md](../styles/vdwolde/SPEC.md)). Root `CLAUDE.md` § Brand makes it win over every Unslop
rule. This file lists each place they disagree, so neither an audit nor a fix pass "unslops" the brand away.

Unslop itself agrees: "If the product already has a real brand ... keep it and build the direction around it." What
follows is that rule, made specific. Where a project is not on the brand (a client site from Website Builder's
template, a vendored template, a frozen work project), these rows do not apply and Unslop's own values in
[tokens.md](tokens.md) are the starting point.

| ID | Unslop says | The brand says | What to do | Why the brand wins |
|---|---|---|---|---|
| X1 | Remove radial colour washes and glows behind content (C1, C4) | One soft backlight per view, on the root surface, rising from the bottom edge (rule 3) | Keep the one backlight. Flag a second one, one on a card, one that is stacked or animated: those break rule 3 and Unslop alike | It is the signature of every vdWolde app; Unslop's own "Signature" slot is already filled by it |
| X2 | Remove coloured glows (C3) | The "vdW" mark sits on the six-colour glow | The mark is never a finding. Any other glow is | The mark is a copied kit asset (rule 6) |
| X3 | Redraw a slop logo flat: wordmark or one solid glyph (K8, K9) | Icons are copied from `Branding/icons/<slug>/`, never redrawn, recoloured or cropped (rule 6) | Replace a non-kit logo with the kit icon. Never redraw the kit icon | One identity across every app |
| X4 | Direction: invent Character and World, tint the neutrals toward the world, take the accent from it | Graphite surfaces, one fixed signal colour per app (`brand.json`), Dark Mode and Light Mode | Write only Product, Moments and Signature ([passes.md](passes.md) § Direction). Character, World, ramp and accent are given | The palette is the brand; a per-product tint would make every app look different |
| X5 | One accent, used rarely; on dark the primary button may be off-white | One signal: the primary action, the active state and the focus ring, never two on a screen; red only for danger (rule 1) | The primary action uses the signal. The rest of Unslop's accent discipline (few percent of the screen, neutral chart steps) applies as written | Rule 1 fixes where the signal goes; Unslop only says how little |
| X6 | Its own spacing scale (4 … 128), radii (controls 8 to 10, cards 12 to 16, pill nowhere), easing `cubic-bezier(0.22, 1, 0.36, 1)`, durations 120 to 500 ms, light-mode shadows | Spacing 4 8 12 16 24 32 48; radii controls 8, windows 12, cards and tiles 14, chips pill; 120 / 200 / 300 ms, enter `cubic-bezier(0.2, 0.8, 0.2, 1)`, leave `cubic-bezier(0.4, 0, 1, 1)`; elevation by lightness, no drop shadows | Use the brand tokens from `tokens.css`. A value off the brand scale is the S1 finding; the fix lands on the brand scale, not Unslop's | Tokens are owned by the guide; a project never edits its copy of one |
| X7 | Weights 400 to 500, 600 at most; no 700+ (T1) | Sora for names and numbers, DM Sans for everything else, on the brand type scale; the mark is Sora Bold | Use the weights the brand scale names. Flag 800/900 only where the scale does not name them | The type scale is the guide's |
| X8 | Sentence case everywhere (T2) | Title Case for names and titles; sentence case for buttons, labels and messages; buttons start with a verb; UK English; Dutch only in Finance Dashboard (rule 8) | Uppercase tracked labels are still a finding; the fix is sentence case for labels and Title Case for names and titles, at the brand's `--type-ui` (600, tracking 0). The guide's own component sheets show an uppercase tracked overline ("DARK MODE"): that is the guide's presentation, not a pattern for apps (owner's decision, 2026-11-15) | Rule 8 is the brand's writing standard |
| X9 | Pick a type family for the character; any mono for figures; `tabular-nums` | Sora tabular figures for money and counts that line up (DM Sans has none); a negative amount reads `-€ 3,00` (rule 5) | Never swap the families. Figures that align go in Sora with tabular numerals | `tabular-nums` on DM Sans does nothing; the brand already chose |
| X10 | Categories that need colour get a small status dot (I1, Icons pass) | Status always shows an icon and a word (rule 7) | A dot alone is not enough: icon plus word | Accessibility: colour is never the only signal |
| X11 | Visuals pass: generate a hero scene with an image tool | Not in the guide; root `CLAUDE.md` § Stop and ask before covers paid generation | Ask before any paid generation; most vdWolde apps are apps, where Unslop itself says no generated image is needed | Cost and the owner's say |
| X12 | Focus: "a visible focus ring" | 2 px signal focus ring with a gap, 32 px targets (40 px main action), reduced motion keeps a 120 ms fade (rule 9) | Use the brand's ring and target sizes | Rule 9 is stricter |
| X13 | Contrast: text on the accent 4.5:1 | 4.5:1 text, 3:1 rings and strokes; light shade of a coloured text in Dark Mode, deep shade in Light Mode; amber and yellow use their text shade (rule 4) | Run `contrast-check.mjs` (styles/vdwolde) and `design-tools.mjs contrast` | Rule 4 names the shades per mode |

**What does not conflict, and so applies in full to a vdWolde app:** the audit itself; every copy rule except casing;
the spacing disciplines (same thing, same size; grouping; alignment; density), only on the brand scale; one bright
element, quiet chrome; chart hierarchy and one highlight per chart; stat cards are numbers; nested radius maths; no
`transition-all`, no `hover:scale`, no looping motion; the template check.

A fix that would break a row above is a stop: ask before making it (root `CLAUDE.md` § Brand). A departure the
owner approves is recorded in the project's `.claude/DESIGN.md` with the reason (SPEC.md § Departures).

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. Changes: see [README.md](README.md).
