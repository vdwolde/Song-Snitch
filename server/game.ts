// The single source of truth for the one room this server ever holds, and the only
// writer of that state. No socket code lives here — server/ws.ts calls these functions
// and broadcasts what they return. See .claude/SECURITY.md for why the submitter must
// never leak before a reveal, and .claude/ARCHITECTURE.md for the round-end race.
import { randomBytes } from 'node:crypto';
import * as net from './net';
import * as spotify from './spotify';
import {
  DEFAULT_SONGS_PER_PLAYER,
  MAX_PLAYERS,
  PLAYER_COLOURS,
  type ErrorCode,
  type HostState,
  type Phase,
  type PlayerColour,
  type PlayerState,
  type Reveal,
  type RoomMode,
  type RoundEndReason,
  type TrackInfo,
} from '../shared/types';

const PORT = Number(process.env.PORT ?? 5178);
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O — easy to read aloud

interface Player {
  id: string;
  token: string; // secret; sent once, only down that player's own socket
  name: string;
  colour: PlayerColour;
  connected: boolean;
  score: number;
  submissions: TrackInfo[];
}

interface Round {
  track: TrackInfo;
  submitterId: string; // the secret — lives here and in Reveal, nowhere else
  seq: number; // monotonic; guards a stale timer/play-callback from a superseded round
  startedAt: number; // 0 until Spotify confirms play; else Date.now()
  votes: Map<string, string>; // voterId -> guessedPlayerId
  timer: ReturnType<typeof setTimeout> | null;
  endReason: RoundEndReason | null; // non-null ⇒ this round is already over
}

interface Room {
  code: string;
  songsPerPlayer: number;
  mode: RoomMode;
  phase: Phase;
  players: Map<string, Player>;
  rounds: Round[];
  roundIndex: number;
  lastReveal: Reveal | null;
}

// One room, not a Map<code, Room> — one host, one Premium account, one set of speakers.
// Two concurrent rooms would fight over the single playback device.
let room: Room | null = null;

// The playback device is a server-session resource, not a per-room one — reconnecting
// Spotify shouldn't be required just because the host started a new room.
let deviceId: string | null = null;

let seqCounter = 0;

let notifyState: (() => void) | null = null;
let notifyReveal: ((reveal: Reveal) => void) | null = null;

export function setBroadcasters(state: () => void, reveal: (r: Reveal) => void): void {
  notifyState = state;
  notifyReveal = reveal;
}

export function getRoom(): Room | null {
  return room;
}

export function isValidPlayerToken(token: string): boolean {
  if (!room) return false;
  for (const p of room.players.values()) if (p.token === token) return true;
  return false;
}

type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };
function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
function err<T>(code: ErrorCode, message: string): Result<T> {
  return { ok: false, code, message };
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return code;
}

function playerViews(): { id: string; name: string; colour: PlayerColour; connected: boolean; score: number; submittedCount: number }[] {
  if (!room) return [];
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    colour: p.colour,
    connected: p.connected,
    score: p.score,
    submittedCount: p.submissions.length,
  }));
}

function expectedVoters(r: Round): number {
  if (!room) return 0;
  let n = 0;
  for (const p of room.players.values()) if (p.connected && p.id !== r.submitterId) n++;
  return n;
}

export function createRoom(songsPerPlayer: number, mode: RoomMode = 'manual'): void {
  const n = Math.min(5, Math.max(1, Math.round(songsPerPlayer) || DEFAULT_SONGS_PER_PLAYER));
  room = {
    code: randomRoomCode(),
    songsPerPlayer: n,
    mode: mode === 'top-tracks' ? 'top-tracks' : 'manual',
    phase: 'lobby',
    players: new Map(),
    rounds: [],
    roundIndex: -1,
    lastReveal: null,
  };
  notifyState?.();
}

export function setDeviceReady(id: string): void {
  deviceId = id;
  notifyState?.();
  if (room && room.phase === 'playing') {
    const r = room.rounds[room.roundIndex];
    if (r && !r.endReason) {
      const resumeAt = r.startedAt > 0 ? Date.now() - r.startedAt : 0;
      armRound(r, resumeAt);
    }
  }
}

