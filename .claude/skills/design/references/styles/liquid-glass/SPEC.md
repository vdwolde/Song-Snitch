# Liquid Glass: canonical spec

The owner's favourite design language, written so any agent can reproduce it faithfully and ship it accessibly. Evidence: 22 posts, 79 screenshots, studied under `Projects/Website Builder/playbook/styles/liquid-glass/study/` (INDEX.md, 22 post files, palette.json). Every number is tagged **[m]** measured (palette.json or a clear pixel read in the study) or **[e]** estimated (eyeballed, or a policy choice made here). Where the study is silent the text says "not determined". Machine-readable values: [tokens.json](tokens.json) (the single source for colour, radii, blur, alpha, timing). Contrast gate: [contrast-check.mjs](contrast-check.mjs).

Tunables are named once (a `--lg-*` token, or a `tokens.json` path) and used everywhere by that name.

How to use: read §0-§2 for the look, §4 and §10 before writing any colour or text, §12 to self-score. §10 overrides the look wherever they conflict: the originals fail WCAG; this spec ships the same look accessibly.

---

## 0. Identity

| Item | Value |
| --- | --- |
| Name | **Liquid Glass** (owner's name for it) |
| Aliases | glassmorphism 2.0, gel glass, aurora gel, squircle glass |
| One line | Soft squircle cards on a pale ground, in three surface classes (matte, frost, gel), light type, one lime accent, dot-matrix numerals for primary values |
| Catalog link | `references/ui-catalog/styles.csv` row `liquid-glass` is **Apple's** adaptive lens material for Apple platforms; it stays as it is. This style is a different thing that shares the name; its row is `liquid-glass-gel` (parent `liquid-glass`, aliases above plus "Liquid Glass", "Liquid Glass UI", "House Liquid Glass"). `/design` resolves the name to this spec before catalog keyword matching (discover.md § 2). Use this spec when the owner says "Liquid Glass" without an Apple/SwiftUI context. Its nearest catalog neighbours: `glassmorphism` (our frost plate is a constrained, accessible version of it: same 10-20 px blur and 0.1-0.3 white fill, extended with the rim, lip and a text-bearing alpha floor) and `aurora-ui` (our gel bloom drift keeps its 8-12 s loop, extended to one hue per tile and no `@keyframes`). |

**What it is NOT**

| Not | Why it is not, and the tell |
| --- | --- |
| Apple's clear lens glass | Apple's is a transparent, refracting, content-adaptive material for navigation. Ours has no real refraction or specular shine on cards; its colour comes from opaque chromatic gels and a pale matte ground. Only the small circular buttons may fake a lens with a thin iridescent rim; a decorative plate (no text) over a photographic ground may also bend its edge, as a Chromium-only progressive enhancement (§12 I2). |
| Neumorphism | No paired light/dark extruded shadows as the main surface. One post has near-invisible "soft plate" filter pills (top-left 1 px white, bottom-right 1 px grey); allowed only for pills, never as the sole boundary (§10). |
| Flat material / elevation shadows | No heavy drop shadows (>0.12 alpha) and no stacked elevation scale. Separation is value, rim and bloom. |
| Rainbow aurora | One hue per gel tile; the hue budget is §4 rule 1 (3 saturated families per frame, up to 5 colourways on a gel board). |

**The three surface classes** (every surface in a Liquid Glass UI is exactly one of these; §2)

| Class | One-line recipe | Reads as | Text on it |
| --- | --- | --- | --- |
| a. Matte soft card | Opaque near-white squircle on a slightly darker ground, ambient shadow only, no blur, no rim | Paper | Ink |
| b. Frost plate | Translucent white over a photo/gel/sky with backdrop blur, rim brightest top-left, lower-edge lip | Thick frosted glass | Ink (light plate) or white on a dark scrim plate |
| c. Gel tile | Opaque one-hue radial bloom, bottom-weighted, pale desaturated rim, soft top-left highlight, 2-4% grain | Pillowed candy gel | Ink on vivid ramp (light mode), white on deep ramp (dark mode) |

---

## 1. Geometry

Ratios are of the element's **shorter side** unless stated.

### 1.1 Squircle, radii, stadium

| Element | Radius | Tag | Notes |
| --- | --- | --- | --- |
| Corner model | G2 continuous curvature (superellipse n=2 in CSS `corner-shape: squircle`; n≈4 in bezier form) | [m] visible in 8 posts | Never a circular arc where the platform can do better (fallback §11). |
| Matte card | `radius.cardRatio` 0.22 (range 0.18-0.26) | [e] consensus of 8 posts | |
| Gel tile | `radius.gelRatio` 0.30 (range 0.14-0.30; round 3 moved it from 0.24 to the top of the range: at the 9 rem module it is 43 px, which is 0.2 of the short side of a 215 px landscape tile, the proportion read on the four-gel board) | [e] | Pillowed: one corner may be ~15% rounder than its opposite (3 posts). |
| Pills, chips, tags, search fields, row pills | `radius.stadiumRatio` 0.5 of **height** | [m] full stadium | With `corner-shape: squircle` the ends get flat shoulders (nav pills in 1 post): allowed, never required. |
| Circular glass button | circle, diameter `control.circleButtonPx` 44 px (visual 0.12-0.2 of card width in the originals) | [e] | Hit area never below 44 px (§10). |
| Dark slabs (dark variant) | 0.05-0.06 | [e] 1 post | Outlier; keep `cardRatio` unless the owner asks for the tight dark look. |
| Sharp slab | 0.012 | [e] 1 post | Outlier, not part of the spec. |
| Speech bubble | one flat corner `radius.bubbleFlatCornerRatio` 0.04 (0.02-0.05); the other three `radius.bubbleRoundCornerRatio` 0.27 | [e] 4 posts | Flat corner is bottom-right for the sender's own message, bottom-left for incoming. |
| Egg/arch portrait window | capsule arch, aspect 0.75, radius = half width top and bottom | [m] 1 post (270x360) | |

**One absolute radius.** A wide card and a square card in the same grid share **one absolute radius**: `--lg-radius-card = radius.cardRatio × --lg-module`, where the module is the grid's square cell side (`radius.moduleRem` 9 rem ≈ 144 px, so 1.98 rem ≈ 32 px). Do not scale the radius with the card's own size [m: Ddtu, DePNi: a 2.4:1 wide card keeps the radius of its square neighbours].

**Concentric rule.** An element nested in a rounded parent with padding `i`: `r_inner = max(r_outer - i, radius.concentricMinRatio × r_outer)`. Row pills inside a card use `--lg-inset` (0.02 of card width ≈ 0.375 rem) as `i`. Stadium children are exempt (radius = half their own height).

### 1.2 Folder-tab card

One outline (a notched tab, never two joined rectangles). `W` = card width, `H` = card height.

| Parameter | Value | Tag |
| --- | --- | --- |
| Aspect W:H | `folder.aspect` 1.65:1 (835x500) | [m] |
| Tab width | `folder.tabWidthRatio` 0.39 W (0.38-0.40) | [e] 5 posts |
| Tab rise | `folder.tabRiseOfHeight` 0.21 H | [e] 5 posts |
| S-slope horizontal run | `folder.slopeRunOfWidth` 0.12 W (≈45° because rise 0.21 H = 0.127 W at aspect 1.65) | [e] |
| Body corner radius | min(`--lg-radius-card`, `folder.bodyRadiusOfHeight` 0.17 H) (study 0.14-0.20 H) | [e] |
| Row pills | height 0.20 H, inset 0.02 W, gap 0.013 W | [e] |
| Ports | circle 0.05 W bulging out of the right edge in a concave notch, at row-pitch intervals | [e] 2 posts |

Path generator (stack-neutral, 20 lines of JS; the same function draws plain squircles when `tab` is omitted; bezier factor `radius.squircleBezierC` 0.66 is [e], the circular value would be 0.5523). Set the result as `clip-path: path(...)` on fixed-size cards or as an SVG `<path>` mask; re-run on resize.

```js
export function shapePath({ w, h, r, k = 0.66, tab }) {
  const f = (n) => +n.toFixed(2), c = r * (1 - k);
  const rise = tab ? tab.rise : 0;
  const top = tab
    ? `L${f(tab.w)} 0 C${f(tab.w + tab.run / 2)} 0 ${f(tab.w + tab.run / 2)} ${f(rise)} ${f(tab.w + tab.run)} ${f(rise)} L${f(w - r)} ${f(rise)}`
    : `L${f(w - r)} 0`;
  return [
    `M0 ${f(r)} C0 ${f(c)} ${f(c)} 0 ${f(r)} 0`, top,
    `C${f(w - c)} ${f(rise)} ${f(w)} ${f(rise + c)} ${f(w)} ${f(rise + r)}`,
    `L${f(w)} ${f(h - r)} C${f(w)} ${f(h - c)} ${f(w - c)} ${f(h)} ${f(w - r)} ${f(h)}`,
    `L${f(r)} ${f(h)} C${f(c)} ${f(h)} 0 ${f(h - c)} 0 ${f(h - r)} Z`,
  ].join(' ');
}
// folder: shapePath({ w, h, r, tab: { w: 0.39 * w, rise: 0.21 * h, run: 0.12 * w } })
```

---

## 2. The three surfaces

Common to all: paint order is listed bottom to top. Percent/ratio values are of the surface's own width `W` or height `H`.

### 2a. Matte soft card

| # | Layer (paint order) | Parameters | Tag |
| --- | --- | --- | --- |
| 1 | Ground | §3 | |
| 2 | Ambient shadow | y `shadow.matte.yOfHeight` 0.015 H, blur 0.065 H, colour black alpha `alpha.shadowMatte` 0.05, neutral | [e] 8 posts (y 0.01-0.02 H, blur 0.05-0.08 H, alpha 0.04-0.06) |
| 3 | Fill | light `color.light.card` #ffffff on ground `color.light.ground`, a value step of 4-6 L* (ratio 1.13); dark `color.dark.panel` on `color.dark.ground` (+4 L*) | [m] #fff/#fefefe 37-70% share |
| 4 | Edge floor (accessibility addition, not in the originals) | 1 px `color.light.hairline` #b4b4ba (1.83:1 vs ground, floor 1.6) or the shadow, never value alone | [e] policy; §10 |
| 5 | Optional top highlight | 1 px white alpha 0.6 on the top inner edge (tab plates only) | [e] 1 post |
| 6 | Content | padding `layout.paddingOfWidth` 0.07 W | [e] 0.065-0.08 |

No blur, no rim, no transparency. A card overlapping a map or dot grid shows none of it.

### 2b. Frost plate

| # | Layer | Parameters | Tag |
| --- | --- | --- | --- |
| 1 | Backdrop | A photo, gel, sky, or live content with luminance variation under the plate. A plate over a flat ground does not read as glass: the originals place it across a hard light/dark edge. | [m] |
| 2 | Backdrop filter | `blur(b) saturate(1.4)`. `b` relative to plate height: 0.05-0.15 H when the ground is already defocused (photo, gel, sky); 0.30-0.50 H over sharp colour; hard cap `blur.capPx` 40 px. Token tiers: soft 12, medium 24, strong 40 px. Saturation `blur.saturate` 1.4 (range 1.3-1.6, raised from 1.15 in round 2 so the colour behind the pane glows through instead of greying out): [e] policy, not measurable from stills. | [e] |
| 3 | Fill | Decorative (no text): white alpha `alpha.frostDecor` 0.22 (range 0.12-0.30 over photo/sky; 0.35-0.45 over saturated gel). **Text-bearing, light plate, TINTED (the default, round 2): the ground's own tint (`grounds.<name>.tint`, exposed to CSS as `--lg-ground-tint`) mixed with white at `alpha.frostTintShare` 0.55, laid at `alpha.frostTint` 0.46 (round 4; was 0.52), ink text.** `node contrast-check.mjs --derive-plate 4.5` prints the lowest alpha at which ink and ink-secondary both hold 4.5:1 over every blob colour of every declared ground (0.43); 0.46 is that minimum plus the margin the live probe needs (`--derive-plate 4.7`). Secondary labels on a plate are `ink-secondary` at weight 400, never a bold dark grey (hierarchy by size and weight, not by darkening). The plate is translucent and picks up the hue behind it (pink glass over pink), and is only valid over a declared ground variant (pink, mint, sky, light): the contrast gate checks it over every blob colour of that ground (§10.2 rule 4). **Strong plate (any backdrop): white alpha `alpha.frostText` 0.72**, kept for a plate that does not sit on a declared ground; the decorative 0.12-0.45 range never carries text (§10). **Text-bearing, dark plate: scrim `color.dark.plateScrim` alpha `alpha.frostDarkScrim` 0.8 plus white 0.06 tint.** | [m] ranges, [e] floors and the tint recipe |
| 4 | Top sheen | Light on the upper face: linear white alpha 0.16 fading to 0 by 38% of the height (0.05 on dark and sky-scrim plates, so light text never loses contrast) | [e] 1 post (gloss band 0.04 H, ~0.2) |
| 5 | Rim | Gradient stroke `rim.widthOfWidth` 0.006 W (0.004-0.008), min 1 px, white alpha `alpha.rim` 0.6 (0.5-0.7) at the top-left corner, fading to 0.25 by 45% of the diagonal, ending at lip alpha at the bottom-right | [m] 8 posts |
| 6 | Lower-edge lip | Band `rim.lipOfHeight` 0.025 H along the bottom (and bottom-right corner), white alpha `alpha.lip` 0.5, fading upward: the glass "thickens" | [e] 5 posts |
| 7 | Shadow | None, or y ≤ 0.02 H alpha ≤ 0.08. Floating pills only: y `shadow.float.yOfHeight` 0.08 H, blur 0.4 H, alpha 0.12 (tint the shadow with the backdrop hue when over a gel) | [m] consensus; floaters [e] |
| 8 | Content | | |

Outliers (do not generalize): fill-less glass (alpha 0.06, rim only); flat slab (alpha 0.18). The dark double slab (outer rim plate + inset inner plate 0.03 W, rim lit on the glow-facing sides) is the dark variant's frost (§13d).

**Dark plate rim (round 2).** The dark plate's rim is a 1 px gradient in the frame's one hue: `color.dark.glow` at alpha `alpha.darkRimLit` 0.85 on the glow-facing (bottom-right) corner, 0.30 at 38% of the diagonal, white at `alpha.darkRimUnlit` 0.18 on the far corner, plus a faint outer glow (`0 0 2.4rem -0.4rem`, glow at `alpha.darkOuterGlow` 0.22). The inner slab (double slab) sits inset by one `--lg-inset` with a concentric radius, a 1 px white 0.07 edge on the unlit side and a 1 px glow 0.35 edge plus a soft glow wash on the lit side. The unlit side keeps the static edge floor (white 0.18 on `#121212` is 1.72:1 against 1.6), the lit side is a 3:1 graphic (7.58:1). [e], read from the lit corners of one post; the numbers are mine.

### 2c. Gel tile

| # | Layer | Parameters | Tag |
| --- | --- | --- | --- |
| 1 | Base | Linear gradient top→bottom `top` → `bottom` stop of the colourway | [m] |
| 2 | Bloom | Radial gradient, ellipse `gel.bloom.radiusXPct` 70% x `radiusYPct` 60%, centre x `xPct` 50%, **y `yPct` 70%** (range 55-85%: bottom-weighted), stops `core` 0 → `mid` at `midStopPct` 45% → transparent at 100% | [m] centres 0.55-0.85 in 7 posts |
| 3 | Highlight | Soft radial at the top-left (≈20% x, 15% y), wide, no hard specular. White alpha `alpha.highlight` 0.16 (0.12-0.20) on **vivid ramps only** (it only lightens the background under ink). On **deep ramps** use `alpha.highlightDeep` 0.06: the highlight sits under the tile title, and 0.16 measured white-on-deep-green at about 3.9:1 (fails 4.5:1), 0.06 measures about 5.0:1 | [e] 0.16; 0.06 [m] in the layer probe; **luminous ramps use `alpha.highlightLuminous` 0.04** |
| 3b | Pale edge wash (round 2) | A radial wash centred on the bloom, transparent up to 50% of an ellipse 80% x 76%, then the colourway `rim` colour up to alpha `alpha.gelEdgeVivid` 0.6 (vivid) or `alpha.gelEdgeDeep` 0.05 (deep: any more drops white-on-deep under 4.5:1 at the top stop, see the contrast gate). The saturated core is surrounded by a pale edge on every side, which is what makes the tile read pillowed | [m] pale edge on all four sides in 5 posts; alphas [e] |
| 4 | Rim | Pale, desaturated wash, depth `gel.rimDepthRatio` 0.05 W (0.03-0.06), colour = colourway `rim` (inset shadow, no dark inner shadow: two outliers have a dark top edge, not spec). **Round 2 adds a 1 px gradient ring** (`gel.rimPx`), white `alpha.gelRimHi` 0.55 at the top-left to `alpha.gelRimLo` 0.15 at the bottom-right, a **lower-edge lip** (`gel.lipOfHeight` 2.5% H, white `alpha.gelLip` 0.30; 0.22 on deep ramps), and two soft white inner glows (lower edge 0.4, lit top-left 0.35) so the surface reads as a pillow, not a flat fill | [m] lit rim and lighter lower edge in 6 posts; numbers [e] |
| 5 | Grain | Monochrome noise, opacity `gel.grainPct` 3% (2-4%), applied **after** the gradients so dark bands do not band; single 128 px tile | [m] 7 posts; 6-10% in 2 outliers |
| 6 | Content | Padding ≥ `layout.paddingOfWidth` 0.07 W so no text enters the rim, lip or edge wash zone | |

**Tile shape and stack (round 2).** The originals' tiles are landscape, about `gel.aspectWide` 1.4:1 ([m] from the four-tile stacks; a 1.74:1 board tile is the widest); the bento keeps 1:1. Tiles in a stack are butted with a gap of 0.005-0.012 of the stack width (`gel.stackGapOfWidth`; the layer uses `clamp(0.25rem, 0.8cqi, 0.75rem)`) so the group reads as one slab of glass. [m] gap, [e] clamp.

**Tone per board (round 4): ONE tone per board.** A board (a bento, a drawer, a pricing row, one frame) uses one gel tone for every tile; a dark jewel tile beside a pastel one reads as two styles (the round 3 bento mixed blue and violet luminous with orange and pink vivid, and the critic named it). The references are uniformly luminous pastel, and white text cannot sit on a pastel (§10.2 rule 2b), so the default is the pastel look carried accessibly by **ink**:

| Ground | Default tone | Text | Why |
| --- | --- | --- | --- |
| Light ground, haze, cream, sky, photo | **vivid** | ink | Pastel like the references; ink clears 4.5:1 on every stop (worst 4.73:1, blue core). |
| Dark ground (`.dark`, the node board) | **deep** (dark mode swaps to it by itself) | white | Reads as lit green glass on near-black; the lit pale rim and lip stay. |
| A board that is jewel on purpose (a hero proof object, a brief that asks for white text on saturated gel) | **luminous**, every tile | white | Only when no vivid tile shares the board; it is a deliberate departure, say so in the brief. |

The lightness band is the vivid one (OKLCH L 0.62-0.88 across the stops): the "luminous ramps at a lighter band" idea does not exist, because white cannot hold 4.5:1 above L about 0.55, so where the pastel is wanted the text is ink, not white. A new colourway gets all three ramps from `add-colourway.mjs` and is used in its default tone for the ground.

**Flow, not spot (round 4).** The bloom is a large ellipse (`gel.bloom.radiusXPct` 100, `radiusYPct` 85, mid stop 50%) centred off-axis, joined by a second softer ellipse drifting in from the opposite top corner (`--gel-mid` at 80%) over a 160 degree base ramp, so the colour travels corner to corner instead of sitting as a centred spot. Every colour in the stack is a ramp stop or a mix of two, so the gate's stop pairs still bound the text contrast (the live probe confirms). **Thicker pale lit edge on all four sides:** the inset rim is `--lg-rim-spread` 0.32 rem over a 1.4 rem blur, the pale edge wash starts at 36% of its ellipse, and a crisp 0.16 rem inner pale line (white 0.30) runs round the whole tile. Landscape tiles (§ above, 1.4:1) are the default shape of a bento (`shape="wide"`).

**The gel colourways** (`gel.vivid.*` in tokens.json; `core` is the ink-safe core, `coreStudy` the measured one where they differ)

| Colourway | Top (edge) | Mid | Core | Bottom | Rim | Source |
| --- | --- | --- | --- | --- | --- | --- |
| green | #c2d69b | #5bab4b | **#3b943c** | #8fcf9a | #bfe3c0 | top/mid/core [m] (palette #c2d69b, #5bab4b, #3b943c); bottom/rim [e] |
| pink | #f9b3cd | #f99bbc | **#f36393** | #f53b8a | #fbd9e5 | top/mid/core/bottom [m]; rim [e] |
| blue | #53b4e3 | #4194ed | **#327cf3** | #53b4e3 | #8fd0f0 | [m] except rim [e] |
| orange-to-magenta | #fce9cc | #fdc395 | **#e94cc2** | #f6713b | #f7c6ea | top..bottom [m] (cream, peach, magenta core, orange-red bloom); rim [e] |
| violet | #cb7edc | #b86dd3 | **#ad62d3** (study #a354c9) | #cb7edc | #d4a0f0 | [m] except core, lightened 0.015 OKLCH L so ink passes 4.5:1 (§10) |
| sky-to-cream (`skycream`, vertical) | #62a8e6 | #9cc4c8 | **#a9cbb3** | #e2dcc2 | #eef4f1 | [e] from the sky-to-cream phone tiles (top #62a8e6 [e], bottom #e2dcc2 [m]); added with `add-colourway.mjs --vivid` |
| brown-to-gold (`gold`) | #c79a68 | #d9a24f | **#c8872f** | #f0c869 | #f6e3b4 | [e] from the dark brown-to-gold hero gel of the cream study posts, lightened until ink holds 4.5:1 (core 6.20:1); its luminous ramp is the dark brown-to-gold itself |

**Adding a colourway.** `node tools/add-colourway.mjs <name> <hex>` (one hue: the OKLCH rule below) or `--vivid top,mid,core,bottom,rim` (a hand-authored multi-hue ramp such as the two above; luminous and deep are derived by pure darkening until white holds). It runs the whole contrast gate on a copy first and writes nothing unless 0 pairs fail, then updates `tokens.json` (this folder and the vendored copy), regenerates the fenced CSS and `colorways.ts`, and is idempotent (`--dry-run` prints the ramps and the gate result). Use at most 5 colourways on a gel board (§4 rule 1).

Accessible deep ramps for dark mode (`gel.deep.*`, white text, generated by the rule below): green #25762a / #006f12 / **#055e11** / #15711e; pink #9e3b60 / #9a2957 / **#8e0049** / #9a315a; blue #3161af / #2056af / **#0145a7** / #275aad; orange-magenta #933f7c / #8e2f77 / **#83116b** / #8f3678; violet #7e4899 / #783a96 / **#6c238d** / #793f96 (top / mid / core / bottom).

**Luminous ramps (round 3: `gel.luminous.*`, `tone="luminous"`).** The references put white text on saturated gel; the vivid ramps cannot carry it (§10.2 rule 2) and the deep ramps do it by going dark. The luminous ramp is the third option: the vivid ramp pushed down only as far as white needs. Rule (`luminousFromVivid` in contrast-check.mjs, parameters `gel.derive.luminous`): keep each stop's hue (a stop with chroma under 0.1, such as the pale tops, borrows the mid stop's hue), lift chroma to at least 0.9 of the core's, then lower OKLCH L in 0.002 steps until white holds **4.75:1** over the stop plus the pale rim at `alpha.gelEdgeLuminous` 0.10 plus white at `alpha.highlightLuminous` 0.04, the worst case under a title. Generated (top / mid / core / bottom): green #2b701c / #1f7206 / **#107318** / #2b701c; pink #ae356a / #ae356a / **#b92b63** / #cc0e6c; blue #016c94 / #0165b9 / **#125fd4** / #016c94; orange-to-magenta #94520a / #965200 / **#be189b** / #b23f01; violet #9346a4 / #9046aa / **#8f44b3** / #9346a4. The pale rim, the 1 px gradient ring and the lower-edge lip (`alpha.gelLipLuminous` 0.30) are kept; the edge wash and highlight are lowered for the same reason as on the deep ramps. It is a jewel-toned gel with a lit pale edge, not the pastel top of the originals: that pale top cannot sit under white text at any contrast (§10.2 rule 2b).

