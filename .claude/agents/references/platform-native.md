# Platform-native lookup — does the platform already do this?

Read by the `design` lens when it tags a finding `native:`, and by anyone climbing rung 4 of
`CLAUDE.md` § Coding principles ("does a native platform feature cover it?"). Not loaded up
front. Each row: what people hand-roll or import a library for → what the platform ships.

**Check browser support before recommending a web row.** The Support column is Baseline status from the
Modern Web Guidance guide set of 2026-11-09: **W** Widely available (no fallback owed), **N** Newly available
with its Baseline date (Widely 30 months later), **L** Limited, **·** not in that data set (long established;
check the project's own target). A project's stated browser-support line overrides the default target, which is
Baseline Widely available. Never assert support from memory. The fallback for each N or L row, and the reasoning
behind every web row, is in `modern-web.md` next to this file; the id in brackets is the guide to fetch for the
full text (`modern-web.md` § Going deeper).

## HTML

| Hand-rolled or imported | Native | Support |
| --- | --- | --- |
| Modal / lightbox library, `z-index` overlay, focus trap by hand | `<dialog>` + `showModal()` (focus trap, `Esc`, backdrop, top layer) [`dialog`] | W |
| Accordion / disclosure component | `<details>` / `<summary>`; shared `name` for one-open [`accordion`] | W; `name` N 2024-09-03 |
| Autocomplete dropdown for a short known list | `<input list>` + `<datalist>` | · |
| Date / time picker library | `<input type="date">`, `time`, `datetime-local`, `month`, `week` | · |
| Colour picker library | `<input type="color">` | · |
| Progress bar / gauge div with a width style | `<progress>` / `<meter>` [`progress`] | · |
| Range slider component | `<input type="range">` [`slider`] | · |
| Client-side form validation library for basic rules | `required`, `pattern`, `min`/`max`, `minlength`, `type=email\|url`, `setCustomValidity` [`forms`] | · |
| Tooltip / popover / dropdown positioned by JS | `popover` attribute + `popovertarget` (top layer, light-dismiss) [`declarative-dialog-popover-control`] | N 2025-01-27 |
| Lazy-loading library for images / iframes | `loading="lazy"`, `decoding="async"` | · |
| Responsive-image JS | `srcset` / `sizes` / `<picture>` | · |
| "Copy" fallbacks via a hidden textarea | `navigator.clipboard.writeText()` [`copy-button`] | W |
| Hiding a background region from focus by `tabindex` juggling | `inert` | W |

## CSS

| Hand-rolled or imported | Native | Support |
| --- | --- | --- |
| Sticky header via a scroll listener | `position: sticky` | · |
| Auto-growing textarea script | `field-sizing: content` [`form-fields-automatically-fit-contents`] | N 2026-06-16 |
| Scroll-snap carousel library (for a simple case) | `scroll-snap-type` / `scroll-snap-align` [`carousel`] | W |
| Scroll-triggered fade-in via `IntersectionObserver` | `animation-timeline: view()` / scroll-driven animations [`scroll-entry-exit-effects`] | N 2026-10-27 |
| Aspect-ratio padding hack | `aspect-ratio` | · |
| Media-query breakpoints for a component's own layout | container queries (`@container`) [`size-aware-styling`] | W |
| Margin / padding mirrored for RTL by hand | logical properties (`margin-inline`, `padding-block`, …) | · |
| JS computing a colour tint / shade | `color-mix()`, relative colour syntax [`color`] | ·; relative colours N 2024-09-16 |
| JS dark-mode toggle for the OS default | `prefers-color-scheme`, `color-scheme` [`dark-mode`] | W |
| JS for reduced-motion users | `prefers-reduced-motion` [`motion`] | · |
| Sass variables for runtime theming | custom properties (`--token`) | · |
| Parent-styling-by-child JS class toggle | `:has()` [`child-state-based-styling`] | W |
| Smooth-scroll library | `scroll-behavior: smooth` | W |
| Truncate-to-N-lines script | `-webkit-line-clamp` trio plus `line-clamp` [`css-layout`] | · |
| Page / view transition library | View Transitions API [`same-document-transitions`] | N 2025-10-14 |
| "Touched" class or `:not(:focus):invalid` to delay error styling | `:user-invalid` [`validate-input-after-interaction`] | W |
| Specificity managed by BEM or `!important` | `@layer` + `:where()` [`css`] | W |
| `transform` rewritten whole to change one axis | individual `translate` / `rotate` / `scale` | W |
| Spring or bounce easing from a JS animation library | `linear()` easing [`physics-based-easing`] | W |

## Legacy web patterns

What to look for in existing web code, and the replacement a finding must name. The rows marked **scan** are also
detected by `modern-web-guidance legacy-scan` (`modern-web.md` § Going deeper); its hits are candidates to read,
not findings.

| Legacy pattern in the code | Replacement to name | Support | Guide |
| --- | --- | --- | --- |
| Backdrop click listener that closes a `<dialog>` (**scan**) | `closedby="any"`, keeping the listener behind a `'closedBy' in HTMLDialogElement.prototype` check | L | `dialog` |
| Click listener that only calls `showModal()`, `close()`, `showPopover()`, `hidePopover()` or `togglePopover()` (**scan**) | `command` / `commandfor`, or `popovertarget` | N 2025-12-12 / N 2025-01-27 | `declarative-dialog-popover-control` |
| `role="dialog"`, `aria-modal`, a focus trap, `Esc` handler or focus-restore code on a native modal `<dialog>` | delete it: `showModal()` provides all of it | W | `dialog` |
| `overflow: hidden` or `position: fixed` on `html`/`body` to lock scroll under a modal | `overscroll-behavior: contain` on `dialog:modal` and on `::backdrop` (with `overflow: hidden` there) | L, degrades | `prevent-page-scroll-under-modal-dialog` |
| `input:invalid` / `textarea:invalid` / `select:invalid` error styling (**scan**) | `:user-invalid` | W | `validate-input-after-interaction`, `select-menu-interaction` |
| JS that toggles a class on a parent when a child control changes or takes focus (**scan**) | `:has()` | W | `child-state-based-styling` |
| `keydown` handler that acts on `Enter` without `isComposing` (**scan**) | `if (e.isComposing \|\| e.keyCode === 229) return;` | L, both checks are the fallback | `ime-safe-enter-submit` |
| Password, address, card, name, email or phone field with no `autocomplete`, or `autocomplete="off"` on one of them (**scan** covers password, address and card) | `current-password` / `new-password`, `street-address`, `postal-code`, `cc-*`, `name` / `nickname`, `email`, `tel` | W | `autofill-sign-in-form`, `autofill-sign-up-form`, `autofill-address-form`, `autofill-payment-form`, `forms` |
| Identifier input (username, invite or room code, search box) with autocorrect and spellcheck left on | `autocorrect="off" spellcheck="false"` (`autoCorrect` / `spellCheck` in JSX). Add `autocapitalize="none"` only after checking the server does not compare the value case-sensitively against a capitalised one | N 2026-09-11, ignored where unsupported | `forms` |
| `type="number"` for a code, card number or postcode; one input per digit | `type="text" inputmode="numeric"`, one field, `autocomplete="one-time-code"` for codes | W | `forms`, `sms-otp-form` |
| `scrollHeight` script or `autosize()` on a textarea (**scan**) | `field-sizing: content`, keeping the script behind `CSS.supports` | N 2026-06-16 | `form-fields-automatically-fit-contents` |
| Checkbox hidden with `opacity: 0` and redrawn on a sibling (**scan**) | `accent-color`, or `appearance: none` on the input itself | L (cosmetic, degrades) | `checkbox` |
| `<div role="progressbar" aria-valuenow>` (**scan**) | `<progress value max>` | · | `progress` |
| `noUiSlider` or similar for a single-handle slider (**scan**) | `<input type="range">` | · | `slider` |
| `tippy()` or similar for a plain hover tooltip (**scan**) | `popover` + anchor positioning; `interestfor` is L, so keep hover/focus listeners as the trigger | L | `interest-triggered-tooltips` |
| `title` attribute used as a tooltip | a keyboard-reachable tooltip pattern | · | `html` |
| LCP image with `loading="lazy"`, or with no priority hint | `fetchpriority="high"` and no lazy loading (`priority` on `next/image`) | N 2024-10-29, degrades | `optimize-image-priority` |
| `fetchpriority="high"` on more than two images, `fetchpriority="low"` on lazy below-the-fold images, the old `importance` attribute | one or two high; lazy alone below the fold | N 2024-10-29 | `optimize-image-priority` |
| `srcset` without `sizes`; images or video without `width`/`height` | add `sizes`; add dimensions or `aspect-ratio` | · | `performance` |
| `-webkit-image-set()` without `image-set()` (**scan**) | standard `image-set()` | W | `deliver-optimized-decorative-images` |
| `::-webkit-scrollbar` rules with no standard property (**scan**) | `scrollbar-color` + `scrollbar-width`, old rules inside `@supports not (scrollbar-color: auto)` | N 2025-12-12 / N 2024-12-11 | `customize-scrollbar-color-and-thickness` |
| `-webkit-mask-image` without `mask-image` (**scan**) | add the unprefixed `mask-image` | W | `soft-edge-content-fade` |
| Colours overridden in `@media (prefers-color-scheme: dark)` with no `color-scheme` (**scan**) | add `color-scheme: light dark` on `:root`; `light-dark()` only with its fallback | W; `light-dark()` N 2024-05-13 | `dark-mode` |
| Theme toggle that sets a class or `data-theme` but never `color-scheme` (**scan**) | set `color-scheme` (and `<meta name="color-scheme">`) with the toggle | W | `dark-mode-toggle` |
| `matchMedia('(prefers-color-scheme: dark)')` read once, no `change` listener | add the listener | W | `dark-mode` |
| Ladder of `:nth-child(n)` rules that only step `animation-delay` / `transition-delay` (**scan**) | `calc(sibling-index() * step)` after a `--sibling-index` custom-property declaration | N 2026-08-18 | `dynamic-sibling-animations` |
| `aos`, `scrollreveal`, `wowjs`, or `IntersectionObserver` only to fade things in on scroll (**scan**) | `animation-timeline: view()` behind `@supports`; a decorative reveal needs no fallback | N 2026-10-27 | `scroll-entry-exit-effects` |
| `max-height` transition to fake height `auto` (**scan**) | `interpolate-size: allow-keywords`, `max-height` kept as fallback | L | `animate-to-intrinsic-sizes` |
| Global `* { animation-duration: 0.01ms }` reduced-motion override | per-animation `@media (prefers-reduced-motion: …)`. **Not a finding in a project on the vdWolde Brand Guide recipe**: the guide mandates one global rule (a documented decision, see Rules of use) | · | `motion` |
| `react-wrap-balancer`, `balance-text`, `balanceText()` (**scan**) | `text-wrap: balance` | N 2024-05-13, degrades | `improve-text-layout-and-legibility` |
| `fitty`, `fitText` (**scan**) | `text-fit` is L: keep the script, note the native path | L | `equal-width-text-lines` |
| `border-bottom` underline hack (**scan**) | `text-decoration` + `text-underline-offset` + `text-decoration-thickness` | · | `custom-text-decorations` |
| `invert() sepia() saturate() hue-rotate()` chain to recolour an icon (**scan**) | CSS mask with `background-color: currentColor`, or inline SVG `fill="currentColor"` | W | `icons` |
| `100vw` for full width; `vh` for a full-height mobile layout | `100%`; `dvh` / `svh` | W | `css-layout` |
| `order`, `*-reverse` or `grid-auto-flow: dense` on interactive content | DOM order that matches the visual order | · | `css-layout` |
| `.innerHTML = DOMPurify.sanitize(…)` (**scan**) | keep it: `setHTML()` / Sanitizer API is L. Note the native path only | L | `sanitize-untrusted-html` |
| Third-party CDN `<script>` / stylesheet with no `integrity` (**scan**) | `integrity`, `crossorigin="anonymous"`; self-host where possible | · | `secure-external-subresources` |
| `humanizeDuration`, `pretty-ms`, a hand-written duration formatter (**scan**) | `Intl.DurationFormat`; `Temporal` is L | N 2025-03-04 | `calculate-event-differentials` |
| Bootstrap `data-spy="scroll"` (**scan**) | keep: `scroll-target-group` is L | L | `scrollspy` |
| `.async-hide { opacity: 0 !important }` anti-flicker snippet (**scan**) | `<script async blocking="render">` is L: keep, note the native path | L | `flicker-free-client-side-ab-testing` |
| `:host-context()` in web-component styles (**scan**) | inherited custom properties or container style queries | L, never standard | `styling-web-components` |
| Inline `onclick="…"` | `addEventListener` | · | `html` |

## JavaScript / Web APIs

| Hand-rolled or imported | Native |
| --- | --- |
| `lodash.cloneDeep` / `JSON.parse(JSON.stringify())` | `structuredClone()` |
| `moment` / `dayjs` for formatting one date | `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` |
| Number / currency formatting library | `Intl.NumberFormat` |
| Pluralisation helper | `Intl.PluralRules` |
| List-joining helper ("a, b and c") | `Intl.ListFormat` |
| `axios` for plain requests | `fetch` + `AbortController` (timeout via `AbortSignal.timeout()`) |
| `uuid` package | `crypto.randomUUID()` |
| `lodash.groupBy` | `Object.groupBy()` / `Map.groupBy()` |
| `lodash.uniq`, set operations | `Set` (and its set methods) |
| Query-string parsing library | `URL` / `URLSearchParams` |
| Scroll / visibility listeners for "is it on screen" | `IntersectionObserver` |
| Resize listeners on an element | `ResizeObserver` |
| Debounced storage polling across tabs | `BroadcastChannel`, the `storage` event |
| `lodash.get` / `_.isNil` | optional chaining `?.`, nullish `??` |
| Array helper libraries | `Array.prototype` (`at`, `flat`, `flatMap`, `findLast`, `toSorted`) |
| Event-emitter class | `EventTarget` / `CustomEvent` |
| Polling for the online state | `navigator.onLine` + `online` / `offline` events |

## Python (stdlib)

| Hand-rolled or imported | Native |
| --- | --- |
| Hand-written memo dict | `functools.lru_cache` / `functools.cache` |
| `requests` for one internal call in a stdlib-only tool | `urllib.request` (keep `requests` if already a dependency) |
| Manual path string joins | `pathlib.Path` |
| Hand-rolled argument parsing | `argparse` |
| Manual CSV splitting | `csv` |
| Custom record classes with only fields | `dataclasses` |
| `collections` re-implementations | `Counter`, `defaultdict`, `deque` |
| Temp-file juggling | `tempfile`, `shutil` |
| Retry loop with `sleep` around a subprocess | `subprocess.run(..., timeout=)` |

## .NET (BCL)

| Hand-rolled or imported | Native |
| --- | --- |
| JSON library for plain serialisation | `System.Text.Json` |
| Manual `HttpWebRequest` / string-built URLs | `HttpClient`, `UriBuilder` |
| Hand-written command-line parsing for a simple tool | `System.CommandLine`, or `args` for one flag |
| Manual string-building for paths | `Path.Combine`, `Path.GetRelativePath` |
| Hand-rolled process spawn via a joined string | `ProcessStartInfo.ArgumentList` (argv array, § Security defaults) |
| Lock-and-queue background worker | `System.Threading.Channels` |
| Custom retry loop | `Polly` only if already installed; otherwise a small bounded loop |

## Database

| Hand-rolled in app code | Native |
| --- | --- |
| Uniqueness check before insert | `UNIQUE` constraint (a check-then-insert races) |
| Referential-integrity checks in code | `FOREIGN KEY` (+ `ON DELETE`) |
| Value-range validation only in the app | `CHECK` constraint |
| Default values set in every caller | column `DEFAULT` |
| Application-side "updated at" bump | trigger, or `DEFAULT` / generated column |
| Pagination by loading all rows | `LIMIT` / `OFFSET` (or keyset) |
| App-side filtering, grouping, summing | `WHERE` / `GROUP BY` / aggregates |
| App-side `json` parsing to filter | JSON operators / generated columns (per engine) |

## Rules of use

- **Name the exact feature**, as in the tables, in a `native:` finding — "use the platform"
  is not actionable.
- **Support decides the wording of a web finding.** W, or inside the project's stated target: a plain
  `native:` finding naming the replacement. N or L outside the target: `native (verify support): …`, and the
  finding must name the fallback from `modern-web.md` (or say that the feature simply degrades), so the author
  decides. An L row whose replacement column says "keep" is not a finding at all.
- **Severity of a legacy web pattern.** Suggested by default: it works, there is just a smaller or sturdier
  form. Important when the pattern is a defect a user can hit today: an LCP image that is lazy-loaded, error
  styling shown before any input, an Enter handler that submits half-composed IME text, a modal with no focus
  containment, a state shown by colour alone. Never Critical on this table alone.
- **The standing stack wins.** In a React project a shadcn/Base UI primitive is never reported as "use native
  `<dialog>` / `popover`" (`web-ui-baseline`), and a project's documented decision (an animation engine, a token
  system) is not a legacy pattern.
- **Keep a dependency that is already installed and used elsewhere** when the native
  version would only make one call site different (rung 5 before rung 4 is a consistency
  call, not a bug). Flag it as a Suggestion at most.
- These are platform facts, written fresh for this base; nothing here is copied text.
