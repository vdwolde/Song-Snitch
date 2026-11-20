# motion-checks — how things should move, and how to catch the ones that do not

Read by `polish` (Phase 5 and Phase 6), `create` (Phase 7) and `verify` (§ 2 step 11). The tier of motion
(subtle, standard, complex) is decided by the Design Read and `motion.csv`; this file is about **quality inside
the tier**: the failures a user feels without naming them (a menu that jumps, a row that shoves its
neighbours, a label that swaps instead of changing). **The vdWolde Brand Guide owns durations, curves and the
reduced-motion rule (120 / 200 / 300 ms, enter `cubic-bezier(0.2, 0.8, 0.2, 1)`, leave `cubic-bezier(0.4, 0, 1, 1)`,
reduced motion keeps a 120 ms fade); nothing here changes them.** `ux-details.md` § 11 (interruptible
animations) and § 9 (view transitions) are not repeated.

Adapted from the motion rules and the 18 failure pairs of `benjitaylor/skills` › `stageshow` (MIT, © 2026
Benji Taylor), rewritten for product UI. Its cursor, camera, loop and demo-story rules are left out.

## How to run it

1. **Measure before you read code** ([tools/motion-probe.js](../tools/motion-probe.js), `verify.md` § 2 step 11):
   install it, trigger one interaction (open the menu, add the row, submit the form), read the report. It lists
   every animation it saw (infinite loops, layout properties animated, linear easing, long transitions), steps
   in the layout (`jumps`), things that popped in or out (`appearsWithNoEntrance`, `vanishesWithNoExit`),
   popovers whose edges drift (`anchorDrift`) and the browser's layout shifts. Candidates only.
2. **Decide `fits` / `does not fit`** per rule. A purely static screen has no motion findings; say so.
3. **A rule applies only to motion that exists.** Never add a transition to satisfy a rule: this file fixes
   motion that is there, and `create` adds motion only as far as the chosen tier says.
4. **Fix at the shared component** (the dropdown, the toast, the list), not at each use.
5. Report like any finding: `selector or path:line — claim — severity — fix`. **High** when the motion hides
   or moves what the user is aiming at (a menu that jumps under the pointer, content shoved down as you click);
   **Medium** when it reads as glitchy; **Low** when it is taste.
6. Every fix keeps the global reduced-motion rule and a complete result without the movement.

## The checks