**Deriving a new colourway from a brand hue (OKLCH rule, `gel.derive`).** Chroma `C` is reduced into the sRGB gamut at each stop.

| Stop | Vivid ramp (light mode, ink text) L / chroma | Deep ramp (dark mode, white text) L / chroma |
| --- | --- | --- |
| top | 0.88 / 0.40 C | 0.50 / 0.80 C |
| mid | 0.76 / 0.70 C | 0.47 / 0.90 C |
| core | **0.62 / 1.00 C** | **0.42 / 1.00 C** |
| bottom | 0.80 / 0.65 C | 0.48 / 0.85 C |
| rim | 0.92 / 0.20 C | 0.86 / 0.20 C |
| C | 0.20 | 0.17 |

The study's five cores sit at OKLCH L 0.59-0.67 (C 0.15-0.23) [m, computed from the palette hexes]. The rule uses core L 0.62: every vivid stop then has luminance ≥ 0.20, so **ink text passes 4.5:1 on every stop**; every deep stop has luminance ≤ 0.18, so **white passes**. `node contrast-check.mjs --derive <hue>` prints the vivid, deep and luminous ramps; `--self-test` proves the rule for 12 hues, for the luminous rule too. Brand-hue procedure: take the brand hue angle in OKLCH, run the rule, keep the result only if `--derive` shows ink/white passing, never hand-tint the core lighter (vivid) or darker (deep) than the rule.

