# Directions — how to pick design directions that really differ

Used by `create` (3 candidates in text) and `overhaul` (3 options built out). The failure this file
prevents: three "options" that are one idea in three colours.

## Seed first

Run discover.md § 4 (product-type lookup) before choosing anything. Its `Primary Style Recommendation`
and `Color Palette Focus` are the **conventional** direction for the category. Its `Anti_Patterns` apply to
every direction. It is a seed, not truth.

## The five axes

Pick one value per axis for each direction, from the catalog or the list below, never from memory.

| # | Axis | Where the values come from |
|---|---|---|
| 1 | **Style** | An `active` row of `styles.csv`. Two styles differ only if they share **at most one term in `Keywords`** *and* differ in `Complexity` (Low / Medium / High) where the catalog allows it. Different `Style Category` alone proves nothing, because every row has its own name. `Era/Origin` is a tie-break only: 16 of the 50 active rows are "2020s Modern". Check the row's `Do Not Use For`, and its Light/Dark Mode columns against the app's light/dark decision. |
| 2 | **Type pairing** | A `typography.csv` row. Directions need different `Category` (Sans + Sans, Serif + Sans, Display + Sans, Mono + Sans, …) and, inside Sans + Sans, a different heading font. |
| 3 | **Colour strategy** | One of: monochrome + one accent · duotone · saturated multi-hue · dark-first with light accents · soft/pastel. Take real values from the `colors.csv` row nearest the product type, then adjust with `design-tools.mjs`. That file has one palette per product type, so it is a starting point, not a family. |
| 4 | **Layout archetype** | **Apps:** sidebar app · top-nav app · command-palette first · master-detail (list + pane) · dashboard grid · single-flow wizard · canvas / workbench · tray + popup (desktop). **Sites:** a `landing.csv` `Pattern Name`. (`app-interface.csv` is mobile guidelines, not layouts.) Different structure, not different spacing. |
| 5 | **Motion tier** | Subtle / Standard / Complex from `motion.csv`. |

## The rule

Any two directions must differ on **at least 4 of the 5 axes.** Print the matrix as a table
*before* designing anything, and check the rule pairwise. If two rows are too close, replace one;
do not nudge it.

## A principled spread (guideline, not a rule)

When nothing else points the other way, make one direction **conventional for the category** (the seed),
one **adjacent** (a secondary style from `products.csv`, a different layout), and one **against the grain**
(deliberately unlike what competitors in this category do, still passing every constraint). Label each so
the user knows what they are choosing between: familiar, a step away, or a bet.

## Ban list

- The lazy trio: "dark technical", "editorial serif", "playful rounded". Use them only if the Design
  Read really points there, and never all three at once.
- Everything in `SKILL.md` Step 3, and the product type's `Anti_Patterns`.
- A direction the constraints rule out. The Design Read's quiet constraints (accessibility-first,
  regulated, public-sector) apply to **all** directions. A direction may be bold; it may not fail
  contrast or ignore the audience.

## Stack limits

- Web on shadcn: every direction must be expressible as shadcn tokens on Base UI.
- WPF/WinUI/Avalonia: no web-only effects (backdrop blur, mix-blend, scroll-driven CSS). Check
  `stacks/wpf.csv` before promising one.

## What each direction gets

A two-to-three word name, the five axis values, its label (familiar / a step away / a bet), one sentence
on who it is right for, and two costs: **what you give up** by choosing it, and **what it costs to apply**
(for an existing app: how many components and literals change, any new dependency, the risk; take the
counts from the overhaul baseline). A direction missing either cost is not finished.
