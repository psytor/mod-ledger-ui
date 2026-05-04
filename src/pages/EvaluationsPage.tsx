import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import { evaluationStorage } from '@/services/evaluationStorage';
import type { Evaluation } from '@/types/evaluation';

export default function EvaluationsPage() {
  const [evaluations] = useState<Evaluation[]>(() => evaluationStorage.listMine());

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1>Evaluations</h1>
        <Link to="/evaluations/new">
          <Button variant="primary">New evaluation</Button>
        </Link>
      </div>

      {evaluations.length === 0 ? (
        <p>No evaluations yet. Create one to start scoring mods.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {evaluations.map((e) => (
            <li
              key={e.id}
              style={{
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--color-border, #333)',
              }}
            >
              <Link
                to={`/evaluations/${e.id}`}
                style={{ fontWeight: 600, textDecoration: 'none' }}
              >
                {e.name}
              </Link>
              {e.description && (
                <div style={{ color: 'var(--color-text-secondary, #888)', fontSize: '0.9rem' }}>
                  {e.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
