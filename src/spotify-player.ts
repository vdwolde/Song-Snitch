// Loads the Spotify Web Playback SDK once and wraps it as a device the host tab
// exposes. `initialised` is a module-level guard because React StrictMode
// double-invokes effects in dev — without it, two devices would fight for playback.
let initialised = false;
let sdkReady: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkReady) return sdkReady;
  sdkReady = new Promise((resolve) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(script);
  });
  return sdkReady;
}

interface PlayerHandlers {
  onReady: (deviceId: string) => void;
  onTrackEnded: () => void;
  onError: (message: string) => void;
}

export async function initPlayer(handlers: PlayerHandlers): Promise<void> {
  if (initialised) return;
  initialised = true;
  await loadSdk();

  const player = new window.Spotify.Player({
    name: 'Song Snitch',
    getOAuthToken: (cb) => {
      fetch('/api/host/token')
        .then((r) => r.json())
        .then((d: { accessToken?: string; error?: string }) => {
          if (d.accessToken) cb(d.accessToken);
          else handlers.onError(d.error ?? 'Spotify authentication expired');
        })
        .catch(() => handlers.onError('Could not reach the server for a Spotify token'));
    },
    volume: 1,
  });

  player.addListener('ready', ({ device_id }) => handlers.onReady(device_id));
  player.addListener('authentication_error', () =>
    handlers.onError('Spotify authentication expired — reconnect Spotify.'),
  );
  player.addListener('account_error', () => handlers.onError('Spotify Premium is required to host.'));
  player.addListener('initialization_error', () =>
    handlers.onError("This browser can't play Spotify audio — try desktop Chrome or Edge."),
  );
  // The server disambiguates a genuine end from the SDK's spurious post-play(0,true)
  // event (see server/game.ts's trackEnded) — the client just reports every one.
  player.addListener('player_state_changed', (state) => {
    if (state && state.paused && state.position === 0) handlers.onTrackEnded();
  });

  await player.connect();
}
