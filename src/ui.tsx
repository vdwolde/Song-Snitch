import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

/** The mark beside the app name (Brand Guide v1.0: never below 24 px). */
export function Brand() {
  return (
    <div className="brand">
      <img className="brand-mark" src="/icons/mark.svg" width={40} height={40} alt="" />
      <h1 className="brand-title">Song Snitch</h1>
    </div>
  );
}

/**
 * A player's colour tile (set by the parent's `data-colour`) with their initial, so a colour
 * is never the only cue: the tile carries a letter and the name always sits beside it.
 */
export function Swatch({ name }: { name: string }) {
  return (
    <span className="swatch" aria-hidden="true">
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

/** Placeholder rows while a list loads. They only fade in after 300 ms (styles.css), so a fast answer shows none. */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

/** Danger status: icon plus words, never colour alone. Click to dismiss when `onDismiss` is given. */
export function ErrorBanner({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <p className="error" role="alert" onClick={onDismiss}>
      <CircleAlert className="icon" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
