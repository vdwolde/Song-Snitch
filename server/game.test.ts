// Exercises the pure state transitions with no Spotify I/O: leaving the module-level
// deviceId unset makes armRound() take its "no device yet" branch, so startGame/
// startRound never touch the network. Each test resets the module by re-importing
// isn't necessary — every test calls createRoom() first, which replaces the room wholesale.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as game from './game';
import { MAX_PLAYERS, type PlayerColour, type RoomMode } from '../shared/types';

function join(code: string, name: string, colour: PlayerColour) {
  const r = game.joinRoom(code, name, colour);
  assert.equal(r.ok, true, `join(${name}) failed: ${!r.ok && r.message}`);
  if (!r.ok) throw new Error('unreachable');
  return r.value;
}

function freshRoom(songsPerPlayer = 1, mode: RoomMode = 'manual'): string {
  game.createRoom(songsPerPlayer, mode);
  return game.getRoom()!.code;
}

function track(id: string) {
  return { id, uri: `spotify:track:${id}`, name: `Track ${id}`, artists: 'Artist', albumArt: null, durationMs: 5000 };
}

test('colour and name uniqueness are enforced', () => {
  const code = freshRoom();
  join(code, 'Alice', 'pink');
  const dupColour = game.joinRoom(code, 'Bob', 'pink');
  assert.equal(dupColour.ok, false);
  assert.equal(!dupColour.ok && dupColour.code, 'colour-taken');

  const dupName = game.joinRoom(code, 'alice', 'amber'); // case-insensitive
  assert.equal(dupName.ok, false);
  assert.equal(!dupName.ok && dupName.code, 'name-taken');
});

test('room fills at MAX_PLAYERS and the next join is rejected', () => {
  const code = freshRoom();
  const colours = ['pink', 'orange', 'amber', 'yellow', 'green', 'sky', 'violet', 'lime'] as const;
  assert.equal(colours.length, MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) join(code, `P${i}`, colours[i]);
  const overflow = game.joinRoom(code, 'Overflow', 'pink');
  assert.equal(overflow.ok, false);
  assert.equal(!overflow.ok && overflow.code, 'room-full');
});

test('joining mid-game is rejected', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('a1'));
  const bob = game.getRoom()!.players.get([...game.getRoom()!.players.keys()][1])!;
  game.submitTrack(bob.id, track('b1'));
  assert.equal(game.startGame().ok, true);

  const late = game.joinRoom(code, 'Carol', 'lime');
  assert.equal(late.ok, false);
  assert.equal(!late.ok && late.code, 'game-in-progress');
});

test('startGame refuses with fewer than 2 players or incomplete submissions', () => {
  const code = freshRoom(2);
  const a = join(code, 'Alice', 'pink');
  assert.equal(game.startGame().ok, false); // only 1 player

  join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('a1'));
  assert.equal(game.startGame().ok, false); // Alice has 1/2, Bob has 0/2
});

test('shuffle touches every submission exactly once', () => {
  const code = freshRoom(2);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(a.playerId, track('a2'));
  game.submitTrack(b.playerId, track('b1'));
  game.submitTrack(b.playerId, track('b2'));
  assert.equal(game.startGame().ok, true);
  assert.equal(game.getRoom()!.rounds.length, 4);
  const ids = game.getRoom()!.rounds.map((r) => r.track.id).sort();
  assert.deepEqual(ids, ['a1', 'a2', 'b1', 'b2']);
});

test('endRound is idempotent under three racing triggers', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(b.playerId, track('b1'));
  assert.equal(game.startGame().ok, true);

  game.skipRound();
  game.skipRound(); // second call: no-op, phase already 'reveal'
  game.trackEnded(); // third trigger, also a no-op

  const reveal = game.getRoom()!.lastReveal!;
  assert.equal(reveal.endReason, 'skipped');
  assert.equal(game.getRoom()!.phase, 'reveal');
});

