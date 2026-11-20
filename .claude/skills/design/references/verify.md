# verify — look at it, audit it, report the gates

Read by the last phase of create, improve and polish, and by polish's audit. Scale it to the mode:
create looks at the first screen, then every key screen; improve looks at what changed; polish looks at
everything in scope. overhaul does not use this file (the canvas review is its verification).

The helper: `node ~/.claude/skills/design/tools/design-tools.mjs <command>`. If `node` is not found,
prepend `C:\Program Files\nodejs` to PATH (root `CLAUDE.md` § Windows dev-machine hygiene).

## 1. Can I look?

| Surface | How |
|---|---|
| Web, dev server already running | Use it. |
| Web, not running, start command documented (README, `CLAUDE.md`, launcher) | Start it in the background on loopback, never elevated. Wait until it answers. Stop it when done. |
| Web, neither | Gate `unavailable`: say why, and ask the user for a screenshot. |
| WPF / WinUI / Avalonia | **Never launch the app** (ASR blocks new binaries; Computer Cleaner needs elevation). Ask for a screenshot at the default and the minimum window size, and say which DPI. |
| Tray, CLI, email, deck | Ask for a screenshot or the output. |

## 2. The look, web (chrome-devtools)

1. `navigate_page`, then per key screen: `emulate` viewport `390x844x3,mobile,touch`, then `resize_page`
   to 768 and 1280 wide; `take_screenshot` each. Look for overflow, clipped or wrapped-badly text,
   misaligned rows, a focal point that is missing, anything the Design Read would not say.
2. `list_console_messages`: every error and warning is a finding.
3. `take_snapshot` (accessibility tree): unnamed buttons and links, skipped heading levels, missing
   landmarks, inputs without a label.
4. If the app has a dark mode: `emulate` `colorScheme` dark, screenshot again, then reset to `auto`.
5. Keyboard: `press_key` Tab repeatedly with a snapshot every few presses. Every interactive element is
   reachable, shows a visible focus, there is no trap, and the order matches the visual order.
6. **Rendered contrast** (do not eyeball it). `evaluate_script` with `sourcePath` set to
   [tools/contrast-probe.js](../tools/contrast-probe.js) (format "function"), then pass the pairs to
   `design-tools.mjs contrast <fg> <bg> ...`. Large text is 24px+, or 18.66px+ at weight 700+;
   it needs 3:1, everything else 4.5:1. A pair whose `bg` is `image` cannot be computed: say so and judge
   it by eye. Alpha is ignored, so composite a translucent colour first.

7. **Reduced motion:** `emulate` with `prefersReducedMotion: reduce` (the tool takes it; pass every other
   setting in the same call, because each call replaces all emulation), reload, screenshot, and trigger one
   animated interaction: the result must still show, only without the movement (brand: a 120 ms fade).
   Then check the source: `evaluate_script` over `document.styleSheets` for a `prefers-reduced-motion`
   rule that zeroes `animation` and `transition`, plus a grep for animation written outside it. Reset to
   `auto`. Report what was checked.
8. **Accessibility score:** `lighthouse_audit` (`mode: navigation`) covers accessibility, SEO and best
   practices. It **excludes performance**; for performance see polish Phase 5 (`performance_start_trace`).
9. **UX details** ([ux-details.md](ux-details.md)), in the same session: on the `390x844x3,mobile,touch`
   emulation check that fixed bars clear the notch and home indicator (`env(safe-area-inset-*)` in the
   stylesheet, `viewport-fit=cover` in the head) and that targets measure 44 px on touch and 24 px on any
   pointer (the `hit-target` check of step 10); press Ctrl+K and a
   single-key shortcut while a text field has focus (the shortcut must not fire); trigger a reversible delete and
   confirm an Undo toast appears inside an `aria-live` region; in step 7's grep also look for
   `::view-transition` rules under `prefers-reduced-motion`.
