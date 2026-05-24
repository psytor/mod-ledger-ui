import { useState } from 'react';
import { Button, Input, Modal } from 'astrogators-shared-ui';
import type { EvaluationExportV1 } from '@/types/evaluationExport';
import styles from './ImportEvaluationDialog.module.css';

type Props = {
  isOpen: boolean;
  payload: EvaluationExportV1 | null;
  existingNames: string[];
  onCancel: () => void;
  onConfirm: (nameOverride: string) => void;
};

export default function ImportEvaluationDialog({
  isOpen,
  payload,
  existingNames,
  onCancel,
  onConfirm,
}: Props) {
  // Derived state: reset `name` whenever the payload identity changes.
  // Uses the "store info from previous render" pattern instead of useEffect
  // — it skips a wasted render and satisfies react-hooks/set-state-in-effect.
  const [trackedPayload, setTrackedPayload] = useState(payload);
  const [name, setName] = useState(payload?.evaluation.name ?? '');
  if (payload !== trackedPayload) {
    setTrackedPayload(payload);
    setName(payload?.evaluation.name ?? '');
  }

  if (!payload) return null;

  const ev = payload.evaluation;
  const configuredSets = ev.mod_set_configs.filter((c) => c.variants.length > 0);
  const variantCount = configuredSets.reduce((n, c) => n + c.variants.length, 0);
  const authorLabel = ev.authoredBy?.username ?? 'Unknown';
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
      title="Import evaluation"
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
          error={nameCollides ? `An evaluation named "${trimmedName}" already exists. Import will still create a separate copy.` : undefined}
          helperText={nameCollides ? undefined : "Rename if you want — defaults to the file's name."}
        />
        {ev.description && (
          <p className={styles.description}>{ev.description}</p>
        )}
        <dl className={styles.summary}>
          <div className={styles.row}>
            <dt>Author</dt>
            <dd>{authorLabel}</dd>
          </div>
          <div className={styles.row}>
            <dt>Configured sets</dt>
            <dd>{configuredSets.length}</dd>
          </div>
          <div className={styles.row}>
            <dt>Scoring rules</dt>
            <dd>{variantCount}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onConfirm(name)}
            disabled={!name.trim()}
          >
            Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
