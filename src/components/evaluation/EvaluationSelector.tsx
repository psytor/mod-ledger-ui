import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Select } from 'astrogators-shared-ui';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { useMods } from '@/contexts/ModContext';
import { evaluationStorage } from '@/services/evaluationStorage';
import type { Evaluation } from '@/types/evaluation';

export default function EvaluationSelector() {
  const { activeEvaluationId, setActiveEvaluationId, runEvaluation, verdicts } = useEvaluation();
  const { mods } = useMods();
  const [evaluations] = useState<Evaluation[]>(() => evaluationStorage.listMine());

  const active = evaluations.find((e) => e.id === activeEvaluationId) ?? null;

  if (evaluations.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          border: '1px solid var(--color-border, #333)',
          borderRadius: '4px',
          marginBottom: '1rem',
        }}
      >
        <span style={{ color: 'var(--color-text-secondary, #888)' }}>
          No evaluations yet.
        </span>
        <Link to="/evaluations/new">
          <Button variant="primary" size="sm">Create one</Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        border: '1px solid var(--color-border, #333)',
        borderRadius: '4px',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 600 }}>Evaluation:</span>
      <Select
        value={activeEvaluationId ?? ''}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
          setActiveEvaluationId(e.target.value || null)
        }
      >
        <option value="">— None —</option>
        {evaluations.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name}
          </option>
        ))}
      </Select>
      <Button
        variant="primary"
        size="sm"
        disabled={!active || mods.length === 0}
        onClick={() => runEvaluation(mods)}
      >
        Evaluate
      </Button>
      {verdicts.size > 0 && (
        <span style={{ color: 'var(--color-text-secondary, #888)', fontSize: '0.9rem' }}>
          {verdicts.size} mod{verdicts.size === 1 ? '' : 's'} evaluated
        </span>
      )}
      <Link
        to="/evaluations"
        style={{ marginLeft: 'auto', fontSize: '0.9rem' }}
      >
        Manage →
      </Link>
      {active?.description && (
        <div
          style={{
            width: '100%',
            color: 'var(--color-text-secondary, #888)',
            fontSize: '0.9rem',
          }}
        >
          {active.description}
        </div>
      )}
    </div>
  );
}
