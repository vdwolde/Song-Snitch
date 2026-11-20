# craft-checks — the visual details that make a screen look finished

Read by `polish` (Phase 4, audit and fix; Phase 7, micro-polish), `create` (Phase 2, plan; Phase 11, verify) and
`verify` (§ 2 step 10, which runs the geometry audit that finds most of these). They are the small things a
careful designer screenshots and sends back with "what is this?": a word jammed against a card edge, a title
sitting on its subtitle, an icon set that is half filled and half outline. None is a new feature, so `polish`'s
contract allows them. **The vdWolde Brand Guide owns every value it names (spacing scale, radii, type, motion,
no drop shadows); where a number here and the brand disagree, the brand wins. With no brand value, use the
project's own token; the px below are defaults for a project that has neither.**

Adapted from the craft rules of `benjitaylor/skills` › `stageshow` (MIT, © 2026 Benji Taylor), rewritten for
real product UI. Stageshow builds faux marketing illustrations, so its crop, bleed and placeholder-bar rules
are left out on purpose.

## How to run it

1. **Run the audit first** (`verify.md` § 2 step 10). Its check names are in the "Audit" column. A rule with
   no check is walked by eye on the screenshots.
2. **Decide `fits` / `does not fit`** per rule from "Fits when / Never when". A rule that does not fit is not a
   finding; say so in one line.
3. **Every audit result is a candidate.** Look at the screenshot and read the selector's code. A candidate you
   cannot see, or one the design means, is dropped with a reason, never fixed by hiding it.
4. **Fix it once where every caller routes through** (the shared component, the token), not in each caller
   (root `CLAUDE.md` § Coding principles, surgical changes).
5. Report as `selector or path:line — missing/wrong <rule> — severity — fix`. Severity: **High** when it makes a
   frequent screen look broken (text cut off, a control that does not fit its label, a page that scrolls
   sideways); **Medium** when it is visibly rough (uneven padding, mixed icon sets, rows spread to fill space);
   **Low** otherwise.
6. In `polish` and `create`, build the fitting ones in the order of the groups below, with the project's gates
   after each. A fix that needs the back end (copy that fits real data) is a finding for its owner.

## 1. Spacing and alignment (the high-yield group)

| # | Rule | Audit | Check | Fix |
|---|---|---|---|---|
| 1 | Words sit at least 12 px inside the edge of a card, panel or row (under 8 is a defect) | `tight-inset` | Text a few px from a bordered or filled box | Padding from the spacing scale on the shared card |
| 2 | Padding reads even: the top and bottom inset is not much smaller than the side inset, and the bottom of a card gets the same inset as the top | `uneven-padding`, `uneven-inset`, `lopsided` | Content closer to one edge than to the others | One padding value on the component; carry the inset round the bottom |
| 3 | Row padding is 12 px, dense rows 8 px; a one-line row is not three times taller than its words | `fat-row` | Rows far taller than their text | Row padding, not extra air inside the row |
| 4 | A list's gap follows the row, not the pane: rows are not spread to fill the space | `loose-list` | Gap larger than the row | Tighten to the row padding; add content or shrink the pane |
| 5 | A title over its subtitle reads as one item: 4 to 6 px of ink between the lines | `stack-gap` | Lines touching, or two small lines drifting apart | Line-height 1.3 plus a 2 px gap; the row padding gives the air |
| 6 | A button keeps 8 to 12 px from the field, line or card above it | `tight-control` | A button hugging its field | Margin from the scale; a composer's Send sits close under its box |
| 7 | Text never touches a neighbouring box: a fixed `gap` of 8 to 12 px, never what `space-between` leaves over | `touching`, `gap-collapse` | Text 0 to 4 px from a badge, icon or button | Set `gap`; let the flex item shrink the text, not the gap |
| 8 | A dot or badge is not a column: 6 px clear of the text, inside the row's inset | `tight-mark` | An unread dot at the text | Hang it in the gutter or on the avatar |
| 9 | Edges 1 to 3 px apart are an accident: line them up exactly, or part them by a full gutter | `near-tangent` | Two cards whose left edges differ by 2 px | Same container, same left edge |
| 10 | Nested shapes pad evenly, and the outer radius equals the inner radius plus the padding | `double-corner` | A square child poking out of a round card; a pill inside a field off-centre | `overflow: hidden` on the rounded parent, or the radius arithmetic |
| 11 | Columns line up: every row shares one grid template with fixed tracks; optional content keeps its (empty) track | by eye | A column that wobbles from row to row | `grid-template-columns` on the list, not per row |
| 12 | A control hugs its content: no `flex: 1` with the content pushed to one end; fix overflow by fitting the content, not by widening the box | `control-fit`, `spills` | A label wider than its button; a child past its card | Fit the text, then the box |
| 13 | Fixed boxes do not shrink: an icon button or chip in a flex row gets `flex: none` | `squeezed` | An icon button narrower than its label's neighbour | `flex: none` |
| 14 | A label is centred on its letters, not its line box: capitals sit low in a plain line box | by eye, zoom | A label beside an icon that reads low | `text-box: trim-both cap alphabetic` inside `@supports (text-box: trim-both cap alphabetic)` (Chromium only today) with a 1 px padding fallback |
| 15 | A centred amount centres its digits: the currency sign hangs off the left, outside the centring | by eye | `€45` that sits right of centre | The sign absolutely placed at `right: 100%` inside the digit box |
| 16 | Content clears the bar above it by at least the side inset | by eye | A heading just under a toolbar rule | Top padding on the page content |
| 17 | Whitespace groups: a title is closer to its own metadata than to the next record | by eye | Equal spacing everywhere | Group gap smaller than the section gap |

