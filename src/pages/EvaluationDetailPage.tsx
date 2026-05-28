import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Container, useAuth, type User } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import EvaluationView from '@/components/evaluation/EvaluationView';
import { evaluationStorage } from '@/services/evaluationStorage';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { useMods } from '@/contexts/ModContext';
import type { Evaluation, EvaluationVisibility } from '@/types/evaluation';
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

function visibilityBadge(v: EvaluationVisibility): {
  label: string;
  variant: 'default' | 'info' | 'success';
} {
  if (v === 'protocol') return { label: 'Protocol', variant: 'info' };
  if (v === 'manifest') return { label: 'Manifest', variant: 'success' };
  return { label: 'Private', variant: 'default' };
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
  const [forkError, setForkError] = useState<string | null>(null);
  const [isForking, setIsForking] = useState(false);

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
  const owner = isOwner(evaluation, user);
  const badge = visibilityBadge(evaluation.visibility);
  // Fork is offered when a logged-in user is viewing a Protocol they don't
  // own. Logged-out users see Protocols too but can't fork (no account to
  // own a copy); they can still Use.
  const canFork =
    !owner && evaluation.visibility === 'protocol' && user != null;

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

  const handleFork = async () => {
    if (isForking) return;
    setForkError(null);
    setIsForking(true);
    try {
      const copy = await evaluationStorage.fork(evaluation.id);
      navigate(`/evaluations/${copy.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to fork evaluation.';
      setForkError(message);
      setIsForking(false);
    }
  };

  const configuredCount = evaluation.mod_set_configs.filter(
    (c) => c.variants.length > 0
  ).length;
  const totalSets = modSets.length;
  const progressPercent =
    totalSets === 0 ? 0 : Math.round((configuredCount / totalSets) * 100);

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
              <div className={styles.heroTopRow}>
                <p className={styles.heroEyebrow}>Evaluation Profile</p>
                <Badge variant={badge.variant} size="sm">
                  {badge.label}
                </Badge>
              </div>
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
                {canFork && (
                  <Button
                    variant="outline"
                    onClick={handleFork}
                    disabled={isForking}
                  >
                    {isForking ? 'Forking…' : 'Fork'}
                  </Button>
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
              {forkError && (
                <p role="alert" style={{ color: 'var(--color-danger, #d33)', margin: 0 }}>
                  {forkError}
                </p>
              )}
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

            <EvaluationView evaluation={evaluation} />
          </div>
        </div>
      </Container>
    </Layout>
  );
}
