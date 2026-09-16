import { useEffect } from 'react';

/**
 * Show the browser's native "Leave site? Changes you made may not be saved."
 * prompt while `hasUnsavedChanges` is true.
 *
 * Covers full-page unload only — tab close, reload, browser back to a
 * different origin, an external link. It does NOT block in-app React Router
 * `<Link>` navigation: the declarative router API this app uses has no
 * `useBlocker`, and adding the data router is an explicit architecture
 * change (see CLAUDE.md). In-app "Cancel" / nav-away is a deliberate user
 * action anyway; the real accident this guards is closing or reloading the
 * tab mid-edit.
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy Chrome/Edge still require returnValue to be set for the
      // prompt to show; the string is ignored by every modern browser.
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