## 2. Type

| # | Rule | Audit | Check | Fix |
|---|---|---|---|---|
| 18 | Fit the text before fixing the box: a control's border box holds content, padding and border | `control-fit`, `clipped` | Text cut or overflowing its container | Wrap, truncate with a tooltip, or grow the box on purpose; never `overflow: hidden` to hide it |
| 19 | Small text keeps a line height of at least 1.3 and an inset on every side | `small-text` | 11 px text with line-height 1 | Raise the line height; brand body text is 14 px or more |
| 20 | Nothing under 10 px, ever; UI text 11 to 15 px, scaled by the project, not shrunk to fit more in | `small-text` | 9 to 10 px "metadata" | Fewer rows, not smaller type |
| 21 | A stat and its unit are one line: `12 min` never wraps the unit onto its own line | `unit-wrapped` | A unit below its number | `white-space: nowrap` on the pair, size the number to the tile, or move the unit to the lead |
| 22 | Figures that update or line up use tabular numerals, from a font that has them (Sora yes, DM Sans no) | `tabular-nums` | A column whose digits shift width | `font-variant-numeric: tabular-nums` on Sora figures |
| 23 | Headings balance, paragraphs avoid orphans | `text-wrap` | A heading with one word on its last line | `text-wrap: balance` / `pretty` |
| 24 | One family for the product; monospace only for code, identifiers and aligned numbers | by eye | Mono on every technical label | Brand pair for UI, mono for code |
| 25 | Copy that fits: pick real names and values whose length suits the layout; no truncated chips, wrapped names or ragged labels | `clipped`, `words-cut` | A chip cut mid-word | Real data in the design, not "John Doe" |

## 3. Icons

| # | Rule | Audit | Check | Fix |
|---|---|---|---|---|
| 26 | One set, one stroke, one size per scene; a toolbar is not half filled and half outline | `mixed-icons` | Filled beside outline; sizes 16, 18 and 20 in one nav | One set from `icons.csv`; one size |
| 27 | Icons of 14 px and under are filled: thin outlines go wiry | by eye | A hairline icon at 12 px | The set's filled variant |
| 28 | An icon is one opaque colour; fade it with `opacity` on the svg, never a translucent ink (strokes that cross paint darker) | `translucent-icon`, `onion-skin` | `rgba` stroke; overlapping translucent avatars | Opaque token; an avatar stack with opaque fills and a ring |
| 29 | A drawing fits its box: nothing cut by the svg edge; an odd glyph in an even box snaps when motion ends | `clipped-glyph` | An arrow whose tip is flat | Fix the viewBox or use the set's glyph |
| 30 | Emoji are content (messages, reactions), never icons | `emoji-icon` | An emoji in a nav item or button | A glyph from the set |
| 31 | No hand-drawn marks and no invented logo: a letter in a coloured square beside a real company's name is a fake | by eye | A made-up "G" tile | The company's real mark from its brand assets, or a plain text name |
| 32 | AI features get no sparkle, wand or star, and no purple as "the AI colour"; show what it does. The product's own mark is fine | by eye | Sparkles on the "AI" button | A plain label that says what happens |
| 33 | Centre glyphs by eye, not by box: shift a play triangle toward its point by a sixth of its width | by eye, zoom | A play button that reads off-centre | A 1 px nudge on that glyph only |

