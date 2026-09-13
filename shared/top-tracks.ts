// Pure picker logic for top-tracks mode: dependency-free and RNG-injected so it's
// testable under node:test without touching Spotify or Math.random (same discipline as
// server/game.ts's shuffle()). See .claude/DOMAIN.md for how this feeds a room's
// submissions, and server/game.ts::autoSubmit for the caller.
import type { TrackInfo } from './types';

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

// A year-long favourite says more about who someone is than last week's discovery —
// this game is "guess the person," not "guess the playlist."
const RANGE_WEIGHT: Record<TimeRange, number> = { short_term: 0.8, medium_term: 1.0, long_term: 1.2 };
// Each step down a range's list is 2% less likely than the one above it — gentle on
// purpose, so the tail of the pool still gets drawn regularly across repeat games.
const RANK_DECAY = 0.98;

export interface RankedTracks {
  range: TimeRange;
  tracks: TrackInfo[];
}

interface Candidate {
  track: TrackInfo;
  weight: number;
}

// Dedupes across ranges by SUMMING weight — a track that's in all three ranges is a
// signature song, and should be more likely to be drawn, not just present once.
export function buildPool(ranked: RankedTracks[], excludeIds: ReadonlySet<string>): Candidate[] {
  const byId = new Map<string, Candidate>();
  for (const { range, tracks } of ranked) {
    tracks.forEach((t, rank) => {
      if (excludeIds.has(t.id)) return;
      const weight = RANGE_WEIGHT[range] * RANK_DECAY ** rank;
      const existing = byId.get(t.id);
      if (existing) existing.weight += weight;
      else byId.set(t.id, { track: t, weight });
    });
  }
  return [...byId.values()];
}

// Efraimidis-Spirakis weighted random sampling without replacement: key = rng()^(1/weight),
// sort descending. Returns the WHOLE pool as an ordered list, not a fixed number of
// picks — the caller (server/game.ts::autoSubmit) walks it in order and takes however
// many pass its own room-wide duplicate/playability checks.
export function orderByWeightedRandom(pool: Candidate[], rng: () => number): TrackInfo[] {
  return pool
    .map((c) => ({ track: c.track, key: rng() ** (1 / c.weight) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.track);
}

// The shape of a Spotify API track object — shared so server/spotify.ts::search() and
// the player's top-tracks import (src/spotify-top-tracks.ts) map it identically and
// can't drift out of sync with each other.
export interface SpotifyTrackLike {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

export function toTrackInfo(t: SpotifyTrackLike): TrackInfo {
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(', '),
    albumArt: t.album.images[t.album.images.length - 1]?.url ?? null,
    durationMs: t.duration_ms,
  };
}
