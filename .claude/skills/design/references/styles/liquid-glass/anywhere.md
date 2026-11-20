# Liquid Glass anywhere: recreate it in any app, program or design tool

A self-contained guide for rebuilding the Liquid Glass look outside a website: native desktop, mobile, design tools, slides. A human or any AI tool can follow it without reading anything else. The canonical numbers live in [SPEC.md](SPEC.md) and [tokens.json](tokens.json); this file cites them by section and token path and never overrides them. Where this file and SPEC disagree, SPEC wins (and the disagreement is a bug in this file). Contrast gate: [contrast-check.mjs](contrast-check.mjs).

Tags used below: **[m]** measured in the study, **[e]** estimated or a policy choice (SPEC §15), `unverified` = an API or version claim not confirmed against official docs in this session (§6 lists them all). A URL next to a claim is the doc page it was checked against.

Contents: 0 paste-ready prompt · 1 how to use · 2 portable core · 3 per-stack sections · 4 port in 30 minutes · 5 conformance · 6 provenance.

---

## 0. Paste-ready prompt block

Drop this into any AI tool, or hand it to a designer. It is complete on its own.

```text
TASK: Restyle this UI as "Liquid Glass": a soft, pillowed, light UI. It is NOT Apple's refracting lens glass.
Follow every rule. If the platform lacks a primitive, use the stated fallback; never invent another look.

SURFACES. Every surface is exactly ONE of three:
(a) MATTE CARD, the default for content. Opaque near-white squircle on a slightly darker ground
    (#ffffff on #f2f1f1). No blur, no rim, no transparency. 1 px edge #b4b4ba plus a faint shadow
    (y 1.5% of height, blur 6.5% of height, black 5%).
(b) FROST PLATE, floating chrome only (nav, pills, toasts, sheets). Translucent white over a photo or
    gradient that has light/dark variation. Backdrop blur 24 px (12 soft, 40 hard cap) + saturate 1.15.
    Fill: white 22% if it holds no text; white 72% with ink text, or #121212 80% with light text.
    1.5 px gradient rim: white 60% top-left, 25% mid-way, 50% bottom-right. Lighter lip on the bottom
    edge (2.5% of height, white 50% fading up). No shadow (floating pills only: y 8% of height,
    blur 40%, black 12%).
(c) GEL TILE, the colour. Opaque, ONE hue per tile. Layers bottom to top: vertical linear gradient;
    radial bloom ellipse 70% x 60% centred x 50% y 70% (bottom-weighted): core, mid at 45%,
    transparent at 100%; soft white 16% highlight at top-left (20%,15%); pale desaturated rim 5% of
    width deep; 3% monochrome grain (128 px tile, overlay) LAST. Padding >= 7% of width so text never
    enters the rim.

SHAPES. Continuous-curvature squircle corners, never a plain arc where the platform can do better.
Card radius = 0.22 x module (module = grid cell side 144 px, so 32 px); gel 0.24 x module; ONE absolute
radius shared by wide and square cards. Pills, chips, tags, search fields: full stadium (radius = half
height), min height 44. Circle buttons 44 px. Nested radius = max(outer - inset, 0.25 x outer).
Padding 7% of width. Gaps: gel 8 px, matte 20 px.

PALETTE. Light: ground #f2f1f1, card #ffffff, sunk #e7e7ea, ink #121214, ink-2 #43434a, ink-3 #64646c,
hairline #b4b4ba, control-edge #7a7a82. Dark: ground #121212, panel #1c1c1c, raised #242424, ink #f4f4f6.
ONE accent: lime #dff30f as a fill behind ink, never as text. At most 3 saturated hues per frame.
Gel ramps top/mid/core/bottom (light mode, INK text):
  green #c2d69b #5bab4b #3b943c #8fcf9a | pink #f9b3cd #f99bbc #f36393 #f53b8a
  blue #53b4e3 #4194ed #327cf3 #53b4e3 | orange-magenta #fce9cc #fdc395 #e94cc2 #f6713b
  violet #cb7edc #b86dd3 #ad62d3 #cb7edc. Rims: #bfe3c0 #fbd9e5 #8fd0f0 #f7c6ea #d4a0f0.
Dark mode uses deep ramps with WHITE text:
  green #25762a #006f12 #055e11 #15711e | pink #9e3b60 #9a2957 #8e0049 #9a315a
  blue #3161af #2056af #0145a7 #275aad | orange #933f7c #8e2f77 #83116b #8f3678
  violet #7e4899 #783a96 #6c238d #793f96.

TYPE. Urbanist (or Outfit); fallback Inter. Sentence case, no all-caps labels. Titles weight 300 at
20 px or larger, with 500-700 on the emphasised words in the same line; body 16 px weight 400;
labels 14 px; nothing under 12 px. Tracking -0.02 em titles, -0.03 em display. Primary numbers may use
a dot-matrix face (Doto) at 24 px or larger, with the same value as real text beside it.

MOTION. Springs, never linear or keyframe loops. Sheet/tab 220/21/1 (about 4% overshoot, 560 ms);
press 400/28/1 (scale 0.97, 420 ms); hover 260/30/1 (lift 2 px, no overshoot). No spring runtime:
cubic-bezier(0.3,1.25,0.6,1). Gel bloom drifts slowly (10 s, x +-6%, y +-4%), only while visible.

ACCESSIBLE RULES (these override the look). Text 4.5:1; large text and UI edges 3:1.
INK text on vivid gels and on frost; WHITE only on deep gels; no alpha-reduced text on a gel;
lime never as text on light. Hit area >= 44 px. Focus ring 2 px ink + 2 px white halo, 2 px offset.
State is never hue alone (add icon, word or shape). Honour reduce-transparency (opaque plate),
reduce-motion (no drift, squish, lift), high contrast (solid edges, no grain), forced colours.

FALLBACKS. No backdrop blur: opaque tinted plate (white 90%+), keep rim and lip. No squircle:
same-radius rounded rectangle. No grain primitive: tiled noise PNG at 3%. No radial gradient:
pre-rendered PNG. Max 6 blurred plates per view (3 mobile, 1 over live video/canvas); blur <= 40 px.

DO NOT: heavy drop shadows (> 12%); neon outer glows; rainbow gradients inside one tile; thick
coloured borders; bevels or glossy specular; white text on pastel gels; pure #000/#fff text; blur on
a parent of a frosted element; tilt or depth-of-field in the product UI; frost on every card;
neumorphic paired shadows; dot numerals as the only form of a decision-critical number.
```

---

## 1. How to use this file

Read the paste block (§0); if that is all you need, stop. For a stack, read §2 once, then only your stack in §3, do the 10 steps in §4, score with §5. The look is three surface classes, not a theme: a port that gets the three surfaces, the squircle radius, the one-hue gel bloom and light type right is recognisable even with no blur.

**Apple's Liquid Glass is a different thing** (SPEC §0): a transparent, refracting lens for navigation. This style has no refraction on cards; colour comes from opaque chromatic gels on a pale matte ground. On Apple platforms you may use `glassEffect` for navigation chrome; gel tiles and matte cards are still drawn by hand (§3.4).

---

## 2. Portable core (stack-neutral)

### 2.1 Parameter table

Ratios are of the shorter side unless stated; `W` width, `H` height. Source = tokens.json path.

| Parameter | Value | Source | Tag |
| --- | --- | --- | --- |
| Module (grid cell side) | 9 rem = 144 px | `radius.moduleRem` | [e] |
| Matte card radius | 0.22 x module = 31.7 px (0.18-0.26) | `radius.cardRatio` | [e] |
| Gel tile radius | 0.24 x module = 34.6 px (0.14-0.30) | `radius.gelRatio` | [e] |
| Stadium (pills, chips, fields) | 0.5 x own height | `radius.stadiumRatio` | [m] |
| Circle button | 44 px | `control.circleButtonPx` | [e] |
| Concentric | `max(r_outer - inset, 0.25 x r_outer)`; inset 0.02 W | `radius.concentricMinRatio` | [e] |
| Squircle bezier factor | 0.66 (circular 0.5523); CSS superellipse n = 2 | `radius.squircleBezierC` | [e] |
| Padding / gaps | 0.07 W (20 px); gel gap 8 px, matte gap 20 px | `layout.*` | [m] |
| Blur tiers | 12 / 24 / 40 px; cap 40 | `blur.*Px` | [e] |
| Blur vs plate height | 0.05-0.15 H over defocused ground; 0.30-0.50 H over sharp colour | `blur.defocusedGroundOfHeight`, `sharpGroundOfHeight` | [e] |
| Saturation | 1.15 | `blur.saturate` | [e] policy |
| Frost fill, no text | white 0.22 (0.12-0.30; 0.40 over saturated gel) | `alpha.frostDecor` | [m] range |
| Frost fill, text | white 0.72 (light); #121212 0.80 + white 0.06 (dark) | `alpha.frostText`, `frostDarkScrim` | [e] floor |
| Rim | 0.006 W (min 1 px; 1.5 px in CSS ref); white 0.60 top-left, 0.25 at 45% of diagonal, 0.50 bottom-right | `rim.widthOfWidth`, `alpha.rim` | [m] |
| Lip | 0.025 H, white 0.50 fading up | `rim.lipOfHeight`, `alpha.lip` | [e] |
| Matte shadow | y 0.015 H, blur 0.065 H, black 0.05 | `shadow.matte.*` | [e] |
| Floating-pill shadow | y 0.08 H, blur 0.4 H, black 0.12 | `shadow.float.*` | [e] |
| Gel bloom | centre x 50%, y 70% (55-85%), ellipse 70% x 60%, mid at 45% | `gel.bloom.*` | [m] |
| Gel highlight | white 0.16 (0.12-0.20) at 20% x, 15% y, out by 55%; **0.06 on deep (dark) ramps** so white title text keeps 4.5:1 | `alpha.highlight`, `alpha.highlightDeep` | [e] |
| Gel rim depth | 0.05 W (0.03-0.06) | `gel.rimDepthRatio` | [m] |
| Grain | mono noise 3% (2-4%), one 128 px tile, after gradients | `gel.grainPct` | [m] |
| Glass circle fill / disabled | white 0.24 (0.18-0.30) / opacity 0.5 | `alpha.glassButton`, `disabled` | [m]/[e] |
| Hover / press | lift 2 px, brightness 1.04; press scale 0.97, brightness 0.96 | `control.state.*` | [e] |
| Springs (tension/friction/mass) | sheet 220/21/1; press 400/28/1; hover 260/30/1; dot 300/24/1; draw 120/22/1; count 170/26/1 | `motion.spring.*` | [e] |
| Bloom drift | 10 s (8-12), x +-6%, y +-4% | `gel.bloom.driftPeriodMs` | [e] |
| Type scale (px) | 12, 14, 16, 20, 24, 32, 48, 72; weights 300 (>= 20 px only), 400, 500, 600 | `type.scaleRem`, `type.weight` | [e] |
| Tracking / leading | display -0.03 em, title -0.02 em, body 0; 1.05 / 1.25 / 1.5 | `type.trackingEm`, `type.leading` | [e] |
| Dot numeral | dot 0.6 of pitch, min 24 px, weight 400 | `type.dot.*` | [e] |
| Tap / focus | 44 px; ring 2, offset 2, halo 2 px | `contrast.*` | policy |
| Contrast floors | text 4.5, large text 3, UI 3, hairline 1.6, value step 1.08 | `contrast.*` | policy |
| Perf budgets | <= 6 backdrop layers (3 mobile, 1 over live canvas); <= 4 drifting tiles; blur <= 40 | `perf.*` | [e] |