## 4. Colour and depth

| # | Rule | Audit | Check | Fix |
|---|---|---|---|---|
| 34 | One neutral family for window, sidebar and cards; a different surface differs on purpose | by eye | Three greys of three temperatures | One ramp from the tokens |
| 35 | Quiet is not faint: check text, actions and surface against the real ground, in both modes | contrast function (verify § 2.6) | Light grey on white "for calm" | A step darker; run `contrast` |
| 36 | No redundant tonal borders: try the fill alone, add the border for separation, state, or because the product draws it | by eye | A border and a fill and a shadow on one card | Remove two |
| 37 | **Do not outline the hero to point at it.** An accent ring with a soft halo reads as a focus state nobody gave it, and a dot beside its label is a mark with no meaning | by eye | A highlighted card with a glow ring | Lift it the way the product would: its own surface or a label in the accent. A ring is for a field that has focus |
| 38 | A filled button keeps its colour under the pointer: one step of its own colour, never a grey swap | hover screenshot | Hover turns grey | One lightness step of the same colour |
| 39 | Nothing translucent overlaps (avatars, chips, stacked cards) | `onion-skin` | Overlap shows through | Opaque fills |
| 40 | Depth by one mechanism, used everywhere. On a dark theme depth is a lighter surface, not a shadow; **vdWolde has no drop shadows at all** | by eye | Shadows on dark surfaces; two depth systems | Surface steps from the tokens |
| 41 | A gradient or glow serves the story or goes; status colour stays legible and distinct (success, pending, disabled never muddy) | by eye | A glow on a plain card | Remove it |
| 42 | A light pass does not prove dark: screenshot both modes | audit in dark mode | A white card in a dark screen | Token for the surface |

## 5. Hierarchy and density (look at the whole screen, not the details)

| # | Rule | Audit | Check | Fix |
|---|---|---|---|---|
| 43 | **One number gets to be big**; the rest are lines. Say it once: the same fact in header, card and every row is noise | by eye | Three equally loud figures | One display figure; the rest at body weight |
| 44 | **The heaviest mark sits on what the screen is about.** What does the eye land on first, and is it the result? | by eye | The eye lands on chrome or on a decoration | Reduce the loud things, raise the answer |
| 45 | Judge the silhouette first: squint or shrink to a thumbnail. The subject, the support and the empty space make one picture | thumbnail screenshot | A flat grey rectangle, every object the same weight in the same bordered card | One lead object; group the rest; remove boxes before adding them |
| 46 | Space follows the story: the answer gets the room; no empty band mid-pane while the result is pushed down; no void under a list | by eye | A big gap above the result | Move or crop; do not spread rows |
| 47 | Compose objects, not an inventory of cards: hierarchy from proportion, space, material and ground, not more boxes | by eye | Nested bordered cards that all compete | Remove the inner border; use spacing |
| 48 | Over-detail kills the subject: a branch, hash, author, duration and badge on every row makes every row the subject | by eye | Seven pieces of metadata per row | Real detail on the one row that matters, on hover or in a detail view |
| 49 | A top bar with one control and an empty side reads unfinished | by eye | A lonely button in a bar | What the product puts there, or drop the bar |

## 6. Narrow widths: recompose, never shrink

| # | Rule | Audit | Check | Fix |
|---|---|---|---|---|
| 50 | A narrow layout is a second design: crop closer, stack, drop secondary anatomy; keep the action and the result whole. A desktop screen scaled into a phone passes the overflow check while its text becomes unreadable | `small-text` at 390 / 320, `page-overflow`, `words-cut` | Same layout, smaller type | A real small-width layout; text stays at native size, at least 10 px at 320 |
| 51 | A popover, menu or dialog keeps a gutter of at least 16 px from the edge of the visible area, and fits before its first frame | `overlay-room` | A menu against the screen edge | Placement with collision padding |

## 7. Signs of slop (Unslop)

The screen-level tells of generated UI, from [unslop/signs.md](unslop/signs.md). The groups above catch geometry;
this one catches the look. **In a vdWolde project read [unslop/conflicts.md](unslop/conflicts.md) first**: the
brand's backlight, mark, signal, Title Case and token values are not findings.