| # | Rule | Measured by | Fix |
|---|---|---|---|
| 1 | **Feedback starts on the input.** A press, a toggle or a key answers at once; a presentation delay feels broken. Only story-telling motion is slow | by eye; the animation's `atMs` against your trigger | Remove the delay; transition on the property that changed |
| 2 | **Nothing pops.** Everything that appears has an entrance and everything that goes has an exit; it stays mounted until the exit ends | `appearsWithNoEntrance`, `vanishesWithNoExit` | Mount it and transition `opacity` and `transform`, or `@starting-style`; unmount on `transitionend` |
| 3 | **Content arrives after its container**: a popover's rows fade in once the surface is nearly its size; a pin's number once its circle is full | by eye, slowed | Delay the content a beat behind the surface |
| 4 | **Neighbours make room continuously.** A new row carries the rows below it; it does not shove them in one frame | `jumps`, `layoutShifts` | Animate the containing track's height (or `grid-template-rows: 0fr` to `1fr`), or reserve the space |
| 5 | **A resizing surface moves size, position and content as one transition** and never stretches its text; an interrupted resize retargets from where it is | `jumps` on the surface and its content | Animate the box, keep the text at its size inside a clipped slot |
| 6 | **A changing control changes on itself.** A button whose label or icon changes keeps one element, crossfades the label and eases its width, so its neighbours move with it. Never swap in a second button | `jumps` on the neighbours | One element; `States`-style stacking in one grid cell sized to the largest state |
| 7 | **Text and values that change move or crossfade in a stable slot.** A status word that changes does not snap; a number does not jump width | `jumps` | Crossfade in a fixed-width slot; tabular figures (Sora; DM Sans has none) |
| 8 | **An open surface holds its anchor.** A menu, listbox, popover or sheet is pinned by the edge it opened from; reserve the height of the longest list so it never re-centres while open | `anchorDrift` | Position from the trigger edge; `min-height`; do not centre a surface that can grow |
| 9 | **A popover fits before its first frame**: sized and scrolled before it shows, never correcting its size while opening | `jumps` on the popover | Measure, then show; use the library's placement with collision handling |
| 10 | **Overlays close where they were**: the state is `{ open, at }`, not a nullable position that snaps to 0,0 on close | by eye | Keep the last position until the exit ends |
| 11 | **Solid things do not fade through.** A card, window or sheet arrives by moving (opaque or nearly), not by going half transparent: a see-through panel is a ghost | by eye | Translate with a short fade; no opacity 0.5 holds |
| 12 | **A spinner turns before it is visible** and keeps turning through its fade-out; a spinner stacked over a check is a state bug | `animations` | Start the rotation on mount; one mark from pending to done |
| 13 | **A dashed border never changes size** (draw it at final size on its own layer and fade it) and border-style never transitions | `animations` (border widths), by eye | Fade a dashed `::before` over the solid hairline |
| 14 | **A moving clip edge never slices text.** A collapsing panel fades before and after its height moves | by eye, slowed | Fade the content first; or sequence fade then height |
| 15 | **Text on a transform stays crisp**: keep its layer through the end (`will-change: transform` on that element only, never the page); text that shimmers or steps by a pixel as a transition ends has lost its layer | by eye, zoom | Hold the compositing layer until after the transition |
| 16 | **Only compositor properties animate** (`transform`, `opacity`). `width`, `height`, `top`, `left`, `margin`, `padding` and `font-size` re-layout every frame | `animations.flagged.layoutProperties` | Transform or `grid` track trick; `clip-path`; measure once and animate a transform |
| 17 | **Nothing loops without a reason.** An infinite animation is a spinner or a live indicator, never decoration; a finished state does not keep pulsing (holding a result means stop) | `animations.flagged.infinite` | Run once; stop at the end state; honour reduced motion |
| 18 | **One easing for entering, one for leaving, chosen from the tokens** (brand: enter and leave curves above); a bare `linear` on a UI movement reads as mechanical; ease-in on an entrance feels slow | `animations.flagged.linearEasing` | Token easing; `linear` only for progress and spinners |
| 19 | **Durations by job**: direct feedback 120 ms, a small change 200 ms, a surface 300 ms (brand tokens); a UI transition over 500 ms is a slideshow | `animations.flagged.longTransitions` | The nearest token |
| 20 | **Related responses overlap**; groups stagger in reading order 40 to 80 ms apart (80 to 120 ms between tiles of a grid); one object enters whole | by eye | A small `transition-delay` per item, capped (a 12-row list staggers its first 6) |
| 21 | **Colour changes between distant hues take about 200 ms**; they pass through mud however they are done | by eye | Let the label carry the slower movement |
| 22 | **A selection, tool or filter the click sets eases in** (about 150 ms) and eases out the same way; it never switches on in one frame. A set where one is chosen and the choice moves is a segmented control whose highlight slides | `jumps` | Transition `background` and `color`; one sliding highlight element |
| 23 | **A carried item is held, not slid**: it keeps the grab offset, follows the pointer with no transition, lifts (a step in surface lightness on dark, since the brand has no shadows) and settles flat on drop; drop targets never travel | `jumps`, by eye | `transform` from the pointer; a slot that opens in place |
| 24 | **Scrolling content fades only the edges that hide content**, starts with whole rows, and clears the fade at the end | by eye | Edge masks toggled by scroll position |
| 25 | **Reduced motion keeps a complete result.** The final state shows, only without the movement (brand: a 120 ms fade); nothing is blank or half-entered | `emulate prefersReducedMotion: reduce`, screenshot after the interaction | One global `prefers-reduced-motion` rule; a still that tells the story |
| 26 | **A stepped clock proves geometry, not frame rate.** Say which browser and throttling you measured; a smooth report at 1x says little about a mid-range phone | the probe at `cpuThrottlingRate: 4` | Report both runs |

## See → do

| You see | You do |
|---|---|
| A menu that re-centres or hops when its list grows | Pin the opening edge; reserve the height |
| Content shoved down the moment a banner or row arrives | Animate the track's height or reserve the space; keep the user's target still |
| A button label that snaps and the button next to it that jumps | One button, crossfade, ease the width |
| A card that fades to half opacity while it moves | Translate it opaque, fade only the last 100 ms |
| A skeleton, toast or panel that appears at once | Mount it and give it the token entrance; unmount after the exit |
| An infinite pulse on a finished state | Run once and stop |
| A report with no findings and a screen you have not watched | Watch the interaction once at normal speed and once slowed before saying it is fine |

## Gotchas learned the hard way

- **The probe only sees the interaction you trigger.** A clean report on page load says nothing about the menu.
- **A CSS animation's easing lives on its keyframes**, not on the effect: read it per keyframe (the probe does).
- **`prefers-reduced-motion` is not `animation: none` everywhere.** Zeroing the duration of an animation that
  hides content on `animation-fill-mode: backwards` can leave the content invisible; check the result, not the rule.
- **`will-change` on a large ancestor** spends memory and can blur text; keep it to the one moving element and
  remove it afterwards.
- **View transitions** are not caught by the probe's per-element boxes (`ux-details.md` § 9 has their rules).
