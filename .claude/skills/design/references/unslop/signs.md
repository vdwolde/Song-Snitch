# Signs of slop

The audit list. Go through every group and note each sign found as `path:line — <ID> <sign> — <fix>`. Each sign
has an ID that `review.md`, `craft-checks.md` § 7 and the `/code` design lens cite, so a finding names the same
sign everywhere.

**Find it** is a ripgrep pattern (the `Grep` tool) that turns up candidates in code. A hit is a candidate, never a
verdict: read the line, and look at the screenshot where it renders. "eye" means no pattern finds it reliably; walk
the screenshots. `audit:` names a check of `tools/ui-audit.js` (verify.md § 2 step 10), `inventory` the
`design-tools.mjs inventory` command. Run the patterns over the UI source only (`*.{tsx,jsx,ts,js,html,css,vue,svelte}`),
never over `node_modules`, vendored `components/ui/*` or generated files. Inside the tables `\|` is the regex `|`,
escaped for markdown: type `|` when you run it.

**Brand** names where the vdWolde Brand Guide changes the fix; [conflicts.md](conflicts.md) has the reason. In a
vdWolde project the brand's value always wins over the fix in this list.

## Surfaces and colour (C)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| C1 | Hue-to-hue gradients (purple to blue, violet to pink) on backgrounds, cards, buttons, the active nav item | `(from\|via\|to)-(purple\|violet\|indigo\|fuchsia\|pink)-\d\|linear-gradient\(` | One neutral surface; the accent only where it means something | The one backlight on the root surface is brand, not slop (X1) |
| C2 | Gradient text in headings, numbers or the logo | `bg-clip-text\|background-clip:\s*text\|text-fill-color:\s*transparent` | Solid primary text colour | |
| C3 | Coloured glows: `shadow-[0_0_20px_…]`, drop-shadow on emoji, glowing pills | `shadow-\[0_0_\|drop-shadow\|text-shadow\|box-shadow:[^;]*\b0 0 \d+px` | Remove; depth from surface steps and hairlines | The "vdW" mark's six-colour glow is brand (X2) |
| C4 | Radial colour washes or blurred blobs behind content | `radial-gradient\|blur-(2xl\|3xl)\|filter:\s*blur\(\d{2,}` | Remove | Except the brand backlight (X1) |
| C5 | Neon or high-contrast coloured borders | `border-(purple\|violet\|fuchsia\|pink\|cyan)-[3-5]00` | Hairline: primary text at 6 to 10% | Hairline token from `tokens.css` |
| C6 | Many near-identical tints of one hue for text (five lavenders) | `inventory` (near-duplicate colour clusters) | Three text roles from one neutral ramp | `neutral-*` tokens |
| C7 | Everything highlighted, so nothing stands out | eye | One accent, once or twice per screen | One signal per app: primary action, active state, focus ring (X5) |
| C8 | Glass cards: white inner highlight plus a coloured shadow | `backdrop-blur\|backdrop-filter` | Plain raised surface with a hairline | Liquid Glass is opt-in by name only |

## Type (T)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| T1 | Headings at weight 800 or 900 | `font-(extrabold\|black)\|font-weight:\s*(800\|900)` | 400 to 500, size for hierarchy | The mark is Sora Bold; brand weights from the type scale (X7) |
| T2 | Uppercase labels with wide tracking (`NAVIGATION`, `PAID THIS MONTH`) | `uppercase\|text-transform:\s*uppercase\|tracking-(wide\|wider\|widest)` | Sentence case, normal or slightly open tracking | Title Case for names and titles, sentence case for labels (X8) |
| T3 | Too many sizes and weights on one screen | `inventory` (font-size literals) | A few sizes from the scale, weights 400 and 500 | The brand type scale |
| T4 | Numbers in mixed formats (`$48,210` next to `$124,860.40`, `07`) | eye; `toFixed\(\|toLocaleString\(\|Intl.NumberFormat` | One format, tabular figures | Sora tabular figures; `-€ 3,00` (X9) |
| T5 | Negative letter spacing on small text | `tracking-(tight\|tighter)\|letter-spacing:\s*-` | 0 or slightly positive under 16 px | |
| T6 | Italic for emphasis | `\bitalic\b\|font-style:\s*italic\|<em>\|<i>` | Colour or weight | |