function armRound(r: Round, positionMs: number): void {
  if (!room || !deviceId) return;
  const seq = r.seq;
  void spotify
    .play(deviceId, r.track.uri, positionMs)
    .then(() => {
      if (!room || r.seq !== seq || r.endReason) return;
      if (r.startedAt === 0) {
        r.startedAt = Date.now() - positionMs;
        r.timer = setTimeout(
          () => {
            if (room?.rounds[room.roundIndex]?.seq === seq) endRound('track-ended');
          },
          r.track.durationMs - positionMs + 1500,
        );
        notifyState?.();
      }
    })
    .catch(() => {
      // Playback failed to start (device lost, network blip). The round stays open —
      // the host can Skip, or the room's own track-ended guard never fires and the
      // round simply waits. Nothing to recover automatically for a party game.
    });
}

function startRound(index: number): void {
  if (!room) return;
  const r = room.rounds[index];
  r.startedAt = 0;
  r.votes.clear();
  r.endReason = null;
  r.seq = ++seqCounter;
  room.roundIndex = index;
  room.phase = 'playing';
  notifyState?.();
  armRound(r, 0);
}

export function joinRoom(code: string, name: string, colour: PlayerColour): Result<{ playerId: string; token: string }> {
  if (!room || room.code !== code.toUpperCase()) return err('bad-room', 'Room not found');
  if (room.phase !== 'lobby') return err('game-in-progress', 'The game has already started');
  const trimmedName = name.trim().slice(0, 24);
  if (!trimmedName) return err('bad-room', 'Name is required');
  if (!(PLAYER_COLOURS as readonly string[]).includes(colour)) return err('bad-room', 'Invalid colour');
  if (room.players.size >= MAX_PLAYERS) return err('room-full', 'Room is full');
  for (const p of room.players.values()) {
    if (p.name.toLowerCase() === trimmedName.toLowerCase()) return err('name-taken', 'That name is taken');
    if (p.colour === colour) return err('colour-taken', 'That colour is taken');
  }
  const id = 'p_' + randomBytes(4).toString('hex');
  const token = randomBytes(16).toString('hex');
  room.players.set(id, { id, token, name: trimmedName, colour, connected: true, score: 0, submissions: [] });
  notifyState?.();
  return ok({ playerId: id, token });
}

export function rejoinPlayer(code: string, token: string): Result<{ playerId: string }> {
  if (!room || room.code !== code.toUpperCase()) return err('bad-room', 'Room not found');
  const player = [...room.players.values()].find((p) => p.token === token);
  if (!player) return err('bad-room', 'Unknown player — join again');
  player.connected = true;
  notifyState?.();
  if (room.phase === 'playing') {
    const r = room.rounds[room.roundIndex];
    if (r) maybeEndOnAllVoted(r);
  }
  return ok({ playerId: player.id });
}

export function setPlayerConnected(playerId: string, connected: boolean): void {
  if (!room) return;
  const p = room.players.get(playerId);
  if (!p) return;
  p.connected = connected;
  notifyState?.();
  if (room.phase === 'playing') {
    const r = room.rounds[room.roundIndex];
    if (r) maybeEndOnAllVoted(r);
  }
}

export function submitTrack(playerId: string, track: TrackInfo): Result<void> {
  if (!room || room.phase !== 'lobby') return err('bad-room', 'Submissions are closed');
  const p = room.players.get(playerId);
  if (!p) return err('bad-room', 'Unknown player');
  // 'submit-rejected', not 'bad-room' — the player is still valid, only this particular
  // song was; PlayerApp must not treat these as "your session is dead."
  if (p.submissions.length >= room.songsPerPlayer) return err('submit-rejected', "You've submitted enough songs");
  for (const other of room.players.values()) {
    if (other.submissions.some((t) => t.id === track.id)) {
      return err('submit-rejected', 'Someone already submitted that song');
    }
  }
  p.submissions.push(track);
  notifyState?.();
  return ok(undefined);
}

export function unsubmitTrack(playerId: string, trackId: string): Result<void> {
  if (!room || room.phase !== 'lobby') return err('bad-room', 'Submissions are closed');
  // Removing an auto-imported song would just have it re-imported on the next
  // top-tracks submit — there's nothing to remove it FOR in this mode.
  if (room.mode === 'top-tracks') return err('submit-rejected', 'Songs are auto-imported in this mode');
  const p = room.players.get(playerId);
  if (!p) return err('bad-room', 'Unknown player');
  p.submissions = p.submissions.filter((t) => t.id !== trackId);
  notifyState?.();
  return ok(undefined);
}

