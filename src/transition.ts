// A short cross-fade when the game moves to its next phase (lobby, playing, reveal, finished), through the
// View Transitions API. Where the API is missing, or the player asked for less motion, the update just runs.
import { flushSync } from 'react-dom';

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => unknown };

function withViewTransition(update: () => void): void {
  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  doc.startViewTransition(async () => {
    flushSync(update);
  });
}

// Applies a new state message, with the cross-fade only when its phase differs from the last one seen.
// The first message after a load never fades: there is nothing on screen to fade from.
export function applyPhase(lastPhase: { current: string | null }, phase: string, update: () => void): void {
  const changed = lastPhase.current !== null && lastPhase.current !== phase;
  lastPhase.current = phase;
  if (changed) withViewTransition(update);
  else update();
}
