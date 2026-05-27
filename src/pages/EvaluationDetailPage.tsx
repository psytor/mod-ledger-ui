import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Container, useAuth, type User } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import { evaluationStorage } from '@/services/evaluationStorage';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { useMods } from '@/contexts/ModContext';
import type { Evaluation } from '@/types/evaluation';
import styles from './EvaluationDetailPage.module.css';

// Ownership predicate.
// - Logged out: localStorage records have ownerUserId === null → owner.
// - Logged in: backend records carry ownerUserId === user.id (numeric).
//   Shared-ui's User.id is a string, so we coerce for the comparison.
function isOwner(ev: Evaluation, user: User | null): boolean {
  if (user == null) return ev.ownerUserId === null;
  return ev.ownerUserId === Number(user.id);
}

function slugifyForFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'evaluation';
}

export default function EvaluationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeEvaluationId, setActiveEvaluationId } = useEvaluation();
  const { modSets } = useMods();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'not-found' }
    | { kind: 'ready'; evaluation: Evaluation }
  >({ kind: 'loading' });

  useEffect(() => {
    if (!id) return;
    if (isAuthLoading) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    void evaluationStorage
      .get(id)
      .then((ev) => {
        if (cancelled) return;
        setState(ev ? { kind: 'ready', evaluation: ev } : { kind: 'not-found' });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: 'not-found' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAuthLoading]);

  if (state.kind === 'loading') {
    return (
      <Layout>
        <Container maxWidth="lg">
          <div className={styles.page}>
            <div className={styles.shell}>
              <p className={styles.loading}>Loading…</p>
            </div>
          </div>
        </Container>
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

  const handleExport = () => {
    const author = user
      ? { userId: user.id, username: user.username }
      : null;
    const json = evaluationStorage.exportToJson(evaluation, author);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mod-ledger-${slugifyForFilename(evaluation.name)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete "${evaluation.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    if (activeEvaluationId === evaluation.id) {
      setActiveEvaluationId(null);
    }
    try {
      await evaluationStorage.delete(evaluation.id);
      navigate('/evaluations');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete evaluation.';
      window.alert(message);
    }
  };

  const configuredCount = evaluation.mod_set_configs.filter(
    (c) => c.variants.length > 0
  ).length;
  const totalSets = modSets.length;
  const progressPercent =
    totalSets === 0 ? 0 : Math.round((configuredCount / totalSets) * 100);
  const owner = isOwner(evaluation, user);

  return (
    <Layout>
      <Container maxWidth="lg">
        <div className={styles.page}>
          <div className={styles.shell}>
            <Link to="/evaluations" className={styles.back}>
              Back to evaluations
            </Link>

            <Card
              chamfered
              chamferSize="lg"
              variant="outline"
              padding="none"
              showDiagonalBorders
              diagonalBorderColor="var(--color-primary)"
              className={styles.heroCard}
            >
              <span className={styles.heroAccent} aria-hidden="true" />
              <p className={styles.heroEyebrow}>Evaluation Profile</p>
              <h1 className={styles.heroTitle}>{evaluation.name}</h1>
              {evaluation.description && (
                <p className={styles.heroDesc}>{evaluation.description}</p>
              )}

              <div className={styles.heroActions}>
                <Button variant="primary" onClick={handleUseThis}>
                  Use this
                </Button>
                {owner && (
                  <Link to={`/evaluations/${evaluation.id}/edit`}>
                    <Button variant="outline">Edit</Button>
                  </Link>
                )}
                <Button variant="outline" onClick={handleExport}>
                  Export
                </Button>
                {owner && (
                  <span className={styles.danger}>
                    <Button variant="danger" onClick={handleDelete}>
                      Delete
                    </Button>
                  </span>
                )}
              </div>
            </Card>

            <Card chamfered chamferSize="sm" padding="none" className={styles.statusCard}>
              <div className={styles.statusHead}>
                <p className={styles.statusLabel}>Configuration coverage</p>
                <span className={styles.statusValue}>
                  {configuredCount}
                  <em> / {totalSets || '—'}</em>
                </span>
              </div>
              <div className={styles.statusBar} aria-hidden="true">
                <div
                  className={styles.statusFill}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </Card>

            <section className={styles.section}>
              <header className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Mod sets</h2>
                <p className={styles.sectionMeta}>
                  {totalSets === 0
                    ? 'Awaiting set data'
                    : `${configuredCount} of ${totalSets} configured`}
                </p>
              </header>

              {totalSets === 0 ? (
                <p className={styles.loading}>Loading mod sets…</p>
              ) : (
                <div className={styles.setList} role="list">
                  {modSets.map((set) => {
                    const config = evaluation.mod_set_configs.find(
                      (c) => c.set_id === set.set_id
                    );
                    const count = config?.variants.length ?? 0;
                    const configured = count > 0;
                    return (
                      <Card
                        key={set.set_id}
                        chamfered
                        padding="none"
                        showDiagonalBorders
                        diagonalBorderColor={
                          configured ? 'var(--color-success)' : 'var(--color-border)'
                        }
                        className={`${styles.setRow} ${configured ? styles.setRowConfigured : ''}`}
                      >
                        <span className={styles.setRowName}>{set.name}</span>
                        <div className={styles.setRowMeta}>
                          <span className={styles.setRowCount}>
                            {configured
                              ? `${count} scoring rule${count === 1 ? '' : 's'}`
                              : 'No scoring rules'}
                          </span>
                          <Badge
                            variant={configured ? 'success' : 'default'}
                            size="sm"
                          >
                            {configured ? 'Configured' : 'Unconfigured'}
                          </Badge>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </Container>
    </Layout>
  );
}
