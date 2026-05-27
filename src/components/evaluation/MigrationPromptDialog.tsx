import { useState } from 'react';
import { Button, Modal } from 'astrogators-shared-ui';
import styles from './MigrationPromptDialog.module.css';

type Props = {
  isOpen: boolean;
  localCount: number;
  onImport: () => Promise<void>;
  onDiscard: () => void;
};

// First-login migration prompt. Non-dismissable: the user must choose
// Import or Discard. There is no "later" / "not now" escape — once a user
// is authenticated, the backend is the single source of truth and the
// localStorage leftovers cannot quietly coexist.
//
// Esc, click-outside, and the X button all flow through the Modal's
// onClose prop; we wire that to a no-op so none of them dismiss the
// dialog. The parent guarantees this only mounts when isAuthenticated
// AND localCount > 0.
export default function MigrationPromptDialog({
  isOpen,
  localCount,
  onImport,
  onDiscard,
}: Props) {
  const [phase, setPhase] = useState<'prompt' | 'importing' | 'confirm-discard'>(
    'prompt'
  );
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setError(null);
    setPhase('importing');
    try {
      await onImport();
      // Parent will unmount us by setting isOpen=false. Don't reset phase
      // here — if the unmount races, leaving phase='importing' avoids a
      // flicker back to the prompt.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please try again.';
      setError(message);
      setPhase('prompt');
    }
  };

  const handleDiscardConfirmed = () => {
    onDiscard();
    // Parent unmounts on count→0.
  };

  // Plural-aware copy.
  const evalNoun = `evaluation${localCount === 1 ? '' : 's'}`;

  return (
    <Modal
      isOpen={isOpen}
      // No-op: this dialog is non-dismissable. The user must pick Import
      // or Discard. See module docstring.
      onClose={() => {}}
      title="Local evaluations found"
      size="md"
      closeOnOverlayClick={false}
    >
      <div className={styles.body}>
        {phase === 'confirm-discard' ? (
          <>
            <div className={styles.confirmBlock}>
              <p className={styles.confirmTitle}>This cannot be undone</p>
              <p className={styles.message}>
                Permanently delete{' '}
                <span className={styles.count}>
                  {localCount} local {evalNoun}
                </span>
                ? They will not be uploaded to your account.
              </p>
            </div>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase('prompt')}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDiscardConfirmed}
              >
                Yes, discard
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.message}>
              You weren&rsquo;t logged in when you created{' '}
              <span className={styles.count}>
                {localCount} {evalNoun}
              </span>{' '}
              saved locally on this computer. Import them into your account, or
              you will lose them.
            </p>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase('confirm-discard')}
                disabled={phase === 'importing'}
              >
                Discard local evaluations
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleImport}
                disabled={phase === 'importing'}
              >
                {phase === 'importing' ? 'Importing…' : 'Import to my account'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
