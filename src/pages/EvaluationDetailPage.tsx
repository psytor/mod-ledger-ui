import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import { evaluationStorage } from '@/services/evaluationStorage';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { useMods } from '@/contexts/ModContext';
import type { Evaluation } from '@/types/evaluation';

// Phase 1: local records (ownerUserId === null) are owned by the current user.
// When auth lands, compare against the authenticated user's id.
function isOwner(ev: Evaluation): boolean {
  return ev.ownerUserId === null;
}

export default function EvaluationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveEvaluationId } = useEvaluation();
  const { modSets } = useMods();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'not-found' }
    | { kind: 'ready'; evaluation: Evaluation }
  >({ kind: 'loading' });

  useEffect(() => {
    if (!id) return;
    const ev = evaluationStorage.get(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(ev ? { kind: 'ready', evaluation: ev } : { kind: 'not-found' });
  }, [id]);

  if (state.kind === 'loading') {
    return (
      <Layout>
        <p>Loading…</p>
      </Layout>
    );
  }

  if (state.kind === 'not-found') {
    return <Navigate to="/evaluations" replace />;
  }

  const { evaluation } = state;

  const handleUseThis = () => {
    setActiveEvaluationId(evaluation.id);
    navigate('/');
  };

  const configuredCount = evaluation.mod_set_configs.filter(
    (c) => c.variants.length > 0
  ).length;

  return (
    <Layout>
      <Link to="/evaluations" style={{ fontSize: '0.9rem' }}>
        ← Back to evaluations
      </Link>
      <h1 style={{ marginTop: '0.5rem' }}>{evaluation.name}</h1>
      {evaluation.description && (
        <p style={{ color: 'var(--color-text-secondary, #888)' }}>{evaluation.description}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <Button variant="primary" onClick={handleUseThis}>
          Use this
        </Button>
        {isOwner(evaluation) && (
          <Link to={`/evaluations/${evaluation.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
        )}
      </div>

      <h2 style={{ marginTop: '2rem' }}>Mod sets</h2>
      <p style={{ color: 'var(--color-text-secondary, #888)', fontSize: '0.9rem' }}>
        {configuredCount} of {modSets.length} mod sets configured.
      </p>

      {modSets.length === 0 ? (
        <p>Loading mod sets…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {modSets.map((set) => {
            const config = evaluation.mod_set_configs.find((c) => c.set_id === set.set_id);
            const count = config?.variants.length ?? 0;
            return (
              <li
                key={set.set_id}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--color-border, #333)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <span style={{ fontWeight: 600 }}>{set.name}</span>
                <span
                  style={{
                    color:
                      count === 0
                        ? 'var(--color-text-secondary, #888)'
                        : 'var(--color-text, #e8e8e8)',
                    fontSize: '0.9rem',
                  }}
                >
                  {count === 0
                    ? 'unconfigured'
                    : `${count} variant${count === 1 ? '' : 's'}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

    </Layout>
  );
}
