# DOMAIN

The business rules, the data model, and the lifecycle of the core entity. Read this before
changing validation, scoring, or anything that decides what a value *means*. For structure
see [ARCHITECTURE.md](ARCHITECTURE.md); for terminology see [GLOSSARY.md](GLOSSARY.md).

## Core entity

The **Room** — one per server process, held in `server/game.ts`'s module-level `room`
variable. Its identity is a 4-character code (e.g. `QXKM`), not a persisted id — nothing
survives a restart (see [DECISIONS.md](DECISIONS.md) ADR-001).

## Data model

All in-memory (`Map`/array), never normalized, never persisted:

| Type | Field | Notes |
| --- | --- | --- |
| `Player` | `id`, `token` | Random, server-minted. `token` is a bearer secret for reconnect — never a client-chosen value. |
| | `name`, `colour` | Unique within the room, both server-enforced. |
| | `connected`, `score`, `submissions` | `submissions: TrackInfo[]`, capped at `songsPerPlayer`. |
| `Round` | `track`, `submitterId` | `submitterId` is the one field that must never reach a client before its `Reveal` — see [SECURITY.md](SECURITY.md). |
| | `seq` | Monotonic, never reset — guards a stale timer/play callback from a superseded round, safely even across a `createRoom()` reset. |
| | `votes` | `Map<voterId, guessedPlayerId>`. |
| | `endReason` | `null` until the round is over; non-null makes `endRound()` idempotent. |
| `Room` | `code`, `songsPerPlayer`, `mode`, `phase` | `mode` is `'manual'` or `'top-tracks'` (see [DECISIONS.md](DECISIONS.md) ADR-004), set once at `createRoom()` and never changed after |
| | `players`, `rounds`, `roundIndex` | `rounds` is built and shuffled once, at `startGame()`. |
| | `lastReveal` | Kept so a reconnecting client during the `reveal` phase gets resent the answer. |

The Spotify playback device id is deliberately **not** part of `Room` — it's a
module-level variable in `server/game.ts`, because it's a server-session resource (tied
to the host's browser tab), not a per-game one; starting a new room shouldn't require
reconnecting Spotify.

## Lifecycle

**Room:** `lobby → playing → reveal → finished` (`Phase` in `shared/types.ts`).
`playing ⇄ reveal` repeats once per round; there is no `submitting` phase — players
search and submit the moment they join, and "lock submissions" and "start" are one host
action (`host:start`).

**Round:** created unshuffled at `startGame()` → shuffled into `room.rounds` → armed
(`server/game.ts::armRound` calls Spotify `play()` and starts a `durationMs`-based
timer) → ended exactly once, via whichever of three triggers fires first:

| Trigger | Source |
| --- | --- |
| `all-voted` | Every connected non-submitter has cast a vote |
| `track-ended` | The server's own timer, or the Web Playback SDK's `player_state_changed` (debounced against a spurious signal right after `play()` — ignored within 3s of the round starting) |
| `skipped` | The host tapped Skip |

`endRound()`'s `if (room.phase !== 'playing' || !r || r.endReason) return;` guard is the
whole idempotency mechanism — see [ARCHITECTURE.md](ARCHITECTURE.md)'s concurrency model.

## Business rules (as implemented)

- **Score = 1 flat point per correct guess.** No speed bonus, no streaks — a deliberate
  v1 scope choice (`.claude/PRODUCT.md` non-goals).
- A player can't vote for their own submitted track (`server/game.ts::castVote`), and
  isn't counted in `expectedVoters` for that round.
- Colours and names must be unique within a room, case-insensitive for names
  (`server/game.ts::joinRoom`).
- A room caps at 8 players — exactly `PLAYER_COLOURS.length`, by construction
  (`shared/types.ts`), not an arbitrary limit.
- Joining is refused once `phase !== 'lobby'` (`game-in-progress`) — a late joiner has
  submitted nothing and would be an impossible answer in every remaining round.

## Validation

All server-side, client checks are UX only (`.claude/SECURITY.md`):

- Player name: trimmed, capped at 24 characters, required.
- Search query (`server/routes.ts`): capped at 100 characters.
- `songsPerPlayer`: clamped to 1–5 at room creation (`server/game.ts::createRoom`).
- A submitted track's Spotify id must be unique across the whole room, not just per player.
- `top-tracks` mode only: a candidate must also be playable in the **host's** Spotify
  market (`server/spotify.ts::playableIds`, `server/game.ts::autoSubmit`) — the
  player's own top-tracks fetch carries their own market, but the host's device is what
  actually plays the song. See [DECISIONS.md](DECISIONS.md) ADR-004.

## Source data & normalization

No imported files or feeds. In manual mode, track data comes live from the Spotify
Search API per query (`server/spotify.ts::search`). In `top-tracks` mode, each
player's phone fetches their own Spotify top tracks directly
(`src/spotify-top-tracks.ts`) and sends an ordered candidate list; the server never
queries Spotify for the tracks themselves in this mode, only to re-check playability.
Either way, track data is never cached or stored beyond the single `TrackInfo` snapshot
attached to a submission.

## Extending the domain

Adding a new round-end reason, for example, touches three files: `shared/types.ts`
(`RoundEndReason`), `server/game.ts` (the new trigger + `endRound`'s reason handling),
and whichever of `src/HostApp.tsx`/`src/PlayerApp.tsx` needs different reveal messaging.
