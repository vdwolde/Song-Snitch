import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { DEFAULT_SONGS_PER_PLAYER, type ClientMsg, type HostState, type Reveal, type RoomMode, type ServerMsg } from '../shared/types';
import { useRoom } from './net';
import { initPlayer } from './spotify-player';

interface HostStatus {
  authed: boolean;
  user: string | null;
}

export function HostApp() {
  const [status, setStatus] = useState<HostStatus | null>(null);
  const [state, setState] = useState<HostState | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [songsPerPlayer, setSongsPerPlayer] = useState(DEFAULT_SONGS_PER_PLAYER);
  const [mode, setMode] = useState<RoomMode>('manual');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const onMessage = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'host:state':
        setState(msg);
        if (msg.phase !== 'reveal') setReveal(null);
        break;
      case 'reveal':
        setReveal(msg);
        break;
      case 'error':
        setError(msg.message);
        break;
    }
  }, []);

  const onOpen = useCallback(
    (send: (msg: ClientMsg) => void) => {
      if (status?.authed) send({ t: 'host:hello' });
    },
    [status?.authed],
  );
  const { send } = useRoom(onMessage, onOpen);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const loginError = params.get('error');
    if (loginError) setError(loginError);
    fetch('/api/host/status')
      .then((r) => r.json())
      .then((d: HostStatus) => setStatus(d));
  }, []);

  // Returning from the Spotify bounce page (public/callback.html, see
  // .claude/DECISIONS.md ADR-005) lands here as a #code=&state= fragment — a fragment
  // never reaches a server, so this posts it to complete the login instead of Spotify
  // ever redirecting straight to a GET route.
  useEffect(() => {
    if (!location.hash.includes('code=')) return;
    const hash = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname); // strip it immediately — single-use
    const code = hash.get('code');
    const authState = hash.get('state');
    if (!code || !authState) return;
    fetch('/api/host/complete-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state: authState }),
    })
      .then((r) => r.json())
      .then((d: { ok: boolean; message?: string }) => {
        if (!d.ok) setError(d.message ?? 'Spotify login failed — try again.');
        return fetch('/api/host/status')
          .then((r) => r.json())
          .then((s: HostStatus) => setStatus(s));
      })
      .catch(() => setError('Could not complete Spotify login — try again.'));
  }, []);

  useEffect(() => {
    if (!status?.authed) return;
    // Covers the ordering race `onOpen` can't: the socket often finishes connecting
    // before this `/api/host/status` fetch resolves, so the connect-time `onOpen`
    // fires while `status` is still null and skips sending 'host:hello'. This re-sends
    // it once auth is known — redundant with onOpen on some orderings, but 'host:hello'
    // is a read-only status ping, so sending it twice is harmless.
    send({ t: 'host:hello' });
    void initPlayer({
      onReady: (deviceId) => send({ t: 'host:deviceReady', deviceId }),
      onTrackEnded: () => send({ t: 'host:trackEnded' }),
      onError: setError,
    });
    // initPlayer starts the SDK once per authed session — it must not restart on
    // every `send` re-creation, only when auth state actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.authed]);

  useEffect(() => {
    if (!state?.joinUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(state.joinUrl, { margin: 1, width: 240 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [state?.joinUrl]);

  if (!status) return <main className="host status-line pulsing">Loading</main>;

  if (!status.authed) {
    return (
      <main className="host host-auth">
        <h1 className="brand-title">Song Snitch</h1>
        <p>Connect the host&apos;s Spotify Premium account to start a game.</p>
        <a className="button" href="/auth/login">
          Connect Spotify
        </a>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  if (!state) return <main className="host status-line pulsing">Connecting</main>;

  return (
    <main className="host">
      {error && (
        <p className="error" onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {!state.code && (
        <section className="host-create">
          <h1 className="brand-title">Song Snitch</h1>
          <p>Signed in as {status.user}</p>
          <label>
            Songs per player
            <input
              type="number"
              min={1}
              max={5}
              value={songsPerPlayer}
              onChange={(e) => setSongsPerPlayer(Number(e.target.value))}
            />
          </label>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value as RoomMode)}>
              <option value="manual">Everyone picks songs</option>
              <option value="top-tracks">Auto — everyone's top tracks</option>
            </select>
          </label>
          <button onClick={() => send({ t: 'host:createRoom', songsPerPlayer, mode })}>Create room</button>
        </section>
      )}

      {state.code && state.phase === 'lobby' && (
        <section className="host-lobby">
          <div className="room-code-card card-enter">
            <h1 className="room-code">{state.code}</h1>
            <p className="lan-url">Scan to join, or visit {state.joinUrl}</p>
          </div>
          {qrDataUrl && <img className="qr" src={qrDataUrl} alt={`QR code to join at ${state.joinUrl}`} />}
          {state.mode === 'top-tracks' && (
            <p className="status-line">Players may briefly show as disconnected while they connect Spotify.</p>
          )}
          <ul className="roster">
            {state.players.map((p) => (
              <li key={p.id} data-colour={p.colour}>
                <span className="swatch" /> {p.name} — {p.submittedCount}/{state.songsPerPlayer}
                {!p.connected && ' (disconnected)'}
              </li>
            ))}
          </ul>
          {state.needsDevice && <p className="status-line">Waiting for playback to connect…</p>}
          <button
            disabled={
              state.needsDevice ||
              state.players.length < 2 ||
              state.players.some((p) => p.submittedCount !== state.songsPerPlayer)
            }
            onClick={() => send({ t: 'host:start' })}
          >
            Start game
          </button>
        </section>
      )}

      {state.phase === 'playing' && state.round && (
        <section className="host-playing card-enter">
          <p className="round-counter">
            Round {state.round.index + 1} of {state.round.total}
          </p>
          {state.round.track.albumArt && <img className="album-art" src={state.round.track.albumArt} alt="" />}
          <h2>{state.round.track.name}</h2>
          <p>{state.round.track.artists}</p>
          <p className="status-line pulsing">
            {state.round.votedCount}/{state.round.expectedVoters} voted
          </p>
          <button onClick={() => send({ t: 'host:skip' })}>Skip to next song</button>
        </section>
      )}

      {state.phase === 'reveal' && reveal && (
        <section className="host-reveal">
          <h2>{reveal.track.name}</h2>
          <p>{reveal.track.artists}</p>
          <div className="reveal-card" data-colour={state.players.find((p) => p.id === reveal.submitterId)?.colour}>
            <p className="reveal-answer">
              Added by <strong>{state.players.find((p) => p.id === reveal.submitterId)?.name}</strong>
            </p>
          </div>
          <ul className="roster">
            {reveal.scores.map((s) => {
              const p = state.players.find((pl) => pl.id === s.playerId);
              return (
                <li key={s.playerId} data-colour={p?.colour}>
                  <span className="swatch" /> {p?.name}: {s.score}
                  {s.gained ? ' (+1)' : ''}
                </li>
              );
            })}
          </ul>
          <button onClick={() => send({ t: 'host:next' })}>{reveal.isLastRound ? 'See final scores' : 'Next song'}</button>
        </section>
      )}

      {state.phase === 'finished' && (
        <section className="host-finished card-enter">
          <h1>Final scores</h1>
          <ol className="leaderboard">
            {[...state.players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <li key={p.id} data-colour={p.colour} className={i === 0 ? 'winner' : undefined}>
                  {i === 0 && <span className="trophy">🏆</span>}
                  <span className="swatch" /> {p.name} — {p.score}
                </li>
              ))}
          </ol>
        </section>
      )}
    </main>
  );
}
