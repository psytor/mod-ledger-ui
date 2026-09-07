import { useState } from 'react';
import styles from './RecommendationCaution.module.css';

const DISMISS_KEY = 'mod-ledger:recommendation-caution-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Slim caution strip shown above the mod grid, dismissable for the current
 * session only (sessionStorage, so it returns on the next visit — a permanent
 * opt-out would let a new player silence it once and forget it).
 *
 * Context: the tool shipped to production and shared players were nervous that
 * following a SELL verdict at face value could cost them a genuinely good mod.
 * The evaluations are one shared rule set and can't cover every character or
 * team, so this is a standing reminder to sanity-check before selling.
 */
export default function RecommendationCaution() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // sessionStorage blocked (private mode, etc.) — the strip simply
      // reappears on the next mount; nothing else depends on this flag.
    }
  };

  return (
    // Outer wrapper carries the same max-width / centering / gutter as
    // ModGridPage's .header and .contentArea, so the strip lines up with the
    // mod grid rather than spanning the full container.
    <div className={styles.wrap}>
      <div className={styles.strip} role="note">
        <span aria-hidden="true" className={styles.icon}>
          &#9888;
        </span>
        <p className={styles.text}>
          <strong>These are suggestions, not final verdicts.</strong>{' '}
          Evaluations come from a shared rule set that can&rsquo;t account for
          every character, team, or play style. If you&rsquo;re unsure about a
          mod, keep it and double-check with someone before selling.
        </p>
        <button
          type="button"
          className={styles.dismiss}
          onClick={dismiss}
          aria-label="Dismiss this notice for now"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