// top-tracks mode: the player's phone sends its whole ordered candidate list (already
// built by shared/top-tracks.ts from their own Spotify top tracks); this takes the
// first songsPerPlayer that are playable in the HOST's market (see
// spotify.ts::playableIds) and not already submitted by anyone else in the room.
// Async because it calls Spotify — re-checks the room/player after the await, since
// the room can move on while a phone is mid-request.
export async function autoSubmit(playerId: string, candidates: TrackInfo[]): Promise<Result<void>> {
  if (!room || room.phase !== 'lobby' || room.mode !== 'top-tracks') {
    return err('bad-room', 'Submissions are closed');
  }
  const requestingRoom = room;
  const p = requestingRoom.players.get(playerId);
  if (!p) return err('bad-room', 'Unknown player');
  if (p.submissions.length >= requestingRoom.songsPerPlayer) return ok(undefined);

  const capped = candidates.slice(0, 50);
  let playable: Set<string>;
  try {
    playable = await spotify.playableIds(
      capped.map((c) => c.id),
      spotify.getHostCountry(),
    );
  } catch {
    // Not authenticated, or Spotify unreachable — don't block a party game over this;
    // treat every candidate as playable (a genuine 403 at playback still falls back to
    // the host's existing Skip button).
    playable = new Set(capped.map((c) => c.id));
  }

  if (room !== requestingRoom || room.phase !== 'lobby') return err('bad-room', 'Submissions are closed');
  const stillP = room.players.get(playerId);
  if (!stillP) return err('bad-room', 'Unknown player');

  const takenIds = new Set<string>();
  for (const other of room.players.values()) for (const t of other.submissions) takenIds.add(t.id);

  const remaining = room.songsPerPlayer - stillP.submissions.length;
  let added = 0;
  for (const track of capped) {
    if (added >= remaining) break;
    if (!playable.has(track.id) || takenIds.has(track.id)) continue;
    stillP.submissions.push(track);
    takenIds.add(track.id);
    added++;
  }
  notifyState?.();
  if (added < remaining) {
    return err(
      'submit-rejected',
      `Only found ${stillP.submissions.length}/${room.songsPerPlayer} playable songs — pick the rest yourself`,
    );
  }
  return ok(undefined);
}

export function startGame(): Result<void> {
  if (!room || room.phase !== 'lobby') return err('bad-room', 'No room in the lobby phase');
  const players = [...room.players.values()];
  if (players.length < 2) return err('bad-room', 'Need at least 2 players to start');
  if (players.some((p) => p.submissions.length !== room!.songsPerPlayer)) {
    return err('bad-room', 'Not everyone has submitted enough songs yet');
  }
  const rounds: Round[] = [];
  for (const p of players) {
    for (const track of p.submissions) {
      rounds.push({ track, submitterId: p.id, seq: 0, startedAt: 0, votes: new Map(), timer: null, endReason: null });
    }
  }
  shuffle(rounds);
  room.rounds = rounds;
  room.roundIndex = -1;
  nextRound();
  return ok(undefined);
}

export function castVote(playerId: string, guessId: string): Result<void> {
  if (!room || room.phase !== 'playing') return err('bad-room', 'No active round');
  const r = room.rounds[room.roundIndex];
  const voter = room.players.get(playerId);
  const guessed = room.players.get(guessId);
  if (!r || !voter || !guessed) return err('bad-room', 'Invalid vote');
  if (playerId === r.submitterId) return err('bad-room', "You can't vote on your own song");
  if (guessId === playerId) return err('bad-room', "You can't guess yourself");
  if (r.votes.has(playerId)) return err('bad-room', 'Already voted');
  r.votes.set(playerId, guessId);
  notifyState?.();
  maybeEndOnAllVoted(r);
  return ok(undefined);
}

function maybeEndOnAllVoted(r: Round): void {
  const expected = expectedVoters(r);
  if (expected > 0 && r.votes.size >= expected) endRound('all-voted');
}

