import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Select, useAuth } from 'astrogators-shared-ui';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { useMods } from '@/contexts/ModContext';
import { evaluationStorage } from '@/services/evaluationStorage';
import { evaluationsApi } from '@/services/evaluationsApi';
import type { Evaluation } from '@/types/evaluation';

export default function EvaluationSelector() {
  const { activeEvaluationId, setActiveEvaluationId, runEvaluation, verdicts } = useEvaluation();
  const { mods } = useMods();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [mine, setMine] = useState<Evaluation[]>([]);
  const [protocols, setProtocols] = useState<Evaluation[]>([]);

  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    // Mine + Protocols are independent sources; Protocols are world-readable
    // so they load regardless of auth (you can Use one without owning it).
    void evaluationStorage
      .listMine()
      .then((list) => !cancelled && setMine(list))
      .catch(() => !cancelled && setMine([]));
    void evaluationsApi
      .listProtocols()
      .then((list) => !cancelled && setProtocols(list))
      .catch(() => !cancelled && setProtocols([]));
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated]);

  // The active id may point at either list — a Used Protocol you don't own
  // still needs to resolve here so the Evaluate button stays enabled.
  const active =
    [...mine, ...protocols].find((e) => e.id === activeEvaluationId) ?? null;

  if (mine.length === 0 && protocols.length === 0) {
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
        {mine.length > 0 && (
          <optgroup label="My Evaluations">
            {mine.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </optgroup>
        )}
        {protocols.length > 0 && (
          <optgroup label="Protocols">
            {protocols.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </optgroup>
        )}
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