Dark and neutral colours are in the paste block; the full palette is `tokens.json` `color.*`. Extras: light `hairline` #b4b4ba, `control-edge` #7a7a82, `focus` #121214 / halo #ffffff; dark `hairline` #46464b, `control-edge` #86868e, `inkSecondary` #b8b8c0, `inkTertiary` #9c9ca4; states light #14692c #8a4b00 #b3261e #1a4fc4, dark #6fdc8c #f2b84b #ff8a80 #8ab4ff; dark corner glow #003a0a / #3dab43 / #16d015.

### 2.2 Gel colourways (`gel.vivid.*` ink text; `gel.deep.*` white text)

| Colourway | Vivid top / mid / core / bottom / rim | Deep top / mid / core / bottom / rim |
| --- | --- | --- |
| green | #c2d69b / #5bab4b / #3b943c / #8fcf9a / #bfe3c0 | #25762a / #006f12 / #055e11 / #15711e / #c4d7c3 |
| pink | #f9b3cd / #f99bbc / #f36393 / #f53b8a / #fbd9e5 | #9e3b60 / #9a2957 / #8e0049 / #9a315a / #e5c8d0 |
| blue | #53b4e3 / #4194ed / #327cf3 / #53b4e3 / #8fd0f0 | #3161af / #2056af / #0145a7 / #275aad / #c4d2e8 |
| orange-magenta | #fce9cc / #fdc395 / #e94cc2 / #f6713b / #f7c6ea | #933f7c / #8e2f77 / #83116b / #8f3678 / #e1c9d8 |
| violet | #cb7edc / #b86dd3 / #ad62d3 / #cb7edc / #d4a0f0 | #7e4899 / #783a96 / #6c238d / #793f96 / #d9cbe1 |

Brand hue instead: OKLCH rule in SPEC §2c (`gel.derive`): vivid L 0.88 / 0.76 / **0.62** / 0.80 / 0.92 with chroma 0.2 x (0.40, 0.70, 1.00, 0.65, 0.20); deep L 0.50 / 0.47 / **0.42** / 0.48 / 0.86 with chroma 0.17 x (0.80, 0.90, 1.00, 0.85, 0.20). `node contrast-check.mjs --derive <hue>` prints ramps. Never hand-tint a core.

### 2.3 The three surfaces as ordered layer stacks

Paint bottom to top; a "layer" is a view, brush, draw call or Figma fill, whichever the platform offers.

**a. Matte card:** (1) shadow, neutral black 0.05; (2) opaque card fill, squircle radius 0.22 x module; (3) 1 px hairline #b4b4ba (the accessible edge floor, SPEC §2a); (4) content inset 0.07 W.

**b. Frost plate:** (1) backdrop with luminance variation (a plate over a flat ground does not read as glass); (2) blur 24 px + saturate 1.15, clipped to the plate's squircle; (3) tint white 0.22 (no text) / 0.72 (ink text) / #121212 0.80 + white 0.06 (light text); (4) optional top gloss 0.04 H, white 0.2; (5) rim gradient stroke 1-1.5 px; (6) lip 0.025 H, white 0.5 fading up; (7) shadow none (floaters: y 0.08 H, blur 0.4 H, 0.12, tinted by the backdrop hue); (8) content.

**c. Gel tile:** (1) linear gradient top to bottom; (2) bloom radial ellipse 70% x 60% at (50%, 70%): core 0, mid 45%, transparent 100%; (3) highlight radial white 0.16 on vivid ramps, 0.06 on deep ramps, at (20%, 15%), out by 55%; (4) pale rim wash 0.05 W deep, no dark inner shadow; (5) grain 3%, last, overlay where available; (6) content padded 0.07 W, ink (vivid) or white (deep).

### 2.4 Faking a missing layer

| Platform lacks | Fake it with | Note |
| --- | --- | --- |
| Per-element backdrop blur | (1) Known image/gradient ground: draw a second pre-blurred copy under the plate, aligned and clipped to it. (2) Otherwise an opaque tinted plate: white 0.90-0.95, rim and lip kept (ink on white is 15:1, so text plates pass). | The copy must be re-aligned when the plate moves; bake it for static grounds. |
| Window-only blur (Mica/Acrylic) | Use it on a small borderless window that is itself the plate, not on the whole app. | §3.7, §3.8 |
| Squircle | (1) The cubic-bezier path below as clip or mask. (2) Same-radius rounded rectangle: slightly tighter corners, acceptable, never a reason to change the ratio (SPEC §11.2 rung 6). | Rebuild on resize. |
| Elliptical radial gradient | Scale a circular gradient on one axis (Y x 0.857 for 70% x 60%), or bake a PNG per colourway at 2x. | A PNG cannot drift. |
| Overlay blend (grain) | Tile a mid-grey noise PNG whose pixels carry 3-6% alpha, normal blend. | Flatter than overlay. |
| Grain at all | Omit (SPEC §11.2 rung 7); the gel stays. | Dark gels may band. |
| Inset shadow (gel rim) | Edge gradients, a blurred stroked path clipped to the shape, or a radial gradient transparent to `rim` over the last 5%. | |
| Springs | Closed-form damped spring (§2.5) or `cubic-bezier(0.3, 1.25, 0.6, 1)` (about 5% overshoot [e]). | |
| Gradient stroke | Two L-shaped strokes (white 0.6 top-left, 0.5 bottom-right) or a plain 1 px white 0.35 stroke. | Brightest top-left is the cue that matters. |

**Squircle path** (SPEC §1.2; port it, 14 lines of cubic beziers; the folder-tab variant is in SPEC):

```js
export function shapePath({ w, h, r, k = 0.66 }) {
  const f = (n) => +n.toFixed(2), c = r * (1 - k);
  return [
    `M0 ${f(r)} C0 ${f(c)} ${f(c)} 0 ${f(r)} 0`, `L${f(w - r)} 0`,
    `C${f(w - c)} 0 ${f(w)} ${f(c)} ${f(w)} ${f(r)}`,
    `L${f(w)} ${f(h - r)} C${f(w)} ${f(h - c)} ${f(w - c)} ${f(h)} ${f(w - r)} ${f(h)}`,
    `L${f(r)} ${f(h)} C${f(c)} ${f(h)} 0 ${f(h - c)} 0 ${f(h - r)} Z`,
  ].join(' ');
}
```

### 2.5 Spring motion without a spring runtime

Spring (tension `k`, friction `c`, mass 1): `w0 = sqrt(k)`, damping ratio `z = c / (2 sqrt(k))`. Sheet: `w0 = 14.83`, `z = 0.71`, overshoot `exp(-pi z / sqrt(1 - z^2)) = 4.1%`. Step response, `t` in seconds, `z < 1`: `wd = w0 sqrt(1 - z^2)`; `x(t) = 1 - exp(-z w0 t) (cos(wd t) + (z w0 / wd) sin(wd t))`. Critically damped (`z = 1`): `x(t) = 1 - (1 + w0 t) exp(-w0 t)`.

| Use | k / c | z | Overshoot | Settle ms | "Response" `2pi / w0` s |
| --- | --- | --- | --- | --- | --- |
| Sheet, tab, accordion | 220 / 21 | 0.71 | 4.1% | 563 | 0.424 |
| Press, toggle thumb | 400 / 28 | 0.70 | 4.4% | 420 | 0.314 |
| Hover lift, fades | 260 / 30 | 0.93 | 0% | 463 | 0.390 |
| Dot numeral | 300 / 24 | 0.69 | 4.7% | 480 | 0.363 |
| Stroke draw-in | 120 / 22 | 1.0 | 0% | 781 | 0.574 |
| Counter, bar grow | 170 / 26 | 1.0 | 0% | 663 | 0.482 |

No spring at all: `cubic-bezier(0.3, 1.25, 0.6, 1)` over the settle time for overshooting moves; `cubic-bezier(0.22, 1, 0.36, 1)` (common ease-out) for the no-overshoot ones. Pre-sampled 25-point curves: `tokens.json` `motion.spring.*.linear`. Overshoot never above 6%. Reduced motion: no drift (bloom rests at 50% / 70%), no squish, no lift, springs resolve instantly (SPEC §9).

### 2.6 Accessibility rules (SPEC §10; these override the look)

