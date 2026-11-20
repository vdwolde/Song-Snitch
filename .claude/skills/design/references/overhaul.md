# overhaul — analyse the current design, then offer three different ones

One continuous pass that ends with the user choosing. **Nothing in the codebase changes until the user
picks an option and says apply now.** State the Design Read once (SKILL.md Step 2).

**Entry rule:** no real UI yet means there is nothing to overhaul. Say so and run `create` instead.
**Depth:** `full` (default) builds five boards per option. `preview` builds one board per option and is
what `create`'s "show me visually" and a user's "quick overhaul" use. Phases are the same.

## Phase 1 — Analyse, with a baseline

Read [discover.md](discover.md), the UI code and `.claude/DESIGN.md`. Then measure and look:

- **Numbers (report-only):** `design-tools.mjs inventory <ui paths>` (stray literals, near-duplicate
  colours, repeated sizes and radii), `contrast` on the token pairs, and the fingerprint (`inferred` when
  DESIGN.md has none). These counts also price each option in Phase 3.
- **Web:** if a dev server is running, or the project documents its start command, screenshot desktop (1440)
  and mobile (390×844) with chrome-devtools ([verify.md](verify.md) § 1–2). Otherwise read the components
  and say you did.
- **WPF / WinUI / Avalonia:** read the XAML and ask the user for a screenshot. **Never launch the app**
  (Computer Cleaner needs elevation; the user does the double-click).

## Phase 2 — Critique

A short written read, citing the Phase 1 numbers: what works, what does not, what must survive any
redesign (brand assets, content, accessibility constraints). Hierarchy, information architecture,
cognitive load, emotional fit. Include the squint test on the Phase 1 screenshots: shrink them to a thumbnail;
what does the eye land on first, and is it what the screen is for? Is every object the same weight in the same
bordered card, or could this be any product in its category? This becomes the sticky note at the top of the canvas. Do not soften it.

## Phase 3 — Direction matrix, before any design

**House style:** when the user named one or the project falls under the default `vdwolde` style (discover.md § 2), skip the matrix: the spec is the one direction.
State its cost to apply from the Phase 1 counts, confirm scope once, and offer three directions only if the user
asks for alternatives.

Follow [directions.md](directions.md): seed from the product type, choose **all three** directions first,
print the 5-axis matrix, check every pair differs on at least 4 axes. Give each a label (familiar, a step
away, a bet), its cost to give up, and its **cost to apply**, from the Phase 1 counts (components touched,
literals to replace, new dependencies, risk).

## Phase 4 — Content brief

One shared brief so the options are comparable: the app's **real** copy, the screen inventory, and two
**key screens**: the **most-used** one and the **most demanding** one (the densest or hardest: a table, a
form, an empty state). A direction that only works on a hero screen is a trap. No lorem ipsum, no invented
numbers or testimonials; a missing fact becomes `[PLACEHOLDER]`. Write it to a scratch file.

## Phase 5 — Build the three options in parallel

**Set up the canvas first.** Find the Design artifact type (`Artifact` with `action: "list"`,
`scope: "types"`), then publish with its `type_url`, a `title` naming the app, no files, and
`auto_open: "after_first_write"`. `read` its `artifact-type/reference/format.md` and `craft.md` (they
save to the scratchpad). That type's own instructions own the file format; if anything here disagrees with
them, they win.

**Boards per option (`full` = 5, `preview` = 1: key screen 1, large, with a compact system strip):**

| Platform | Large | Small |
|---|---|---|
| Web | page, 1440 wide, `expand: "fill"` | phone 390×844 |
| WPF / desktop window | default window size | narrowest supported window |
| Native mobile | phone 390×844 | tablet 820×1180 |
| Tray / menu utility | menu or popup at 100% | the same at 200% DPI, dark taskbar |

`full` = large 1, large 2, small 1, small 2, and a **visual-system board**: palette swatches with token
names (light and dark if both exist), type scale and pairing, spacing / radius / elevation scale, button /
input / card / nav in every state (default, hover, focus, disabled, error), icon style, a short motion note.
For WPF, label boards "HTML approximation" and list `ResourceDictionary` keys instead of CSS variables.
Every board uses the Phase 4 content.

**Before spawning, save the plan so a cut loses nothing** (SKILL.md § Checkpoints): `save matrix` (the
Phase 3 matrix, labels and both costs), `save content-brief` (the Phase 4 text; also the scratch path),
`save workdir` (the `<root>/project/` path and the saved `format.md` / `craft.md` paths), and `add --group
boards` one item per expected board file (`a-home-desktop`, …).