### 2d. CSS reference implementation

The maintained implementation is the Website Builder layer's `src/styles/liquid-glass.css` (`playbook/styles/liquid-glass/layer/`): a generated token block (from tokens.json, `tools/gen-tokens.mjs`) plus hand-written utilities. **Port from there.** The round 1 reference block that used to sit in this section was removed in round 3: it predated the tinted plate, the gel rim, lip and edge wash, the haze grounds, the luminous ramp and the dark rim, so copying it reproduced the old look.

Rules the implementation keeps: tokens not literals (literals appear only inside the token block); no `@keyframes` (the bloom drift is a JS ticker writing `--lg-bloom-x/y`; press and hover are springs, colour changes are `transition`s with the spring-derived `linear()` easing); no external requests (grain is an inline SVG data URI, the `xmlns` string is a namespace name, fonts are self-hosted); classes, not `data-*` selectors (a template rule), as Tailwind v4 `@utility` classes (`lg-frost`, `lg-gel`, `lg-gel-green`, ...). Maps onto the house flat token set (`--background = --lg-ground`, `--card = --lg-card`, `--foreground = --lg-ink`, `--muted-foreground = --lg-ink-secondary`, `--border = --lg-hairline`, `--input = --lg-control-edge`, `--ring = --lg-focus-ring`, `--primary = --lg-ink`, `--primary-foreground = --lg-on-ink`, `--accent = --lg-lime`) through a bridge scoped to `html.lg-theme`. Dark mode is the house `.dark` class.

The current recipes in brief (the numbers are the tokens; the layer file is authoritative):

```css
/* b. Frost plate, text-bearing, TINTED (light): the ground's tint x white, translucent, saturated backdrop */
.lg-frost { backdrop-filter: blur(var(--lg-blur)) saturate(var(--lg-saturate));            /* 24px, 1.4 */
  background: linear-gradient(to bottom, rgb(255 255 255 / .16) 0, transparent 38%),         /* top sheen */
              color-mix(in srgb, color-mix(in srgb, var(--lg-ground-tint) 55%, white) 52%, transparent); }
/* + 1.5px gradient rim (::before, brightest top-left) + lip (::after) + inset bevel; refraction (lg-refract) only on decorative plates */

/* c. Gel tile: base, bloom, pale edge wash, lip, highlight; the ramp swaps by tone */
.lg-gel { background:
    radial-gradient(circle at 20% 15%, rgb(255 255 255 / var(--lg-a-highlight)), transparent 55%),
    linear-gradient(to top, rgb(255 255 255 / var(--lg-gel-lip-a)) 0, transparent 2.5%),
    radial-gradient(ellipse 80% 76% at var(--lg-bloom-x) var(--lg-bloom-y), transparent 50%, color-mix(in srgb, var(--gel-rim) calc(var(--lg-gel-edge-a) * 100%), transparent) 100%),
    radial-gradient(ellipse 100% 85% at var(--lg-bloom-x) var(--lg-bloom-y), var(--gel-core) 0, var(--gel-mid) 50%, transparent 100%), /* gel.bloom.radiusXPct/radiusYPct/midStopPct in tokens.json */
    linear-gradient(to bottom, var(--gel-top), var(--gel-bottom)); }
/* tone: vivid (default, ink text) | .dark or lg-gel-deep (white text, edge .05, highlight .06) | lg-gel-luminous (white text, edge .10, highlight .04) */
```

JS ticker for the bloom drift (writes `--lg-bloom-x/y` on up to `perf.maxDriftingTiles` 4 visible gel tiles; no `@keyframes`). One shared `requestAnimationFrame` loop, paused when offscreen (IntersectionObserver), when `document.hidden`, or under reduced motion (leave at rest position). Period `gel.bloom.driftPeriodMs` 10 000 ms (8-12 s [e], inferred in 7 posts; no post shows it).

```js
// x = 50 + 6*sin(2*pi*t/T), y = 70 + 4*sin(2*pi*t/(1.3*T)) (percent); T = 10000 ms
const T = 10000, ax = 6, ay = 4; // tokens: gel.bloom.driftPeriodMs, driftXAmpPct, driftYAmpPct
```

---

## 3. Grounds

