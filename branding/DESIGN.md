# DESIGN

Visual identity, UX patterns, and client-side interaction rules. Read this before changing
templates, styling, or front-end behavior. Front-end *code* conventions live in
[STACK.md](../.claude/STACK.md).

## Design language

Read: a party game shown on a shared screen and played on phones, so big display type and vivid
player colours on graphite, lit from the bottom edge.

| Part | Value |
| --- | --- |
| Style | vdWolde Brand Guide v1.0: graphite surfaces, one signal colour, a soft backlight rising from the bottom edge, 1 px hairlines and no drop shadows. Dark Mode default, Light Mode follows the system (no toggle) |
| Type pairing | Sora (names, numbers, display) + DM Sans (everything else) + system monospace for code |
| Colour strategy | Graphite neutrals + one signal colour: Amber `#F5A524` at glow High (1.7). The eight player colours are the guide's vivid set, the only other saturated colours |
| Layout archetype | Two single-column screens: `.host` (centred, read across a room) and `.player` (a phone column) |
| Motion tier | Subtle: 120 / 200 / 300 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, reduced motion = 120 ms fade |

Status: applied (2026-11-07).

Source of truth: the Development Base's `Branding/brand.json` (Brand Guide v1.0). This file records what the
app does with it and never restates a value the guide owns. Amber carries glow High because the host screen
is large display type and the player colours are vivid; the guide's own screen
(`Branding/screens/song-snitch-*.png`) is the reference.

## Brand

Values live in `src/brand/tokens.css` (copied from the guide, never edited) and the recipe in
`src/brand/vdwolde.css` (copied from the Base's `design/references/styles/vdwolde/web/`, with one change: its
`:focus-visible` border-radius is dropped so pills and tiles keep their own shape). `index.html` sets
`<html data-signal="amber">` and puts `vdw-backlight vdw-glow-high` on `<body>`, the single backlight, on the
root surface only. `src/styles.css` holds only the app's layout, the player-colour aliases and the shadcn
bridge. Never hardcode a hex value in a `.tsx` file; use a token (`var(--signal-ui)`, `var(--player-colour)`).

**shadcn/ui:** `components/ui/*` (via `npx shadcn add <component>`, on Base UI, never Radix) is available for
new UI work. `src/styles.css`'s "shadcn bridge" maps shadcn's semantic tokens onto the brand tokens
(`--primary` is the signal fill, `--accent-surface` is `--raised`), and `src/shadcn.css` binds
`--font-sans` / `--font-heading` to DM Sans / Sora. `@custom-variant dark` follows the system dark scheme.

### Colors

| Token | Used for |
| --- | --- |
| `--ground`, `--surface`, `--raised`, `--edge`, `--control-edge` | Page, cards and rows, hover surface, hairlines, control borders (swap with the system scheme) |
| `--text`, `--text-muted` | Primary and secondary text |
| `--signal-ui` | The one primary button per view, the winner's border, the "it was your song" card |
| `--signal-text` | Coloured text and icons: amber light shade in Dark Mode, `#956416` in Light Mode (never the vivid amber) |
| `--signal` | The 2 px focus ring |
| `--ok` / `--ok-text`, `--danger` / `--danger-text` | Right-guess card, error banner. Always with an icon and words. Red is for errors only |
| `--ink` | Dark label (`#0F1115`) on any vivid fill, signal or player colour, in both modes |

### The 8 player colours

`shared/types.ts::PLAYER_COLOURS`: pink, orange, amber, yellow, green, sky, violet, lime. The first seven are the
guide's signal colours (violet uses its UI fill), lime is one of its free colours. Names live in
`shared/types.ts`, values only in `src/styles.css`'s `--c-*` aliases onto `src/brand/tokens.css`; a
`[data-colour='x']` rule sets `--player-colour`, and `server/brand.test.ts` fails if a colour has no rule.
`MAX_PLAYERS` is `PLAYER_COLOURS.length` (8): the colour set is the player cap.

A colour is never the only cue: every player tile (`Swatch` in `src/ui.tsx`) carries the player's initial and
sits beside the name, and the join screen's colour buttons carry a number (1 to 8) and a check when chosen.
Several player colours sit in the amber/orange/yellow family, which is why the letter matters.

### Typography

| Role | Typeface | Fallback |
| --- | --- | --- |
| Brand title, headings, room code, the host question, counts (`.num`), tiles | Sora 700 (tabular figures, verified: the variable TTF carries `tnum`) | system-ui, sans-serif |
| Body, buttons, inputs, all Spotify track and artist text, typed names in lists | DM Sans 400 to 700 (no `tnum` feature, so counts are set in Sora) | system-ui, sans-serif |

