// Pure picker logic — no Spotify I/O, no game state. Lives under server/ so it matches
// the existing `tsx --test server/*.test.ts` glob without touching package.json (see
// server/game.test.ts, which already imports from ../shared/).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPool, orderByWeightedRandom } from '../shared/top-tracks';
import type { TrackInfo } from '../shared/types';

function track(id: string): TrackInfo {
  return { id, uri: `spotify:track:${id}`, name: `Track ${id}`, artists: 'Artist', albumArt: null, durationMs: 200000 };
}

test('buildPool sums weight across ranges — a track in all three outranks a rank-0 single-range track', () => {
  const pool = buildPool(
    [
      { range: 'short_term', tracks: [track('signature')] },
      { range: 'medium_term', tracks: [track('signature')] },
      { range: 'long_term', tracks: [track('signature'), track('long-only')] },
    ],
    new Set(),
  );
  const signature = pool.find((c) => c.track.id === 'signature')!;
  const longOnly = pool.find((c) => c.track.id === 'long-only')!;
  assert.ok(signature.weight > longOnly.weight, `${signature.weight} should exceed ${longOnly.weight}`);
});

test('buildPool drops excluded ids from every range', () => {
  const pool = buildPool(
    [
      { range: 'short_term', tracks: [track('a'), track('b')] },
      { range: 'long_term', tracks: [track('a')] },
    ],
    new Set(['a']),
  );
  assert.deepEqual(
    pool.map((c) => c.track.id),
    ['b'],
  );
});

test('orderByWeightedRandom with a constant rng sorts strictly by weight', () => {
  const pool = buildPool([{ range: 'long_term', tracks: [track('rank0'), track('rank1'), track('rank2')] }], new Set());
  const ordered = orderByWeightedRandom(pool, () => 0.5);
  // 0.5^(1/w) is strictly increasing in w for 0<0.5<1, so descending key order === descending weight order.
  assert.deepEqual(
    ordered.map((t) => t.id),
    ['rank0', 'rank1', 'rank2'],
  );
});

test('orderByWeightedRandom returns a permutation, not a subset', () => {
  const pool = buildPool([{ range: 'short_term', tracks: [track('a'), track('b'), track('c')] }], new Set());
  const ordered = orderByWeightedRandom(pool, () => 1);
  assert.deepEqual(
    ordered.map((t) => t.id).sort(),
    ['a', 'b', 'c'],
  );
});

test('a higher-ranked track is drawn first materially more often than a lower-ranked one', () => {
  // A tiny seeded LCG — deterministic, no flake.
  let seed = 42;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const tracks = Array.from({ length: 50 }, (_, i) => track(`t${i}`));
  const pool = buildPool([{ range: 'long_term', tracks }], new Set());

  let rank0First = 0;
  let rank49First = 0;
  const trials = 5000;
  for (let i = 0; i < trials; i++) {
    const first = orderByWeightedRandom(pool, rng)[0].id;
    if (first === 't0') rank0First++;
    if (first === 't49') rank49First++;
  }
  // Comparing rank-0 against rank-49 (rather than against a uniform baseline) keeps
  // this test agnostic to RANK_DECAY's exact value — it only needs rank to matter at
  // all, which is the property that matters, not a specific decay curve's math.
  assert.ok(
    rank0First > rank49First * 1.5,
    `expected rank-0 (${rank0First}) to clearly lead rank-49 (${rank49First})`,
  );
});