1. Text 4.5:1; large text (>= 24 px regular, >= 18.7 px bold) and UI edges 3:1. Check pairs with `node contrast-check.mjs`.
2. Ink on frost and on vivid gel; white on deep gel only. Hierarchy on a gel by weight and size, never alpha (ink at 0.78 on green core is 3.75:1).
3. No text in the rim. Frost text plates: white >= 0.72 with ink, #121212 >= 0.80 with light text.
4. Static card edge = value step + 1 px hairline (>= 1.6:1); interactive edges `control-edge` at 3:1.
5. Lime is a fill behind ink (15:1), never light-ground text (1.24:1); a lime graphic carries a 1.5 px ink ring.
6. State is never hue alone. Dot numerals: >= 24 px, real text twin, hidden from assistive tech.
7. Weight 300 only at >= 20 px; body >= 16 px at >= 400; nothing under 12 px; weight 200 never.
8. Hit area >= 44 x 44 px; focus ring 2 px + 2 px offset + 2 px halo (18.7:1).
9. Honour OS preferences: reduce transparency (opaque plate), reduce motion, increase contrast (control-edge ring, no grain), forced colours (system colours, 1 px borders).

### 2.7 Performance rules (SPEC §11)

- <= 6 backdrop-blur plates per view (3 mobile, 1 over live video/canvas/3D); blur <= 40 px, prefer 12-24. A scrolling plate over a quarter of the viewport: use an opaque card.
- Blur the **ground** once (a sibling layer or baked asset), never an ancestor of the plate. Web: an ancestor with `filter`, `opacity < 1`, `mask`, `clip-path` or blend mode makes the plate sample nothing (MDN https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter).
- <= 4 drifting gel tiles, only visible ones. One shared 128 px grain tile. Low memory or battery saver: keep the gel, drop grain, drift and blur. Animate transform/opacity only.

---

## 3. Per-stack sections

Capabilities ("per-element backdrop blur" = blurring what is painted behind one element):

| Stack | Per-element backdrop blur | Squircle | Elliptical gel | Grain / blend | Springs | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| CSS / React | yes | `corner-shape` (Chromium) or path | yes | yes | `linear()` | Full |
| SwiftUI | yes (Material); `glassEffect` is Apple's lens | native | `EllipticalGradient` | overlay tile | native | Full |
| Compose | no built-in (copy trick or Haze); API 31+ | custom path | scaled circle | tile + blend | native | Near-full |
| Flutter | yes (`BackdropFilter`) | `ClipRSuperellipse` | circular + transform | tile / shader | native | Full |
| WPF | no (faked from a sibling ground, verified 2026-10; window-level material unverified) | `SquircleBorder` (verified) | yes (RadiusX/Y) | alpha-baked tile | custom easing (verified) | Gel, matte full; frost approximated |
| WinUI 3 | in-app acrylic; per-element needs App SDK 2.0 | custom clip | partly | limited | Composition | Good |
| Avalonia | no (window-level only) | custom geometry | yes | limited | custom easing | Gel, matte full |
| Electron / Tauri | yes (web) + window materials | as CSS | yes | yes | as CSS | Full |
| WinForms / tray | no | no | `PathGradientBrush` | no | no | Flat gel icons |
| Figma | yes | corner smoothing | yes | noise | prototype | Stills |
| Slides | no (blurred export) | freeform | partly | no | no | Stills |

### 3.1 Plain CSS / HTML

