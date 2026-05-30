import { useEffect, useState } from 'react';

// Tracks whether a CSS media query currently matches. Used to swap layout
// modes (e.g. stacked sections on desktop vs tabs on mobile) without
// double-rendering both trees.
//
// SSR-safe: returns `false` on first render (when window is undefined) so
// server snapshots don't trip useEffect's "rendered different" warning.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Modern API; older Safari/iOS still ship `addListener` but every
    // browser the app targets has had `addEventListener` for years.
    mql.addEventListener('change', handler);
    // Sync to the current value (matches state on mount + on query swaps).
    // The setState-in-effect lint rule fires here, but it's correct: we
    // need to reflect the *current* query's value when `query` changes,
    // and the change-listener only fires on subsequent changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
