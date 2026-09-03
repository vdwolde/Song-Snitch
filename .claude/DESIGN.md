# DESIGN

Visual identity, UX patterns, and client-side interaction rules. Read this before changing
templates, styling, or front-end behavior. Front-end *code* conventions live in
[STACK.md](STACK.md).

## Design language

Vibrant & block-based, in the "quiz game / game-show" register — bold flat colour
blocks, a punchy condensed display face for big moments, no gradients-as-decoration,
tactile "sticker button" affordances (a solid drop shadow that presses flat on tap).
Chosen for the audience (friends at a casual game night, read from across a room *and*
tapped on a phone) over anything quieter or more corporate — see
[DECISIONS.md](DECISIONS.md) if one is ever recorded for this pass.

## Brand

All tokens are CSS custom properties on `:root` in `src/styles.css` — the **only** source
of color. Never hardcode a hex value in a `.tsx` file; reference the token
(`var(--accent)`, `var(--player-colour)`).

### Colors

| Token | Hex | Used for |
| --- | --- | --- |
| `--bg` | `#0f172a` | Page background |
| `--panel` | `#1b2846` | Cards, list rows |
| `--text` | `#f1f5fb` | Primary text |
| `--muted` | `#94a3b8` | Secondary text, status lines |
| `--accent` | `#3b82f6` | Primary buttons, links, room code |
| `--secondary` | `#8b5cf6` | Fallback reveal-card accent when no player colour applies |
| `--gold` | `#eab308` | Leaderboard winner, trophy, "it was your song" |
| `--good` | `#22c55e` | Correct-guess feedback |
| `--bad` | `#f43f5e` | Errors, wrong-guess feedback |
| `--c-crimson` … `--c-sand` | 8 hex values | The 8 fixed player colours — see below |

Deliberately picked to be distinguishable from every semantic token above (`--good`,
`--bad`, `--gold`) even though a couple of player hues sit in the same family (e.g.
`--c-crimson` and `--bad` are both red-leaning) — acceptable because they're never the
only signal in the same context (a swatch is always paired with a name; a result banner
is always paired with words like "You got it!").

No external brand book — this is a personal party game, not a client product.

### The 8 player colours

Names live in `shared/types.ts::PLAYER_COLOURS`; hex values live only in
`src/styles.css`'s `:root` block — neither file duplicates the other. Every coloured
element sets `data-colour="<name>"` and reads `var(--player-colour)`, set per-value by a
one-line `[data-colour='x'] { --player-colour: var(--c-x); }` rule.

`MAX_PLAYERS` is `PLAYER_COLOURS.length` (8) — the colour set **is** the player cap, by
construction, not a separately-enforced number.

### Typography

Two Google Fonts, loaded via `<link>` in `index.html` (not self-hosted — this already
depends on internet access for Spotify, so one more small request is an acceptable cost
for the room-code/reveal punch it buys):

| Token | Font | Used for |
| --- | --- | --- |
| `--font-display` | Anton | `.brand-title`, `.room-code`, `.your-turn`, `.you-scored` — **static, controlled-length copy only** |
| `--font-body` | Epilogue | Everything else, including every piece of Spotify track/artist data |

**Anton is scoped deliberately narrow.** It's an all-caps, condensed display face with
uncertain non-Latin glyph coverage — never apply it to a Spotify track title, artist
name, or a player's own typed name. Those are arbitrary external/user text and stay in
Epilogue, where legibility matters more than branding. `.brand-title` and `.room-code`
are the only places holding text this project itself wrote.

### Assets

None. No logo, no favicon set, no OG image — this isn't a deployed public site.

## Component philosophy

Two hand-rolled, single-file React components — `src/HostApp.tsx` and
`src/PlayerApp.tsx` — no component library, no shared `components/` folder. Each owns
its own screen's local state (`useState`); the server's next broadcast is the only
source of truth, so there's nothing to lift or share between them. See
[STACK.md](STACK.md) for why this stays single-file per screen rather than split further.

## Layout & spacing

No formal grid or breakpoint system. `.host` is a centered max-width column sized for a
laptop/TV screen read from across a room — big moments (`.room-code`, `h2`, the reveal
answer) use `clamp()` rather than a fixed `rem` size, so they scale down safely on a
narrower laptop instead of overflowing. `.player` is a centered max-width column sized
for a phone, with `env(safe-area-inset-bottom)` padding for the iOS home-indicator area.