Full reference implementation: SPEC §2d (tokens, three surfaces, controls, focus ring, dark mode, degradation ladder, forced colours). `backdrop-filter` is Baseline 2024 (https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter). `corner-shape` (`squircle` = `superellipse(2)`, needs a non-zero `border-radius`) is experimental, not Baseline (https://developer.mozilla.org/en-US/docs/Web/CSS/corner-shape); Chrome and Edge 139+ ship it, Firefox and stable Safari status is conflicting in search results (`unverified`), so always `@supports`-guard it. Compact core:

```css
:root { --lg-card:#fff; --lg-ink:#121214; --lg-hairline:#b4b4ba; --lg-white:255 255 255;
  --lg-r-card:calc(9rem*.22); --lg-r-gel:calc(9rem*.24); --lg-pad:1.25rem; --lg-blur:24px;
  --gel-top:#c2d69b; --gel-mid:#5bab4b; --gel-core:#3b943c; --gel-bottom:#8fcf9a; --gel-rim:#bfe3c0;
  --lg-grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.lg-matte { background:var(--lg-card); border-radius:var(--lg-r-card); padding:var(--lg-pad);
  box-shadow:0 .14rem .6rem rgb(0 0 0/.05), 0 0 0 1px var(--lg-hairline); }
.lg-frost { position:relative; overflow:hidden; border-radius:var(--lg-r-card); padding:var(--lg-pad); background:var(--lg-card); }
@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .lg-frost { background:rgb(var(--lg-white)/.22); -webkit-backdrop-filter:blur(var(--lg-blur)) saturate(1.15); backdrop-filter:blur(var(--lg-blur)) saturate(1.15); }
  .lg-frost--text { background:rgb(var(--lg-white)/.72); color:var(--lg-ink); } }
.lg-frost::before { content:""; position:absolute; inset:0; border-radius:inherit; padding:1.5px; pointer-events:none;
  background:linear-gradient(135deg, rgb(var(--lg-white)/.6), rgb(var(--lg-white)/.25) 45%, rgb(var(--lg-white)/.5));
  mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite:exclude; -webkit-mask-composite:xor; }
.lg-frost::after { content:""; position:absolute; inset:auto 0 0 0; height:.5rem; pointer-events:none;
  background:linear-gradient(to top, rgb(var(--lg-white)/.5), transparent); }
.lg-gel { position:relative; isolation:isolate; overflow:hidden; border-radius:var(--lg-r-gel); padding:var(--lg-pad); color:var(--lg-ink);
  background:radial-gradient(ellipse 70% 60% at 50% 70%, var(--gel-core) 0, var(--gel-mid) 45%, transparent 100%),
             linear-gradient(to bottom, var(--gel-top), var(--gel-bottom));
  box-shadow:inset 0 0 1.4rem .2rem var(--gel-rim); }
.lg-gel::before { content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(circle at 20% 15%, rgb(var(--lg-white)/.16), transparent 55%); }
.lg-gel::after { content:""; position:absolute; inset:0; pointer-events:none; background-image:var(--lg-grain); opacity:.03; mix-blend-mode:overlay; }
.lg-gel > * { position:relative; z-index:1; }
@supports (corner-shape:squircle) { .lg-matte,.lg-frost,.lg-gel { corner-shape:squircle; } }
@media (prefers-reduced-transparency:reduce) { .lg-frost,.lg-frost--text { background:var(--lg-card); backdrop-filter:none; -webkit-backdrop-filter:none; } }
```

Gotchas: `mask-composite` needs the `-webkit-` form on Safari; spring easing is the `linear(...)` string from `tokens.json`, with the bezier fallback.

### 3.2 React + Tailwind v4 + shadcn/ui on Base UI (the user's web baseline)

Provisioning, tokens, dark mode and `cn()` live in the `web-ui-baseline` skill; this adds the glass layer. Untested sketch.

1. **Tokens in `globals.css`.** Map shadcn's flat set to glass tokens (SPEC §2d): `--background` = ground, `--card` = card, `--foreground` = ink, `--muted-foreground` = ink-secondary, `--border` = hairline, `--input` = control-edge, `--ring` = focus ring, `--primary` = ink, `--accent` = lime. Put the `--lg-*` and `--gel-*` properties in `:root`, dark values in `.dark`, expose them: `@theme inline { --color-lg-ink: var(--lg-ink); --radius-lg-card: var(--lg-radius-card); --radius-lg-gel: var(--lg-radius-gel); --ease-lg-sheet: var(--lg-ease-sheet); }`.
2. **Surfaces as `@utility`** (v4 custom utilities allow nested `&::before`). Wrap the §3.1 blocks one to one, literals only in the token block (house rule C3):

```css
@utility lg-frost { position: relative; overflow: hidden; border-radius: var(--lg-radius-card);
  background: rgb(var(--lg-white-rgb) / var(--lg-a-frost-decor));
  -webkit-backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate)); backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));
  &::before { /* rim, as 3.1 */ } &::after { /* lip, as 3.1 */ } }
@utility lg-frost-text { background: rgb(var(--lg-frost-scrim-rgb) / var(--lg-a-frost-text)); color: var(--lg-ink); }
/* same for lg-matte, lg-gel, plus the reduced-transparency / forced-colors blocks */
```

   Keep the `-webkit-` lines; whether your build auto-prefixes is `unverified`.
3. **cva** (colourway via `data-gel`):

```tsx
const surface = cva("", { variants: { surface: { matte: "lg-matte p-5", frost: "lg-frost p-5",
  "frost-text": "lg-frost lg-frost-text p-5", gel: "lg-gel p-5" } }, defaultVariants: { surface: "matte" } });
type Gel = "green" | "pink" | "blue" | "orange" | "violet";
export function Surface({ surface: s, gel, className, ...p }: React.ComponentProps<"div"> & VariantProps<typeof surface> & { gel?: Gel }) {
  return <div data-gel={s === "gel" ? gel ?? "green" : undefined} className={cn(surface({ surface: s }), className)} {...p} />;
}
```

4. **Controls.** Restyle shadcn `Button`, `Input`, `Toggle` per SPEC §7 (stadium, 44 px min, `control-edge`, 3-layer focus ring); no `rounded-md` default survives.
5. **Base UI pitfall.** Popups (dialog, popover, menu) portal and animate. A transition that sets `opacity` or `filter` on an **ancestor** of a frosted element makes the blur sample an empty backdrop (SPEC §11.1; MDN backdrop-root rule). Fade the plate's own children and test.

### 3.3 Electron and Tauri

Web UI per §3.1/§3.2. A native window material blurs the **desktop behind the window**, not the content inside: good for a small floating panel that is itself a frost plate.

- **Electron.** `win.setBackgroundMaterial(material)` (Windows 11 22H2+: `auto`, `none`, `mica`, `acrylic`, `tabbed`) and `win.setVibrancy(type)` (macOS: `sidebar`, `popover`, `hud`, `under-window`...) per https://www.electronjs.org/docs/latest/api/browser-window. A constructor option `backgroundMaterial` and a transparent-window requirement are `unverified`. Page background transparent, the §2.3 tint on top.
- **Tauri 2.** `window-vibrancy` crate / Tauri window effects; the JS API lists an `Acrylic` effect with a resize/drag performance caveat on Windows 10 1903+ and 11 build 22000 (https://v2.tauri.app/reference/javascript/api/namespacewindow/). The `tauri.conf.json` key is `unverified`. Needs a transparent window. Prefer Mica for persistent windows, Acrylic for transient panels.
- Rounded corners with decorations off need `DWMWA_WINDOW_CORNER_PREFERENCE` (33) or a CSS clip (https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute).

### 3.4 SwiftUI (iOS, iPadOS, macOS)

Per-element blur via `Material`; continuous corners natively; elliptical gradients; native springs. Rim, lip and grain are composed by hand.

- **Squircle:** `RoundedRectangle(cornerRadius: r, style: .continuous)` (https://developer.apple.com/documentation/swiftui/roundedrectangle/init(cornerradius:style:)).
- **Apple's lens:** iOS 26 `glassEffect(_:in:)` with `Glass` (`.regular`, `.clear`, `.tint(_:)`, `.interactive()`) and `GlassEffectContainer` (https://developer.apple.com/documentation/swiftui/view/glasseffect(_:in:)); the page body was not retrievable, signature from general knowledge: `unverified`. It is Apple's refracting material, a different style (SPEC §0); use it only for navigation chrome, else `Material` plus the hand-drawn rim below.
- **Frost:** `.ultraThinMaterial` gives the blur (radius and alpha are system-defined; names `unverified` here), so a text plate adds an explicit white 0.72 overlay plus rim and lip. **Gel:** `ZStack` of layers; `EllipticalGradient` (iOS 17+, `unverified`) for the 70% x 60% bloom; a tiled `Image` for grain.

```swift
struct LGGel: View {   // untested sketch
    var top = Color(hex: 0xC2D69B), mid = Color(hex: 0x5BAB4B), core = Color(hex: 0x3B943C)
    var bottom = Color(hex: 0x8FCF9A), rim = Color(hex: 0xBFE3C0), module: CGFloat = 144
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: module * 0.24, style: .continuous)
        ZStack {
            LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom)
            EllipticalGradient(stops: [.init(color: core, location: 0), .init(color: mid, location: 0.45),
                                       .init(color: mid.opacity(0), location: 1)],
                               center: UnitPoint(x: 0.5, y: 0.7), startRadiusFraction: 0, endRadiusFraction: 0.7)
            RadialGradient(colors: [.white.opacity(0.16 /* 0.06 on deep ramps */), .clear], center: UnitPoint(x: 0.2, y: 0.15), startRadius: 0, endRadius: 80)
            shape.strokeBorder(rim, lineWidth: module * 0.05).blur(radius: 6)
            Image("grain128").resizable(resizingMode: .tile).opacity(0.03).blendMode(.overlay)
        }.clipShape(shape)
    }
}
// LGFrost (untested): content.padding(20).background(.ultraThinMaterial, in: shape).background(shape.fill(.white.opacity(text ? 0.72 : 0.22)))
//   .overlay(shape.strokeBorder(LinearGradient(white 0.6 -> 0.25 @0.45 -> 0.5, .topLeading -> .bottomTrailing), lineWidth: 1.5))
//   .overlay(alignment: .bottom) { LinearGradient(white 0.5 -> clear, bottom -> top).frame(height: 8).clipShape(shape) }
```

- **Springs:** `.spring(response: 2*pi/sqrt(tension), dampingFraction: z)`: sheet `(0.424, 0.71)`, press `(0.314, 0.70)` with `scaleEffect(0.97)`, hover `(0.390, 0.93)`. The mapping is derived here (`unverified`).
- **Accessibility:** `@Environment(\.accessibilityReduceTransparency)` swaps the plate for the opaque card, `\.accessibilityReduceMotion` stops drift and squish; `.frame(minWidth: 44, minHeight: 44)`; `.accessibilityHidden(true)` on the dot numeral with the real value as the container label.
- **Gotchas:** check the white 0.72 overlay in dark mode (use the #121212 0.80 scrim); no stacks of Materials in scrolling lists; `blendMode(.overlay)` renders offscreen, keep it to gel tiles.

### 3.5 Jetpack Compose (Android)

- `Modifier.blur(radius)` blurs a composable's own content and needs API 31; below that it renders unblurred (https://developer.android.com/develop/ui/compose/graphics/blur/overview). It does not blur what is behind. `graphicsLayer { renderEffect }` is API 31+ too (`unverified` against docs).
- **Backdrop options:** (1) *blur-copy trick* (no library; ground is an image or gradient you control): draw the same ground inside the plate, shifted by the plate's position, clipped and blurred. (2) A library such as Haze (`hazeSource` / `hazeEffect` with a blur, tint, noise style); names and minSdk `unverified`. Below API 31 show the opaque plate (white 0.92) with rim and lip.

```kotlin
// untested sketch: frost plate via the blur-copy trick
@Composable fun LgFrost(ground: @Composable () -> Unit, plateOffset: IntOffset, modifier: Modifier = Modifier,
                        text: Boolean = true, content: @Composable BoxScope.() -> Unit) {
    val shape = RoundedCornerShape(32.dp)   // circular arcs; see squircle note
    val canBlur = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    Box(modifier.clip(shape)) {
        if (canBlur) Box(Modifier.matchParentSize().offset { -plateOffset }.blur(24.dp)) { ground() }
        Box(Modifier.matchParentSize().background(Color.White.copy(alpha = if (!canBlur) 0.92f else if (text) 0.72f else 0.22f)))
        Box(Modifier.matchParentSize().border(1.5.dp,
            Brush.linearGradient(listOf(Color.White.copy(0.6f), Color.White.copy(0.25f), Color.White.copy(0.5f))), shape))
        content()
    }
}
```

- **Squircle:** `RoundedCornerShape` is circular; write a `Shape` whose `createOutline` builds a `Path` with `cubicTo` from §2.4. No built-in superellipse that I verified (`unverified`).
- **Gel:** `Brush.radialGradient` is circular; scale for the ellipse: `drawBehind { scale(1f, 0.857f, pivot = Offset(size.width/2, size.height*0.7f)) { drawCircle(brush, radius = size.width*0.7f) } }`. Grain: `ShaderBrush(ImageShader(bitmap, TileMode.Repeated, TileMode.Repeated))` at alpha 0.03, `BlendMode.Overlay`.
- **Springs:** `spring(dampingRatio = 0.71f, stiffness = 220f)` sheet, `0.70f / 400f` press, `0.93f / 260f` hover; direct stiffness mapping `unverified`.
- **Gotchas:** `graphicsLayer` effects render offscreen and clip to bounds, so blur spill needs outsets (https://developer.android.com/develop/ui/compose/graphics/draw/modifiers); update the plate offset on scroll and layout; touch targets at least 44 (Android's own is 48 dp).

### 3.6 Flutter

- **Blur:** `BackdropFilter(filter: ImageFilter.blur(sigmaX: s, sigmaY: s), child: ...)` filters everything behind it in the ancestor's clip, so **wrap it in a clip** (`ClipRRect` / `ClipRSuperellipse`) or it blurs the whole screen; costly, merge overlapping filters with `BackdropGroup` / `backdropKey` (https://api.flutter.dev/flutter/widgets/BackdropFilter-class.html). Start at sigma 24, match by eye (CSS-px equivalence `unverified`).
- **Squircle:** `ClipRSuperellipse`, "resembles SwiftUI's continuous corner style" (https://api.flutter.dev/flutter/widgets/ClipRSuperellipse-class.html); the Flutter version that added it is `unverified`; on older SDKs a `ClipPath` with a `CustomClipper<Path>` built from §2.4.
- **Gel:** `RadialGradient(center: Alignment(0, 0.4))` puts the bloom at x 50%, y 70% (alignment spans -1..1); circular, so stretch with a `GradientTransform` or bake PNGs. Grain: `DecorationImage(image: grain, repeat: ImageRepeat.repeat, opacity: 0.03)` or a fragment shader (`FragmentProgram.fromAsset`; `unverified`).
- **Springs:** `SpringDescription(mass: 1, stiffness: 220, damping: 21)` with `SpringSimulation` via `AnimationController.animateWith` takes the tokens directly (`unverified`).

```dart
// untested: ClipRSuperellipse(borderRadius: r, child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
//   child: DecoratedBox(decoration: BoxDecoration(color: Colors.white.withValues(alpha: text ? 0.72 : 0.22), borderRadius: r,
//     border: Border.all(color: Colors.white.withValues(alpha: 0.5), width: 1.5)), child: Padding(padding: EdgeInsets.all(20), child: child))))
```

- **Gotchas:** `Border` is solid only (gradient rim = `CustomPainter`); do not put `BackdropFilter` under `Opacity` or `ShaderMask` without `blendMode: BlendMode.src`; respect `MediaQuery.disableAnimationsOf`; a reduce-transparency signal may not exist on every platform (`unverified`), offer a setting.

### 3.7 WPF (the user's desktop stack)

**Verified 2026-10 on .NET 8 WPF.** A real window in the style (gel bento with dot-matrix numerals, pill tabs and glass icon buttons; a frost-plate stack over a multi-blob ground; a dark node board) was built from the `dotnet-wpf` archetype in a scratch copy, compiled (0 errors, 0 warnings under the archetype's `latest-recommended` analyzers) and rendered with `RenderTargetBitmap`: `playbook/styles/liquid-glass/proof/wpf/lg-proof-wpf.png` in Website Builder. The canonical, drop-in recipe is the `wpf/` folder next to this file (`LiquidGlass.xaml`, `SquircleBorder.cs`, `GlassParts.cs`, `README.md`); the excerpts below are copied from it. "Verified" below means seen in that build or render, not read from docs.

Template shape (`Templates/archetypes/dotnet-wpf`): `net8.0-windows`, x64, MVVM, no UI library by default. The recipe adds **no NuGet package**: two `.cs` files and one `ResourceDictionary`.

| Surface | WPF reality (verified) |
| --- | --- |
| Matte card | Full: squircle fill + 1 px hairline, a `DropShadowEffect` on a fill-only sibling. |
| Gel tile | Full: base `LinearGradientBrush`, bottom-weighted `RadialGradientBrush` bloom, pale edge wash, highlight, lip, 1 px gradient ring, tiled grain, all clipped to the squircle. `RadiusX`/`RadiusY` are relative to the box, so a non-square ellipse is native. |
| Squircle | **No native corner.** `CornerRadius` is circular. `SquircleBorder` (below) draws and clips with the §2.4 bezier path. Verified; reads right against the originals. |
| Frost plate | **No per-element backdrop blur.** Faked honestly: a `VisualBrush` of the sibling ground, cropped to the plate, `BlurEffect`, tint. Verified (below). `saturate(1.4)` is not available without a pixel shader; the tint carries the colour. |
| Grain overlay blend | No blend modes. An alpha-baked 128 px noise tile (generated in code at first use, fixed seed), normal blend, `Opacity` 0.35 over alpha 0.086 (about 3%). Flatter than overlay, still reads on gel; slightly more visible on dark (0.4). |
| Springs | `EasingFunctionBase` subclass. **Must set `EasingMode.EaseIn` in its constructor** (below). Verified: sheet overshoot 4.3%, press 4.6% (spec 4.1 / 4.4%). |
| Text tracking | **Not available:** `TextBlock` has no letter-spacing property in .NET 8 (checked by reflection; `Typography` has only `CapitalSpacing`). Negative display tracking is dropped; use the lighter weight and size contrast. |

**Squircle: `SquircleBorder` + `SquircleGeometry`** (full file in `wpf/SquircleBorder.cs`). A `Decorator` that paints `Background` and a gradient-capable `BorderBrush` stroke with the §2.4 path (`k` = 0.66) and **clips its child to the same squircle**, so every layered gel or frost child follows the continuous corner. `Radius` is absolute (card 32, gel 43 from the 144 px module); a stadium is `Radius` = half the height, which gives the flat shoulders the spec allows. Core:

```csharp
// SquircleGeometry.Create(Rect rect, double radius, double k = 0.66): c = r * (1 - k); the path of shapePath() in 2.4
c.BeginFigure(new Point(l, t + r), true, true);                                           // isFilled, isClosed
c.BezierTo(new Point(l, t + cc), new Point(l + cc, t), new Point(l + r, t), true, false); // isStroked MUST be true
c.LineTo(new Point(rt - r, t), true, false); /* ...three more corners in the same order... */ g.Freeze();
// SquircleBorder.ArrangeOverride: Child.Arrange(slot); Child.Clip = SquircleGeometry.Create(innerRect shifted by -slot.Origin, Radius - BorderThickness);
// SquircleBorder.OnRender: DrawGeometry(Background, null, outer); DrawGeometry(null, new Pen(BorderBrush, bt), rect inset by bt/2, Radius - bt/2)
```

Three traps found while building it (all in the recipe already). (1) `StreamGeometryContext.LineTo/BezierTo` take `isStroked`; passing `false` (the natural reading of "no fill rule" for a clip) silently removes the whole rim stroke except the closing segment. (2) The clip belongs in the **child's** coordinates, shifted by the slot origin. (3) Padding must apply to the `ContentPresenter` (`Margin="{TemplateBinding Padding}"`), not to the `SquircleBorder` that clips the layers: padding on the clipping element insets the tint and sheen into a rectangle with square corners (seen in the first render). A `DropShadowEffect` goes on a **fill-only sibling**, never on the clipping element: an `Effect` re-rasterises its subtree's text without ClearType (documented WPF behaviour, not re-tested here) and the child clip would cut the shadow.

**Frost: what works.** The guide's technique is right, with four corrections found by building it. `FrostBackdrop` (in `wpf/GlassParts.cs`) is a `FrameworkElement` whose `OnRender` draws `new VisualBrush(Source) { ViewboxUnits = Absolute, Viewbox = TransformToVisual(Source).TransformBounds(own bounds), Stretch = Fill, Viewport = own size }`, and re-renders on `LayoutUpdated` when that region changes (so no manual `SizeChanged` handler). It sits inside the clipped plate under a `BlurEffect`, then tint, sheen, lip, grain, content:

```xml
<lg:FrostBackdrop Margin="-48" Source="{Binding Path=(lg:Glass.Ground), RelativeSource={RelativeSource TemplatedParent}}">
  <lg:FrostBackdrop.Effect><BlurEffect Radius="45" KernelType="Gaussian" RenderingBias="Quality"/></lg:FrostBackdrop.Effect></lg:FrostBackdrop>
<Rectangle Fill="{Binding Path=(lg:Glass.Tint), RelativeSource={RelativeSource TemplatedParent}}"/>   <!-- 0.22 white, or the ground tint plate at 0.46 -->
```

1. **`BlurEffect.Radius` is not a CSS pixel and not a sigma either: measured sigma = Radius / 3** (blur a hard edge, 10-90% rise width / 2.563: Radius 8 -> 2.67, 16 -> 5.32, 24 -> 8.00, 45 -> 15.09, 72 -> 24.00). CSS `blur(Npx)` has sigma N, so the equivalent is `Radius = 3 N`: the guide's example `Radius="24"` is a CSS 8 px blur, not 24. The recipe uses Radius 45 (CSS 15 px, 0.06 of a 262 px plate, inside the 0.05-0.15 H band for a defocused ground). 2. **The bleed is 3 sigma = Radius** (`Margin="-48"` for Radius 45), not "2x the radius": less lets the blurred edge fade to transparent at the plate edge. 3. The ground must be a **sibling** of the plate, never an ancestor (an ancestor contains the plate itself); the copy shows only that ground, not another plate stacked under it. 4. The attached property carries the ground (`lg:Glass.Ground="{Binding ElementName=PinkGround}"` at the use site), because a template cannot see the page's names. The effect radius is fixed in the template (binding it through `TemplatedParent` was not tried); make a second style for a second radius. Cost: one extra render of the ground per plate; fine for a handful of plates, measure before a dozen.

Verified result: a mid-tone "subject" ellipse crossing the plates is crisp outside them and a soft ghost inside, the plates tint toward the ground's pink, and the contrast gate holds (below). Over a flat ground it reads as a pale panel, as §2b already says.

**Window-level material (unchanged, `unverified`).** Not exercised in this proof (it needs an interactive Windows 11 window). Everything in the paragraph and snippet below keeps its previous status: Windows 11 build 22621+, `DwmSetWindowAttribute(hwnd, DWMWA_SYSTEMBACKDROP_TYPE = 38, DWMSBT_*)` (1 none, 2 Mica, 3 Acrylic, 4 Mica Alt; https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type), it blurs the desktop behind the window, not the app's cards, and Acrylic is for transient surfaces, Mica for the long-lived window (https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic).

```csharp
// Window-level material. NOT built here; the CompositionTarget/DwmExtendFrame sequence is a widely used pattern (unverified).
internal static class DwmBackdrop {
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
    [DllImport("dwmapi.dll")] static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins m);
    [StructLayout(LayoutKind.Sequential)] struct Margins { public int L, R, T, B; }
    /// type: 2 Mica, 3 Acrylic, 4 Mica Alt. False below Windows 11 22H2: keep the opaque fallback.
    public static bool Apply(Window w, int type, bool dark) {
        if (!OperatingSystem.IsWindowsVersionAtLeast(10, 0, 22621)) return false;
        var hwnd = new WindowInteropHelper(w).EnsureHandle();            // after SourceInitialized
        HwndSource.FromHwnd(hwnd).CompositionTarget.BackgroundColor = Colors.Transparent;
        var m = new Margins { L = -1, R = -1, T = -1, B = -1 }; DwmExtendFrameIntoClientArea(hwnd, ref m);
        int d = dark ? 1 : 0; DwmSetWindowAttribute(hwnd, 20, ref d, sizeof(int));        // immersive dark mode
        int round = 2;        DwmSetWindowAttribute(hwnd, 33, ref round, sizeof(int));    // corner preference (value 2 unverified)
        return DwmSetWindowAttribute(hwnd, 38, ref type, sizeof(int)) == 0;
    }
}   // XAML: Window Background="Transparent" WindowStyle="None"; no AllowsTransparency="True" (layered windows and backdrops: unverified)
```

Fallback when the window material is unavailable: the opaque tinted plate (white 0.92, rim and lip kept), or the faux frost above.

**`Themes/LiquidGlass.xaml`** (full file in `wpf/LiquidGlass.xaml`; merge in `App.xaml`). Tokens are copied from `tokens.json` and a script confirmed 0 of 48 colour values drift. Keys: `LgInk`, `LgGround`, `LgCard`, `LgHairline`, `LgControlEdge`, `LgLime`, the dark set (`LgDark*`, `LgGlow*`), the five vivid gel colourways (`GelGreen`, `GelPink`, `GelBlue`, `GelOrange`, `GelViolet`, each Top/Mid/Core/Bottom/Rim colours plus `…Base`, `…Bloom`, `…Wash` brushes and a `LgGel<Name>` style), `LgRimBrush`, `LgLipBrush`, `LgSheenBrush`, radii (`LgRadiusCardPx` 32, `LgRadiusGelPx` 43 as `sys:Double`; `CornerRadius` twins for plain pills), `LgFontSans`, text styles, icon geometries, and these templates: `LgMatteCard`, `LgFrostPlate`/`LgFrostPlateText`, `LgGel` (+ per colourway), `LgPillTab`, `LgGlassIconButton`, `LgGlowSlab`, focus styles. Excerpts:

```xml
<!-- bottom-weighted bloom; the fade stop is the SAME colour at alpha 0 (see gotcha) -->
<Color x:Key="GelGreenMidClear">#005BAB4B</Color>
<RadialGradientBrush x:Key="GelGreenBloom" Center="0.5,0.7" GradientOrigin="0.5,0.7" RadiusX="0.9" RadiusY="0.75">
  <GradientStop Color="{StaticResource GelGreenCore}" Offset="0"/><GradientStop Color="{StaticResource GelGreenMid}" Offset="0.5"/>
  <GradientStop Color="{StaticResource GelGreenMidClear}" Offset="1"/></RadialGradientBrush>

<!-- gel template: one template, colourway by attached properties; Background = the linear base -->
<Style x:Key="LgGelGreen" TargetType="ContentControl" BasedOn="{StaticResource LgGel}">
  <Setter Property="Background" Value="{StaticResource GelGreenBase}"/>
  <Setter Property="lg:Glass.Bloom" Value="{StaticResource GelGreenBloom}"/><Setter Property="lg:Glass.Wash" Value="{StaticResource GelGreenWash}"/></Style>
<lg:SquircleBorder Radius="{Binding Path=(lg:Glass.Radius), RelativeSource={RelativeSource TemplatedParent}}" Background="{TemplateBinding Background}">
  <Grid>  <!-- Bloom, Wash, LgGelHighlight, lip, GrainOverlay, then a 1 px ring SquircleBorder ON TOP, then the ContentPresenter (Margin = Padding) -->
```

The gel's 1 px ring is a second, fill-less `SquircleBorder` laid over the wash. Drawn as the parent's own border it sits under the clipped content, over the saturated base, and reads as a hot dark outline (pink and green tiles in the first render).

**Gotchas verified in this build.**

- **Gradient fade to `#00000000` greys the bloom.** WPF interpolates gradient stops without premultiplying alpha. Measured over white at 75% of a radius from `#3B943C`: fade to `#00000000` gives `#C5CAC5` (grey), fade to the same green at alpha 0 gives `#D0E6D0` (green). Always fade to the stop's own colour with alpha 0. (The earlier sketch used `#00000000`: wrong.)
- **`EasingFunctionBase` defaults to `EaseOut`**, which plays the closed form backwards (measured `Ease(0.25)` = -0.015 instead of 0.750). Set `EasingMode = EasingMode.EaseIn` in the constructor; the earlier sketch left it to the XAML.
- **`FocusVisualStyle` is the `:focus-visible` of WPF**: it appears for keyboard focus only. `LgFocusPill` / `LgFocusCircle` stack a 2 px halo rectangle at -5, a 2 px ring at -3 (so a 2 px gap), concentric radii; the default dotted rectangle is replaced. A headless render has no keyboard input, so the proof sets the internal `KeyboardNavigation.AlwaysShowFocusVisual` by reflection (proof only, never ship it). Render root must be the `AdornerDecorator` or the adorner is missing from the PNG.
- **A `Setter TargetName` cannot target a `Transform` inside a `TransformGroup`** (compile error MC4111). Animate the named transform with a `Storyboard` in `Trigger.EnterActions`/`ExitActions`, as `LgPillTab` and `LgGlassIconButton` do (hover lift -2 px on the `settle` spring, press 0.97 on the `press` spring, both `SpringEase`).
- **A custom `FrameworkElement` has no automation peer**, so `DotMatrix` is invisible to UI Automation by itself (the guide's `aria-hidden` rule is met for free); there is no `AutomationProperties.AccessibilityView` setter in WPF. Show the same value as sans text in the same card (the demo does: "1,195 per person").
- **A window's `Background` is not in a render of its child.** Give the render root its own ground (`<Border Background="{StaticResource LgGround}">`), or the PNG has a transparent background.
- **The archetype's `dotnet build` of the `.csproj` alone writes to `bin\Debug\net8.0-windows\`; building the `.sln` writes to `bin\x64\Debug\net8.0-windows\`.** Running a stale DLL from the other folder looks like "the app hangs before `OnStartup`". A restored `App.xaml` with an old timestamp is not regenerated by an incremental build; touch it.
- **Analyzers:** the archetype's `AnalysisLevel latest-recommended` raises CA1725 if an override renames a base parameter (`OnRender(DrawingContext drawingContext)`, `ArrangeOverride(Size arrangeSize)`, `EaseInCore(double normalizedTime)`). The recipe keeps the base names.
- **Fonts:** `Urbanist, Outfit, Inter, Segoe UI Variable Display, Segoe UI` as a `FontFamily` list resolves to Outfit on a machine with Outfit installed (Light weight rendered). Urbanist itself is not installed by default, and WPF cannot load the layer's woff2 files: ship Urbanist as a `.ttf` resource (OFL) or accept Outfit.

**Dot-matrix numerals.** `DotMatrix` (in `wpf/GlassParts.cs`) draws dots from a 5x7 glyph table (digits, `.` `:` `-` `/`; `.` and `:` are 2 columns wide) as ellipses of 0.6 of the pitch; glyph height = 7 pitches, floor 24 px. Verified legible at pitch 5.5 to 7; 5/6/8/0 are ambiguous, so the same value sits beside it in sans (SPEC 5.2).

**Contrast, computed on the XAML values** (`wpf-contrast.mjs`-style script: reads `tokens.json` and the dictionary, SPEC §10 floors; 25 pairs, all pass): ink on ground 16.60, on card 18.71, ink-secondary on card 9.81 / ground 8.70, on-ink on the active pill 18.71, ink on lime 15.12, hairline vs ground 1.83 (floor 1.6), control-edge vs ground 3.78 / card 4.26 (floor 3), focus ring vs halo 18.71, ink on the five vivid gels with edge wash + highlight 8.41 to 10.39, ink on the pink frost plate over every blob colour 9.99 / secondary 5.24 (matches §10.2 rule 4, which confirms the plate is `tint x 0.55 + white x 0.45` at alpha 0.46), dark ink on panel 15.51, dark secondary on panel 8.65, glow graphic 11.05. The one failure the check caught was the demo's own: secondary grey on a `#0E7A1F` gradient stop was 2.79; darkened to `#064510` it is 5.71. Contrast on a dark gel card must be checked at the lightest stop under the text.

**What WPF cannot do (confirmed), and the fallback used.** (1) Per-element backdrop blur of arbitrary content: copy of a known ground, or a window-level material (unverified). (2) A native squircle corner: `SquircleBorder`. (3) Overlay blend for grain: alpha-baked tile, flatter. (4) `saturate()` on the backdrop: none without a compiled pixel shader; tint instead. (5) Text tracking: dropped. (6) `woff2` and variable-axis fonts: TTF only; weight steps limited to what the installed family exposes. (7) Inset shadows: the pale wash plus a ring and lip stand in. (8) A free reduce-transparency signal: none (WinUI's acrylic has one); offer a setting that swaps `Glass.Tint` for the opaque plate and removes the `FrostBackdrop`. (9) Springs without a runtime: `SpringEase` on a `Storyboard`.

**Matte / pill / icon button excerpts.**

```xml
<Style x:Key="LgMatteCard" TargetType="ContentControl"> ...
  <Grid><lg:SquircleBorder Radius="32" Background="#FFFFFF"><lg:SquircleBorder.Effect>   <!-- fill-only shadow sibling -->
      <DropShadowEffect Color="Black" Opacity="0.07" Direction="270" ShadowDepth="2" BlurRadius="14"/></lg:SquircleBorder.Effect></lg:SquircleBorder>
    <lg:SquircleBorder Radius="32" Background="{DynamicResource LgCard}" BorderBrush="{DynamicResource LgHairline}" BorderThickness="1" Padding="{TemplateBinding Padding}"><ContentPresenter/></lg:SquircleBorder></Grid>
```

Pill: a plain `Border` `CornerRadius="22"` `MinHeight="44"` `BorderBrush="{DynamicResource LgControlEdge}"` `BorderThickness="1.5"`; checked = ink fill + check glyph (not colour alone). Glass icon button: 44 px circle, `#3DFFFFFF` fill, 1 px hairline, lens crescent (lilac / blue gradient stroke), 1.5 px round-cap glyph. Both live in the theme; `Style` applies to `ToggleButton` and `RadioButton` (a style on the base class works on the derived one).

**Springs** (storyboards: `EasingMode` EaseIn, `Duration` = settle ms). Verified: sheet (220/21/563) `Ease(.25)` 0.750, `Ease(.5)` 1.041, `Ease(1)` 0.999, peak 1.043; press (400/28/420) peak 1.046; settle (260/30/463) monotone to 1.000, no overshoot.

```csharp
public sealed class SpringEase : EasingFunctionBase {
    public SpringEase() { EasingMode = EasingMode.EaseIn; }          // the default is EaseOut and plays the spring backwards
    public double Tension { get; set; } = 220, Friction { get; set; } = 21, SettleMs { get; set; } = 563;
    protected override double EaseInCore(double normalizedTime) {
        double w0 = Math.Sqrt(Tension), z = Friction / (2 * w0), t = normalizedTime * SettleMs / 1000.0;
        if (z >= 1) return 1 - (1 + w0 * t) * Math.Exp(-w0 * t);
        double wd = w0 * Math.Sqrt(1 - z * z);
        return 1 - Math.Exp(-z * w0 * t) * (Math.Cos(wd * t) + z * w0 / wd * Math.Sin(wd * t));
    }
    protected override Freezable CreateInstanceCore() => new SpringEase { Tension = Tension, Friction = Friction, SettleMs = SettleMs, EasingMode = EasingMode };
}
```

**Proof harness (how the render was made).** A `--render <path.png>` startup argument: lay the window out off-screen (`Left = -20000`, `ShowInTaskbar = false`), wait on a `DispatcherTimer` (1.5 s, started before `Show()`), draw the `AdornerDecorator` through a `DrawingVisual` + `VisualBrush` into a `RenderTargetBitmap` at 192 dpi, encode PNG, `Shutdown()`. Unelevated, framework-dependent: `dotnet bin\Debug\net8.0-windows\LgProof.dll --render out.png`. No screen capture, no elevation.

**Limits that remain.** (1) Window materials (Mica/Acrylic) are unverified and need Windows 11 22H2+; Windows 10 gets the opaque plate. (2) A card cannot blur the app's other content, only a known sibling ground. (3) .NET 9's Fluent theme (`ThemeMode`) is Microsoft's look and needs a retarget from `net8.0-windows` (https://learn.microsoft.com/dotnet/desktop/wpf/whats-new/net90); third-party Mica libraries are new dependencies: ask first. (4) Freshly built unsigned binaries can be blocked on a managed machine: build framework-dependent Debug and launch via `dotnet <App>.dll` as the template does. (5) The proof is one machine, one DPI (rendered at 2x); high-DPI and Windows 10 are unchecked.

### 3.8 WinUI 3

- **Window material:** `Window.SystemBackdrop` with `MicaBackdrop` (`Kind="BaseAlt"` for Mica Alt) or `DesktopAcrylicBackdrop` (App SDK 1.3+); Mica for the main window, Acrylic only for transient surfaces; flyouts, popups and menu flyouts also take `SystemBackdrop` (https://learn.microsoft.com/en-us/windows/apps/develop/ui/system-backdrops).
- **Per-element:** `SystemBackdropElement` renders a backdrop within its bounds with a `CornerRadius` and **requires Windows App SDK 2.0+** (same page): the closest thing to a true frost plate. Below that, in-app acrylic.
- **In-app acrylic:** `AcrylicBrush` as a `Background` blurs the app's own content; it turns solid with Transparency effects off, in Battery Saver or on low-end hardware (free reduce-transparency); do not place panes edge to edge (seams) (https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic). Tuning properties (`TintColor`, `TintOpacity`, `TintLuminosityOpacity`, `FallbackColor`): `unverified`.
- **Matte, gel:** `ThemeShadow` (`Translation="0,0,32"`) is system elevation, not a 0.05-alpha shadow (`unverified`); for the exact shadow use a Composition drop shadow (`unverified`) or hairline only. `RadialGradientBrush` in WinUI 3 (App SDK version) `unverified`; alternatives `compositor.CreateRadialGradientBrush()` (`unverified`) or baked PNGs. Squircle: Composition `CreateGeometricClip` with a Win2D path (`unverified`). Springs: `SpringScalarNaturalMotionAnimation` `DampingRatio` = z, `Period` = the "response" column of §2.5 (`unverified`).

### 3.9 Avalonia

- **Window material:** `TransparencyLevelHint` is a prioritised list (Mica, AcrylicBlur, Blur...); Mica is Windows 11 only, AcrylicBlur needs Windows 10 1803+, `Background` must be `Transparent`, read `ActualTransparencyLevel`; macOS supports only Transparent, Linux depends on the compositor (https://docs.avaloniaui.net/docs/platform-specific-guides/windows, https://api-docs.avaloniaui.net/docs/P_Avalonia_Controls_TopLevel_TransparencyLevelHint).
- **In-app acrylic:** `ExperimentalAcrylicBorder` + `ExperimentalAcrylicMaterial` (`TintColor`, `TintOpacity`, `MaterialOpacity`, `FallbackColor`) is documented for 0.10 (https://docs.avaloniaui.net/docs/0.10.x/tutorials/music-store-app/creating-a-modern-looking-window); unchanged in 11/12 (the stack CSV targets 12) is `unverified`.
- **Effects:** `BlurEffect` blurs the element's own pixels, not what is behind; `DropShadowEffect`; `BoxShadow` (Border only, supports `inset`) (https://docs.avaloniaui.net/docs/graphics-animation/effects). No per-element backdrop blur found in the docs: `unverified`.
- **Gel:** the inset `BoxShadow` makes the rim wash directly. Squircle: `Geometry.Parse(pathData)` accepts SVG-style path data, so the §2.4 output works as a `Clip` (syntax tolerance `unverified`).

```xml
<!-- untested sketch -->
<Panel Width="144" Height="144">
  <Border CornerRadius="34.56" BoxShadow="inset 0 0 22 3 #BFE3C0"><Border.Background>
    <LinearGradientBrush StartPoint="50%,0%" EndPoint="50%,100%"><GradientStop Color="#C2D69B" Offset="0"/><GradientStop Color="#8FCF9A" Offset="1"/></LinearGradientBrush></Border.Background></Border>
  <Border CornerRadius="34.56"><Border.Background>
    <RadialGradientBrush Center="50%,70%" GradientOrigin="50%,70%" RadiusX="70%" RadiusY="60%">   <!-- RadiusY: unverified -->
      <GradientStop Color="#3B943C" Offset="0"/><GradientStop Color="#5BAB4B" Offset="0.45"/><GradientStop Color="#005BAB4B" Offset="1"/></RadialGradientBrush></Border.Background></Border>
  <ContentPresenter Margin="20"/></Panel>
```

Tokens as `DynamicResource` brushes; surfaces as `Style Selector="Border.lg-matte"` classes; `:pointerover` / `:pressed` / `:focus-visible` carry states. Springs: a custom `Easing` subclass (`Ease(double)`) with the §2.5 closed form. Per-element frost: window-level material or the opaque plate; always keep the fallback colour.

### 3.10 WinForms and tray utilities

A tray-only utility (like Stay Awake) has little surface: icon, menu, maybe one small window. Realistic: (1) **Flat gel icon**: draw 16/20/24/32 px with GDI+: `LinearGradientBrush` base, `PathGradientBrush` bloom (ellipse path, `CenterPoint` at 50% x 70%, centre `core`, surround `mid`), white 16% highlight, no grain at that size, squircle via `GraphicsPath.AddBezier` (§2.4); ship a solid high-contrast variant. (2) **Menu**: a custom `ToolStripRenderer` with rounded 8-10 px highlights, ground #f2f1f1, ink text, hairline border; automatic Windows 11 rounding for custom-rendered menus is `unverified`. No frost. (3) **Dot numerals**: draw a 5 x 7 grid of circles (dot 0.6 of pitch) for a counter, only above about 24 px. (4) A borderless popup may take the §3.7 DWM material and corners (same P/Invoke on `Handle`). That is the whole port: flat gel icons, rounded matte menus, palette and type.

### 3.11 Blazor and .NET MAUI

**Blazor** is web: §3.1 applies; tokens in a global stylesheet, surfaces in `*.razor.css` (reach children with `::deep`); in Blazor Hybrid, `backdrop-filter` depends on the WebView engine (WebView2 is Chromium); keep the `@supports` fallbacks. **MAUI**: matte = `Border` (`StrokeShape="RoundRectangle 32"`, `Shadow`), gel = `Grid` of `Border`s with `LinearGradientBrush` / `RadialGradientBrush`; no built-in backdrop blur or continuous corners (use a `PathGeometry` clip); native blur needs per-platform handlers (`UIVisualEffectView`, Android `RenderEffect` API 31+, WinUI `SystemBackdrop`), all `unverified` here. Plan on the opaque plate and put the effort into gel, radii, type and colour.

### 3.12 Terminal and CLI

Only this carries over: the palette (truecolor `ESC[38;2;r;g;bm`; recheck contrast on the terminal's background), dot-matrix numerals (5 x 7 grid of `●` and `·`, plain number beside it), and the spacing (generous padding, sentence case, `╭ ╮ ╰ ╯` corners, one lime accent). No blur, no motion beyond a spinner.

### 3.13 Figma (and Framer, Penpot)

1. **Variables.** Colour collection with Light/Dark modes from §0 and §2.2; number collection for radii (card 31.68, gel 34.56, stadium 22) and spacing (pad 20, gel gap 8, card gap 20); bind fills and strokes.
2. **Type.** Urbanist (Outfit; Inter fallback), scale in §2.1; titles 300 at 20 px+, letter spacing -2% title, -3% display.
3. **Matte card.** Auto-layout frame (padding 20), fill `card`, inside stroke 1 px `hairline`, radius 31.68, drop shadow x 0 y 2 blur 9 black 5%. Corner smoothing for the squircle (`unverified`).
4. **Frost plate.** Fill white 22% (72% with text) + effect **Background blur** (effects: drop shadow, inner shadow, layer blur, background blur: https://help.figma.com/hc/en-us/articles/360041488473). It only shows with a partly transparent **fill**; lowering layer opacity disables it (reported, `unverified`). Blur is not CSS px: start near 24, match by eye (`unverified`). Put a photo or gel with light/dark variation behind.
5. **Rim and lip.** Inside stroke 1.5 px, linear gradient white 60% (top-left), 25% (45%), 50% (bottom-right). Lip: inner shadow x 0, y -4, blur 8, white 50% (negative y lands on the bottom edge). No drop shadow.
6. **Gel.** Fills top to bottom: grain, highlight radial (white 16% to 0 at 20%/15%), bloom radial (handles stretched to 70% x 60%, centre 50%/70%, `core` 0, `mid` 45%, `mid` at 0% alpha 100%), base linear. Rim: inner shadow blur 22 spread 3 `rim`.
7. **Grain.** A Noise effect exists in recent Figma (third-party mirror of the help page; `unverified`); else a 128 px tiling noise image on top, Overlay, 3%.
8. **Controls.** Stadium radius 22, height 44, stroke 1.5 px `control-edge`; active pill `ink` fill with check icon; variants rest/hover/pressed/focus/disabled; focus = 2 px ring, 2 px gap, 2 px halo. Prototype springs 220/21/1 and 400/28/1 (parameter support `unverified`). Check contrast with `contrast-check.mjs`.

**Framer:** a backdrop blur effect on layers (`unverified`); the rest as Figma. **Penpot:** layer blur exists, a background-blur equivalent is `unverified`; use the opaque plate or export a pre-blurred backdrop.

### 3.14 Slides (PowerPoint, Keynote)

No live backdrop blur; fake frost with a pre-blurred picture. (1) Blur the photo or gradient in Figma or an image tool (about 24 px at 1920 wide, match by eye), export, set as slide background. (2) Frost plate: rounded shape, white fill at 28% transparency (text) or 78% (decorative), 1.5 px white outline at about 50% transparency, optional soft edges; for a squircle insert an SVG of `shapePath` and convert it to a shape (`unverified`). (3) Gel: a linear-gradient shape plus a second shape with a radial gradient from `core` to transparent, or a PNG from Figma. (4) Palette as theme colours, Urbanist or Inter, weight 300 at 20 pt+. (5) Use ease-out of about 0.4 s; no springs. Ink text on frost and gel survives projectors. Menu paths and version availability: `unverified`.

### 3.15 3D and motion tools

**Blender:** the look is not a physical material; the fast route is a flat render: a plane with the gel gradient (Color Ramp driven by a Gradient Texture centred at 50%/70%) and a **grain pass** in the compositor (Noise Texture, Overlay mix at 3%) after all colour work; matte, even light, no hard speculars. A real-glass slab (Principled BSDF Transmission 1, Roughness 0.2-0.4) gives frost. Node names `unverified`. **After Effects:** true backdrop blur is easy: an **adjustment layer** masked by the plate's squircle (paste `shapePath` as a mask) with Gaussian Blur about 24 px, then tint, gradient-stroke rim and lip on a shape layer above; springs by expression from §2.5; grain with an Add Grain / Noise effect at about 3%, Overlay. Effect names `unverified`.

---

## 4. Port in 30 minutes: the 10 things to do first, in order of visual payoff

1. **Ground and ink.** Background #f2f1f1, text #121214 (dark: #121212 and #f4f4f6); never pure black or white text.
2. **Type.** Urbanist (or Inter); titles weight 300 at 20 px+, -0.02 em; body 16 px 400; sentence case.
3. **Radii.** Cards 0.22 x module (about 32 px); pills and fields full stadium, 44 px high; one absolute radius.
4. **Matte card as the default surface.** White, 1 px #b4b4ba edge, 5% neutral shadow, 20 px padding and gaps.
5. **One gel tile** per row or cluster: vertical gradient + bottom-weighted bloom (50%/70%, 70% x 60%), ink text, 20 px padding. Start with green or pink.
6. **Accent and active state.** One lime #dff30f fill behind ink; the active filter or tab is a solid ink pill with white text and a check.
7. **Frost plate for floating chrome only.** Blur 24 + saturate 1.15, white 22% (72% with text), rim, lip; no blur available: opaque plate with the same rim and lip.
8. **Gel rim, highlight, 3% grain** (§2.3 gel layers 3-5): turns a gradient box into a gel.
9. **Accessibility.** 44 px hit areas, 2 px ring + halo, state never by hue alone, no text in the rim, honour reduce-transparency and reduce-motion; run `contrast-check.mjs` on any colour you changed.
10. **Springs.** Press scale 0.97 (400/28/1), hover lift 2 px (260/30/1), sheets 220/21/1; no runtime: `cubic-bezier(0.3, 1.25, 0.6, 1)`. Add the 10 s drift last, on up to four visible tiles.

---

## 5. Conformance mini-checklist (20 binary checks, from a screenshot)

Pass or fail, answerable from a screenshot in any tool (properties can stand in where pixels cannot show them). `*` = critical (one critical fail caps the score at 6, two at 4, SPEC §12).

| # | Check | SPEC §12 |
| --- | --- | --- |
| 1 | * Every surface is plainly a matte card, frost plate or gel tile; no fourth type. | I1 |
| 2 | No refraction, glossy specular, neumorphic paired shadows, tilt or depth-of-field in the UI. | I2, I3, L4 |
| 3 | Corners look continuous (squircle), not circular arcs, where the platform can. | G1 |
| 4 | Card radius about 0.22 of the cell side, one absolute radius on wide and square cards; padding about 7% W; gaps 8 px gel, 20 px matte. | G2, G3, L1, L2 |
| 5 | Pills, chips, tags, fields are full stadiums; nested radii concentric. | G4, G5 |
| 6 | Matte cards opaque, no blur or rim, shadow <= 8% and offset <= 2% H, with a hairline edge. | S1, S2, A4 |
| 7 | Frost plates have real backdrop blur (8-40 px, saturated), a rim brightest top-left and a lower lip, over a backdrop with light/dark variation. | S3, S4, S5 |
| 8 | * Frost alpha 0.12-0.30 with no text; >= 0.72 with ink text; dark plate scrim >= 0.80. | S6 |
| 9 | Each gel is one hue family with an off-centre, bottom-weighted bloom (centre 55-85% down). | S7, S8 |
| 10 | * Gel rim pale and desaturated (3-6% W), no dark inner shadow, 2-4% grain, no text in the rim. | S9, S10, S11 |
| 11 | * At most 3 saturated hues; one lime accent, not light-ground text; state never by hue alone. | C1, C2, C5 |
| 12 | Light ground about #f2f1f1, or dark #121212 with a single-hue corner glow. | C4 |
| 13 | * Contrast: ink on vivid gel and frost, white only on deep gel, 4.5:1 text, 3:1 large text and UI edges; no alpha text on a gel. | A1, A2, A3, A5, A6 |
| 14 | * Type: Urbanist/Inter, sentence case, weight 300 only at 20 px+, body 16 px at 400, nothing under 12 px. | T1-T4 |
| 15 | Title tracking -0.02 to -0.04 em, weight contrast in a line; dot numerals only for primary values at 24 px+ with a text twin; unit tags 0.30-0.45 of numeral height, >= 12 px. | T5-T8 |
| 16 | * Controls >= 44 px with a 2 px ring + halo focus state; active tab or filter is an inverted solid pill with an extra mark. | K1-K4 |
| 17 | Motion is spring-based, overshoot <= 6%, press scale 0.97, drift 8-12 s on <= 4 visible tiles. | M1, M2, M4, M5 |
| 18 | * Fallbacks defined for reduce-transparency (opaque plate), reduce-motion, high contrast, forced colours. | A7, A8, M3, P5 |
| 19 | <= 6 blurred plates per view (3 mobile, 1 over live content), blur <= 40 px, no frosted element under a faded or filtered ancestor. | P1-P3 |
| 20 | Dark mode (if any) uses deep gel ramps with white text and #121212 panels, not the light ramps inverted. | A1, C4 |

Score: start at 10, apply the lowest matching cap (SPEC §12): 1-2 non-critical fails 9; 3+ 8; 6+ 6; 10+ 4; any critical 6; two critical 4; check 1 failing 4. SPEC checks not listed (folder tab G6, bubble G7, data-viz V1-V5, L3, P4) apply where those elements exist.

---

## 6. Provenance and honesty

**Numbers.** Every number in §0, §2 and §4 comes from `tokens.json` and SPEC.md here; the study is 22 posts, 79 screenshots (`playbook/styles/liquid-glass/study/INDEX.md` in Website Builder). Tags are the SPEC's. **Measured [m]:** gel core/top/edge hexes, sky and ground colours, folder aspect 1.65:1, post counts, contrast ratios (script-computed). **Estimated [e]:** all radius, blur, alpha, rim, lip, shadow and grain numbers, every spring and the drift (screenshots are stills, all motion inferred), the lime hex, the typeface match, and every accessibility floor and perf budget (policy). **Derived in this file, not in SPEC:** spring "response" values (`2 pi / sqrt(tension)`), per-platform spring mappings, px conversions (144 px x ratios), all platform code and the Figma recipe. **Source inconsistency:** `tokens.json` has `alpha.shadowFloat` 0.1 but `shadow.float.alpha` 0.12 and SPEC §2b/§2d say 0.12; this file uses 0.12; fix the token in a deliberate pass.

**Only §3.7 (WPF) was compiled and run** (2026-10, .NET 8 WPF, scratch copy of the `dotnet-wpf` archetype, rendered to a PNG); every other snippet is an untested sketch.

**Verified against official docs this session:** backdrop-filter Baseline 2024 and the backdrop-root rule, `corner-shape` keywords (MDN); DWM attribute enum order, `DWMWA_SYSTEMBACKDROP_TYPE` needing build 22621, `DWMSBT_*`, `USE_IMMERSIVE_DARK_MODE` and `WINDOW_CORNER_PREFERENCE` (Microsoft Learn); WinUI `Window.SystemBackdrop`, `SystemBackdropElement` needing App SDK 2.0, acrylic types and fallbacks (Microsoft Learn); Compose `Modifier.blur` API 31 with unblurred fallback (Android); Flutter `BackdropFilter` clipping and `ClipRSuperellipse` (Flutter API); Electron `setBackgroundMaterial` / `setVibrancy`; Avalonia `TransparencyLevelHint` and `BoxShadow inset` (via search); SwiftUI `RoundedCornerStyle` (Apple).

**`unverified`** (not confirmed from an official page; treat as leads to test): SwiftUI `glassEffect` details, `Material` names, `EllipticalGradient`, spring mapping (§3.4); Compose `renderEffect`, Haze API, spring mapping, no built-in superellipse (§3.5); Flutter `ClipRSuperellipse` version, blur sigma equivalence, `FragmentProgram`, spring mapping, reduce-transparency signal (§3.6); Firefox and stable Safari `corner-shape`, auto-prefixing (§3.1, §3.2); Electron constructor option and transparency requirement, Tauri config key (§3.3); WPF window material only: `CompositionTarget`/`DwmExtendFrame` sequence, `AllowsTransparency` interplay, corner value 2 (§3.7; everything else in §3.7 was verified by build and render); WinUI acrylic tuning properties, `ThemeShadow`, drop shadow, `RadialGradientBrush`, geometric clip, Composition springs (§3.8); Avalonia acrylic in 11/12, `RadiusY`, `Geometry.Parse` tolerance, no backdrop blur (§3.9); WinForms menu rounding (§3.10); MAUI handlers (§3.11); Figma corner smoothing, blur units, opacity behaviour, Noise effect, prototype springs, Framer, Penpot (§3.13); slides, Blender, After Effects names (§3.14, §3.15).

**Not claimed:** that any platform reproduces the screenshots exactly; only that the three surfaces, shapes, palette, type and accessible rules are recognisably reproducible, with each platform's shortfall stated. No brand, copy or layout from the screenshots is reproduced. If a number must change, change `tokens.json` and SPEC first, then this file.