## Icons (I)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| I1 | Emoji as nav icons, label decoration or status (🏠 📥 🚀 💰 ⚠️ 📈 🔥) | `[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]` | One line icon set, or nothing | Status keeps an icon **and** a word (X10) |
| I2 | Emoji in pills and counts (`18 👤`) | as I1 | Plain number | |
| I3 | Icons in many sizes and colours | eye; `size=\{?\d+\|(h\|w)-\d+ (h\|w)-\d+` near icons | One size, one stroke, text-role colour | |
| I4 | Icons nudged off the column | `translate-[xy]-\[\|-m[tl]-\[`; `audit: icons` | Same icon box width in every row | |
| I5 | A sparkle ✨ for anything AI | `Sparkle\|✨\|Wand` | Remove, or a plain icon where it explains something | |

## Spacing (S)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| S1 | Arbitrary values (`mt-[13px]`, `h-[31px]`) off the 4 px grid | `-\[\d+px\]`; plain CSS: `(padding\|margin\|gap)[a-z-]*:[^;]*\d+px`, then keep the values that are not a multiple of 4 | Steps on the scale; on a tie, padding rounds up and margin or gap rounds down ([passes.md](passes.md) § 1) | Brand scale 4 8 12 16 24 32 48 (X6) |
| S2 | Rows in one list with different heights or gaps | `audit: fat-row, loose-list` | One height, one gap | |
| S3 | Groups closer to their neighbours than to their own items | eye (craft-checks #17) | Smaller gaps inside groups, bigger between | |
| S4 | Uneven padding inside sibling cards | `audit: uneven-padding, uneven-inset` | One padding | |
| S5 | Big empty gap above a section, cramped below | eye | Balanced rhythm | |

## Copy (W)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| W1 | Greeting headlines (`Welcome back, Damir! 👋`) | `(?i)welcome back\|welkom terug\|hey there\|good (morning\|afternoon\|evening)` | The page or the period as the title | |
| W2 | Exclamation marks, `!!` | `[A-Za-z)]!+["'\x60<]` | Plain statement | Rule 8 already forbids them |
| W3 | Changes with no reference (`+12%!!`) | `[+-]\d+(\.\d+)?\s?%` (then look for "vs") | `+12% vs last month` | |
| W4 | Wordy placeholders (`Search anything...`) | `placeholder=["'][^"']*(\.\.\.\|…)` | `Search` | |
| W5 | Hype words (supercharge, seamless, unlock, magic, revolutionise, game-changing, AI-powered) | `(?i)supercharg\|seamless\|unlock\|magic\|revolution\|game.?chang\|ai.powered\|effortless` | What the thing does | |
| W6 | Trailing periods on labels and buttons | `>[A-Z][^<.]{0,40}\.<` | None | |
| W7 | Fake-looking data (`$123,456`, `[X]`, lorem) | `123,?456\|\[X\]\|(?i)lorem ipsum\|john doe` | Plausible numbers | Never invent data in a real app (root CLAUDE.md § Data handling) |

## Components (K)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| K1 | Glowing pills for counts, plans, shortcuts, status | C3 pattern on a `rounded-full` element | Quiet mono text or a keycap | |
| K2 | `PRO`, `New ✨`, `Beta 🚀` badges everywhere | `>\s*(PRO\|NEW\|New\|BETA\|Beta)\b` | Remove, or one quiet text badge | |
| K3 | Every element a full pill (search, buttons, cards) | `rounded-full\|rounded-3xl\|border-radius:\s*9{3,4}px` | Radius by size, nested radius maths | Chips are pills; controls 8, cards 14 (X6) |
| K4 | Charts with rainbow, glowing or pill-shaped bars, uppercase day labels | eye; `COLORS\s*=\s*\[` | One or two series, muted grid, mono labels, one highlight | The signal is the highlight (X5) |
| K5 | Every chart in several shades of the accent, so nothing leads | eye | Neutral steps; the accent on the one thing that matters | |
| K6 | Sparklines, tallies or mini bars in every stat card | eye; `Sparkline\|<Area\|<Line` inside a stat card | Label, figure, change | |
| K7 | Equal cards side by side, each with the same chart | eye; `grid-cols-[34]` | One main chart, compact stats, varied widths | |
| K8 | Logo as a gradient tile with a sparkle and a gradient wordmark | C1, C2 in the logo component | Name as text plus a flat mark | The kit icon from `Branding/icons/<slug>/`, never redrawn (X3) |
| K9 | Logo mark as a glossy orb or glowing dot | eye | Flat glyph, one colour, or the wordmark | As K8 |

## Landing pages and heroes (L)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| L1 | Pill badge above the headline (`✨ Introducing X 2.0`) | `(?i)introducing` | Remove, or a quiet text link if it is real news | |
| L2 | A headline that fits any product | eye | What it does, for whom, with its own nouns | |
| L3 | Gradient or shimmer on the headline | C2; `animate-(shimmer\|gradient)` | Solid text | |
| L4 | Floating blobs, orbs, grids, glowing lines behind the hero | C4; `animate-(float\|blob)` | Plain background or one real product visual | |
| L5 | Everything stacked and centred | eye | Asymmetric split, or text over a large product view | |
| L6 | Three or more buttons, or chips and avatars under them | eye | One primary, at most one secondary | |
| L7 | Unsourced social proof (`Trusted by 10,000+ teams`, star rows) | `(?i)trusted by\|loved by\|\d[\d,.]*\+\s*(teams\|users\|customers\|companies)\|★` | Ask if real; quiet and specific, or remove | |
| L8 | Parallax, elements floating on scroll | `(?i)parallax\|useScroll\|scrollY\|data-speed` | Static layout | |
| L9 | Feature cards with an emoji, bold title, vague line | I1 | Fewer features, concrete copy, line icons or none | |

## Visuals (V)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| V1 | Glossy 3D blobs, orbs, liquid chrome, purple nebula as the hero | eye | The product, or one concrete metaphor | |
| V2 | Stock robots, glowing brains, circuits, holograms for AI | eye | Remove, or show what the AI produces | |
| V3 | Text, fake buttons or a fake logo baked into an image | eye | Real text in the page, a clean image | |
| V4 | An image with a hard edge and a different black | eye | Edges matched to the page, soft mask | |
| V5 | A visual on every section | eye | One visual where it helps, usually the hero | |

## Motion (M)

| ID | Sign | Find it | Fix | Brand |
|---|---|---|---|---|
| M1 | `animate-pulse`, `animate-ping`, breathing glows on things that are not live | `animate-(pulse\|ping\|bounce)\|@keyframes\s+\w*(pulse\|glow\|breath\|float)` | Static | The backlight is never animated (rule 3) |
| M2 | `transition-all` and `hover:scale` on cards and buttons | `transition-all\|transition:\s*all\|hover:scale-` | Colour or surface step on hover, tiny scale on press | |
| M3 | Bouncy springs and overshoot on simple UI | `(?i)spring\|bounce\|cubic-bezier\([^)]*,\s*1\.[1-9]` | One ease-out curve | Brand enter/leave curves (X6) |
| M4 | Everything flying in on load from different sides | eye; `motion\.\|initial=\{\{\|animate-(in\|slide)` | One short fade and rise, small stagger | |
| M5 | Animating width, height, top or left | `transition(-property)?:[^;]*\b(width\|height\|top\|left\|margin)\|transition-\[(width\|height)` | Transform and opacity | |

## Right to left (R)

Only for a screen that is, or should be, Arabic, Persian, Urdu or Hebrew. Fixes in [rtl.md](rtl.md).

| ID | Sign | Find it |
|---|---|---|
| R1 | No `dir="rtl"` and `lang` on the root; Arabic aligned left | `<html(?![^>]*dir=)` |
| R2 | Sidebar, logo and back arrow still on the left | eye |
| R3 | Physical properties: `ml-*`, `mr-*`, `left-*`, `text-left` | `\b(ml\|mr\|pl\|pr)-\|\btext-(left\|right)\b\|\b(left\|right)-\d` |
| R4 | Directional icons not mirrored | eye |
| R5 | Progress bars filling from the left | eye |
| R6 | Letter spacing on Arabic | `tracking-\|letter-spacing` |
| R7 | Fake italic or bold, or a Latin font falling back | eye |
| R8 | Cairo or Tajawal on everything with nobody choosing | `Cairo\|Tajawal` |
| R9 | Western and Arabic-Indic digits mixed | `[\x{0660}-\x{0669}\x{06F0}-\x{06F9}]` |
| R10 | Bidi breaks (`12%+`), tight line height clipping marks | eye |
| R11 | Latin punctuation, Arabic hype and greetings, effects on scripture | eye |

## Template look (P)

Not slop, but what a cleaned-up screen falls back to when nobody decided. Check after the passes.

| ID | Sign | Fix |
|---|---|---|
| P1 | Pure grey page, Inter, white text, the old colour on one button | In a vdWolde app: the brand graphite, Sora + DM Sans, the app's signal. Elsewhere: a ramp tinted to the world |
| P2 | A headline that fits another product if you swap the name | Say what this product does, with its own nouns |
| P3 | A hero visual that is an empty box or a generic picture | A product preview in code, or an image from the world |
| P4 | Every product with the same layout, type and palette | In a vdWolde app the palette and type are shared by design; the layout, moments and signature are not |

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. Changes: see [README.md](README.md).