Three border-radius tokens (`--radius-sm` 8px inputs/chips, `--radius-md` 14px
buttons/list rows, `--radius-lg` 24px feature cards) replace the ad hoc per-element
values the first pass shipped with.

## Motion

Two rules bound everything below: `@media (prefers-reduced-motion: reduce)` collapses
every animation/transition duration to near-zero globally (one rule, in `styles.css`,
not scattered per-animation) — this is the one place a reader should check before adding
a new animation, not a pattern to reproduce per-rule. And **no infinite loops** — every
animation here is one-shot (entrance) or interaction-triggered (hover/press), never a
continuous background loop; that's a deliberate anti-default choice, not an oversight.

| Where | What | Why |
| --- | --- | --- |
| `button`, `a.button`, `.swatch-button` | Press: translates down, shadow flattens. Hover (pointer devices only, via `@media (hover: hover)`): lifts up, shadow deepens | Tactile "sticker button" feedback — see the vibrant/block-based language above |
| `.roster li`, `.leaderboard li` | Staggered rise-in on mount (`nth-child` delays, 0–280ms) | Only replays when the *list itself* remounts (a new phase), not on every score update, since list items keep stable `key`s across re-renders |
| `.room-code-card`, `.reveal-card`, any `.card-enter` section | Pop-in (scale + fade, back-out easing) on mount | Marks a phase transition as a genuine moment, not a data refresh |
| `.leaderboard li.winner` | Pop-in, slightly delayed after the list's own stagger | The trophy shouldn't announce itself before the rest of the board has settled |
| `.status-line.pulsing` | A pulsing dot appended via `::after` | Replaces plain "Loading…" text with a cheap, non-looping-feeling wait indicator (technically a loop, but small/quiet enough not to read as one — reserve for genuine waits, not everything) |

## Interaction rules

- Every action (search, submit, vote) is a direct WS send or `fetch` with **no
  optimistic UI** — the next state broadcast from the server is what actually renders.
- Errors surface as a dismissible banner (click to clear) — never a browser `alert()`.
- No skeletons — a pulsing status line is enough for a two-screen party game with no
  data-heavy views.
- Round-end state (`.claude/SECURITY.md`) is shown as a count ("3/4 voted"), never a
  per-player list — that's a security property, not a style choice; see ADR-003.
- The reveal moment gets a colour wash from context, never from the submitter's
  identity on the *player* side: the host's `.reveal-card` uses the submitter's own
  player colour (`data-colour`, a spotlight — safe, since the reveal has already
  happened), but the player's `.reveal-card` uses `data-result="yes"|"no"|"own"` (green/
  rose/gold) — the player cares whether *they* were right, not a colour identity lookup.

## Accessibility

- A player colour is **never the only signal** — every swatch is always paired with the
  player's name.
- Inputs are `16px` minimum — anything smaller makes iOS zoom on focus and the layout
  doesn't recover.
- Touch targets (colour swatches, guess buttons) are ≥48px, with `touch-action:
  manipulation` to remove the 300ms tap delay.
- All 8 player colours are checked for ≥3:1 contrast against `--bg`.
- `:focus-visible` gets an explicit 3px `--accent` outline globally — the host laptop is
  as likely to be driven by keyboard as touch.
- Anton/Epilogue load with `&display=swap`; the `--font-body`/`--font-display` stacks
  both end in a generic fallback (`sans-serif`), so a blocked/slow Google Fonts request
  degrades to system fonts instead of invisible text.

## Do's and don'ts

| Do | Don't |
| --- | --- |
| Read a colour's hex from `:root` once, reference it via `var(--player-colour)` | Hardcode a hex value in a `.tsx` file |
| Show a count ("3/5 voted") for round progress | Show a per-player list of who's voted/ready — see `.claude/SECURITY.md`, it's a submitter-identity leak, not a UX choice |
| Let the server's next broadcast be the only source of truth | Locally predict or optimistically update game state |
| Use Anton only for this app's own static copy (title, room code, result banners) | Apply Anton to a Spotify track/artist name or a player's typed name |
| Give an entrance animation to a section that mounts once per phase | Add a continuous/infinite-loop animation — reads as generic AI-generated motion, not intentional |
| Add a new animation inside the existing `prefers-reduced-motion` kill-switch's reach | Gate motion by hand-adding a reduced-motion check to every new rule individually |
