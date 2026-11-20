# Unslop passes: audit, direction, nine passes, check

Read by `/design` `create`, `improve` and `polish` (SKILL.md § Step 3 and Step 5), and by the design reviewer
([../review.md](../review.md), [../craft-checks.md](../craft-checks.md) § 7). It is how a screen that looks
generated becomes one that looks designed: the features, content and order of sections stay; every size, colour,
word and image becomes deliberate.

**In a vdWolde project, [conflicts.md](conflicts.md) is read first and wins over every value below.** Values here
are Unslop's defaults for a project with no brand and no tokens of its own; [tokens.md](tokens.md) holds them.

Removing slop is half the job. A screen that is clean but could belong to any product is the next template, so
every run ends with a screen only this product could have. The difference between slop and craft is where the
richness goes: slop spreads colour and effects over the chrome (backgrounds, buttons, borders, labels); craft keeps
the chrome quiet and puts the richness into one or two moments of content.

## What good looks like

- **One bright element.** Each screen has one polished thing that carries the colour and the craft: a rendered
  object, a painted scene, a rich chart. Everything around it is quiet.
- **Quiet chrome.** Navigation, buttons and text use the neutrals and one accent (the brand's signal). Nothing glows.
- **A clear idea.** You can say in one sentence what the visual shows and why it belongs to this product.
- **Text on calm space.** The headline sits on space left empty for it, with one primary and one secondary action.
- **Real product, real material.** Previews look like the real app with plausible data.

Finished examples: [refs.md](refs.md). Visual styles that work and fail: [visuals.md](visuals.md). Code treatments
for an image: [effects.md](effects.md). A presentation video of the passes: [story.md](story.md).

## Run it

1. **Look at the screen.** Find the files that render it, run it, take before screenshots into the project's
   gitignored `.state/` (desktop 1440 and mobile 390; both modes where the app has them). Only a live URL? Save it
   with `node ~/.claude/skills/design/tools/design-tools.mjs snapshot <url> .state/unslop/original.html [--dark]`,
   which also writes `original.live.png`; work on a copy. Only a screenshot? Rebuild it as one static HTML file
   first. In both cases the result is a redesigned page to hand to whoever owns the real site; say so.
   Learned on the 2026-11-15 runs: `snapshot` cannot log in, so a page behind a login needs a short Playwright script
   that fills the form first (the project's dev password, seeded dev data, never real records). Start servers from the
   shell, never the `.bat`, and in a quiet mode where the app offers one (no browser pop-up). In Git Bash, prefix
   `MSYS_NO_PATHCONV=1` when a route argument starts with `/`, or it is rewritten into a Windows path. Screens behind
   an outside login (a Spotify room) are audited from code only; say so under "Not checked".
2. **Audit.** Walk [signs.md](signs.md): run its "Find it" patterns over the UI source, then walk the screenshots
   for the "eye" rows. One line per sign: `path:line — <ID> <sign> — <fix>`. Arabic, Persian, Urdu or Hebrew:
   read [rtl.md](rtl.md) first; its rules win where they differ.
3. **Decide how much to change.**
   - **Heavy slop** (many signs across colour, type, icons, copy): the full process below.
   - **Light slop** (mostly designed, a few signs): polish only what the audit found. Take the direction from the
     existing brand, keep palette, type, layout and visual. Bigger ideas go into the report as suggestions.
     **A vdWolde project is always at most this**, since its brand is the direction.
   - **No slop:** say so, suggest two or three refinements with exact values, apply them only if the user agrees.
     Never change a good screen to make it different.
4. **Set the direction and stop.** Write it (below), show the audit and the direction, and wait for the user before
   editing (`AskUserQuestion` when available). Skip the wait only when the user already said to just do it.
5. **Fix in nine passes, in order.** Finish a pass across the whole screen before the next. When nearly every line
   changes, plan the passes in order and write the screen in one go, as long as every pass is applied. Spacing comes
   first because everything reads differently once the rhythm is right; copy before type and layout because the
   headline's length decides its size; visuals and motion last because they must fit a screen that already works.
6. **Check.** The checklist at the end, render again, compare with the audit list. Anything still on it gets fixed.
7. **Report** the direction, a few lines per pass, and any image prompt written. Then the project's gate.

Keep a run quick: render to check at most three times. Start an approved image generation right after the
direction is confirmed and keep doing the first passes while it runs.

## Direction

Five short lines, derived from what the page says the product does and for whom. Never from what is trending.

- **Product.** What it does and for whom, in one plain sentence.
- **Character.** Two or three concrete words (`calm, exact, a little warm`). Clean, modern, sleek, minimal and
  premium are not allowed: they describe every template.
- **World.** The place or material the product belongs to. It sets the tint of the neutrals, the accent and the visual.
- **Moments.** One or two places that get rich colour, material and detail, chosen from what the product shows.
- **Signature.** One small detail only this product has, used consistently. One, not five.

**In a vdWolde project** Character and World are given by the brand (graphite, the app's signal, the backlight), so
write only Product, Moments and Signature, inside the brand (conflicts.md X4). If the product has a real brand
(logo, colour, typeface that is not slop), keep it; a violet-to-blue gradient, sparkles and glow are slop even in a
logo, unless the user says otherwise.

## 1. Spacing

- Everything on a 4 px grid (brand: the brand scale). Equal things share one size: list rows one height and gap,
  sibling cards one padding.
- Space shows grouping: smaller inside a group than between groups.
- Things line up: icons in one column, labels on one line, numbers right-aligned in one column; no stray nudges.
- Padding follows density: compact panels ~16, cards 20 to 24, page edges 24 to 32.
- Navigation is the densest part: rows 32 to 36, 2 to 4 apart, a section label closer to its items (24 above, 8
  below). Measure the sidebar after the pass; it is where spacing breaks most.
- Replace one-off values (`mt-[13px]`) with steps from the scale. On a tie (6, 10, 14), padding rounds **up**
  (insets need air) and margin or gap rounds **down** (tighter grouping); 1 and 2 px hairline nudges stay. A whole
  stylesheet is snapped in one scripted pass with a dry run first, never by hand (added 2026-11-15 from the Trash
  Scraper run: 166 of 346 values, none of them caught by the Tailwind-only pattern).

## 2. Colour

- One neutral ramp for background, raised surfaces, borders and text (brand: `neutral-*`). In apps the surfaces stay
  neutral; the content carries the colour.
- Three text roles: primary, secondary, muted.
- One accent in the chrome, used rarely (brand: the signal on the primary action, active state and focus ring).
- Inside the moments colour can be rich, as long as each colour means something.
- Text on the accent reaches 4.5:1; accent as text uses a deeper shade (brand: rule 4 shades per mode).
- Semantic colours only carry meaning, toned to sit in the palette (brand: red is danger only).
- Remove hue gradients on surfaces, gradient text, coloured glows and shadows, radial washes, neon borders (brand
  exception: the one backlight, X1).
- Borders are hairlines at 6 to 10% of the primary text colour. Depth on dark comes from surface steps and
  hairlines (brand: elevation by lightness, no drop shadows).
- A gradient is allowed only as a small tone shift inside one neutral.

## 3. Icons

- Every emoji used as an icon or decoration becomes a line icon from one set: the project's own, otherwise lucide
  (adding it is a dependency: ask).
- One size and stroke everywhere (16 or 18 px, 1.5). Icons take the colour of their text role.
- Fixed icon box width and gap to the label (8 or 10), so labels align.
- Drop icons that add nothing. Status keeps an icon and a word (brand rule 7; X10).

## 4. Copy

- Headlines say what the product does for whom, from the facts on the page; never invent new ones.
- No exclamation marks; no greeting headlines (the page name or period as the title).
- Short labels (`Search`). A change says what it compares to (`+12% vs last month`).
- Headlines, labels, buttons and captions end without a period; multi-sentence paragraphs keep theirs.
- No hype words, no `AI-powered` on everything. Unverifiable claims: ask the user, then quiet and specific, or gone.
- Mock data looks real; badges like `PRO`, `New ✨` go unless needed, then as quiet text.
- Brand: casing per rule 8 (X8), UK English, one language per app (Dutch in Finance Dashboard).

## 5. Type

- Type chosen for the character (brand: Sora + DM Sans, never swapped; X9). One family plus at most one partner.
- A few sizes from a scale, weights 400 and 500, 600 for rare emphasis (brand: the type scale; X7). No gradient text.
- Hierarchy from size and colour, not weight. Sentence case for labels; no uppercase tracked labels.
- Small text never gets negative tracking. Numbers use tabular figures and one format (brand: Sora tabular).
- No italic for emphasis.

## 6. Layout

- Keep the sections and their order; inside a section alignment and proportions may change.
- Apps keep app proportions: the shell fills the viewport, sidebar 240 to 280, fluid content capped ~1440 to 1600.
  Never shrink an app into a narrow centred column.
- The strongest landing hero is a scene with the headline on its calm part and the product view rising from the
  bottom edge; without a scene, an asymmetric split. Stacked-and-centred only for a short hero with no visual.
- Long headlines align left. One primary action, at most one secondary.
- Navigation quiet: logo, the existing links, one button; Log in a quiet text link. Links collapse on small screens.
- Compose the first screen as a whole: no dead empty band.
- On small screens everything stacks in reading order; a dense preview gets simpler, never zoomed; no text under 11 px.

## 7. Details

- Nested radius: inner = outer − padding, never under 4 (brand radii: X6). Not everything is a pill.
- Counts and meta as quiet text, often mono and muted. Shortcuts as small keycaps.
- Charts on a muted grid with muted mono labels; one main chart is clearly the biggest thing; one accent per chart,
  the rest in neutral steps; chart type fits the data (trend line, comparison bars, share stacked bar or list).
- Stat cards are numbers: label, figure, change with its reference. No sparklines or icons added to fill them.
- Vary the sizes: equal cards side by side read as a template.
- Active state: a small surface step with a hairline highlight. Hover and focus states exist, inside the palette,
  with a visible focus ring (brand rule 9; X12).
- The logo is the product name plus a simple mark (brand: the kit icon; X3). The signature appears where it
  belongs and nowhere else.

## 8. Visuals

- Decorative filler goes: blobs, orbs, nebulas, floating cubes, glowing grids, brains, robots.
- A landing hero gets a visual that shows something true. Dashboards and app screens almost never need a generated
  image: their moments come from the product (a chart drawn with care, figures set well, real content).
- Generate images for an app only for empty states, onboarding and marketing moments, or when asked. Generation
  that costs money is a stop: ask first (X11).
- Before this pass, look at [refs.md](refs.md). Take qualities, never subject or layout. Recipe: [visuals.md](visuals.md).

## 9. Motion

- Remove motion that loops for no reason, `transition-all`, bouncy springs, `hover:scale` on cards, anything that
  moves more than a few pixels on hover.
- Keep motion that explains: a quick colour or surface change on hover, a tiny scale on press, a menu that fades and
  rises a few pixels, a changed number that tweens.
- Name the transitioned properties (`transition-colors`, `transition-[transform,opacity]`); never animate width,
  height, top, left, margins or large blurs. A progress fill moves to `transform: scaleX()` with `transform-origin:
  left`, unless it carries moving stripes or round ends that a scale would squash; a bar rebuilt with `innerHTML` on
  every change never ran its transition, so drop it. The one exception is an element whose job is to push its
  neighbours (a pull-to-refresh gap, a search box opening in a toolbar): keep `width`/`height` with a `debt:` comment
  naming the trigger to revisit.
- One easing curve and a few durations (brand: the motion tokens; X6). At most one entrance on load.
- Reduced motion keeps a 120 ms fade (brand rule 9).

## Do not

- Rename the product. Keep a real logo; redraw only a slop logo, and never the brand's kit icon.
- Change what the product is: features, content, section order stay unless the user asks.
- Replace removed decoration with new decoration, or swap one trend for another (glass, grain, neon, bento).
- Invent features, claims or data (root `CLAUDE.md` § Data handling).
- Fall back to the same look for every product. In a vdWolde app, the shared palette and type are the brand; the
  layout, moments and signature still come from the product.

## Checklist

- [ ] Direction written (inside the brand where there is one) and every pass follows it
- [ ] Every spacing value on the scale; equal things have equal sizes
- [ ] Icons, labels and numbers each in one aligned column
- [ ] One neutral ramp, three text roles, one accent with enough contrast
- [ ] No hue gradients, gradient text, glows, coloured shadows or colour blobs (brand backlight excepted)
- [ ] No emoji left in the interface; one icon set at one size and stroke
- [ ] Type from the brand or chosen for the character; no uppercase tracked labels, no italic, no negative tracking on small text
- [ ] RTL screens follow [rtl.md](rtl.md)
- [ ] No exclamation marks, no trailing periods on short strings, no greeting headline, no unverified claims
- [ ] Numbers in one format with tabular figures
- [ ] Nested radii add up; buttons share the control radius
- [ ] Table row states read apart: header, value in use, selection and keyboard focus
- [ ] A hero has a real visual or a product preview with a moment, never filler or a labelled placeholder
- [ ] The first screen is composed as a whole, no dead band
- [ ] No looping or bouncy motion, one easing curve, no animated layout properties
- [ ] Template check: swap the product name for another's. Would the screen still fit? Then push the copy, the
      moments and the signature harder

---

Adapted from unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. Changes: see [README.md](README.md).
