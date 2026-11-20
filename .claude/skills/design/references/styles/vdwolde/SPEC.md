# vdWolde: canonical spec (Brand Guide v1.1)

The owner's brand and the **default house style for every vdWolde project, app, tool and site** (not client sites,
not vdwolde.com). It applies without being named. Liquid Glass (`../liquid-glass/`) is a different, opt-in style and
wins only when the user names it.

**Source of truth: the Development Base's `Branding/brand.json`** (machine-readable: every colour, size, rule and file path;
never sample colours from images). The guide itself is the Claude artifact https://claude.ai/artifact/GbdGiKQUbkFCJRBXEudk6P (the PDF is generated from it, so the artifact always wins; if it cannot be read, ask the owner for the new URL or for permission to use the PDF, never fall back silently). `snapshot/brand.json` and
`snapshot/tokens.css` here are version-stamped copies (v1.1, 2026-11-07) for projects and cloud sessions that cannot see
`Branding/`; when both exist, `Branding/` wins. This file holds no value the guide owns: it says how to apply it.

## Identity

| Item | Value |
| --- | --- |
| One line | Graphite surfaces, one signal colour per app, a soft light rising from a lit bottom edge |
| Modes | **Dark Mode** (default) and **Light Mode** (follows the system). Every app has both |
| Type | **Sora** (names, numbers) + **DM Sans** (everything else) + system monospace for code; Atkinson Hyperlegible only in ThinkTwice |
| Mark | "vdW" in Sora Bold on the six-colour glow; never below 24 px (below that write "By vdWolde") |
| Signal per app | Development Base rainbow · Trash Scraper, Fooocus pink · ThinkTwice orange · Song Snitch amber · Finance Dashboard yellow · Stay Awake green · Website Builder, Copilot 365 Agent Builder sky · Computer Cleaner, TV Cleaner violet. A new app takes the next free colour from `brand.json › colour.free` |
| Glow | Low 0.6 (utilities, tray apps) · Middle 1 (apps you work in, default) · High 1.7 (games, shared screens) |

## The nine rules (brand.json › principles, README § Rules that matter most)

1. One signal per app: the primary action, the active state and the focus ring only. Never two signals on a screen. Red is reserved for danger.
2. Graphite does the work: surfaces come from `neutral-*` tokens.
3. One backlight per view, on the root surface, rising from the bottom edge; never on cards, never stacked, never animated.
4. Contrast 4.5:1 for text and 3:1 for rings and strokes. Coloured text: light shade in Dark Mode, deep shade in Light Mode (amber and yellow: their text shade; violet labelled fills: `#8269FF`). Run `node contrast-check.mjs`.
5. Type from the scale in `tokens.css`; money and counts that must line up use Sora tabular figures (DM Sans has none); a negative amount reads `-€ 3,00`; body text 14 px or more.
6. Icons are copied from `icons/<slug>/`, never redrawn, recoloured or cropped. Squircle for macOS/Android, circle for avatars.
7. Status always shows an icon and a word.
8. Writing: Title Case for names and titles, sentence case for buttons, labels and messages; buttons start with a verb; no exclamation marks; UK English; one language per app (Dutch only for Finance Dashboard).
9. Accessibility: visible 2 px signal focus ring with a gap, keyboard access, 32 px targets (40 px main action), both modes, reduced motion keeps a 120 ms fade.

Motion tokens: 120 / 200 / 300 ms, enter `cubic-bezier(0.2, 0.8, 0.2, 1)`, leave `cubic-bezier(0.4, 0, 1, 1)`.
Radii: controls 8, windows 12, cards and tiles 14, chips pill. Spacing 4 8 12 16 24 32 48. Hairline 1 px edges; elevation by lightness, no drop shadows.

## How to apply it, by stack

| Stack | Use |
| --- | --- |
| Any, to find the recipe | [anywhere.md](anywhere.md) |
| Web (vanilla, Vite, Next, Tailwind + shadcn) | `web/vdwolde.css` + `Branding/tokens/tokens.css` + `Branding/fonts/*` |
| WPF / WinForms tray | `wpf/` dictionaries + static TTFs |
| Gradio (Fooocus) | [gradio.md](gradio.md) |
| Android TV | static TTFs as `res/font`, tokens as `colors.xml` (anywhere.md) |
| README / GitHub | `Branding/github/readme/*`, `Scripts/BrandAssets.mjs`, `Scripts/SyncBranding.ps1` |

## Gate

`node contrast-check.mjs` (0 failing pairs; one accepted deviation, the Light Mode control edge on the light ground, is listed in the script) and a screenshot of the finished
screen in both modes compared with `Branding/screens/<slug>-dark.png` / `-light.png` and `Branding/components/*`.

## Departures that are part of the brand

ThinkTwice reads in Atkinson Hyperlegible (older people, low vision, a stressful moment). Finance Dashboard is Dutch.
Anything else that departs is recorded in the project's `.claude/DESIGN.md` with the reason.