test('scoring: correct guess is +1, self-vote and post-reveal votes are rejected', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  const c = join(code, 'Carol', 'lime');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(b.playerId, track('b1'));
  game.submitTrack(c.playerId, track('c1'));
  assert.equal(game.startGame().ok, true);

  const submitterId = game.getRoom()!.rounds[0].submitterId;
  const selfVote = game.castVote(submitterId, submitterId === a.playerId ? b.playerId : a.playerId);
  assert.equal(selfVote.ok, false);

  const voters = [a.playerId, b.playerId, c.playerId].filter((id) => id !== submitterId);
  const correctGuess = game.castVote(voters[0], submitterId);
  assert.equal(correctGuess.ok, true);
  const wrongGuess = game.castVote(voters[1], voters[0]);
  assert.equal(wrongGuess.ok, true);

  assert.equal(game.getRoom()!.phase, 'reveal'); // all-voted (2 of 2 non-submitters)
  const reveal = game.getRoom()!.lastReveal!;
  assert.equal(reveal.endReason, 'all-voted');
  const correctScore = reveal.scores.find((s) => s.playerId === voters[0])!;
  assert.equal(correctScore.gained, 1);
  const wrongScore = reveal.scores.find((s) => s.playerId === voters[1])!;
  assert.equal(wrongScore.gained, 0);

  const lateVote = game.castVote(voters[0], submitterId);
  assert.equal(lateVote.ok, false); // round already over
});

test('a disconnect can complete a round', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  const c = join(code, 'Carol', 'lime');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(b.playerId, track('b1'));
  game.submitTrack(c.playerId, track('c1'));
  assert.equal(game.startGame().ok, true);

  const submitterId = game.getRoom()!.rounds[0].submitterId;
  const [voterA, voterB] = [a.playerId, b.playerId, c.playerId].filter((id) => id !== submitterId);
  game.castVote(voterA, submitterId);
  assert.equal(game.getRoom()!.phase, 'playing'); // voterB hasn't voted yet

  game.setPlayerConnected(voterB, false); // voterB drops off mid-round
  assert.equal(game.getRoom()!.phase, 'reveal'); // re-run all-voted check completes it
});

test('hostState is unaffected by who the current round\'s submitter is', () => {
  // A plain substring search for the submitter's id is NOT a valid test here: every
  // player's id is legitimately public via the roster (players[], needed for voting
  // buttons), so it always appears regardless of any real leak. The property that
  // actually matters is that the shared host screen's output doesn't *depend* on who
  // submitted the playing track — proven by mutating it and diffing the rebuilt state.
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  const c = join(code, 'Carol', 'lime');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(b.playerId, track('b1'));
  game.submitTrack(c.playerId, track('c1'));
  assert.equal(game.startGame().ok, true);

  const room = game.getRoom()!;
  const round = room.rounds[room.roundIndex];
  const originalSubmitter = round.submitterId;
  const before = game.hostState();

  const swapTo = [a.playerId, b.playerId, c.playerId].find((id) => id !== originalSubmitter)!;
  round.submitterId = swapTo;
  const after = game.hostState();
  round.submitterId = originalSubmitter; // restore before the rest of the test runs

  assert.deepEqual(after, before);
});

test('the submitter appears in the reveal, and only there', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(b.playerId, track('b1'));
  assert.equal(game.startGame().ok, true);

  const submitterId = game.getRoom()!.rounds[0].submitterId;
  assert.equal('submitterId' in game.hostState(), false);
  const nonSubmitterId = submitterId === a.playerId ? b.playerId : a.playerId;
  assert.equal('submitterId' in game.playerState(nonSubmitterId)!, false);

  game.skipRound();
  assert.equal(game.getRoom()!.lastReveal!.submitterId, submitterId);
});

test('createRoom mode defaults to manual and rejects an unknown value', () => {
  game.createRoom(2);
  assert.equal(game.getRoom()!.mode, 'manual');
  game.createRoom(2, 'top-tracks');
  assert.equal(game.getRoom()!.mode, 'top-tracks');
  game.createRoom(2, 'nonsense' as unknown as RoomMode);
  assert.equal(game.getRoom()!.mode, 'manual');
});

test('duplicate and over-cap submitTrack return submit-rejected, not bad-room', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('shared'));

  const dup = game.submitTrack(b.playerId, track('shared'));
  assert.equal(dup.ok, false);
  assert.equal(!dup.ok && dup.code, 'submit-rejected');

  const overCap = game.submitTrack(a.playerId, track('a2'));
  assert.equal(overCap.ok, false);
  assert.equal(!overCap.ok && overCap.code, 'submit-rejected');
});

