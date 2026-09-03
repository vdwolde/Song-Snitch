# GLOSSARY

Canonical definitions for project-specific terms — the words that don't mean what they'd
mean in a generic codebase, or that two people could reasonably use differently. Each term
is defined **once, here**; other docs use it without redefining it, and link
(`[term](GLOSSARY.md#term)`) instead of re-explaining.

| Term | Definition |
| --- | --- |
| Room | The single game session this server ever holds (one at a time) — created by the host, joined via a 4-character code. |
| Round | One song's play → guess → reveal cycle. A game has `songsPerPlayer × player count` rounds. |
| Reveal | The moment, and the WS message, that discloses who submitted the currently-playing track — sent identically to every client. |
| Submitter | The player who added the track currently playing. Never present on the wire outside a `Reveal`. |
| Host | The one device that authenticates with Spotify (Premium required) and physically plays audio. Loopback-only in the network guard. |
| Player | Anyone who joins with a room code from their own phone. No Spotify account needed. |
| Voter / expected voter | A connected player other than the current round's submitter — the population whose votes a round is waiting on. |
| Songs per player | The host-set number of tracks each player must submit before the game can start (default 3, clamped 1–5). |
| LAN | Local Area Network — the game is deliberately never exposed beyond the host's home WiFi. |
| PKCE | Proof Key for Code Exchange — the OAuth flow this project uses so no Spotify client secret is ever needed. |
