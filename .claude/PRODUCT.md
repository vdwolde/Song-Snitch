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
2. Host creates a room, sets songs-per-player (default 3), and shows the room code / QR.
3. Each player joins on their phone, picks a name and colour, and searches for and
   submits that many songs.
4. Host starts the game once every player has submitted enough songs.
5. Each round: the host screen plays a track out loud; every phone shows every player's
   name to guess "who added this?" The answer reveals once everyone's voted, the host
   taps Skip, or the track finishes — whichever comes first.
6. After the last round, everyone sees the final leaderboard; the top score wins.

## Feature overview

| Feature | Value |
| --- | --- |
| Server-side Spotify search, no player login | Every player contributes without needing their own Spotify account |
| Shared host screen + phone controllers | No app install; plays like Kahoot/Jackbox |
| Live scoring & reveal after every round | Keeps the room engaged between songs |
| QR code + room code join | Removes "type an IP into eight phones" friction |

## Goals

1. A full game — submit, play every round, reveal, final leaderboard — works
   end-to-end on one home WiFi network with zero setup beyond the host's Spotify login.
2. No player needs their own Spotify account, login, or app install.

## Non-goals

Deliberately out of scope today. **Do not build these without a product decision** —
they are choices, not omissions.

- **Player Spotify login / browsing your own playlists.** Spotify requires HTTPS
  redirect URIs (loopback IPs are the only HTTP exception) and appears to reject
  private-LAN IPs even over HTTPS — a phone on the LAN structurally cannot complete
  Spotify OAuth. See [SECURITY.md](SECURITY.md) and ADR-001 in [DECISIONS.md](DECISIONS.md).
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

## Success metrics

A group of 3+ friends completes one full game — submit, play every round, see a final
leaderboard — in one sitting without anyone needing to read this doc.