test('unsubmit is rejected in top-tracks mode, leaving the submission untouched', () => {
  const code = freshRoom(1, 'top-tracks');
  const a = join(code, 'Alice', 'pink');
  // Seed a submission directly, matching how other tests seed state without going
  // through submitTrack's own validation.
  game.getRoom()!.players.get(a.playerId)!.submissions.push(track('a1'));

  const r = game.unsubmitTrack(a.playerId, 'a1');
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'submit-rejected');
  assert.equal(game.getRoom()!.players.get(a.playerId)!.submissions.length, 1);
});

test('autoSubmit is refused outside top-tracks mode', async () => {
  const code = freshRoom(1); // manual mode
  const a = join(code, 'Alice', 'pink');
  const r = await game.autoSubmit(a.playerId, [track('x')]);
  assert.equal(r.ok, false);
});

test('autoSubmit fills from candidates, skips room-wide duplicates, and reports a short pool', async () => {
  const code = freshRoom(2, 'top-tracks');
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  game.getRoom()!.players.get(b.playerId)!.submissions.push(track('shared'));

  // No Spotify session in tests, so playableIds throws 'not-authed' and autoSubmit
  // fails open — every candidate counts as playable. The room-wide duplicate scan
  // still filters out 'shared'.
  const short = await game.autoSubmit(a.playerId, [track('shared'), track('only-one')]);
  assert.equal(short.ok, false);
  assert.equal(!short.ok && short.code, 'submit-rejected');
  assert.equal(game.getRoom()!.players.get(a.playerId)!.submissions.length, 1);

  const filled = await game.autoSubmit(a.playerId, [track('second')]);
  assert.equal(filled.ok, true);
  assert.equal(game.getRoom()!.players.get(a.playerId)!.submissions.length, 2);
});

// --- Characterization tests: pin behaviour that had no test before a refactor. ---

function twoPlayerGame() {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(b.playerId, track('b1'));
  assert.equal(game.startGame().ok, true);
  return { code, a, b };
}

test('createRoom clamps songsPerPlayer to 1..5 and falls back to the default on NaN', () => {
  game.createRoom(0);
  assert.equal(game.getRoom()!.songsPerPlayer, 1);
  game.createRoom(-4);
  assert.equal(game.getRoom()!.songsPerPlayer, 1);
  game.createRoom(9);
  assert.equal(game.getRoom()!.songsPerPlayer, 5);
  game.createRoom(Number.NaN);
  assert.equal(game.getRoom()!.songsPerPlayer, 3);
  game.createRoom(2.6);
  assert.equal(game.getRoom()!.songsPerPlayer, 3);
});

test('joinRoom: code is case-insensitive, name is trimmed and capped, bad input is refused', () => {
  const code = freshRoom();
  assert.equal(game.joinRoom('ZZZZ', 'X', 'pink').ok, false);
  const blank = game.joinRoom(code, '   ', 'pink');
  assert.equal(!blank.ok && blank.code, 'bad-room');
  const badColour = game.joinRoom(code, 'X', 'red' as PlayerColour);
  assert.equal(!badColour.ok && badColour.code, 'bad-room');
  const p = join(code.toLowerCase(), '  ' + 'n'.repeat(30) + '  ', 'pink');
  assert.equal(game.getRoom()!.players.get(p.playerId)!.name, 'n'.repeat(24));
  assert.ok(game.isValidPlayerToken(p.token));
  assert.equal(game.isValidPlayerToken('nope'), false);
});

test('rejoinPlayer reconnects by token and refuses an unknown one', () => {
  const code = freshRoom();
  const a = join(code, 'Alice', 'pink');
  game.setPlayerConnected(a.playerId, false);
  assert.equal(game.getRoom()!.players.get(a.playerId)!.connected, false);
  const r = game.rejoinPlayer(code.toLowerCase(), a.token);
  assert.equal(r.ok && r.value.playerId, a.playerId);
  assert.equal(game.getRoom()!.players.get(a.playerId)!.connected, true);
  const bad = game.rejoinPlayer(code, 'unknown');
  assert.equal(!bad.ok && bad.code, 'bad-room');
});

test('unsubmitTrack removes a song in manual mode, and only in the lobby', () => {
  const code = freshRoom(2);
  const a = join(code, 'Alice', 'pink');
  game.submitTrack(a.playerId, track('a1'));
  game.submitTrack(a.playerId, track('a2'));
  assert.equal(game.unsubmitTrack(a.playerId, 'a1').ok, true);
  assert.deepEqual(game.playerState(a.playerId)!.yourSubmissions.map((t) => t.id), ['a2']);
  twoPlayerGame();
  assert.equal(game.unsubmitTrack(game.getRoom()!.rounds[0].submitterId, 'a1').ok, false);
});