| Ground | Value | Tag | Notes |
| --- | --- | --- | --- |
| Light studio backdrop (presentation only) | `color.light.groundStudio` #d8d8da (range #d2d2d2-#d8d8d8) | [m] | Behind device mockups. Not a product surface. |
| Light UI ground | `color.light.ground` #f2f1f1 (measured UI grounds #eeedf1, #f1f1f1, #f5f5f5) | [m] range, [e] pick | Matte cards sit 4-6 L* above/below it. |
| Dark ground | `color.dark.ground` #121212 | [m] 69-99% share, 4 posts | Panels one step up: `color.dark.panel` #1c1c1c, `panelRaised` #242424 (+4 L*) [m #1c1c1c-#232323]. |
| Dark one-hue corner glow | One hue only, deep `color.dark.glowDeep` #003a0a → mid #3dab43 → hot #16d015 (hot only in a small corner), plus 6-8% grain on top | [m] #003a0a, #3dab43; hot [e] | Radial from a bottom/right corner. The glow's hue is the frame's only hue (a second hue only for a destructive icon). |
| Sky | gradient `color.sky.top` #94b5db → `bottom` #bed9ed (lighter toward the bottom); translucent screen ground `color.sky.screen` #6b839a | [m] | A UI whose frost plates sit a few steps lighter than the sky-tinted screen. A bright background washes it out (known defect). |
| Heavy-blur photographic ground | Full-bleed photograph blurred until only masses remain, **low contrast, mid-tone, no black mass** (round 2: the first recipe took the darkest observed pixel, #221b1d, as a ground stop and produced a hard dark blob that greyed every plate) | [m] 5 posts (soft mid-tones); recipe [e] | **Recipe (`grounds.*`):** five overlapping radial blobs on a mid-tone base (`light`, `base`, `mid`, `deep`, `shade`), painted with gradients only: no `filter`, no backdrop layer, a 5% grain over it to dither the banding (`alpha.grainHaze`). Lightness spread of the stops at most `grounds.lstarSpreadMax` 35 L* (pink 63-91, mint 61-96, cream 73-97, sky 54-87: 28.2, 34.8, 23.8 and 33.8, checked by `contrast-check.mjs`). The darkest blob (`shade`) stands in for the photo's subject and is mid-tone (pink #bd98a7, L* 66: round 4 lightened it from #a98694 so the mauve reads as a soft shadow, not a dark stain), never near-black. Each ground carries its plate `tint` (pink #f9dbe6, mint #d9efe4, cream #f0e9da, sky #d6e6f5) and a `figure` colour for the subject layer (§3.1). Never set body text directly on a haze; it goes on a plate or a matte card. Optional slow drift is not built (no ticker runs on a ground). Blur lives on a sibling ground layer, never on an ancestor of the plate. Original ground colours observed: pink #e4bcca→#221b1d, mint #daeae5→#072226, teal #7da2ac, red photo (the dark ends are the photo's subject, not the ground). Photo content: not determined (people silhouettes in the originals; do not reproduce). |
| Cream ground (round 3, cleaned in round 4) | clean warm cream, light #fbf7ea → base #f5eedd → sand #f2e3c6 → gold #ecd2a6 → tan #d3b98f, subject #cdb088; plate tint #f6efdc (round 3's #ece4d5 / #dcbba2 / #a89080 read as muddy beige-brown; the shade and figure are now warm tan, never grey-brown) | [m] UI grounds #f6f3ea / #f2eee4, panel #d5d4d2 (posts DdZIfN1jOle, DdWjugcDJyi); the blob stops [e] | The cream variant of the study (a tablet and a phone app): a warm page with one dark brown-to-gold hero gel. As a ground it is the same recipe as the pink and mint hazes (`grounds.cream`), five blobs plus the subject, 62-95 L*. Plates over it are tinted cream; a rose cast from a pink gel nearby is part of the look, not a second ground. Use it for pricing, editorial and shop pages. |
| Sky ground (round 3 recipe) | `grounds.sky`: the old two-stop gradient plus the five blobs and a slate-blue subject (#7d9ab8), 54-87 L*; `variant="sky"` forces the light tokens (the sky stays light in a dark page) | [m] top/bottom/screen; blobs [e] | Reads as sky because it has cloud masses and a darker band, not just a gradient; plates over it are tinted sky (#d6e6f5) or the scrim 0.6 plate with white text (§10.2 rule 4). |
| Photo ground slot (round 4) | `LiquidGlassGround variant="photo" image={...}`: a **local** image (a path under `public/` or an imported static image) painted on a sibling layer, blurred `grounds.photo.blurPx` 32 px (cap 40, about 0.03-0.1 of the ground height), scaled `grounds.photo.scale` 1.2 so the blurred edge never shows, `saturate(1.1)`, under a white veil at `alpha` 0.14 that pulls it toward mid-tone | [e] | The real-photograph replacement for the CSS stand-ins above. **Licensing: user-owned or CC0 images only; no external URLs (the component throws on `http(s):` and `//`), nothing is fetched at runtime; the layer ships no photograph, only a generated abstract demo image (CC0 by construction, `tools/make-demo-ground.mjs`).** A photo is not a declared tint ground, so plates over it are the strong recipe (white 0.72 + ink, valid over any backdrop: worst case 9.39:1, §10.2 rule 4); the blur lives on a sibling layer, never on an ancestor of a plate; keep a hard light/dark step in the photo so a plate straddles something. Put no text on the bare photo. |
| Dot grid | pitch `grid.dotPitchOfWidth` 0.03 W (range 0.012-0.075), dot ≈ 0.2 of pitch (0.002-0.006 W), alpha `alpha.gridDot` 0.08 (0.04-0.12); on the **ground only**: the grid stops at the card edge, which is what lifts the card | [e] 4 posts | Bound it to 2 rem pitch in the CSS reference. |
| Grain | monochrome noise 2-4% on gels, 5% on a haze ground, 6-10% on dark fog areas (round 2: 9% in the layer, normal blend: an overlay blend on near-black changes nothing and the 7% grain was invisible), none on text plates | [m] | One 128 px tile, applied after the gradients. |
| Wireframe grid (sky variant) | line alpha ~0.06-0.08, pitch ~0.06 of screen width | [e] 2 posts | Decorative texture, not data. |

### 3.1 Subject layer (round 3), worked example

Round 2's grounds were five soft blobs with no subject: a plate over them straddles nothing, so it reads as frosted paper (the critic's top finding). The originals' plates sit across the photograph's subject: a hard light/dark edge. The **subject layer** is a stand-in for that figure: a soft mid-tone mass plus a highlight blob, painted with gradients on a sibling layer (no `filter`, no backdrop layer), so a hard edge passes behind the plates and still obeys the ≤ 35 L* spread (§3 table) and the no-near-black rule. The figure is **L\* 55-62** (never near-black on a light ground; pink #a58190, mint #789c8c, cream #a89080, sky #7d9ab8), the highlight blob reuses the ground's `light` stop, so no stop leaves the cap.

Coordinates are percent of the ground box, stops percent of the ellipse (`grounds.subject.*` in tokens.json); `side="left"` mirrors the layer with `scaleX(-1)`:

```css
.lg-subject {                         /* --fig = grounds.<name>.figure, --glint = grounds.<name>.light */
  background:
    radial-gradient(34% 58% at 76% 66%,                       /* body: cx 76, cy 66, rx 34, ry 58 */
      var(--fig) 0 56%, color-mix(in srgb, var(--fig) 55%, transparent) 68%, transparent 76%),
    radial-gradient(15% 22% at 70% 20%,                       /* head: cx 70, cy 20, rx 15, ry 22 */
      var(--fig) 0 52%, transparent 80%),
    radial-gradient(46% 40% at 18% 26%,                       /* highlight: cx 18, cy 26, rx 46, ry 40 */
      var(--glint) 0, transparent 72%);
}
.lg-subject-edge {                    /* optional hard edge: a 1.5% step where the figure meets the light */
  background: linear-gradient(100deg, transparent 58%, color-mix(in srgb, var(--fig) 38%, transparent) 59.5%);
}
```

The body's left edge falls at x ≈ 50-57%, so a plate (or a folder card) placed across the middle of the ground straddles the light/dark step. Rules: place text plates and decorative plates over the edge, never put text on the ground itself (§3 haze row), keep the figure on the side away from the headline, and re-run `contrast-check.mjs` after changing a ground (the tinted-plate pairs and the spread cap read every stop, `figure` included). A grain of `alpha.grainHaze` goes over both layers.

---

## 4. Colour system

All values in [tokens.json](tokens.json) (`color.*`, `gel.*`, `alpha.*`); the contrast gate reads that file. Token names describe purpose, never appearance.

| Token (`--lg-*`, tokens.json path) | Light | Dark | Role |
| --- | --- | --- | --- |
| `ground` (`color.light.ground`, `color.dark.ground`) | #f2f1f1 | #121212 | Page ground |
| `card` | #ffffff | #1c1c1c | Matte card fill |
| `card-sunk` (`cardSunk`, `panelRaised`) | #e7e7ea | #242424 | Inset pills, inputs, sunk rows |
| `ink` | #121214 | #f4f4f6 | Text, icons, strokes, inverted pill fill (light). [e] chosen; the originals use #111-#1a1a1a. |
| `ink-secondary` | #43434a | #b8b8c0 | Labels, sublabels (≥ 7:1 light) |
| `ink-tertiary` | #64646c | #9c9ca4 | Placeholders, axis labels (≥ 4.5:1 on every surface; the originals' #a0-#b5 are 1.7-2.6:1) |
| `on-ink` | #ffffff | #121214 | Text on the inverted pill; white text on deep gel |
| `hairline` | #b4b4ba | #46464b | Static card edge floor (≥ 1.6:1) |
| `control-edge` | #7a7a82 | #86868e | Interactive boundary (≥ 3:1 against every surface) |
| `lime` | #dff30f [e] (soft: #e4eb83 [m]) | #dff30f | The single accent; fill behind **ink**, never text, never the sole indicator on light |
| `focus-ring` / `focus-halo` | #121214 / #ffffff | #ffffff / #121212 | §10 |
| `glow` | n/a | #5fe070 [e] | Dark variant's single hue (derive from the brand hue; green here) |
| `success` `warning` `danger` `info` | #14692c #8a4b00 #b3261e #1a4fc4 | #6fdc8c #f2b84b #ff8a80 #8ab4ff | State text/icon colours (≥ 4.5:1); always with an icon or word |
| Gel stops | §2c (`gel.vivid`) | §2c (`gel.deep`) | Per-tile ramps |
| Sky | `color.sky.*` | same | §3 |

Rules:

1. **Hue budget (round 3, evidence-based).** Outside a gel board: **at most 3 saturated hue families per frame** [m]. A gel tile is one hue; neighbouring tiles are different hues; everything else is neutral. **On a gel board** (a butted stack of gel tiles, the references' four-gel board: purple, orange-pink, pink, blue) **up to 5 colourways, one hue per tile, and nothing else saturated beside the board except the single lime** [m: four hues on the board of post Dc1FdCeDON0, the study's own reference; the orange-to-magenta pair counts once]. Tokens: `gel.hueBudget`. A frame with a gel board and a second saturated area (a dark glow, a hero photo) is over budget.
2. **One lime accent** [m 7 posts]: puck, progress head, FAB, "new" chip, one marker per chart. Lime is a fill behind ink; a lime graphic needs a 1.5 px ink ring; lime is never a text colour on a light ground (1.24:1).
3. **State is never hue alone**: pair with an icon, word, shape (filled / hatched / dashed) or position. Two hues (pink wire vs green wire) is not a state.
4. Light grounds are cool-neutral (a few points toward blue/violet) [e]. Never pure grey ink on pure white.
5. Hierarchy by weight and size first; by colour (`ink-secondary`) second; **never by alpha on a gel** (§10).

---

## 5. Typography

| Role | Family | License |
| --- | --- | --- |
| **Primary (recommended)** | **Urbanist** (variable 100-900), geometric, single-storey a/g, straight-tailed y. Consensus: Urbanist 300 / Outfit 300 in 12 of 22 posts [m]. Equivalent drop-in: Outfit. | OFL-1.1 |
| **Fallback** | **Inter** (variable). The Helvetica-like branch (Inter 300 / Hanken Grotesk 300) in 10 of 22 posts [m]. Use it when a project needs more legibility at small sizes or a neutral voice. | OFL-1.1 |
| Dot-matrix numerals | **Doto** (variable, weight axis; a rounded-dot axis if the build has one: verify on a specimen, not determined) | OFL-1.1 |

Self-host woff2 with `font-display: swap`; load no Google Fonts request. The study never names the exact faces (they are matched by shape): the match is [e].

### 5.1 Scale, weight, tracking (ratios, then rem)

| Role | Size (rem, `type.scaleRem`) | Weight | Tracking | Leading | Min allowed |
| --- | --- | --- | --- | --- | --- |
| Hero numeral | 3 / 4.5 (`3xl`/`4xl`); 0.07-0.13 of card width [m] | 300-500 | -0.02em | 1.05 | 300 only at ≥ 1.25 rem |
| Display title | 2 (`2xl`) | 300 (500-700 on the emphasised words) | -0.03em | 1.05-1.15 | |
| Card title | 1.25-1.5 (`lg`/`xl`) | 300 | -0.02em | 1.25 | 300 only ≥ 1.25 rem |
| Body | 1 (`base`) | 400 | 0 | 1.5 | 400, ≥ 1 rem |
| Label / sublabel | 0.875 (`sm`) | 400-500 | +0.01em | 1.4 | weight ≥ 400 |
| Caption, unit tag | 0.75 (`xs`) | 500 | +0.01em | 1.4 | **0.75 rem hard floor** |

Rules [e unless marked]:

- Sentence case everywhere [m]; no all-caps UI labels.
- **Weight contrast inside one line** is the signature [m 5 posts]: a 200-300 lead-in and a 500-700 emphasis ("Hello Alex / **can I help you?**"). Mono-weight 300 headlines are a defect (§10).
- Numerals: tabular figures; thousands separator kept; currency/percent prefix as a superscript at 0.45 of numeral height [m]; trailing unit after a slash on the baseline.
- **Unit / delta tag**: size `type.tag.ofNumeralHeight` 0.38 of numeral height (0.30-0.45 [m]), light, top-aligned (delta) or baseline (unit), **never below 0.75 rem** (the originals collapse to <11 px).
- Hierarchy ramp for dim text: `ink` → `ink-secondary` → `ink-tertiary`. Alpha is allowed only on a flat ground, floor 0.72 over a surface proven in §10; never on a gel.

### 5.2 Dot-matrix numerals

| Rule | Value | Tag |
| --- | --- | --- |
| Use | Primary values only (the hero number of a tile, a counter); never labels, prices in a form, body text, or anything read quickly or by assistive tech | [m] 9 posts |
| Dot diameter | `type.dot.diameterOfPitch` 0.6 of the dot pitch (0.64 and 0.6 measured/estimated) | [e] |
| Pitch | ≈ 1/7 of glyph height for a 5x7 matrix (hero ≈ 0.14 of card width); a "centreline" variant (one dotted stroke, round caps, `stroke-dasharray: 0 gap`) is allowed for a single hero digit | [e] |
| Minimum size | `type.dot.minRem` 1.5 rem (24 px): below it the dots alias at 1x | [e] from the defect log |
| Weight | Doto's weight axis sets the dot size; pick the weight whose dot reads ≈ 0.6 of pitch. **Small and medium sizes (the web layer's default): 700**, which keeps the dots legible near the 1.5 rem floor. **400 is allowed at hero sizes**, where the dots are large enough to read at that weight (range 300-700). Verify on a specimen | [e]; 700 verified on a specimen in the layer |
| Colour | `ink` on matte (not #2a2a2a), white on deep gel, white alpha 0.85 only on a flat dark plate | [e] |
| **Ambiguity fix** | 5/6/8/0 and 3/9 are ambiguous. A dot value is **never the only visible form** of a decision-critical number: show the same value in the sans face within the same card (label, unit line, caption), and mark the dot form `aria-hidden="true"` with the real text in the accessible name | policy |
| Unit | Set in the sans, 0.38 of numeral height | [e] |

---

## 6. Data-viz

All strokes round-capped. `W` = card width.

| Element | Spec | Tag |
| --- | --- | --- |
| Hairline | `dataviz.hairlinePx` 1.5 px (0.002-0.004 W); informational strokes ≥ 1.5 px; white alpha 0.3-0.9 **only on a deep gel**, `ink` on a vivid gel or white | [m] |
| Dashed forms | dash ≈ gap ≈ `dataviz.dashOfCardWidth` 0.012 W, stroke 0.005 W; dashed = inactive, solid hairline = hover, filled translucent = selected (same silhouette in three states) | [m] |
| Pillow / bell bars | Rounded bell-top silhouette, top radius `dataviz.barTopRadiusOfWidth` 0.4 of bar width, concave flares at the base; fill white alpha 0.35 over the gel (selected) | [m] |
| Three-fill bars (dark) | Role by fill: diagonal hatch 45°, 1 px lines, pitch 0.06 of bar width = baseline/previous; dot grid, dots 0.02 of bar width, pitch 0.1 = current; flat dark gradient = other. 1.5 px cap line on top (green for the highlighted). Dim, not bold: the hatch is `ink-secondary`, the flat fill a gradient from 55% to 8% of `ink-secondary`, the dotted bar the glow hue; axis labels are `ink-tertiary` at the 0.75 rem floor (5.7:1 on the dark panel; the originals' labels are about 2.5:1). Layer component: `FillBars` (labels are HTML so the floor holds at every width) | [m] 1 post; dim floors [e] |
| Halftone fill | Dot pitch `dataviz.halftonePitchOfWidth` 0.01 W, dot diameter 0.6 of pitch, white alpha 0.6-0.85, dots shrink to zero at the shape edge | [m] 4 posts |
| Dotted dial | ~60 dot ticks around a circle, alpha 0.6; a hatched wedge (8 slashes at 45°) marks the bad zone; ring diameter 0.75 of tile side | [m] 1 post |
| Tick ruler | `dataviz.tickCount` ~35 ticks, three heights 1 / 0.55 / 0.3, every 5th long, stroke 0.004 W, fade to 0 at both ends; **current tick 1.5x taller, 2x stroke, lime** | [m] 5 posts |
| Waveform | `dataviz.waveformLines` ~60 vertical hairlines, alpha 0.35-0.8, tallest in the middle (~0.25 of card height), faint oval plate behind the centre (white alpha 0.12, 0.3 W wide) | [m] 3 posts |
| Sparkline | 1.2 px hairline sine, `ink-tertiary`/`ink`, two filled ink dots (0.012 W) on the peaks | [m] |
| Score ring | 1.5 px ring covering 0.8 of the circumference then a dashed 0.2 continuation; centre value | [m] 1 post |
| Nodes | Hollow circle = idle, filled = current; diameter `dataviz.nodeOfCardWidth` 0.012 W, stroke 0.002 W; a pinched teardrop flare where a wire meets a card (dark variant) | [m] |
| Wires | 1.5 px S-curves, radius ~0.06 W, ring port; state by **shape + label**, not pink-vs-green alone | [m] |
| Dotted baselines | Dot 0.003 W, pitch 0.012 W | [m] |
| Axis labels | ≥ 0.75 rem, `ink-tertiary` (the originals use 0.01-0.02 W) | policy |

Every informational stroke or fill needs 3:1 against its tile (§10).

### 6.1 Component numbers (the layer's data-viz, round 3)

Colour is always `currentColor` (ink on a vivid gel or matte, white on a deep or luminous gel), so the surface chooses it (§10.2). All are decorative drawings with an `aria-label` summary or are hidden; the value they draw is also in text (V3).

| Component | Numbers | Tokens |
| --- | --- | --- |
| BellBars | Pillow bars in three forms: **solid** (white alpha 0.35 fill + 1.5 px stroke = selected), **dashed** (1.5 px stroke, dash = gap = 0.012 W, no fill = inactive), **dotted** (1.5 px round-cap dots, the "estimated" form); top radius 0.4 of the bar width, base flares 0.35 of the bar width each side rising 0.15 of the bar height, bar gap 0.5 of the bar width, a filled node on the selected crown; the form is repeated in the caption | `dataviz.bell.*`, `barTopRadiusOfWidth` |
| DottedDial | 60 dot ticks (alpha 0.6, dot radius 0.022 of the ring radius) around a ring 0.75 of the tile side, a solid 1.5 px arc over a 270 degree sweep for the value, a centre dot; optional hatched wedge (8 slashes at 45 degrees) over the bad zone | `dataviz.dial.*` |
| TickRuler | 35 ticks, heights 1 / 0.55 / 0.3, every 5th long, stroke 0.004 W, opacity fading to 0 over the last 5 ticks at both ends; the current tick 1.5x taller, 2x stroke, lime with a 1.5 px ink ring (A5) | `dataviz.tickCount`, `tickRuler.*` |
| Waveform | 60 vertical hairlines (1.5 px, round caps), alpha 0.35 at the ends to 0.8 in the middle, tallest 0.25 of the card height in the middle, a faint oval behind the centre (white 0.12, 0.3 W wide); decorative, hidden from assistive tech | `dataviz.waveform.*` |
| ScoreRing | 1.5 px ring: solid over 0.8 of the circumference, then a dashed continuation over 0.2 (dash 0.02 of the circumference); centre value is text; the arc draws in on spring `draw` (120 / 22) | `dataviz.ring.*` |
| Wires and ports | 1.5 px S-curves (horizontal S, control points at the mid x), a hollow ring port 0.05 W where a wire meets a card; on the **dark node board** the wire ends in a pinched teardrop flare (a circle of 0.05 W tapering to the wire over 2.5 port radii, pinch 0.35) in the frame's one glow hue; on the **folder card** the port sits in a concave notch (a ground-coloured disc 1.35x the port) bulging out of the right edge; state is the label or icon beside it, never the wire hue (C5) | `dataviz.wire.*` |

---

## 7. Controls

Hit area ≥ **44 px** (`control.tapPx`) for every control, even when the visual is smaller. All states below are required; states differ by more than colour.

| Control | Rest | Hover (`@media (hover:hover)`) | Press | Focus-visible | Disabled |
| --- | --- | --- | --- | --- | --- |
| Stadium filter / tab pill | `card` fill, 1.5 px `control-edge`, chevron on filters, min-height 44 | lift -2 px, brightness 1.04, spring `settle` | scale 0.97, brightness 0.96, spring `press` | 3-layer ring (below) | opacity 0.5, no lift, `aria-disabled`, cursor not-allowed |
| Active (inverted) pill | solid `ink` fill, `on-ink` text (white pill on dark); a check or underline mark in addition | same | same | same | n/a |
| Glass circle button | 44 px, `rgba(white, 0.24)` fill (0.18-0.3 [m]), thin lens rim (1 px `hairline`, optional iridescent crescent lilac #c9b6ee / peach #f3d4c3 / blue #b8d4ee, 0.015 of diameter [e], bottom-left/top-right) , icon `ink` 1.5 px stroke ≥ 1.25 rem | lift -2 px | scale 0.97 | ring | opacity 0.5 |
| Chip / tag | stadium, fill `card-sunk`, text `ink`, height ≥ 2 rem, 0.0 shadow; lime chip = `lime` fill + `ink` text | fill step darker | scale 0.97 | ring | opacity 0.5 |
| NE-arrow action | glyph ↗ 1.25 px stroke, ≈ 0.02 W, top-right at inset 0.07 W; the **button around it is 44 px**, accessible name states the action ("Open details") | glyph translates 2 px NE | scale 0.97 | ring | opacity 0.5 |
| Badge | dot 0.5 rem red + count text ≥ 0.75 rem; never a colour alone | n/a | n/a | n/a | n/a |
| Input / search | stadium (a textarea: card radius), **sunk glass (round 4)**: fill `card-sunk` at 78% over a 7% black top fade, an inner shadow along the top (0.14 rem, black 0.10), a **lit rim** along the bottom (inset 1 px white 0.8, plus a 1 px white 0.8 outer line under the field), and a **1 px `control-edge`** line (the A3 boundary, kept at 3:1 for WCAG 1.4.11 because the sunk fill alone cannot give a boundary 3:1; `prefers-contrast: more` restores 1.5 px); the old 1.5 px dark outline read as a hard box, placeholder `ink-tertiary`, min-height 48; **a visible label above it** (placeholder is never the label); the search field adds a 1.25 rem 1.5 px search glyph in `ink-secondary` | edge darkens one step | n/a | ring | opacity 0.5 |
| Toggle | 3 rem x 1.75 rem stadium, track edge `control-edge` 3:1; on = `ink` fill + check icon in the thumb; off = `card-sunk` + dash; thumb moves on spring `press` | | scale 0.97 | ring | opacity 0.5 |
| Slider | hairline track 4 px `control-edge`, filled part `ink`, **lens thumb** 24 px (translucent white fill, 1.5 px iridescent crescent rim lilac / peach / blue per §7 circle button, 3:1 ring) in a 44 px hit area, native range input underneath so keyboard and assistive tech work, a visible label and the value as text; lime puck only with a 1.5 px `ink` ring | thumb lift | thumb scale 0.97 | ring around the thumb | opacity 0.5 |
| Stepper | two 44 px glass circles (minus, plus) either side of the dot numeral (≥ 1.5 rem, the real count as text beside it, §5.2), 1 rem apart; a button at the bound is disabled, not hidden | lift -2 px | scale 0.97 | ring | opacity 0.5 |

**Focus ring (all controls):** three stacked rings that follow the control's radius: `focusOffset` 2 px halo gap, `focusRing` 2 px (`focus-ring`), `focusHalo` 2 px outer halo. Ring vs halo is 18.7:1 in both modes, so it reads on a light ground, a vivid gel, a deep gel or a photo. Never remove outlines without this replacement. CSS in §2d.

Active pill note: the original's colour-only active state (blue gel pill) must also carry the check/underline mark.

---

## 8. Layout

| Rule | Value | Tag |
| --- | --- | --- |
| Grid | Bento 2x2 or 3 columns, mixed spans (one wide card = 2 cells) | [m] |
| Gap, butted gel tiles | **Canonical: `layout.gapGelClamp` = `clamp(0.25rem, 0.8cqi, 0.75rem)`**, i.e. `layout.gapGelOfStackWidth` 0.008 of the stack's own width (range 0.005-0.012 W, [m] 4 posts); `layout.gapGelRem` 0.5 rem is the fallback outside a size container (0.008 W at a 62.5 rem stack). No per-tile drop shadow | [m] ratio, [e] clamp |
| Gap, matte cards | **Canonical: `layout.gapCardRem` 1.25 rem (20 px) = 0.139 of the 9 rem module.** The study's ratio 0.03-0.05 of card width [m] is the cross-check, not a second rule: 1.25 rem is 0.04 W for a card 31 rem wide and stays inside the range from 25 to 42 rem; when the two disagree the rem value wins (a ratio gap would shrink with the card and break the 44 px tap spacing) | [m] 6 posts ratio, [e] the rem pick |
| Inner padding | 1.25 rem ≈ 0.07 W (0.065-0.08) | [m] |
| Placement inside a tile | title top-left, action top-right (NE arrow), primary value bottom-left, chart bottom-right | [m] 5 posts |
| Alternation | One saturated gel per row (or per cluster), the rest matte | [m] |
| Value stack in a card | title → big number → legend → chart at the bottom | [m] |
| Sidebar | ~0.30 of screen, content ~0.70 | [m] 2 posts |
| Labels outside tiles | Allowed above-left of a tile at ~0.04 W (sky variant) | [m] |
| Perspective / yaw | 12-30° yaw, 5-25° roll, depth-of-field falloff are **presentation devices** of the screenshots (studio photography, mockups). The product UI is flat, axis-aligned, sharp. Never ship tilt or DoF blur in the product. | [m] |

---

## 9. Motion

All motion is spring-based. **No `@keyframes`, no animation library besides the house springs, in the layer and in the styled stamp.** The template ships `tw-animate-css` (its `enter`/`exit` keyframes) for the unused shadcn dialog; the layer's `stamp.mjs` removes that import and `ui/dialog.tsx` when nothing else imports them (round 3), so the built CSS of a stamped build carries zero `@keyframes`. A build that really needs the dialog keeps both and records the exception. With a spring runtime use the pairs; with none, use the `linear()` easing + duration derived from the same spring (generated by integrating the spring, not hand drawn; tokens.json `motion.spring.*`). All motion in the study is **inferred** (the screenshots are stills); the numbers are [e].

| Motion | Spring (tension / friction / mass) | ζ | Overshoot | Settle | Notes |
| --- | --- | --- | --- | --- | --- |
| Sheet, tab, accordion, folder-tab slide, active-pill slide | **220 / 21 / 1** | 0.71 | 4.1% | 563 ms | The "~5% overshoot" of the study |
| Press squish (scale 0.97) and toggle thumb | **400 / 28 / 1** | 0.70 | 4.4% | 420 ms | Press = scale 0.97 on down, spring back on up |
| Hover lift (-2 px, scale 1.02 max) and fades | **260 / 30 / 1** | 0.93 | 0% | 463 ms | No overshoot on hover |
| Dot-numeral re-sequence | **300 / 24 / 1** | 0.69 | 4.7% | 480 ms | Each dot rolls to its new position; stagger `motion.spring.dot.staggerMs` 12 ms per dot (~120 ms across a glyph) |
| Stroke draw-in (wires, rings, curves) | **120 / 22 / 1** | 1.0 | 0% | 781 ms | Animate `stroke-dashoffset` to 0; lead with the bright tail |
| Counter tick, bar grow from baseline | **170 / 26 / 1** | 1.0 | 0% | 663 ms | |
| Gel bloom drift | not a spring: a slow ticker, period **10 s** (8-12 s), x ±6%, y ±4%, two incommensurate sines (§2d) | | | | Pause offscreen / hidden / under reduced motion |

Non-spring stacks: `transition-duration` = settle ms and `transition-timing-function` = the matching `linear(...)` string; or `cubic-bezier(0.3, 1.25, 0.6, 1)` (≈ 5% overshoot [e]) when `linear()` is unsupported.

Reduced motion (`prefers-reduced-motion: reduce`, read live with a change listener, not once): no drift (bloom at rest 50% / 70%), no squish, no lift, dot numeral swaps instantly, strokes appear drawn, springs resolve to the end state; hover and press change colour/brightness only. The page must be fully usable with motion off.

---

## 10. Accessible rendering

The originals fail WCAG: white text on gel 1.3-2.5:1, ghost labels 1.1-1.5:1, sublabels #a0-#b5 on white 1.7-2.6:1, value-only card edges 1.1-1.3:1, lime on white 1.2:1, hue-only state, dot numerals ambiguous. This section defines the same look, shippable. Where it conflicts with §2-§9, this section wins.

### 10.1 Floors

| Rule | Floor |
| --- | --- |
| Text (normal) | 4.5:1 |
| Large text (≥ 1.5 rem regular, or ≥ 1.17 rem bold) | 3:1 |
| UI component boundary / informational graphic | 3:1 |
| Static card edge (value + hairline/shadow) | value step ≥ 1.08:1 **and** `hairline` ≥ 1.6:1; a non-interactive card is not required to meet 3:1, but value alone (1.1-1.3:1) is not allowed |
| Tap target | ≥ 44 x 44 px |
| Minimum text | 0.75 rem; weight ≥ 400 under 1.25 rem |
| Thin face | weight **300 only at ≥ 1.25 rem (20 px)**; body ≥ 1 rem at ≥ 400; weight 200 never |
| Alpha text | ≥ 0.72 on a flat ground; **none on a gel** |
| Focus | 2 px ring, 2 px offset, 2 px halo; ring vs halo ≥ 3:1 (measured 18.7:1) |

### 10.2 The rules that make the look accessible

1. **Ink on glass, ink on vivid gel.** Light mode: every text colour on a vivid gel or a frost plate is `ink` (#121214). The vivid ramps are built so ink clears 4.5:1 on top/mid/core/bottom (worst 4.73:1, blue core). Hierarchy on a gel uses weight and size only, never alpha (`ink` at 0.78 on the green core is 3.75:1: fails) and never a grey.
2. **White on deep gel.** Dark mode and any tile whose text must be white uses the deep ramp (core L 0.42): white clears 4.5:1 (worst 5.67:1); white alpha 0.90 secondary clears 4.5:1 (worst 4.93:1). Never white on a vivid ramp (pink core 2.99:1, peach 1.57:1, blue edge 2.33:1). **The top-left highlight (§2c) is 0.16 white on vivid ramps only and `alpha.highlightDeep` 0.06 on deep ramps:** the script checks the gel stops alone, but the highlight sits under the title and 0.16 on the deep green top measured about 3.9:1 in the layer probe (0.06: about 5.0:1).
2b. **White on a luminous gel (round 3).** The references' own look (white text on saturated gel) is reachable accessibly with `tone="luminous"`: the ramp is the vivid one darkened only as far as white needs (§2c), 4.75:1 under the worst-case wash and highlight (gate floor 4.7; the live probe reads about 0.15 below the composite). **The honest trade-off:** a luminous tile is jewel-toned, not pastel: the pale top of the originals (#c2d69b, #fce9cc) cannot sit under white text at any ratio, so the pale lives in the rim, the 1 px ring, the lip and the highlight, not in the fill. It is closer to the references than the deep ramp (which is a dark-mode ramp) and further than the vivid ramp with ink (the largest tonal deviation of rounds 1 and 2 was ink on vivid). **Round 4: one tone per board (§2c).** The default on a light ground is ink-on-vivid (pastel, like the references); luminous is a whole-board choice, never mixed with vivid tiles on one board. Never mix white and ink text in one tile, never white on a vivid ramp.
3. **No text in the rim.** The pale rim is 0.03-0.06 W deep and fails both ink and white; padding keeps text out.
4. **Frost plate with text:** light plate, **tinted (round 2)** = the ground tint mixed 55% with white, laid at alpha 0.46 (round 4), ink text, valid over a declared ground only; over every blob colour of the ground the worst case is pink 9.99:1 ink / 5.24:1 secondary (on `deep` #ec6f9b), mint 10.24 / 5.37, cream 12.42 / 6.51, sky 8.97 / 4.70 (on the steel-blue `screen`), flat light 17.01 / 8.92. Ink tertiary (3.2:1 on the pink worst case) is **not** allowed on a plate. Light plate **over any backdrop** (`strong`) = white alpha ≥ 0.72 (`alpha.frostText`; the 0.12-0.45 decorative range of §2b is for plates with no text) and ink text (worst case over a pure black backdrop: 9.39:1 ink, 4.92:1 secondary). Saturation 1.4 is not in the pair table (the filter keeps luma, but gamut clipping can shift it): the live probe in the site proof measured 0 failures. Dark plate = scrim `#121212` alpha ≥ 0.8 and light text (worst case over white: 9.24:1, 5.15:1). Sky glass: white 0.72 plate with ink, or scrim `#101a2a` alpha 0.6 with white text (5.87:1). A decorative-only plate keeps `alpha.frostDecor` 0.22 and holds no text.
5. **Matte card boundaries:** value step plus `hairline` 1 px or the ambient shadow; interactive boundaries (inputs, toggles, tracks, outline pills) use `control-edge` at 3:1. A control identified by a visible text label or a ≥ 3:1 icon needs no boundary, but keep the rim ≥ 1.6:1.
6. **Lime:** ink text on lime (15:1) is allowed; lime text on a light ground is banned (1.24:1); a lime graphic (puck, tick, dot) carries a 1.5 px ink ring or sits on the dark ground (12.5:1).
7. **No hue-only state:** every state pairs the hue with an icon, a word, a shape (filled / hatched / dashed) or a position.
8. **Dot numerals:** treated as text (4.5:1), ≥ 1.5 rem, with the real value present as text in the same card; `aria-hidden` on the dot form. Unit/delta tags ≥ 0.75 rem.
9. **Violet / pink vivid cores** were adjusted from the measured hexes only where ink missed 4.5:1 (violet core #a354c9 → #ad62d3). No other study hex was changed.
10. **Preferences honoured:** `prefers-reduced-transparency` (opaque), `prefers-reduced-motion` (no drift/squish/lift), `prefers-contrast: more` (control-edge rings, no grain), `forced-colors` (system colours with borders; **round 4: no surface sets `forced-color-adjust: none`, because the property is inherited and left authored white ink on a Canvas surface, white on white; the solid pills and the active chip keep it only because they set both Highlight and HighlightText themselves**). §11.

### 10.3 Result of `node contrast-check.mjs`

**Round 4: 113 pairs (409 background combinations) checked, 0 failed; 4 ground spreads within the cap (pink 28.2, mint 34.8, cream 23.8, sky 33.8 L*); 10 original-look pairs fail as expected; `--self-test` 17 passed.** Round 4 added the two colourways (9 pairs each set), lowered the tinted plate alpha 0.52 to 0.46 and lightened the pink and cream grounds; the table below is the round 3 print and the per-pair worst cases changed only where §10.2 rule 4 quotes the new numbers. Re-run `node contrast-check.mjs --md` for the current table.

**Round 3: 95 pairs (345 background combinations) checked, 0 failed; 4 ground lightness spreads (pink, mint, cream, sky), all within the 35 L* cap; 10 original-look pairs fail as expected; `--self-test` 17 passed.** Round 3 added 18 pairs (the luminous ramps: white on the stops, white under the worst-case wash and highlight at the 4.7 margin, focus halo vs core, the dot numeral on the luminous core; the tinted plate over the cream ground) and raised the deep/luminous wash pairs from 4.5 to 4.7 (the deep green top was darkened #25762a to #1f7125: the live probe had read 4.54 for white on it). The 77-pair state below is round 2: (Round 2 added 20 pairs: tinted plate ink and secondary over every blob colour of the pink, mint, sky and light grounds; ink and white text over the gel's edge wash plus highlight at full alpha; the dark rim's unlit and lit sides. The table below is the original 57; run `node contrast-check.mjs --md` for all 77. Round 2 also tried the gel secondary at alpha 0.9 under the edge wash and dropped that pair: no layer text uses alpha on a gel (§10.1, A6).) Iteration log of the check against draft tokens: run 1 = 61 pairs, 7 failed (ink-alpha 0.78 secondary on the five vivid cores 3.67-4.24:1; frost-light secondary 3.08:1; frost-dark secondary 3.82:1), fixed by dropping alpha hierarchy on gels, raising `alpha.frostText` 0.6 → 0.72 and `alpha.frostDarkScrim` 0.72 → 0.8, darkening `inkSecondary`. Run 2 = 10 failed (a wrongly specified solid-grey secondary on vivid gels, which is not a valid pattern and was removed as a pair; and white alpha 0.86 secondary on the five deep ramps, 4.01-4.48:1), fixed by darkening the deep ramps (top L 0.54 → 0.50, core 0.44 → 0.42) and `alpha.whiteOnDeepSecondary` 0.86 → 0.90. Run 3 = 57 pairs, 0 failed. The pair list is data in the script; `--md` regenerates this table; `--verbose` prints every background combination.

| Pair | Kind | Worst background | Ratio | Min | Result |
| --- | --- | --- | --- | --- | --- |
| light ink text | text | light.cardSunk | 15.16 | 4.5 | pass |
| light inkSecondary text | text | light.cardSunk | 7.95 | 4.5 | pass |
| light inkTertiary text | text | light.cardSunk | 4.75 | 4.5 | pass |
| light on-ink text on inverted pill | text | light.ink | 18.71 | 4.5 | pass |
| light ink text on lime chip | text | light.limeSoft | 14.71 | 4.5 | pass |
| light state success text | text | light.cardSunk | 5.51 | 4.5 | pass |
| light state warning text | text | light.cardSunk | 5.51 | 4.5 | pass |
| light state danger text | text | light.cardSunk | 5.30 | 4.5 | pass |
| light state info text | text | light.cardSunk | 5.75 | 4.5 | pass |
| light control edge vs surfaces | ui | light.cardSunk | 3.45 | 3 | pass |
| light focus ring vs focus halo | ui | light.focusHalo | 18.71 | 3 | pass |
| dark focus ring vs focus halo | ui | dark.focusHalo | 18.73 | 3 | pass |
| light hairline floor (static card edge) | floor | light.ground | 1.83 | 1.6 | pass |
| light card vs ground value step | floor | light.ground | 1.13 | 1.08 | pass |
| light lime graphic: ink ring vs lime | ui | light.lime | 15.12 | 3 | pass |
| dark ink text | text | dark.panelRaised | 14.13 | 4.5 | pass |
| dark inkSecondary text | text | dark.panelRaised | 7.88 | 4.5 | pass |
| dark inkTertiary text | text | dark.panelRaised | 5.70 | 4.5 | pass |
| dark ink text on lime chip | text | dark.lime | 15.12 | 4.5 | pass |
| dark state success text | text | dark.panelRaised | 9.09 | 4.5 | pass |
| dark state warning text | text | dark.panelRaised | 8.67 | 4.5 | pass |
| dark state danger text | text | dark.panelRaised | 6.80 | 4.5 | pass |
| dark state info text | text | dark.panelRaised | 7.43 | 4.5 | pass |
| dark control edge vs surfaces | ui | dark.panelRaised | 4.30 | 3 | pass |
| dark hairline floor | floor | dark.panelRaised | 1.65 | 1.6 | pass |
| dark lime graphic vs surfaces | ui | dark.panelRaised | 12.54 | 3 | pass |
| dark glow accent graphic vs surfaces | ui | dark.panelRaised | 9.15 | 3 | pass |
| dark glow accent text vs surfaces | text | dark.panelRaised | 9.15 | 4.5 | pass |
| dark inverted pill: ink on light pill fill | text | dark.pillFill | 18.71 | 4.5 | pass |
| gel green (vivid): ink title/value | text | vivid.green.core | 4.89 | 4.5 | pass |
| gel pink (vivid): ink title/value | text | vivid.pink.bottom | 5.23 | 4.5 | pass |
| gel blue (vivid): ink title/value | text | vivid.blue.core | 4.73 | 4.5 | pass |
| gel orangeMagenta (vivid): ink title/value | text | vivid.orangeMagenta.core | 5.59 | 4.5 | pass |
| gel violet (vivid): ink title/value | text | vivid.violet.core | 4.87 | 4.5 | pass |
| gel green (deep): white title/value | text | deep.green.top | 5.67 | 4.5 | pass |
| gel green (deep): white secondary (alpha 0.90) | text | deep.green.top | 4.93 | 4.5 | pass |
| gel pink (deep): white title/value | text | deep.pink.top | 6.46 | 4.5 | pass |
| gel pink (deep): white secondary (alpha 0.90) | text | deep.pink.top | 5.56 | 4.5 | pass |
| gel blue (deep): white title/value | text | deep.blue.top | 6.07 | 4.5 | pass |
| gel blue (deep): white secondary (alpha 0.90) | text | deep.blue.top | 5.27 | 4.5 | pass |
| gel orangeMagenta (deep): white title/value | text | deep.orangeMagenta.top | 6.48 | 4.5 | pass |
| gel orangeMagenta (deep): white secondary (alpha 0.90) | text | deep.orangeMagenta.top | 5.58 | 4.5 | pass |
| gel violet (deep): white title/value | text | deep.violet.top | 6.41 | 4.5 | pass |
| gel violet (deep): white secondary (alpha 0.90) | text | deep.violet.top | 5.55 | 4.5 | pass |
| gel x5 (deep): focus halo vs core | ui | deep.green.core | 8.03 | 3 | pass |
| frost light plate: ink text over any backdrop (11) | text | #000000 + white@0.72 | 9.39 | 4.5 | pass |
| frost light plate: ink secondary over any backdrop | text | #000000 + white@0.72 | 4.92 | 4.5 | pass |
| frost dark plate: ink text over any backdrop | text | #ffffff + scrim@0.8 | 9.24 | 4.5 | pass |
| frost dark plate: ink secondary over any backdrop | text | #ffffff + scrim@0.8 | 5.15 | 4.5 | pass |
| sky glass light plate: ink over the sky range | text | sky.screen + white@0.72 | 13.56 | 4.5 | pass |
| sky glass dark plate: white over the sky range | text | sky.bottom + scrim@0.6 | 5.87 | 4.5 | pass |
| dot numeral: ink on card/ground | text | light.ground | 16.60 | 4.5 | pass |
| dot numeral: white on deep gel core | text | deep.green.core | 8.03 | 4.5 | pass |

(The five per-colourway "focus halo vs core" rows are collapsed to one above; the script prints each. Worst of the five is green, 8.03:1.)

Original-look pairs that must fail (printed by the script as `fails-as-expected`): white on vivid pink core 2.99; white on peach 1.57; white on blue edge 2.33; #b5b5b5 sublabel on white 2.05; #c6c6cc chip text on #ececf0 1.44; lime graphic on white 1.24 (min 3); #f2f2f2 card edge on white as UI boundary 1.12 (min 3); white alpha 0.4 on green core 1.80; ink alpha 0.78 on green core 3.75; #5a5a5a on #1a1a1a 2.52.

Scope of the check: it proves colour contrast for the token pairs and the derivation rule. It does **not** prove text size, weight, tap target, focus visibility, reduced-motion or forced-colors behaviour; those are §12 checks to read in CSS or screenshot.

---

## 11. Performance and degradation

### 11.1 Budgets (policy, [e])

| Budget | Value |
| --- | --- |
| `backdrop-filter` layers per view | ≤ `perf.maxBackdropLayersPerView` 6 (≤ 3 on a coarse-pointer / low-tier device). CSS cannot count layers, so the layer enforces the budget by rule: under `(pointer: coarse), (max-width: 40rem)` a decorative plate drops its blur (fill 0.3, rim kept), a text plate drops it only when marked `solidOnSmall` (opaque card, rung 1), and the author counts the rest. |
| Layers over a live canvas, video or WebGL | ≤ 1 |
| Blur radius | ≤ `blur.capPx` 40 px; prefer 12-24 px |
| Gel tiles with a running drift | ≤ `perf.maxDriftingTiles` 4, only those intersecting the viewport |
| Grain | one 128 px SVG tile shared by all gels |
| Ancestors of a frosted element | no `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode`, `backdrop-filter`, or animated `transform` above it: each makes a backdrop root and the plate samples an empty backdrop (house pitfall: aerra, longplay). Put reveal fades on an inner wrapper or on the plate's own opacity-free children. |
| `will-change` | `transform` only on the element while a spring runs; remove at rest; never on gel tiles or frost plates by default |
| Large frosted areas | a plate bigger than ~1/4 of the viewport that scrolls: use opaque `card` instead |

### 11.2 Ladder (apply top to bottom; each rung is a CSS or JS condition, shown in §2d)

| # | Condition | Rendering |
| --- | --- | --- |
| 1 | `backdrop-filter` unsupported (`@supports not`) | Opaque tinted plate: `card` fill, rim kept; text-bearing plates already pass because ink on opaque white is 15:1 |
| 2 | `prefers-reduced-transparency: reduce` | Same opaque plate; blur none |
| 3 | `prefers-reduced-motion: reduce` | No drift, no squish, no lift, springs resolve to the end state, dot numeral swaps |
| 4 | `forced-colors: active` | `Canvas`/`CanvasText`, 1 px `CanvasText` border, no gradient, no rim, no grain, `Highlight`/`HighlightText` fill **and** a border for the active pill, the active chip and the solid CTA (round 3: a chip with only a background fill vanished), `Highlight` for focus; keep the card edge (the value-only edge vanishes here) |
| 5 | `prefers-contrast: more` | `control-edge` 1.5 px ring on cards, frost plates **and gel tiles** (round 3), no grain |
| 6 | No `corner-shape` support (feature-detect with `@supports`; not every engine ships it) | `border-radius` with the same radius; for fixed-size cards swap in `clip-path: path(shapePath(...))` (§1.2). Corners stay circular-arc: acceptable, never a reason to change the radius ratio |
| 7 | Low memory / Data-Saver (`navigator.deviceMemory ≤ 2`, `Save-Data`, `prefers-reduced-data: reduce`) | **Still gel**: the gel is CSS gradients, keep it. Drop grain, drift, backdrop blur (use opaque plate), and the photographic ground (use the flat `ground`) |
| 8 | Safari | Always write `-webkit-backdrop-filter` beside `backdrop-filter`; `mask-composite: exclude` needs `-webkit-mask-composite: xor` |

---

## 12. Conformance checklist

Binary pass/fail. Each is checkable from a screenshot (S) or by reading CSS (C). `*` = critical.

| ID | Check | How |
| --- | --- | --- |
| I1* | Every surface is exactly one of: matte card, frost plate, gel tile | S |
| I2 | No refraction or specular shine on cards or text plates. Allowed: the iridescent lens rim on circular buttons and the slider thumb, and **edge refraction on a decorative plate (no text) over a photographic ground**, as a Chromium-only progressive enhancement (`backdrop-filter: url()`; elsewhere the plate keeps its blur and bevel). Evidence: the originals show bent, bright edges on decorative plates over photo grounds, never on text plates. The layer: `GlassPlate` refracts only with `tone="decor"`; a text plate never | S |
| I3 | No paired light+dark extrusion shadows as a primary surface | C |
| G1 | Card and tile corners are continuous-curvature (`corner-shape: squircle` or a path), not plain arcs, where supported | C |
| G2 | Matte radius = 0.18-0.26 of the module side | C |
| G3 | One absolute radius shared by wide and square cards in a grid | C |
| G4 | Every pill/chip/tag/search is a stadium (radius = half height) | S |
| G5 | Nested radii are concentric (`r_outer - inset`) | C |
| G6 | Folder tab: 0.38-0.40 W wide, 0.21 H rise, ~0.12 W S-slope, one outline | S |
| G7 | A speech bubble has exactly one flat corner | S |
| S1 | Matte card is opaque, has no blur, no rim | C |
| S2 | Matte shadow ≤ 0.08 alpha and offset ≤ 0.02 H | C |
| S3 | Frost plate has `backdrop-filter` blur 8-40 px with `saturate` | C |
| S4 | Frost rim is a gradient brightest top-left, 1-2 px | S |
| S5 | Frost plate has a lighter lower-edge lip | S |
| S6* | Decorative frost alpha 0.12-0.30; text-bearing light frost either tinted 0.46 over a declared ground (ink text, §10.2 rule 4) or ≥ 0.72 white over any backdrop; dark text plate scrim ≥ 0.8 | C |
| S13 | A tinted plate sits only inside a ground that sets `--lg-ground-tint`; its tint is that ground's own hue, never grey | C |
| S14 | Frost is not milky grey: the hue behind a plate shows through it (saturate 1.3-1.6, fill alpha ≤ 0.6 on a tinted plate) | S |
| S15 | Gel has a 1 px gradient rim (brightest top-left), a lower-edge lip of about 2.5% H and a pale edge wash round the bloom: the tile reads pillowed, not flat | S |
| S16 | A stand-in photographic ground has 4-6 soft blobs, lightness spread ≤ 35 L*, no near-black mass, grain, no `filter`/backdrop layer | C |
| S17 | The dark board's plates carry a 1 px one-hue luminous rim (lit on the glow side, unlit side ≥ 1.6:1) and grain 6-10% that is visible | S |
| S18 | A frost plate sits over a ground with a subject: a hard light/dark edge passes behind it, within the ≤ 35 L* spread (§3.1) | S |
| S19 | White text on a gel only on a deep or luminous ramp (§10.2 rules 2, 2b); the luminous tile keeps the pale rim, ring and lip | C |
| S7 | Each gel tile is one hue family (core and edge within ±25° OKLCH hue) | S |
| S8 | Gel bloom is off-centre and bottom-weighted (y 55-85%) | S |
| S9 | Gel rim is pale and desaturated, 3-6% W; no inner shadow, no hard specular | S |
| S10 | Gel carries 2-4% monochrome grain (or documents the omission under Data-Saver) | C |
| S11* | No text inside the gel rim zone (padding ≥ 0.065 W) | S |
| C1 | At most 3 saturated hue families in a frame outside a gel board; a gel board may use up to 5 colourways, one hue per tile, with nothing else saturated beside it except the one lime (§4 rule 1) | S |
| C2 | One lime accent; not used as light-ground text or as the sole indicator | S |
| C3* | No colour literal outside the token definitions | C |
| C4 | Light ground ≈ #f2f1f1 or dark #121212 with a single-hue corner glow | S |
| C5* | State colours always paired with an icon, word, shape or position | S |
| T1 | Primary Urbanist (or Inter fallback), self-hosted | C |
| T2* | Weight 300 only at ≥ 1.25 rem; no weight 200 | C |
| T3* | Body ≥ 1 rem at ≥ 400; no text under 0.75 rem | C |
| T4 | Sentence case; no all-caps UI labels | S |
| T5 | Title tracking -0.02 to -0.04 em at ≥ 1.5 rem; body tracking 0 | C |
| T6 | Weight contrast (300 vs 500-700) inside at least the hero title line | S |
| T7* | Dot numerals only for primary values, ≥ 1.5 rem, with a real-text twin, `aria-hidden` | C |
| T8 | Unit/delta tag 0.30-0.45 of numeral height and ≥ 0.75 rem | C |
| V1 | Informational strokes ≥ 1.5 px (hairlines 1.2-1.5 only decorative) | C |
| V2 | Dashed forms: dash ≈ gap ≈ 0.012 W | C |
| V3* | Series and state distinguished by more than hue (fill / hatch / dash / label) | S |
| V4 | Halftone/dot fills: dot = 0.6 of pitch | C |
| V5 | Tick ruler: current tick taller and lime | S |
| V6 | Bell bars carry three forms (solid, dashed, dotted) and the form is also in the caption | S |
| V7 | Wires end in a port (folder card: in a notch; node board: a pinched flare); state by label or icon, not hue | S |
| K1* | Every control has a ≥ 44 px hit area | C |
| K2 | Active filter/tab is an inverted solid pill with an extra mark | S |
| K3* | Focus ring: 2 px ring, 2 px offset, 2 px halo on every control | C |
| K4 | Rest/hover/press/focus/disabled all defined | C |
| K5 | NE-arrow actions have an accessible name | C |
| K6* | Every input has a visible label (placeholder is not a label), a `control-edge` boundary at 3:1 (1 px sunk glass; 1.5 px under `prefers-contrast: more`) and a 44 px+ target | C |
| L1 | Gaps: gel `clamp(0.25rem, 0.8cqi, 0.75rem)` (0.005-0.012 W), matte 1.25 rem (§8) | C |
| L2 | Inner padding 0.065-0.08 W | C |
| L3 | Title top-left, action top-right, value bottom-left, chart bottom-right | S |
| L4 | No perspective tilt or DoF blur in the product UI | S |
| A1* | All normal text ≥ 4.5:1 (checked by `contrast-check.mjs` for the tokens) | C |
| A2* | Large text ≥ 3:1 | C |
| A3* | Interactive boundaries and informational graphics ≥ 3:1 | C |
| A4 | Static card edge has hairline/shadow, not value alone | S |
| A5* | No lime text on a light ground; lime graphic has an ink ring | S |
| A6 | No alpha-reduced text on a gel | C |
| A7* | `prefers-reduced-transparency` makes frost opaque | C |
| A8* | `forced-colors` renders borders and system colours, and **every text node's computed colour differs from, and clears 3:1 against, its effective background** (`proof/site/probe-extras.mjs`, Playwright `forcedColors: "active"`, 0 failures) | C, S |
| P1 | ≤ 6 backdrop layers per view (≤ 3 mobile, ≤ 1 over a live canvas) | C |
| P2 | Blur ≤ 40 px | C |
| P3* | No `filter`/`opacity<1`/`mask`/animated `transform` ancestor above a frosted element | C |
| P4 | `will-change` only while animating | C |
| P5 | Degradation ladder §11.2 rungs 1-8 present | C |
| M1* | Springs only; no `@keyframes` in the layer **or in the built CSS of a stamped build** (the stamp strips the template's `tw-animate-css` import and the unused `dialog.tsx`; a build that keeps the dialog records the exception) | C |
| M2 | Overshoot ≤ 6% | C |
| M3* | `prefers-reduced-motion` removes drift, squish and lift | C |
| M4 | Gel drift period 8-12 s on ≤ 4 visible tiles, paused offscreen | C |
| M5 | Press scale 0.97 on spring `press` | C |

**Critic score mapping** (start at 10; apply the lowest cap that matches):

| Fails | Cap |
| --- | --- |
| 0 | 10 |
| 1-2 non-critical | 9 |
| ≥ 3 fails (any) | 8 |
| ≥ 6 fails | 6 |
| ≥ 10 fails | 4 |
| any one critical (`*`) fails | 6 |
| ≥ 2 critical fails | 4 |
| I1 fails (not recognisably this style) | 4 |

---

## 13. Composition recipes

Structures, not copies; no original content, brand or layout is reproduced.

**a. Gel-tile bento dashboard (light).** A 2x2 (or 3-column) butted grid on `ground`, gap 0.5 rem, one hue per tile from the five colourways, ink text. Each tile: title top-left (weight 300, two lines allowed), NE-arrow top-right, primary value bottom-left (numeral + slash unit), a hairline chart bottom-right (dashed/solid/filled silhouette states, ring and filled nodes). Above the grid: a nav of outline pills (active one inverted) and a trio of 44 px glass circles. Optional: one matte card with a lime chip. Max 3 hues.

**b. Frosted file-stack widget over a blurred photograph.** A heavily blurred photographic ground with a hard light/dark edge. Two to three stadium row plates (`frost`, decorative alpha 0.22, rim, lip) stacked with a 0.01 W gap, each with a small flat file glyph at the left and a left-to-right pale tint by file type; text in the **text-bearing frost** (alpha 0.72, ink). A pink or green hue shows only through the ground, plus one lime/white solid element.

**c. Folder-tab drawer.** A folder-tab card (§1.2) as the container: tab holds the title and a count badge; row pills inside (height 0.2 H), ports on the right edge in concave notches, thin wires (1.5 px S-curves) to a second card; wire state carries a label or icon as well as hue. Matte version on a dotted ground, frost version over a photo.

**d. Dark node-board with one-hue glow.** `dark.ground` #121212, panels `panel`, tiles with radius ≈ 0.05; a hero tile carries a corner glow in one hue (green here) plus 6-8% grain; node cards are a double slab (outer 1 px rim plate, inner plate inset 0.03 W) whose rim is lit on the glow-facing sides; hairline wires with pinched port flares; bars use hatch / dot / flat fills; text white on deep or `ink` (dark) on panels; the lime/green is the only accent. **Round 4 details:** the glow is a radial from the bottom-right **corner** (no subject layer: a subject on the dark ground read as a vertical streak); the grain is the layer's contrast-stretched fog tile at 9% (`--lg-grain-img-fog`), measured in the site proof as a pixel stdev on a flat unlit patch (`probe-extras.mjs`); the node card is a **translucent dark green** double slab (the scrim carries 30% of `glowDeep`, alpha 0.8) lit on the glow side; the wires are 1.5 px hairlines with a luminous halo and core that swell mid-wire and fall away to both ends, merging into pinched teardrop flares that sit in **concave notches** cut into the card edge (`GlassPlate notches`); the measured/solid bar is a **green dot halftone** that fades toward the base, drawn against the hatched bars (`FillBars fill="halftone"`); and a **large thin display value** (`DisplayValue`: weight 300 at 3 rem in secondary ink over the figure) sits on the ground instead of a card.

**e. Sky-glass phone app.** A sky gradient behind a translucent steel-blue screen (`sky.screen`), a faint wireframe grid at alpha 0.06; product/score tiles as a vertical sky-to-cream gel (blue top #62a8e6 [e] → sage → cream #e2dcc2 [m]) or as frost tiles (white 0.22 over the screen, lower 40% carries the gradient); hero values in dot numerals with the real value as text beside; a dotted dial or a fading tick ruler with one lime tick; a single opaque white stadium CTA as the only solid element. Accessible version: light plates with ink text, or scrim 0.6 plates with white text (§10.2 rule 4).

### 13.1 Beyond dashboards (round 3)

A brief that is not a dashboard (a product page, a studio, a shop) still has to stay in the language. These sections reuse the three surfaces; none needs a new one.

| Section | Rule |
| --- | --- |
| **Hero, non-dashboard brief** | A ground with a subject (§3.1: pink, cream or sky) under a display title in weight contrast (300 lead-in, 500-700 emphasis, T6); the headline sits on the side away from the figure, on a matte card or a text plate, never on the haze; one solid pill CTA and one lime badge; ONE gel as the proof object (a luminous or vivid tile with a hero number or a chart), not a bento. If the brief has no number to show, use a folder-tab card with real rows instead of inventing a metric. |
| **Pricing** | Plates over a declared ground (cream or mint, with a subject). **Exactly one featured plan is a gel plate** (one hue, with the lime "most chosen" badge); every other plan is a frost **text** plate (ground-tinted, ink, no refraction). The featured price is a numeral, not a dot numeral (a price is read quickly, §5.2). One solid CTA per plate at most, the featured one solid, the others outline. Plan features are text with a check icon (state is never hue). |
| **Contact** | A `GlassInput` form on one frost **text** plate over a declared ground (sky or pink with a subject): visible labels, sunk-glass fields (§7: a soft sunk fill, an inner shadow along the top, a lit rim along the bottom, a 1 px control-edge line kept at 3:1 for WCAG 1.4.11, no heavy outline), a solid submit pill, a status line (`role="status"`) in text. Never inputs directly on the haze, never a placeholder as the label. A matte card is the fallback when the page has no declared ground. |
| **Footer** | Quiet: the plain ground with the dot grid (or a matte card), a row of outline pills for links (44 px), the attribution line, no frost, no gel, no haze. The footer is where the page rests. **The credit line is exactly `By vdWolde`, with `vdWolde` linked to `https://vdwolde.com/`: no year, no copyright sign, no full name on screen (the owner's attribution rule for every personal site).** The layer's `LiquidGlassFooter` is this row and this line; mount it after `<main>` (it is the page's `contentinfo`), not inside it. |
| **FAQ** | Folder-tab drawer accordion: one `FolderTabCard` per question group (tab = group title and count badge), rows are disclosure buttons (44 px, a chevron, `aria-expanded`), the panel slides on spring `sheet` (220 / 21 / 1). Matte on a dotted ground, frost over a subject ground. |
| **Navigation** | Outline pills with one inverted active pill and a check (K2); a search field and glass circles at the right; at most one lime. |

**Section rhythm (round 4).** A page is a stack of boards on grounds; the gaps between them are as much of the style as the surfaces.

| Rule | Value |
| --- | --- |
| Section vertical padding (content to ground edge) | 3-4 rem on mobile, 4-6 rem from `md` up (`py-12 md:py-16` is the default) |
| Gap between two sections' content on **different** grounds | the sum of the two paddings, 6-10 rem at most; a visible ground change is itself the separator |
| Gap between two sections' content on the **same** ground (for example pricing then contact on the plain ground) | 2-4 rem: give the first section `pb-4 md:pb-6` and the second `pt-4 md:pt-6`; never the full padding twice (the round 3 page had a dead void of about 120 px here) |
| Text plates per viewport (1440 x 900) | at most 3 frost text plates, plus one gel stack (up to 4 tiles) or one folder drawer; more reads as a wall of glass |
| Backdrop layers per viewport | 6 (3 on mobile), SPEC 11.1 |
| Max content width | 64-72 rem; text lines 40-44 characters beside a board |
| One composition per section | one folder drawer with its rows, or one bento, or one node board; two competing compositions in a section means one of them goes |

**Worked example: brief to composition.** Brief: "Meridian Labs, a home-sensor product: a page that says what it is, how it works, lets people ask the assistant, shows the price and takes a message." One ground and one tone per section:

| Section | Ground | Composition (SPEC §) | Layer components | Tone |
| --- | --- | --- | --- | --- |
| Overview (hero) | light + dot grid | a (bento, §13a): outline-pill nav, one headline, one solid CTA, one lime badge, a matte setup card, a 2x2 landscape gel stack | `LiquidGlassGround variant="light" dots`, `PillTab`, `GlassIconButton`, `MatteCard`, `GelStack` + `MetricCard shape="wide"`, `PillLink solid` | vivid |
| How it works | haze-pink + subject + hard edge | b + c (§13b, 13c): ONE folder drawer with gel file tiles and two stacked row plates, the steps on one frost text plate beside it | `LiquidGlassGround variant="haze-pink" subject="right" hardEdge`, `GlassPlate tone="auto"`, `FolderTabCard tone="frost"`, `GelTile` | vivid |
| Assistant | dark, one green corner glow | d (§13d): a large thin display value and three-fill bars on the ground, a green double-slab node card with notched ports, luminous wires, a deep gel answer tile | `LiquidGlassGround variant="dark"`, `DisplayValue`, `FillBars` (hatch, dots, halftone), `GlassPlate tone="dark" slab notches`, `WireLayer`, `PortFlare`, `GelTile deep` | deep |
| Pricing | cream haze inside the light ground | §13.1 pricing: exactly one featured gel plate, the others frost text plates | `LiquidGlassGround variant="haze-cream" subject="left"`, `GelTile`, `GlassPlate`, `AccentBadge` | vivid |
| Contact | photo ground (a local image) | §13.1 contact: one strong text plate with sunk-glass fields | `LiquidGlassGround variant="photo" image="/liquid-glass/demo-ground.jpg"`, `GlassPlate`, `GlassInput`, `GlassTextarea` | n/a |
| Footer | light + dot grid | §13.1 footer | `LiquidGlassFooter` | n/a |

Procedure for any brief: (1) list the sections and give each one purpose, one ground (§3) and one composition; (2) fix the one tone per board (§2c table); (3) choose at most 3 hue families per frame (§4 rule 1; a gel board may use 5 colourways, and `add-colourway.mjs` adds a brand hue); (4) put every sentence of text on a matte card or a text plate (§10.2 rule 4), never on a haze; (5) run `node contrast-check.mjs`, build, then run the probes (`proof/site/`: contrast, forced colours, backdrop count, requests, keyframes).

---

## 14. Anti-patterns (where it is easily faked badly)

| Fake | Why it is wrong | Fix |
| --- | --- | --- |
| Grey blur blobs behind a grey card | No chroma: the glass has nothing to refract and the bloom reads as dirt | One saturated hue per gel; the ground has luminance variation |
| Rainbow gradient across a tile | Breaks one-hue-per-tile and the 2-3 hue cap | One hue family with a pale edge; two-tone only in the orange-to-magenta colourway |
| Thick coloured or white borders | The rim is 1-2 px, brightest top-left, fading | Gradient rim + lip |
| Neon glow / coloured outer glow | The only glow is the dark variant's one-hue corner on the ground | Corner glow on the ground, not on cards |
| Heavy drop shadows | Separation is value + rim; shadows ≤ 0.12 alpha | Ambient shadow 0.05 or none |
| Bevel pastiche (picture-frame bevels, inner shadows, glossy specular) | The mitred bevel appeared in 2 posts only; the consensus is pale rim, no inner shadow, no hard specular | Pale desaturated rim wash |
| A milky grey text plate: white 0.72 over a dark-mass ground | The ground's colour is lost, the plate reads as grey paper (the round 1 proof) | Tinted plate: ground tint + white at 0.52, saturate 1.4, over a mid-tone ground |
| A near-black blob as the "photo" | One hard dark mass greys every plate above it and breaks any text outside a plate (1.13:1 measured) | Mid-tone blobs, ≤ 35 L* spread; the dark end is the subject, not the ground |
| Full-opacity glass / a white 0.9 plate called glass | Loses the backdrop | Decorative alpha 0.12-0.30; text plates 0.72 only because text needs it, still with blur and rim |
| Blurring the whole page / a blur on an ancestor | Creates a backdrop root; breaks the frost; heavy | Blur only the plate's backdrop; blur the ground on a sibling layer |
| All cards frosted | Frost needs content behind it; matte is the default surface | Matte for content, frost for floating chrome |
| White text on a pastel gel | The original defect (1.3-2.5:1) | Ink on vivid, white on deep |
| Pure-black or pure-white text | Harsh against the soft ground | `ink` #121214 / #f4f4f6 |
| Dot numerals for everything | Unreadable at small size; 5/6/8/0 ambiguity | Primary values only, with a text twin |
| Perspective tilt and depth-of-field in the product | A photography effect of the showcase screenshots | Flat, sharp UI |
| Apple-style lens refraction on every card | A different style (§0) | Matte/frost/gel only; refraction only on decorative plates (I2) |
| Soft symmetrical blobs with nothing behind the plates (round 2's ground) | A plate straddles no edge, so it reads as frosted paper | The subject layer (§3.1) |
| Pastel gel with white text | The original defect, 1.3-2.5:1 | `tone="luminous"` (jewel ramp) or ink on vivid |
| A refracting or beveled rim on a text plate | Distorts the backdrop under the text and breaks I2 | Refraction on decorative plates only |

---

## 15. Provenance

- Evidence: **22 posts, 79 screenshots** (light 17, dark 2, sky 2, mixed 1), studied in `Projects/Website Builder/playbook/styles/liquid-glass/study/`. Posts: DaAvTqiDEq5, Dc1FdCeDON0, Dc6PietDNcd, Dcyg2r8DPmu, Dd1dTtojJxP, Dd6m6AtjJoE, Dd9MFLLDH43, DdEi9ycDPg0, DdHHLiEDMCL, DdMQqPajF3f, DdWjugcDJyi, DdZIfN1jOle, DdeSSCZjC4v, DdjfCAIDE0a, DdmAhanjMny, DdrKkoHDDPF, Ddtu7uqDBM1, DeCVR68jBEg, DeMptwsDP-a, DePNi7tjD2W, DeR1Y-3jOl8, DeW77zDDLyP. Eight of the screenshots were re-viewed to settle disagreements (a four-gel board, a folder card over a blurred pink photo, a dark node board, a frost counter card, a bento dashboard on a monitor, a sky phone app). The study's existing house material was read for consistency: `styling.md` (flat token set), `synthesis/techniques.md` § frosted glass, `synthesis/degradation-and-a11y.md`, and the design skill's catalog rows `Liquid Glass`, `Glassmorphism`, `Aurora UI`.
- **Round 3 (2026-10-30)** acted on an independent critic's findings (7/10, capped at 6 by M1): the styled stamp's `@keyframes` (M1), refraction on text plates (I2), the four-hue gel board (C1), flat grounds (the subject layer), the missing components (§6.1, §7), the luminous tone (§2c, §10.2 rule 2b), the marketing sections (§13.1) and the stale reference CSS (§2d). Every new number here is [e] unless it cites a post.
- **No brand name, watermark, copy or layout from the originals is reproduced.** Every post shows creator watermarks or third-party marks; the spec cites none. Example copy, names and company marks do not appear.
- **Measured [m]:** hex values taken from palette.json (gel cores, edges, sky, dark ground, studio grounds), aspect ratios read from pixel dimensions (folder 1.65:1, gel tile 1.74:1), the counts of posts agreeing, the OKLCH coordinates computed here from those hexes, the contrast ratios (computed by the script).
- **Estimated [e]:** all radii ratios, alphas, blur ratios, rim and lip widths, shadow numbers, grain amplitude, dot-grid parameters, motion (every motion is inferred: the screenshots are stills), the lime hex #dff30f (the measured lime is #e4eb83), the Urbanist/Inter/Doto matches (shape-matched, not identified), and every policy floor in §10-§11 (alpha 0.72/0.8, perf budgets).
- **Not determined:** the exact typefaces; backdrop saturation (the study does not measure it, `saturate(1.15)` is a policy default); the photographic ground content; whether Doto's roundness axis exists in the build you load; real hover/press/focus states (no post shows them, §7 is designed); the vendor's real animation (none shown); behaviour on a non-white ground for the glass circle button's iridescent rim beyond the one measured post.
- **Known uncertainty:** the study read most radii on perspective-distorted mockups (corners look rounder near the camera); ratios are the consensus, not exact. Dark-variant evidence is 4 posts (2 pure dark). The bevel/inner-shadow variants (2 posts) were deliberately left out as outliers. The accessible ramps change only the violet core of the measured palette; all other adjustments are new tokens (deep ramps, scrim alphas, `inkTertiary`) that do not exist in the originals.