1. **Find.** Run each "Find it" pattern from signs.md with `Grep` over the UI source in scope (never vendored
   `components/ui/*`, `node_modules` or generated files), then walk the screenshots for the "eye" rows. A hit is a
   candidate: read the line and look at where it renders.
2. **Report** as `path:line — <ID> <sign> — severity — fix`. **High:** a sign on the first screen or the primary
   action (C1, C2, C3, I1, W1, L4, V1, M1). **Medium:** visible on a frequent screen. **Low:** otherwise.
3. **Fix in the pass order** of [unslop/passes.md](unslop/passes.md), each pass across the whole scope before the
   next, with the project's gate after each: spacing, colour, icons, copy, type, layout, details, visuals, motion.
   RTL first when the screen is right to left.

| Pass | Sign IDs | Caught by | Fix with |
|---|---|---|---|
| RTL (first, only for RTL screens) | R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 | Patterns in signs.md, eye | [unslop/rtl.md](unslop/rtl.md) |
| 1. Spacing | S1 S2 S3 S4 S5 | S1 pattern + `inventory`; `audit: fat-row, loose-list, uneven-padding, uneven-inset`; rules 2, 3, 4, 17 above | The brand or project spacing scale |
| 2. Colour | C1 C2 C3 C4 C5 C6 C7 C8 | Patterns; `inventory` clusters for C6; § 4 above | One neutral ramp, one accent (brand: the signal; X1, X2, X5) |
| 3. Icons | I1 I2 I3 I4 I5 | Emoji pattern; `audit: icons`; § 3 above | One set, one size and stroke; status keeps icon and word (X10) |
| 4. Copy | W1 W2 W3 W4 W5 W6 W7 | Patterns; read every visible string | Plain, specific, no exclamation marks; brand casing (X8) |
| 5. Type | T1 T2 T3 T4 T5 T6 | Patterns; `inventory` font sizes; § 2 above | Brand type scale, Sora tabular figures (X7, X9) |
| 6. Layout | L1 L2 L5 L6 L7 L9 P1 P2 P3 P4 | Patterns for L1, L7; eye; template check | Composition rules in passes.md § 6 |
| 7. Details | K1 K2 K3 K4 K5 K6 K7 K8 K9 | Patterns; § 5 above for hierarchy | Radii from the brand (X6), kit icon (X3) |
| 8. Visuals | V1 V2 V3 V4 V5 | Eye on the screenshots | [unslop/visuals.md](unslop/visuals.md); paid generation is a stop (X11) |
| 9. Motion | M1 M2 M3 M4 M5 L3 L4 L8 | Patterns; [motion-checks.md](motion-checks.md) | Brand motion tokens; no looping, no `transition-all` |

Every ID in signs.md appears in this table once; the `/code` design lens (`~/.claude/agents/references/lenses/design.md`
§ UI slop) runs the same patterns on a diff.

## See → do

| You see | You do |
|---|---|
| A void under a list or pane | More real content, or crop the pane. Never spread the rows |
| A one-line row three times taller than its words | Row padding 12 px (8 dense) and more rows; no air inside the row |
| A whole panel floating with even margins in a page that wants it flush | Fill the column or bleed it off an edge |
| Grey blocks where the eye lands | Real words there; filler belongs at the edges |
| A label beside a real value drawn as a bar | Both words, or drop the row |
| A stat's unit on its own line | `nowrap` the pair or size the number to the tile |
| An emoji where an icon belongs | A glyph from one set |
| An icon cut by its box | Fix the viewBox |
| A dot or reaction on the words | Move it to the gutter or the avatar |
| An audit candidate you think the design means | Look again; if it still looks right, say so with the screenshot. Never clear it by hiding the thing |
| Ten audit runs, the report clean, the screen unchanged | Stop. Get a fresh-eye review ([review.md](review.md)) |

## Gotchas learned the hard way

- **The audit's px are CSS px at 1:1.** On a page zoomed or scaled with `transform: scale()`, the real distances
  differ; run it at the real zoom.
- **A fixed header's `padding` is not an inset to the audit's eyes** if the text is centred in a flex row; judge
  the screenshot, not only the number.
- **Ink is not the line box.** The `stack-gap` figure is an estimate (about 1 px) from the font's content area.
- **`text-box-trim` is Chromium-only today:** feature-detect it, keep the fallback, and look in Firefox and Safari
  before claiming the label is centred.