export function skipRound(): void {
  endRound('skipped');
}

export function trackEnded(): void {
  if (!room) return;
  const r = room.rounds[room.roundIndex];
  // The SDK emits a spurious {paused:true, position:0} right after play() starts —
  // ignore anything within 3s of the round actually starting.
  if (!r || r.startedAt === 0 || Date.now() - r.startedAt < 3000) return;
  endRound('track-ended');
}

// Fully synchronous through the phase flip and the broadcast — the invariant that
// makes three racing end triggers (all-voted, track-ended, skip) safe. Whichever calls
// this first wins; every later call this round sees r.endReason already set and no-ops.
function endRound(reason: RoundEndReason): void {
  if (!room) return;
  const r = room.rounds[room.roundIndex];
  if (room.phase !== 'playing' || !r || r.endReason) return;
  r.endReason = reason;
  room.phase = 'reveal';
  if (r.timer) {
    clearTimeout(r.timer);
    r.timer = null;
  }
  const correctPlayerIds: string[] = [];
  const scores: Reveal['scores'] = [];
  for (const p of room.players.values()) {
    const guess = r.votes.get(p.id);
    let gained: 0 | 1 = 0;
    if (guess === r.submitterId) {
      p.score += 1;
      gained = 1;
      correctPlayerIds.push(p.id);
    }
    scores.push({ playerId: p.id, score: p.score, gained });
  }
  const reveal: Reveal = {
    index: room.roundIndex,
    total: room.rounds.length,
    track: { name: r.track.name, artists: r.track.artists, albumArt: r.track.albumArt },
    submitterId: r.submitterId,
    correctPlayerIds,
    endReason: reason,
    scores,
    isLastRound: room.roundIndex === room.rounds.length - 1,
  };
  room.lastReveal = reveal;
  notifyState?.();
  notifyReveal?.(reveal);
  void spotify.pause(deviceId); // fire-and-forget: Spotify must never gate the reveal
}

export function nextRound(): void {
  if (!room) return;
  // Only advance out of a reveal — except the initial kickoff from startGame, where
  // roundIndex is still -1 and phase is still 'lobby' at this point.
  if (room.roundIndex !== -1 && room.phase !== 'reveal') return;
  const next = room.roundIndex + 1;
  room.lastReveal = null;
  if (next >= room.rounds.length) {
    room.phase = 'finished';
    notifyState?.();
    return;
  }
  startRound(next);
}

export function hostState(): HostState {
  const r = room && room.roundIndex >= 0 ? room.rounds[room.roundIndex] : null;
  return {
    code: room?.code ?? '',
    phase: room?.phase ?? 'lobby',
    songsPerPlayer: room?.songsPerPlayer ?? DEFAULT_SONGS_PER_PLAYER,
    mode: room?.mode ?? 'manual',
    joinUrl: net.playerJoinUrl(PORT),
    players: playerViews(),
    needsDevice: !deviceId,
    spotifyUser: spotify.getHostUser(),
    round:
      r && room!.phase === 'playing'
        ? { index: room!.roundIndex, total: room!.rounds.length, track: r.track, votedCount: r.votes.size, expectedVoters: expectedVoters(r) }
        : null,
  };
}

export function playerState(playerId: string): PlayerState | null {
  if (!room) return null;
  const you = room.players.get(playerId);
  if (!you) return null;
  const r = room.roundIndex >= 0 ? room.rounds[room.roundIndex] : null;
  return {
    code: room.code,
    phase: room.phase,
    songsPerPlayer: room.songsPerPlayer,
    mode: room.mode,
    you: { id: you.id, name: you.name, colour: you.colour, score: you.score },
    players: playerViews(),
    yourSubmissions: you.submissions.map((t) => ({ id: t.id, name: t.name, artists: t.artists })),
    round:
      r && room.phase === 'playing'
        ? {
            index: room.roundIndex,
            total: room.rounds.length,
            track: { name: r.track.name, artists: r.track.artists, albumArt: r.track.albumArt },
            isYours: r.submitterId === playerId,
            yourGuessId: r.votes.get(playerId) ?? null,
            votedCount: r.votes.size,
            expectedVoters: expectedVoters(r),
          }
        : null,
  };
}
