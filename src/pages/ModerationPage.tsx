import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button, Card, Container, Modal, fetchUsernames, useAuth } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import { evaluationsApi } from '@/services/evaluationsApi';
import { canModerate } from '@/utils/permissions';
import type { Evaluation } from '@/types/evaluation';
import styles from './EvaluationsPage.module.css';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export default function ModerationPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [manifests, setManifests] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usernames, setUsernames] = useState<Record<number, string>>({});
  // id -> newly-created Protocol, once published this session (the source
  // Manifest is untouched by /publish, so the row stays — this just swaps
  // the action for a link to what got created).
  const [published, setPublished] = useState<Record<string, Evaluation>>({});

  const reload = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const list = await evaluationsApi.listAllManifests();
      setManifests(list);

      const ownerIds = [
        ...new Set(list.map((e) => e.ownerUserId).filter((id): id is number => id !== null)),
      ];
      try {
        const names = await fetchUsernames(ownerIds);
        setUsernames(names);
      } catch {
        // Non-fatal — cards fall back to a raw "User #N" label.
        setUsernames({});
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load shared evaluations.';
      setLoadError(message);
      setManifests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!canModerate(user)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [isAuthLoading, user, reload]);

  if (!isAuthLoading && !canModerate(user)) {
    return <Navigate to="/evaluations" replace />;
  }

  return (
    <Layout>
      <Container maxWidth="lg">
        <div className={styles.page}>
          <Card
            chamfered
            chamferSize="lg"
            variant="outline"
            padding="none"
            showDiagonalBorders
            edgeColor="var(--color-primary)"
            className={styles.hero}
          >
            <span className={styles.heroAccent} aria-hidden="true" />
            <p className={styles.eyebrow}>Mod Ledger // Moderation</p>
            <h1 className={styles.title}>Shared Evaluations</h1>
            <p className={styles.subtitle}>
              Every Manifest (link-only shared evaluation) across every user. Publish a good one
              into the public Protocols list.
            </p>
          </Card>

          {loadError && (
            <p className={styles.importError} role="alert">
              {loadError}
            </p>
          )}

          {isLoading ? (
            <Card
              chamfered
              padding="none"
              showDiagonalBorders
              edgeColor="var(--color-primary)"
              className={styles.empty}
            >
              <p className={styles.emptyText}>Loading shared evaluations…</p>
            </Card>
          ) : manifests.length === 0 ? (
            <Card
              chamfered
              padding="none"
              showDiagonalBorders
              edgeColor="var(--color-primary)"
              className={styles.empty}
            >
              <p className={styles.emptyText}>
                No Manifests shared yet. They&apos;ll show up here as soon as a user shares one.
              </p>
            </Card>
          ) : (
            <div className={styles.grid}>
              {manifests.map((e) => (
                <ManifestCard
                  key={e.id}
                  evaluation={e}
                  ownerUsername={e.ownerUserId != null ? usernames[e.ownerUserId] : undefined}
                  publishedProtocol={published[e.id]}
                  onPublished={(protocol) =>
                    setPublished((prev) => ({ ...prev, [e.id]: protocol }))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </Container>
    </Layout>
  );
}

interface ManifestCardProps {
  evaluation: Evaluation;
  ownerUsername: string | undefined;
  publishedProtocol: Evaluation | undefined;
  onPublished: (protocol: Evaluation) => void;
}

function ManifestCard({
  evaluation: e,
  ownerUsername,
  publishedProtocol,
  onPublished,
}: ManifestCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const dateLabel = new Date(e.createdAt).toLocaleDateString(undefined, DATE_FORMAT);
  const ownerLabel = ownerUsername ?? (e.ownerUserId != null ? `User #${e.ownerUserId}` : 'Unknown');

  const openModal = () => {
    setSlug('');
    setError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isPublishing) return;
    setModalOpen(false);
  };

  const submit = async () => {
    if (isPublishing) return;
    const trimmed = slug.trim();
    if (!SLUG_PATTERN.test(trimmed)) {
      setError('Slug must be lowercase letters, numbers, and hyphens (e.g. speed-mod).');
      return;
    }
    setError(null);
    setIsPublishing(true);
    try {
      const protocol = await evaluationsApi.publish(e.id, trimmed);
      onPublished(protocol);
      setModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish.';
      setError(message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <Card
        chamfered
        padding="none"
        showDiagonalBorders
        edgeColor="var(--card-line-color)"
        className={styles.card}
      >
        <span className={styles.cardAccent} aria-hidden="true" />
        <p className={styles.cardEyebrow}>Manifest</p>
        <h2 className={styles.cardName}>{e.name}</h2>
        {e.description && <p className={styles.cardDesc}>{e.description}</p>}
        <p className={styles.cardMeta}>
          <span>shared by {ownerLabel}</span>
          <span aria-hidden="true"> · </span>
          <span>{dateLabel}</span>
        </p>
        <div className={styles.cardFooter}>
          {publishedProtocol ? (
            <Link to={`/evaluations/${publishedProtocol.id}`} className={styles.cardOpen}>
              View Protocol →
            </Link>
          ) : (
            <Button variant="outline" size="sm" onClick={openModal}>
              Publish
            </Button>
          )}
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={closeModal} title="Publish as Protocol" size="sm">
        <div>
          <p>
            Promote "{e.name}" to a Protocol. Anyone will be able to find it in the Protocols
            list — including logged-out users.
          </p>
          <label>
            <span>Protocol slug</span>
            <input
              type="text"
              value={slug}
              onChange={(ev) => setSlug(ev.target.value)}
              placeholder="speed-mod"
              autoComplete="off"
              disabled={isPublishing}
            />
            <small>
              Lowercase letters, numbers, and hyphens. This is the permanent identifier and
              can&apos;t be changed later.
            </small>
          </label>
          {error && (
            <p role="alert" style={{ color: 'var(--color-danger, #d33)' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button type="button" variant="outline" onClick={closeModal} disabled={isPublishing}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={submit}
              disabled={isPublishing || slug.trim().length === 0}
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