**Spawn three subagents in one message** (`Agent`, the parent's model, no downgrade: this is judgment
work). One per option. Each brief carries its matrix row and label, the content brief path, the saved
`format.md` / `craft.md` paths, its file names, the sizes above, "write to `<root>/project/`, never
publish", and this output contract: **return only the file paths and one line on the direction. No
preamble, no recap.** Why parallel: the boards would flood the main context, and separate contexts stop
the first idea anchoring the other two. **Each brief also says: write the boards in this order, key screen
first (large, then small), the visual-system board last, and write each file the moment it is finished.** A
usage limit then cuts at most the board being written; every earlier board is already on disk.

File names: start with a letter, only letters, digits, `.`, `_`, `-`, no spaces, unique stems:
`a-home-desktop.dc.html`, `a-detail-mobile.dc.html`, `a-system.dc.html`, then `b-…`, `c-…`. The canvas
needs an entry named `Main.dc.html`: make option A's first board that file.

**Check the files, not the render:** each expected file exists, is non-empty, and makes no external request
that `format.md` does not allow. `done` every board that passes. **A missing or empty board goes back to its
agent once, and the brief names only the boards still missing**, never the whole option again. A usage-limit
reply from an agent is not a result: `fail` that option's missing boards, **stop spawning**, keep every
board already written, and report which boards exist and how to resume. On a resume, `next --group boards`
lists what is missing; confirm each `done` board's file is still there (the scratch folder can be gone in a
new session, and a vanished board goes back to pending) and spawn agents only for the rest.

## Phase 6 — Assemble and publish once

Write `project/canvas.json`: an optional row 0 "Current" (the Phase 1 screenshots, as image boards if
`format.md` allows images, otherwise only the critique sticky), then **one row per option**, boards left to
right, 80px apart. Row pitch about 1500px (boards up to ~1000 tall plus title space plus the 120px row
gap); a `title1` note about 260px above each row ("A — <name> — <label>"); one sticky with the Phase 2
critique above the first row. **Assemble only when every expected board exists** (unless the user asks for
a partial canvas). Publish all files in **one** `Artifact` call (`root` = the scratchpad
folder), then `save canvas` the link at once. In your reply give the link, the matrix, and the cost lines, so
a later session can resume.

**Do not screenshot, render or read the canvas back unless the user asks.** The canvas type says never to,
and the user's review is the verification.

## Phase 7 — The user chooses

One `AskUserQuestion` with two questions: which option (A / B / C / Other) and **apply now / record as
target**. `save choice` the answer straight away: Phase 8 can then run in a later session. **Other is a remix** ("A's palette with B's layout"): read the canvas comments, resolve it axis by
axis, re-check the ≥ 4-of-5 rule against the other options, and publish one refinement round to the same
canvas URL. One round only; after it the user picks.

## Phase 8 — Apply

- **Before applying:** read-only `git status`. If the tree is dirty, say so and recommend committing first;
  never commit it yourself.
- **Apply now:** in slices that each leave the app building: tokens, then app shell, then screens. Register
  each slice as an item (`add --group apply slice-tokens slice-shell …`) and `done` it after its gate passes,
  so a cut resumes at the next slice and the tree is never left mid-slice. Use the
  project's quality gate (`.claude/REVIEW.md`; for WPF `dotnet build`). Web on shadcn: never run
  `npx shadcn init` against a stylesheet with content — scratch project, hand-merge. Ask before any new
  dependency or deleted file. Afterwards rerun `inventory` (report-only) to count leftover legacy literals.
- **Record as target:** change no code.
- **Either way, document:** rewrite `.claude/DESIGN.md` including the new fingerprint, add an ADR whose
  **Rejected** field holds the two unchosen options. For "target" add `Status: target, not applied` to
  DESIGN.md and a row in `.claude/PRODUCT.md`'s known-gaps table.

Finish by suggesting `/design polish` to normalise what the overhaul left behind. Suggest only.

## Done when

- [ ] The matrix was printed first and every pair differs on ≥ 4 of 5 axes.
- [ ] Each option has its boards for the chosen depth, a label, and both costs.
- [ ] No lorem ipsum, invented numbers or emoji icons on any board.
- [ ] Nothing in the codebase changed before the user chose.
- [ ] DESIGN.md and the ADR match what was (or was not) applied.