test('castVote refuses an unknown voter or guess, a self-guess and a second vote', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  const c = join(code, 'Carol', 'lime');
  for (const p of [a, b, c]) game.submitTrack(p.playerId, track(p.playerId));
  assert.equal(game.startGame().ok, true);
  const submitterId = game.getRoom()!.rounds[0].submitterId;
  const [v1, v2] = [a, b, c].map((p) => p.playerId).filter((id) => id !== submitterId);
  assert.equal(game.castVote('ghost', submitterId).ok, false);
  assert.equal(game.castVote(v1, 'ghost').ok, false);
  assert.equal(game.castVote(v1, v1).ok, false);
  assert.equal(game.castVote(v1, v2).ok, true);
  assert.equal(game.castVote(v1, submitterId).ok, false); // already voted
  assert.equal(game.playerState(v1)!.round!.yourGuessId, v2);
  assert.equal(game.hostState().round!.votedCount, 1);
  assert.equal(game.hostState().round!.expectedVoters, 2);
});

test('nextRound only advances out of a reveal, and finishes after the last round', () => {
  twoPlayerGame();
  game.nextRound(); // still playing: ignored
  assert.equal(game.getRoom()!.roundIndex, 0);
  game.skipRound();
  assert.equal(game.getRoom()!.lastReveal!.isLastRound, false);
  game.nextRound();
  assert.equal(game.getRoom()!.phase, 'playing');
  assert.equal(game.getRoom()!.roundIndex, 1);
  assert.equal(game.getRoom()!.lastReveal, null);
  game.skipRound();
  assert.equal(game.getRoom()!.lastReveal!.isLastRound, true);
  game.nextRound();
  assert.equal(game.getRoom()!.phase, 'finished');
  assert.equal(game.hostState().round, null);
});

test('trackEnded is ignored before the round has started playing', () => {
  twoPlayerGame();
  game.trackEnded(); // no device, so startedAt stays 0
  assert.equal(game.getRoom()!.phase, 'playing');
});

test('reveal scores every player, marks correct guesses, and keeps endReason', () => {
  const code = freshRoom(1);
  const a = join(code, 'Alice', 'pink');
  const b = join(code, 'Bob', 'amber');
  const c = join(code, 'Carol', 'lime');
  for (const p of [a, b, c]) game.submitTrack(p.playerId, track(p.playerId));
  assert.equal(game.startGame().ok, true);
  const submitterId = game.getRoom()!.rounds[0].submitterId;
  const [v1, v2] = [a, b, c].map((p) => p.playerId).filter((id) => id !== submitterId);
  game.castVote(v1, submitterId);
  game.castVote(v2, v1);
  const reveal = game.getRoom()!.lastReveal!;
  assert.equal(reveal.endReason, 'all-voted');
  assert.deepEqual(reveal.correctPlayerIds, [v1]);
  assert.equal(reveal.scores.length, 3);
  assert.deepEqual(reveal.scores.find((s) => s.playerId === v1), { playerId: v1, score: 1, gained: 1 });
  assert.deepEqual(reveal.scores.find((s) => s.playerId === v2), { playerId: v2, score: 0, gained: 0 });
  assert.deepEqual(Object.keys(reveal.track).sort(), ['albumArt', 'artists', 'name']);
});

test('playerState shows the round without uri/id and flags the submitter\'s own song', () => {
  const { a, b } = twoPlayerGame();
  const submitterId = game.getRoom()!.rounds[0].submitterId;
  for (const id of [a.playerId, b.playerId]) {
    const s = game.playerState(id)!;
    assert.deepEqual(Object.keys(s.round!.track).sort(), ['albumArt', 'artists', 'name']);
    assert.equal(s.round!.isYours, id === submitterId);
    assert.equal(s.players.length, 2);
    assert.deepEqual(Object.keys(s.players[0]).sort(), ['colour', 'connected', 'id', 'name', 'score', 'submittedCount']);
  }
  assert.equal(game.playerState('ghost'), null);
  assert.equal(game.hostState().round!.track.uri.startsWith('spotify:track:'), true);
});
