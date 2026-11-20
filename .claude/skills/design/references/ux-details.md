# ux-details — twenty interaction details to check and build

Read by `polish` (Phase 4, audit and fix), `create` (Phase 2, build them in from the start) and `verify`
(§ 2 step 9). They are the small behaviours users feel without naming: not new features, so `polish`'s
contract allows them. **The vdWolde Brand Guide owns geometry, colour and type; nothing here changes it.**

## How to run it

1. **Per detail, decide `fits` / `does not fit` for this app** from its "Fits when" and "Never when" columns
   and the stack. A detail that does not fit is not a finding. Say so in one line, with the reason.
2. **Check** with the "Check" column (a grep or a look). A fitting detail that is missing is a finding:
   `path:line — missing <detail> — severity — fix`. Severity: **High** when its absence loses data or creates
   a duplicate record (a reversible delete with no way back, a create button that can be double-submitted);
   **Medium** when it makes a frequent action slow or wrong on touch (targets, safe area, no loading shape);
   **Low** otherwise.
3. **Audit** stops there. **Polish / create** then builds the fitting ones, **one at a time, running the
   project's gates after each** (`REVIEW.md`), in this order: 5, 19, 2, 1, 13, 14, 16, 17, 4, 3, 6, 7, 9, 10,
   11, 15, 8, 12, 20, 18. A build that cannot be done from the front end (a server dedupe, an upload hash)
   is a finding for the owner of the back end, never a silent skip.
4. Report all 20 as **Built** (what, which files), **Already done** (where) or **Skipped** (why).

Use what the project already has (its toast, modal, router, query library, tokens) before adding a
dependency. Every animation needs a reduced-motion path. Where a project's docs lock a rule (for example
"motion is entrance-only"), the docs win; adapt the detail instead of overriding them.

## The twenty

