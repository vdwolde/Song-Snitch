// Types shared between server and client. Keep this file dependency-free (no imports
// from server/ or src/) so both sides can import it without pulling in the other's code.

export const PLAYER_COLOURS = [
  'crimson',
  'amber',
  'lime',
  'mint',
  'azure',
  'violet',
  'magenta',
  'sand',
] as const;
export type PlayerColour = (typeof PLAYER_COLOURS)[number];

// The colour set IS the player cap — see .claude/DESIGN.md.
export const MAX_PLAYERS = PLAYER_COLOURS.length;
export const DEFAULT_SONGS_PER_PLAYER = 3;

export type Phase = 'lobby' | 'playing' | 'reveal' | 'finished';
export type RoundEndReason = 'all-voted' | 'track-ended' | 'skipped';

export interface TrackInfo {
  id: string;
  uri: string;
  name: string;
  artists: string;
  albumArt: string | null;
  durationMs: number;
}

// A roster entry — safe to send to every screen, in every phase. Never carries who
// submitted what; see .claude/SECURITY.md for why that split matters.
export interface PlayerView {
  id: string;
  name: string;
  colour: PlayerColour;
  connected: boolean;
  score: number;
  submittedCount: number;
}

export interface HostState {
  code: string; // '' before a room has been created
  phase: Phase;
  songsPerPlayer: number;
  lanUrl: string;
  players: PlayerView[];
  needsDevice: boolean; // Spotify Web Playback SDK device not yet connected
  spotifyUser: string | null;
  round: {
    index: number;
    total: number;
    track: TrackInfo; // the host screen renders the full track, incl. its Spotify URI
    // A count, never a per-player list: a discrete "who's ready" set is unavoidably a
    // leak by construction — the round can only end once every non-submitter has
    // voted, so any per-player readiness set converges to naming the one who didn't.
    votedCount: number;
    expectedVoters: number;
  } | null;
  // Deliberately no submitterId anywhere on this type: the host laptop is a shared
  // screen the whole room can see, so it's treated as a player surface, not a trusted one.
}

export interface PlayerState {
  code: string;
  phase: Phase;
  songsPerPlayer: number;
  you: { id: string; name: string; colour: PlayerColour; score: number };
  players: PlayerView[];
  yourSubmissions: { id: string; name: string; artists: string }[];
  round: {
    index: number;
    total: number;
    track: { name: string; artists: string; albumArt: string | null }; // no uri, no id
    isYours: boolean; // "sit this one out"
    yourGuessId: string | null; // echo of your own vote only
    votedCount: number;
    expectedVoters: number;
  } | null;
}

// The ONLY type on the wire that carries who submitted a track. Constructed in exactly
// one place (server/game.ts's endRound) and sent identically to every connected client.
export interface Reveal {
  index: number;
  total: number;
  track: { name: string; artists: string; albumArt: string | null };
  submitterId: string;
  correctPlayerIds: string[];
  endReason: RoundEndReason;
  scores: { playerId: string; score: number; gained: 0 | 1 }[];
  isLastRound: boolean;
}

export type ErrorCode =
  | 'bad-room'
  | 'name-taken'
  | 'colour-taken'
  | 'room-full'
  | 'game-in-progress'
  | 'not-host'
  | 'not-premium'
  | 'spotify';

export type ClientMsg =
  | { t: 'host:hello' }
  | { t: 'host:createRoom'; songsPerPlayer: number }
  | { t: 'host:deviceReady'; deviceId: string }
  | { t: 'host:start' }
  | { t: 'host:skip' }
  | { t: 'host:trackEnded' }
  | { t: 'host:next' }
  | { t: 'player:join'; code: string; name: string; colour: PlayerColour }
  | { t: 'player:rejoin'; code: string; token: string }
  | { t: 'player:submit'; track: TrackInfo }
  | { t: 'player:unsubmit'; trackId: string }
  | { t: 'player:vote'; guessId: string };

export type ServerMsg =
  | { t: 'error'; code: ErrorCode; message: string }
  | ({ t: 'player:identity' } & { playerId: string; token: string })
  | ({ t: 'host:state' } & HostState)
  | ({ t: 'player:state' } & PlayerState)
  | ({ t: 'reveal' } & Reveal);
