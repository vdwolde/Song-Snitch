import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HostApp } from './HostApp';
import { PlayerApp } from './PlayerApp';
import './styles.css';

// The whole router: /host* is the shared-screen display (loopback-only, enforced
// server-side too — see server/net.ts); everything else is the phone/player screen.
// Within each app, the real "route" is state.phase, which comes from the server.
const isHost = location.pathname.startsWith('/host');

function Footer() {
  return (
    <footer className="app-footer">
      <a href="https://vdwolde.com/" target="_blank" rel="noopener noreferrer">
        By vdWolde
      </a>
    </footer>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isHost ? <HostApp /> : <PlayerApp />}
    <Footer />
  </StrictMode>,
);