10. **Geometry audit** ([tools/ui-audit.js](../tools/ui-audit.js)): `evaluate_script` with `sourcePath` set to the
    absolute path of `~/.claude/skills/design/tools/ui-audit.js` (build it from `%USERPROFILE%`, never a
    hard-coded user folder), once at each width of step 1 and once more in dark mode. It returns candidates
    for about 30 defects: text jammed against a card edge, uneven padding and insets, clipped or cut text,
    text touching a neighbour, edges 1 to 3 px out of line, title and subtitle too tight, fat and loose rows,
    mixed icon sets, emoji icons, clipped glyphs, targets under 24 px, text under 10 px, a heading without
    `text-wrap: balance`, and more. **Each is a candidate**: screenshot it and read the selector's code before
    you report it, then rate it with [craft-checks.md](craft-checks.md), which says what each one means and
    how to fix it (15 KB: read it only when the audit returned candidates, and only the rules for the checks that fired). `inconclusive: true`, or a `scanned` block near zero (a canvas, an iframe-only page), makes
    the gate `unavailable`, not `pass`. It does not enter iframes or shadow roots; say so in the report.
11. **Motion** (only when the screen animates): [motion-checks.md](motion-checks.md) with
    [tools/motion-probe.js](../tools/motion-probe.js): list the running animations (infinite loops, layout
    properties animated), then sample one interaction frame by frame for jumps, drift and anchor drift. Run it once
    more with `emulate` `cpuThrottlingRate: 4`.
12. **Forced colours and contrast preference:** `emulate` `forcedColors: active` (the web form of Windows High
    Contrast) and `prefersContrast: more`, one screenshot each: text, borders and focus rings stay visible and
    no meaning is lost (an icon-only state, a colour-only badge). Reset to `auto`.

## 3. The look, desktop (screenshot plus XAML)

Contrast of the `ResourceDictionary` colour pairs with the script; no hard-coded colour where a
`SystemColors` key is needed (high contrast); `AutomationProperties.Name` on icon-only controls; a logical
`TabIndex` / focus order and a visible `FocusVisualStyle`; clipping at DPI 100 / 125 / 150 / 200 and at the
minimum window size; `TextTrimming` plus a `ToolTip` on truncated text. Static performance (no running
app needed): list controls virtualised, brushes `Freeze()`d, no `DropShadowEffect` on large or animated
areas, shallow layout nesting (the Performance rows of the stack CSV).

Geometry has no script on desktop, so Grep the XAML for what `ui-audit.js` finds on the web
([craft-checks.md](craft-checks.md) names each): an asymmetric `Padding` on a bordered control (uneven
padding), `Margin` / `Padding` literals off the project's spacing scale, a nested `CornerRadius` that is not
the outer radius minus the padding, icon boxes of mixed sizes, `FontSize` under 12, text with no `Margin` from
a neighbouring box. Keep the platform's own conventions (title bar, accelerators, the OS control behaviour) and
never draw platform chrome from memory: ask for a screenshot of the real thing.

## 4. Finding format

One line each, grouped by severity, no preamble: `path:line — claim — Critical | High | Medium | Low — fix`.
Take the severity from the matching row of the stack CSV or `ux-guidelines.csv` when there is one;
otherwise Critical = blocks use or fails a contrast or keyboard floor, High = visibly broken in a common
case, Medium = inconsistent or rough, Low = taste. Cite only lines you read. Say `nothing found` rather
than guess. A finding from the geometry audit cites its selector in place of `path:line` until you have
found the source line. Within a severity, list the largest visible fault first: structure and hierarchy,
then motion, then polish, because that is the order to fix them in.

## 5. Gates

Report each as `pass`, `fail`, `unavailable` or `blocked`, with the reason for the last two. A gate that
could not run did not pass. Typical gates: the project quality gate (`.claude/REVIEW.md`), contrast,
keyboard path, console clean, reduced motion, accessibility score, geometry audit, performance (polish only).
Two rules from the audit: a tool that returned candidates and no verdict does not make a gate `pass`; and a
finding is never cleared by hiding, removing or suppressing the thing it points at (a `overflow: hidden`
over clipped text, a deleted label). Look again: either it is wrong and gets fixed, or it is right and you
record the frame and why it stands.

## 6. Hand over

End every report with a `Not checked:` line: the states, widths, modes (dark, forced colours), interactions and
screens you did not look at, and what the tools covered against what you looked at yourself. A clean tool
result is not approval; it says only that its checks found nothing. The line goes in the report and, when a
mode writes it, in the changelog line of `.claude/DESIGN.md`; no separate handover file.
