# PRODUCT

Why Song Snitch exists, who it serves, and what it is (and is not) meant to do.
Audience: stakeholders and agents implementing user-facing behavior. For *how* it works
see [ARCHITECTURE.md](ARCHITECTURE.md); for domain rules see [DOMAIN.md](DOMAIN.md).

## Vision

A room full of friends turns their own Spotify libraries into a party guessing game —
one shared screen, everyone's own phone, no app install.

## Problem

Kahoot/Jackbox-style party games are great for a shared screen + phone controllers, but
none of them are *about your own music* — the trivia has to be pre-written by someone.
Song Snitch turns songs the room already picked into the game itself.

## Target users

- **The host** — one person, on a laptop, with a Spotify **Premium** account. Runs the
  shared screen and is the only device that ever authenticates.
- **Players** — up to 7 others, each on their own phone, on the same WiFi. No Spotify
  account, no app install, no login of any kind — see Non-goals.

## Core workflow

1. Host opens the host screen on their laptop and connects Spotify (Premium required).
2. Host creates a room, sets songs-per-player (default 3) and the mode — everyone picks
   their own songs (**manual**, the default), or everyone's top tracks are auto-imported
   (**top-tracks**, see below) — and shows the room code / QR.
3. Each player joins on their phone, picks a name and colour. In manual mode, they
   search for and submit that many songs. In top-tracks mode, they connect their own
   Spotify and their most-played songs are submitted automatically.
4. Host starts the game once every player has submitted enough songs.
5. Each round: the host screen plays a track out loud; every phone shows every player's
   name to guess "who added this?" The answer reveals once everyone's voted, the host
   taps Skip, or the track finishes — whichever comes first.
6. After the last round, everyone sees the final leaderboard; the top score wins.

## Feature overview

| Feature | Value |
| --- | --- |
| Server-side Spotify search, no player login (manual mode) | Every player contributes without needing their own Spotify account |
| Auto-import each player's Spotify top tracks (top-tracks mode) | Skips hand-picking; picks a different set on repeat games (see [DECISIONS.md](DECISIONS.md) ADR-004) |
| Shared host screen + phone controllers | No app install; plays like Kahoot/Jackbox |
| Live scoring & reveal after every round | Keeps the room engaged between songs |
| QR code + room code join | Removes "type an IP into eight phones" friction |

## Goals

1. A full game — submit, play every round, reveal, final leaderboard — works
   end-to-end on one home WiFi network with zero setup beyond the host's Spotify login.
2. No player needs their own Spotify account, login, or app install — **in manual
   mode.** Top-tracks mode is an opt-in exception the host chooses at room creation;
   see ADR-004.

## Non-goals

Deliberately out of scope today. **Do not build these without a product decision** —
they are choices, not omissions.

- **Browsing a player's own playlists, or anything beyond their top tracks.**
  Top-tracks mode (ADR-004) reversed the flat "no player Spotify login" rule for the
  narrow case of auto-importing top tracks; it did not open the door to arbitrary
  per-player Spotify browsing, which stays out of scope.
- More than one concurrent room — one host, one Premium account, one set of speakers.
- Joining mid-game — a late joiner has submitted nothing and would be an impossible
  answer in every round's guess grid.
- Speed/streak scoring, changing a vote once cast, or tie-breakers — a tie is a tie,
  both names are shown.
- Persisting a game across a server restart — the process lifetime *is* the party.
- Remote/internet play — LAN only, by design.

## Known gaps

| Gap | Impact | Status |
| --- | --- | --- |
| Server restart loses all game state (room, scores, Spotify session) | Have to start over | Accepted — see ADR-001 |
| Windows Firewall's first-LAN-connection prompt can be dismissed silently | Game looks broken with no error shown | Start-Project.bat warns before serving; not otherwise mitigated |
| AP/client isolation on some routers blocks phone-to-host LAN traffic entirely | Game unplayable on that network | Untested — verify a phone can reach `/api/health` days before a party, not at it |
| `npm audit` reports vulnerabilities in dev-only transitive deps (esbuild/Vite's dev server) | None at runtime — dev-server only, LAN-only tool | Open, low priority |
| Never verified end-to-end with real phones (only desktop multi-tab) | Phone-only failure modes (screen-lock WS drop, iOS Safari layout) unconfirmed | Open — see README's phone-test checklist |
| Top-tracks mode needs internet on every phone (`vdwolde.com` + Spotify itself) | "LAN-only party game" doesn't hold for this mode specifically | Accepted for this mode only — see ADR-004; manual mode is unaffected and stays the default |
| Top-tracks mode's recently-used exclusion list (`localStorage`) is keyed to the phone's origin | A new DHCP lease for the host, or using `npm run dev` instead of `npm start`, silently resets a player's variety history with no error shown | Open, low priority |
| Top-tracks mode's OAuth bounce page has not been tested against Chrome's Local Network Access prompt | May eventually gate the page's return navigation to the LAN | Untested |
| Top-tracks mode's login round trip through iOS's "Open in Spotify?" interstitial is untested | If it returns the player in a new tab, they lose their `sessionStorage` identity | Untested |
| Top-tracks mode has not been verified end-to-end with two real Spotify accounts | The core "different songs each repeat game" requirement is unconfirmed against real listening history | Open — needs two real phones + two real accounts, see ROADMAP.md if still present |

## Success metrics

A group of 3+ friends completes one full game — submit, play every round, see a final
leaderboard — in one sitting without anyone needing to read this doc.