| # | Detail | Fits when | Never when | Check | Build |
|---|---|---|---|---|---|
| 1 | **Skeleton loaders** | Content arrives from a slow source and has a known layout | Instant local data; a button's own pending state | `Loading…` or a spinner standing in for a whole layout; a skeleton built from different markup than the loaded state | Grey blocks from the same component and size as the loaded state. Show only after ~300 ms: CSS `animation: reveal 150ms ease-out 300ms backwards` (invisible during the delay, space still reserved), not a JS timer. No pulse loop in an entrance-only system. `aria-busy` |
| 2 | **Optimistic updates** | A small reversible action: checkbox, toggle, rename, reorder, star, role | Payments, anything that moves money, anything where the server computes what comes next (rankings, the next item) | A handler that awaits the server before the UI changes | React 19 `useOptimistic`, or TanStack `onMutate` + rollback; vanilla: apply, `try` the request, on failure restore the old state and show the error |
| 3 | **Command menu** | A daily-use app with many pages or actions | A one-screen tool, a marketing page | No Ctrl/⌘+K | `⌘K` / `Ctrl+K` toggles a combobox + listbox (`aria-activedescendant`, ↑ ↓ Enter Esc), listing pages and actions with their shortcuts. Reuse the project's modal; `cmdk` in shadcn projects. Not while another dialog waits for an answer |
| 4 | **Shortcut hints** | The app has shortcuts | None exist | A `keydown` handler with no typing guard; shortcuts that appear nowhere in the UI | `<kbd>` in menus, tooltips, the command menu: `⌘` on Apple platforms (`navigator.userAgentData?.platform ?? navigator.platform`), `Ctrl` elsewhere. Single-key shortcuts skip `input`, `textarea`, `select`, `contenteditable`; modifier combos may fire anywhere. WPF: put the key in the tooltip |
| 5 | **Undo toasts** | A reversible delete, archive or reset | Irreversible actions (revoking sessions, a payment, anything the UI cannot show without the server) | A confirm dialog in front of a reversible delete; a delete with neither | Do it at once, show a 5–10 s toast with Undo (`role="status"` / `aria-live="polite"`). Behind it a soft delete, a server restore, or a delayed request that Undo cancels (flush on `pagehide` and on screen change). Keep the confirm for the irreversible ones |
| 6 | **Stale-while-revalidate** | Lists and dashboards of non-critical data | Balances, stock, prices, anything where old data costs money | `refetchOnWindowFocus: false`, no cache, or a full-page spinner on every visit | TanStack Query / SWR defaults (cache, refetch on focus and reconnect); vanilla: refetch on `visibilitychange` |
| 7 | **Prerendering** | A multi-page, same-site site | An SPA (the router decides), pages that change data on `GET` | No `speculationrules`; check what the router already prefetches first (Next `Link` does) | `<script type="speculationrules">` `{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}`; exclude logout and any link that changes data. Ignored inside an iframe |
| 8 | **BlurHash / ThumbHash** | User-uploaded images, where the server can hash at upload | Static assets; no upload path | An uploaded image with no placeholder, or no width and height | Store the hash with the image; render the blur in a box of the image's exact size. Without a hash: at least an `aspect-ratio` box on a neutral fill. Hashing is back-end work: flag it |
| 9 | **View transitions** | A page or phase change that moves the user to something else | A change whose callers read the DOM straight after (the callback is async) | No `startViewTransition` / `@view-transition` | Same page: `document.startViewTransition(update)` (React: `flushSync` inside it); between pages: `@view-transition { navigation: auto; }`; the same `view-transition-name` on elements that travel. Under 300 ms. **Feature-detect, and add `::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none }` under `prefers-reduced-motion`: `*` does not match them** |
| 10 | **Swipe-to-dismiss sheets** | Bottom sheets and drawers on touch | Desktop-only dialogs | A sheet with no drag | Base UI `Drawer` (`swipeDirection`), Vaul, SwiftUI `presentationDetents`, `@gorhom/bottom-sheet`. Close on distance or a flick; keep the close button |
| 11 | **Interruptible animations** | Anything a user can interrupt: drawers, toggles, menus, hover states | A one-shot entrance that cannot be interrupted | `@keyframes` on an interactive element; input blocked while it plays | Transitions (`@starting-style` for the enter) or springs that turn round from their current position; never block input. Reduced motion: fade only |
| 12 | **Predictive back** | An Android app targeting 16+ with a back stack | TV home screens where Back does nothing; non-Android | `onBackPressed()`, no `OnBackPressedCallback` | `OnBackPressedCallback` / `PredictiveBackHandler`, `android:enableOnBackInvokedCallback="true"` |
| 13 | **Hit slop** | Touch use | A pointer-only desktop tool (still keep ≥ 24 px, WCAG 2.5.8) | Icon buttons under 44 px on a coarse pointer | `@media (pointer: coarse)` (Tailwind `pointer-coarse:`) to 44 px; RN `hitSlop`/padding to 44 pt iOS, 48 dp Android; no overlap with a neighbour |
| 14 | **Safe-area insets** | The page uses `viewport-fit=cover`, or should | A page without `cover` (the browser pads it for you) | Fixed or sticky bars with no `env(safe-area-inset-*)`; a translucent status bar | `viewport-fit=cover` + `env(safe-area-inset-top/right/bottom/left)` on fixed bars. Fold the bar's height into one CSS variable so everything that clears it follows. RN: `react-native-safe-area-context` |
| 15 | **One-time-code autofill** | A code arrives by SMS or email | An authenticator-app code (no message to read) | A split or unlabeled code field | One `<input autocomplete="one-time-code" inputmode="numeric">`; iOS `textContentType = .oneTimeCode`; the SMS ends `@domain.com #123456` |
| 16 | **Tabular numbers** | Timers, prices, counters, table columns | Running prose | Figures that shift width as they change | `font-variant-numeric: tabular-nums` on a font that has `tnum` (Sora yes, DM Sans no); WPF `Typography.NumeralAlignment="Tabular"` |
| 17 | **Balanced headlines** | Any text | n/a | No `text-wrap` | `text-wrap: balance` on headings and short titles, `pretty` on paragraphs |
| 18 | **Continuous corners** | A style that asks for it, on Chromium | **A style or brand that owns corner geometry: the vdWolde Brand Guide does, so skip it there** (decided 2026-11-07) | The style's `SPEC.md` | `corner-shape: squircle` next to the existing `border-radius`; other browsers ignore it. SwiftUI `.continuous` |
| 19 | **Idempotency keys** | Anything that creates a record or takes a payment | Reads | A create/pay request with no key, or a button that stays enabled while it runs | A UUID per user action, the same `Idempotency-Key` on every retry, the button disabled while pending; the server caches the first 2xx (replay it), answers `422` for the same key with another body, never caches failures |
| 20 | **Safe triangle** | A hover menu with submenus | Flat menus, click-to-open menus | Hover submenus that flip while the cursor travels diagonally | Floating UI `safePolygon()`, or the menu library's own |

## Gotchas learned the hard way

- **A skeleton delay is CSS, not JS**, so it cannot be skipped by a re-render and costs no timer.
- **`startViewTransition` runs its callback later.** In a router or a `showView()` that callers read
  straight after, use it only where nothing reads the DOM synchronously; otherwise rely on the entrance animation.
- **A delayed delete must be flushed** on screen change, `pagehide` (with `fetch(..., { keepalive: true })`)
  and before any action that reads the same data (starting a scrape), or Undo lies.
- **Optimistic UI needs the cache shape.** Roll back to the snapshot taken before the change, and keep the
  mutation's own error toast.
- **Safe area without `viewport-fit=cover` does nothing**; add `cover` and the insets in the same change.
- **Sonner and most toast regions expose `aria-live="polite"`**, which is what `role="status"` means; check
  the rendered region instead of adding a second one.
- **A global idempotency cache must sit after auth and before compression**, and is in memory: write the
  `debt:` note (lost on restart, one process).
