import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Music, Trophy, X } from 'lucide-react';
import {
  PLAYER_COLOURS,
  type ClientMsg,
  type PlayerColour,
  type PlayerState,
  type Reveal,
  type ServerMsg,
  type TrackInfo,
} from '../shared/types';
import { useRoom } from './net';
import { Brand, ErrorBanner, SkeletonRows, Swatch } from './ui';
import { applyPhase } from './transition';
import { completeImport, hasAuthReturn, rememberSubmitted, startImport } from './spotify-top-tracks';

interface StoredIdentity {
  code: string;
  token: string;
}

// sessionStorage, not localStorage: it survives a reload (the reconnect case) but is
// per-tab, which is what makes several browser tabs behave as independent players.
const STORAGE_KEY = 'songsnitch-player';

function loadIdentity(): StoredIdentity | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

function saveIdentity(identity: StoredIdentity | null): void {
  try {
    if (identity) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable (private browsing) — the player just re-joins after a reload
  }
}

export function PlayerApp() {
  const [identity, setIdentity] = useState<StoredIdentity | null>(() => loadIdentity());
  const [state, setState] = useState<PlayerState | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinColour, setJoinColour] = useState<PlayerColour>(PLAYER_COLOURS[0]);
  const [joining, setJoining] = useState(false);

  // Optimistic overlays: a tap shows its result at once, the server's next player:state confirms it, and an
  // 'error' message throws the overlay away (so a refused vote or a duplicate song just disappears again).
  const [pendingAdds, setPendingAdds] = useState<TrackInfo[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<string[]>([]);
  const [pendingVote, setPendingVote] = useState<{ roundIndex: number; guessId: string } | null>(null);
  const phaseRef = useRef<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackInfo[]>([]);
  const [searching, setSearching] = useState(false);

  // top-tracks mode: the phone's own Spotify import (src/spotify-top-tracks.ts) — see
  // .claude/DECISIONS.md ADR-004.
  const [autoCandidates, setAutoCandidates] = useState<TrackInfo[] | null>(null);
  const [autoImporting, setAutoImporting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [spotifyUserId, setSpotifyUserId] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(false);

  const onMessage = useCallback(
    (msg: ServerMsg) => {
      switch (msg.t) {
        case 'player:identity': {
          const next = { code: joinCode.toUpperCase(), token: msg.token };
          saveIdentity(next);
          setIdentity(next);
          break;
        }
        case 'player:state': {
          applyPhase(phaseRef, msg.phase, () => {
            setState(msg);
            if (msg.phase !== 'reveal') setReveal(null);
          });
          break;
        }
        case 'reveal':
          setReveal(msg);
          break;
        case 'error':
          setError(msg.message);
          setJoining(false);
          setPendingAdds([]);
          setPendingRemoves([]);
          setPendingVote(null);
          if (msg.code === 'bad-room') {
            saveIdentity(null);
            setIdentity(null);
          }
          break;
      }
    },
    [joinCode],
  );

  const onOpen = useCallback(
    (send: (msg: ClientMsg) => void) => {
      if (identity) send({ t: 'player:rejoin', code: identity.code, token: identity.token });
    },
    [identity],
  );
  const { send, stalled } = useRoom(onMessage, onOpen);

  useEffect(() => {
    if (stalled) setJoining(false); // no answer is coming: let the player try again
  }, [stalled]);

  // Drop an overlay once the server's state shows it (an unchanged list keeps its identity, so this cannot loop).
  useEffect(() => {
    if (!state) return;
    const ids = new Set(state.yourSubmissions.map((t) => t.id));
    setPendingAdds((adds) => (adds.some((t) => ids.has(t.id)) ? adds.filter((t) => !ids.has(t.id)) : adds));
    setPendingRemoves((removes) => (removes.some((id) => !ids.has(id)) ? removes.filter((id) => ids.has(id)) : removes));
    if (state.round?.yourGuessId) setPendingVote(null);
  }, [state]);

  useEffect(() => {
    if (!identity || !query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}&token=${identity.token}`)
        .then((r) => r.json())
        .then((d: { tracks?: TrackInfo[] }) => setResults(d.tracks ?? []))
        .catch(() => setResults([])) // server unreachable: same empty list as a failed Spotify search
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, identity]);

  // Runs once per mount: if we've just landed back from the Spotify bounce page, finish
  // the exchange and pull top tracks. completeImport() strips the #code fragment
  // immediately, so a re-render can't accidentally retry a consumed (single-use) code.
  useEffect(() => {
    if (!identity || !hasAuthReturn()) return;
    setAutoImporting(true);
    completeImport()
      .then(({ candidates, spotifyUserId: id }) => {
        setAutoCandidates(candidates);
        setSpotifyUserId(id);
      })
      .catch((e: Error) => setAutoError(e.message))
      .finally(() => setAutoImporting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  // Sends the imported candidates the moment we have both them AND a live, identified
  // connection (a player:state has arrived) — sending earlier risks net.ts silently
  // dropping the message if the socket isn't OPEN yet. autoSubmitted guards against
  // resending on a later, unrelated reconnect.
  useEffect(() => {
    if (!autoCandidates || !state || autoSubmitted) return;
    setAutoSubmitted(true);
    send({ t: 'player:autoSubmit', candidates: autoCandidates });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCandidates, state, autoSubmitted]);

  // Records what actually landed (not what was merely offered) so a future game
  // excludes it — see src/spotify-top-tracks.ts::rememberSubmitted.
  useEffect(() => {
    if (remembered || !spotifyUserId || !state || state.yourSubmissions.length === 0) return;
    setRemembered(true);
    rememberSubmitted(
      spotifyUserId,
      state.yourSubmissions.map((t) => t.id),
    );
  }, [remembered, spotifyUserId, state]);

  if (!identity) {
    return (
      <main className="player join">
        <Brand />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (joining) return;
            setJoining(true);
            send({ t: 'player:join', code: joinCode.toUpperCase(), name: joinName, colour: joinColour });
          }}
        >
          <label>
            Room code
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
          <label>
            Your name
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              required
            />
          </label>
          <div className="colour-grid">
            {PLAYER_COLOURS.map((c) => (
              <button
                type="button"
                key={c}
                data-colour={c}
                className={c === joinColour ? 'swatch-button selected' : 'swatch-button'}
                onClick={() => setJoinColour(c)}
                aria-label={c}
                aria-pressed={c === joinColour}
              >
                {c === joinColour ? <Check className="icon" aria-hidden="true" /> : PLAYER_COLOURS.indexOf(c) + 1}
              </button>
            ))}
          </div>
          <button className="primary" type="submit" disabled={joining}>
            Join
          </button>
        </form>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        {stalled && <ErrorBanner>Can&apos;t reach the game — make sure you&apos;re on the host&apos;s WiFi.</ErrorBanner>}
      </main>
    );
  }

  if (!state) {
    return (
      <main className="player status-line pulsing">
        Connecting
        {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}
        {stalled && <ErrorBanner>Lost the connection — check you&apos;re still on the host&apos;s WiFi.</ErrorBanner>}
      </main>
    );
  }

  // What the player sees: the server's list with their not-yet-confirmed adds and removes applied.
  const submissions = [...state.yourSubmissions.filter((t) => !pendingRemoves.includes(t.id)), ...pendingAdds.filter((t) => !state.yourSubmissions.some((s) => s.id === t.id))];
  const yourGuessId = state.round?.yourGuessId ?? (pendingVote && pendingVote.roundIndex === state.round?.index ? pendingVote.guessId : null);
  const songsComplete = submissions.length >= state.songsPerPlayer;
  // top-tracks mode fell short of songsPerPlayer (a new account, or a heavily-excluded
  // pool) — fall back to the same manual search every other mode uses, rather than
  // leaving the room permanently unable to start.
  const needsManualFallback = state.mode === 'top-tracks' && autoSubmitted && !autoImporting && !songsComplete;

  return (
    <main className="player" data-colour={state.you.colour}>
      {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}

      {state.phase === 'lobby' && (
        <section className="player-lobby card-enter">
          <p className="you-line">
            <Swatch name={state.you.name} /> {state.you.name}
          </p>
          <ul className="submissions">
            {submissions.map((t) => (
              <li key={t.id}>
                <span>
                  {t.name} — {t.artists}
                </span>
                {state.mode !== 'top-tracks' && (
                  <button
                    onClick={() => {
                      setPendingRemoves((r) => [...r, t.id]);
                      send({ t: 'player:unsubmit', trackId: t.id });
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="status-line">
            <span className="num">
              {submissions.length}/{state.songsPerPlayer}
            </span>{' '}
            songs added
          </p>

          {autoError && <ErrorBanner>{autoError}</ErrorBanner>}

          {state.mode === 'top-tracks' && !songsComplete && !autoSubmitted && (
            <div className="top-tracks-import">
              {autoImporting ? (
                <>
                  <p className="status-line">Importing your top tracks</p>
                  <SkeletonRows count={3} />
                </>
              ) : (
                <button
                  className="primary"
                  onClick={() => {
                    setAutoError(null);
                    void startImport().catch((e: Error) => setAutoError(e.message));
                  }}
                >
                  Connect Spotify
                </button>
              )}
            </div>
          )}

          {(state.mode === 'manual' ? !songsComplete : needsManualFallback) && (
            <div className="search">
              <input
                placeholder="Search a song"
                aria-label="Search a song"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {searching && <SkeletonRows count={3} />}
              <ul className="results">
                {results.map((t) => (
                  <li key={t.id}>
                    {t.albumArt && <img src={t.albumArt} alt="" />}
                    <span>
                      {t.name} — {t.artists}
                    </span>
                    <button
                      onClick={() => {
                        if (!submissions.some((s) => s.id === t.id)) setPendingAdds((a) => [...a, t]);
                        send({ t: 'player:submit', track: t });
                      }}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="roster-heading">Waiting on:</p>
          <ul className="roster">
            {state.players.map((p) => (
              <li key={p.id} data-colour={p.colour}>
                <Swatch name={p.name} /> {p.name} —{' '}
                <span className="num">
                  {p.submittedCount}/{state.songsPerPlayer}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.phase === 'playing' && state.round && (
        <section className="player-playing card-enter">
          {state.round.track.albumArt && <img className="album-art" src={state.round.track.albumArt} alt="" />}
          <h2>{state.round.track.name}</h2>
          <p>{state.round.track.artists}</p>
          {state.round.isYours ? (
            <p className="your-turn">This one&apos;s yours, so sit tight.</p>
          ) : (
            <>
              <p className="prompt">Who added this?</p>
              <div className="guess-grid">
                {state.players
                  .filter((p) => p.id !== state.you.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      data-colour={p.colour}
                      className={yourGuessId === p.id ? 'guess selected' : 'guess'}
                      disabled={!!yourGuessId}
                      onClick={() => {
                        setPendingVote({ roundIndex: state.round?.index ?? -1, guessId: p.id });
                        send({ t: 'player:vote', guessId: p.id });
                      }}
                    >
                      <Swatch name={p.name} /> <span className="guess-name">{p.name}</span>
                      {yourGuessId === p.id && <Check className="icon" aria-hidden="true" />}
                    </button>
                  ))}
              </div>
            </>
          )}
          <p className="status-line pulsing">
            <span className="num">
              {state.round.votedCount}/{state.round.expectedVoters}
            </span>{' '}
            voted
          </p>
        </section>
      )}

      {state.phase === 'reveal' && reveal && (
        <section className="player-reveal">
          <h2>{reveal.track.name}</h2>
          <p>{reveal.track.artists}</p>
          <div
            className="reveal-card"
            data-result={
              reveal.submitterId === state.you.id
                ? 'own'
                : reveal.correctPlayerIds.includes(state.you.id)
                  ? 'yes'
                  : 'no'
            }
          >
            <p className="reveal-answer">
              Added by{' '}
              <span className="reveal-who" data-colour={state.players.find((p) => p.id === reveal.submitterId)?.colour}>
                <Swatch name={state.players.find((p) => p.id === reveal.submitterId)?.name ?? '?'} />{' '}
                <strong>{state.players.find((p) => p.id === reveal.submitterId)?.name}</strong>
              </span>
            </p>
            {reveal.submitterId === state.you.id ? (
              <p className="you-scored own">
                <Music className="icon" aria-hidden="true" /> It was your song
              </p>
            ) : (
              <p className={reveal.correctPlayerIds.includes(state.you.id) ? 'you-scored yes' : 'you-scored no'}>
                {reveal.correctPlayerIds.includes(state.you.id) ? (
                  <>
                    <Check className="icon" aria-hidden="true" /> You got it, +1
                  </>
                ) : (
                  <>
                    <X className="icon" aria-hidden="true" /> Not this time
                  </>
                )}
              </p>
            )}
          </div>
          <p className="your-score">Your score: <span className="num">{state.you.score}</span></p>
        </section>
      )}

      {state.phase === 'finished' && (
        <section className="player-finished card-enter">
          <h1>Final Scores</h1>
          <ol className="leaderboard">
            {[...state.players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <li key={p.id} data-colour={p.colour} className={i === 0 ? 'winner' : undefined}>
                  {i === 0 && <Trophy className="trophy icon" aria-label="Winner" />}
                  <Swatch name={p.name} /> {p.name} <span className="num">{p.score}</span>
                </li>
              ))}
          </ol>
        </section>
      )}
    </main>
  );
}