Self-hosted from `src/brand/fonts/` (woff2, Vite hashes them into `dist/assets/`, so they get the immutable
cache header); no CDN. `html` runs at 16 px (the guide's body-large size, never below 14 px); the `.host`
screen sets 18.4 px. Large display type (`.host-question`, `.room-code`) is Sora 700 with the guide's negative
tracking. Sora's glyph coverage is Latin and Latin Extended: Spotify text in other scripts falls back to the
system font, which is acceptable because it only appears in list rows and one h2.

### Assets

The mark comes from `Branding/icons/song-snitch/` (copied, never redrawn): `public/favicon.svg` and
`public/icons/mark.svg` (squircle), `public/favicon.ico`, `public/apple-touch-icon.png` (180),
`public/icons/pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, wired in `index.html` and
`public/manifest.webmanifest`. The mark sits at 40 px beside the title (`Brand` in `src/ui.tsx`); never below
24 px. `launcher.ico` is in the project root. The README banner, divider and footer are in `branding/readme/`.
`github-pages/*.html` inline the guide's colours because that single file is published on its own.

### Writing

UK English; Title Case for names and screen titles (Song Snitch, Final Scores); sentence case for buttons, labels and messages; buttons start with a verb ("Play next song",
"Skip to next song", "Create room"); no exclamation marks; no bare "OK"; English only.

### Accessibility floor

4.5:1 text and 3:1 rings and strokes by construction (tokens from the guide); a 2 px signal ring with a gap on
every interactive element; targets 40 px (48 px for the primary action, 56 px for colour and guess buttons);
body text 16 px; status never by colour alone; both modes checked.

## Component philosophy

Two hand-rolled screens, `src/HostApp.tsx` and `src/PlayerApp.tsx`, no component library. Each owns its local
state; the server's next broadcast is the only source of truth. Three pieces repeat across both and live in
`src/ui.tsx`: `Brand` (mark plus title), `Swatch` (colour tile with initial) and `ErrorBanner` (icon plus words).

## Components

| Component | Where | Notes |
| --- | --- | --- |
| `Brand` | `src/ui.tsx` | Mark 40 px + `h1.brand-title` |
| `Swatch` | `src/ui.tsx` | Reads `--player-colour` from the nearest `[data-colour]`; initial in dark ink |
| `ErrorBanner` | `src/ui.tsx` | `role="alert"`, danger tokens, click to dismiss when `onDismiss` is given |

## Layout & spacing

Spacing and radii come from the guide (`--space-*`, `--radius-control` 8, `--radius-card` 14, `--radius-pill`).
`.host` is a centred 1000 px column; big moments use `clamp()` so they scale down on a narrow laptop.
`.player` is a 480 px column with `env(safe-area-inset-bottom)` padding. Elevation is by lightness and a 1 px
edge, never a drop shadow. The backlight is on the root surface only (never on a card, never animated).

## Motion

One global `prefers-reduced-motion` rule, from `src/brand/vdwolde.css` (animation off, transitions reduced to
a 120 ms opacity fade); do not add per-rule checks. Durations are the guide's tokens. Only entrances and
presses move, plus the small pulsing dot on `.status-line.pulsing` for genuine waits.

| Where | What | Why |
| --- | --- | --- |
| `button`, `a.button` | 120 ms background fade, 1 px press | Quiet feedback; no lift or shadow |
| `.roster li`, `.leaderboard li` | Staggered rise-in on mount (0 to 280 ms delays, 200 ms) | Replays only when the list remounts (a new phase) |
| `.card-enter`, `.reveal-card`, `.leaderboard li.winner` | Pop-in (scale 0.96 to 1, 300 ms, no overshoot) | Marks a phase change as a moment |

## Voice

Short, plain, second person. Buttons are verbs. A wrong guess is neutral ("Not this time"), never red; red is
for errors, which say what happened and what to do ("Lost the connection, check you're still on the host's WiFi").

## Interaction rules

- Every action (search, submit, vote) is a direct WS send or `fetch` with **no optimistic UI**: the next state
  broadcast is what renders.
- Errors are a dismissible `ErrorBanner`, never a browser `alert()`.
- No skeletons: a pulsing status line is enough.
- Round progress is a count ("3/7 voted"), never a per-player list (a submitter-identity leak; see ADR-003 and
  [SECURITY.md](../.claude/SECURITY.md)).
- The host's `.reveal-card` borders in the submitter's colour (safe, the reveal has happened); the player's uses
  `data-result="yes" | "no" | "own"` (green with a check, neutral with a cross, amber with a note) because the
  player cares whether they were right.
- One primary button (`.primary`, signal fill) per view; every other button is secondary.

## Accessibility

- A player colour is never the only signal (initial, name, number, check).
- Inputs are 16 px minimum (iOS zooms on focus below that).
- Targets are at least 40 px, with `touch-action: manipulation`.
- `:focus-visible` is a 2 px signal outline with an offset, globally; the host laptop is as likely to be driven by
  keyboard as touch.
- Fonts are `font-display: swap` with system-ui fallbacks.

## Do's and don'ts

| Do | Don't |
| --- | --- |
| Take every colour from a token | Hardcode a hex value in a `.tsx` file |
| Put `Swatch` beside a name, set `data-colour` on the parent | Show a player colour with no letter or name |
| Use `--signal-text` for coloured text | Use the vivid amber for text in Light Mode |
| Put `--ink` text on vivid fills | Use white text on a signal or player fill |
| Show a count for round progress | Show who has voted or is ready |
| Let the server broadcast be the source of truth | Predict or update game state optimistically |
| Add motion through the 120/200/300 ms tokens | Add a continuous loop or a second backlight |

## Extending this system

Add a screen inside `HostApp.tsx` or `PlayerApp.tsx`; reuse `Brand`, `Swatch`, `ErrorBanner`; take colours from
`src/brand/tokens.css` through `src/styles.css`; mark the one primary action with `className="primary"`. A new
player colour needs a name in `shared/types.ts`, a `--c-*` alias and a `[data-colour]` rule (the test checks the
rule), and the player cap follows automatically. Run `npm run typecheck && npm test && npm run build`, then look at
both modes (`prefers-color-scheme`) on the host and phone widths.

## Changelog

- 2026-11-07 apply Brand Guide v1.0: Amber signal, glow High, Sora + DM Sans self-hosted, Dark and Light Mode,
  vivid player colours with initials, icon set, copy pass. fingerprint amended: style, Anton/Epilogue game-show
  blocks with sticker buttons and dark-only, to the guide's graphite and signal system.
