import { useState } from 'react';
import { Button, Input, Modal } from 'astrogators-shared-ui';
import type { Evaluation } from '@/types/evaluation';
import styles from './CopyEvaluationDialog.module.css';

type Props = {
  isOpen: boolean;
  source: Evaluation | null;
  // Names of the caller's own evaluations — drives the duplicate warning,
  // same as the create/edit builder.
  existingNames: string[];
  isCopying: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export default function CopyEvaluationDialog({
  isOpen,
  source,
  existingNames,
  isCopying,
  onCancel,
  onConfirm,
}: Props) {
  // Reset `name` whenever the source identity changes — the "store info from
  // previous render" pattern, matching ImportEvaluationDialog.
  const [trackedSource, setTrackedSource] = useState(source);
  const [name, setName] = useState(source?.name ?? '');
  if (source !== trackedSource) {
    setTrackedSource(source);
    setName(source?.name ?? '');
  }

  if (!source) return null;

  const trimmedName = name.trim();
  const nameCollides =
    trimmedName.length > 0 &&
    existingNames.some(
      (n) => n.trim().toLowerCase() === trimmedName.toLowerCase()
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Create a copy"
      size="md"
      closeOnOverlayClick={false}
    >
      <div className={styles.body}>
        <Input
          label="Evaluation name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          autoComplete="off"
          error={
            nameCollides
              ? `An evaluation named "${trimmedName}" already exists. Creating will make a separate copy with the same name.`
              : undefined
          }
          helperText={
            nameCollides ? undefined : 'Rename if you want — defaults to the original name.'
          }
        />
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onConfirm(trimmedName)}
            disabled={!trimmedName || isCopying}
          >
            {isCopying ? 'Creating…' : 'Create a copy'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
