import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Container,
  Modal,
  useAuth,
  type User,
} from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import EvaluationView from '@/components/evaluation/EvaluationView';
import LinkifiedText from '@/components/evaluation/LinkifiedText';
import CopyEvaluationDialog from '@/components/evaluation/CopyEvaluationDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { useMods } from '@/contexts/ModContext';
import { canModerate } from '@/utils/permissions';
import type { Evaluation, EvaluationVisibility } from '@/types/evaluation';
import styles from './EvaluationDetailPage.module.css';

// Ownership predicate.
// - Logged out: localStorage records have ownerUserId === null → owner.
// - Logged in: backend records carry ownerUserId === user.id (numeric).
//   Shared-ui's User.id is a string, so we coerce for the comparison.
function isOwner(ev: Evaluation, user: User | null): boolean {
  // Protocols are admin-collective (ownerUserId is null) — nobody owns one
  // personally, so the null-means-mine localStorage rule must not apply.
  if (ev.visibility === 'protocol') return false;
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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function visibilityBadge(v: EvaluationVisibility): {
  label: string;
  variant: 'default' | 'info' | 'success';
} {
  if (v === 'protocol') return { label: 'Protocol', variant: 'info' };
  if (v === 'manifest') return { label: 'Manifest', variant: 'success' };
  return { label: 'Private', variant: 'default' };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
  // Share / Stop Sharing share one feedback channel — they're never both
  // mid-flight, and either lands by mutating the same hero badge.
  const [shareFeedback, setShareFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null);
  const [isSharing, setIsSharing] = useState(false);
  const [publishModal, setPublishModal] = useState(false);
  const [publishSlug, setPublishSlug] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  // The caller's own eval names — fetched when the copy modal opens, drives
  // the duplicate-name warning the same way the builder does.
  const [myNames, setMyNames] = useState<string[]>([]);
  // Which mod set EvaluationView is currently showing, so the Edit link can
  // hand it to the builder (?set=) and you land on the same set.
  const [viewSetId, setViewSetId] = useState<number | null>(null);

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
  const moderator = canModerate(user);
  const badge = visibilityBadge(evaluation.visibility);
  const canPublish = moderator && evaluation.visibility === 'manifest';
  const canStopSharing = owner && evaluation.visibility === 'manifest';
  // Protocols are admin-collective: any admin or mod can edit/delete them
  // even though nobody owns one. Edit/Delete show for the owner OR a
  // moderator looking at a Protocol.
  const canManageProtocol = moderator && evaluation.visibility === 'protocol';
  const canEdit = owner || canManageProtocol;
  const canDelete = owner || canManageProtocol;
  // Copy an eval you can see but don't own (a Protocol, or a Manifest link)
  // into your own account. Requires being signed in; your own evals offer
  // Edit instead.
  const canCopy = !owner && !!user;

  const detailUrl = `${window.location.origin}${window.location.pathname}`;

  const replaceState = (next: Evaluation) =>
    setState({ kind: 'ready', evaluation: next });

  const handleUseThis = () => {
    setActiveEvaluationId(evaluation.id);
    navigate('/');
  };

  const handleOpenCopy = () => {
    // Refresh the caller's eval names so the duplicate warning is current,
    // then open the modal. A failed fetch just means no warning, not a block.
    void evaluationStorage
      .listMine()
      .then((list) => setMyNames(list.map((e) => e.name)))
      .catch(() => setMyNames([]));
    setCopyModalOpen(true);
  };

  const handleConfirmCopy = async (name: string) => {
    if (isCopying) return;
    setIsCopying(true);
    try {
      const copy = await evaluationStorage.createCopy(evaluation.id, name);
      navigate(`/evaluations/${copy.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create a copy.';
      window.alert(message);
      setIsCopying(false);
    }
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

  const handleShare = async () => {
    if (isSharing) return;
    setShareFeedback(null);
    // Owner + currently Private: Share is the flip-to-Manifest moment.
    // Anything else: it's just a clipboard copy.
    const shouldFlipToManifest = owner && evaluation.visibility === 'private';
    setIsSharing(true);
    try {
      if (shouldFlipToManifest) {
        const updated = await evaluationStorage.setVisibility(
          evaluation.id,
          'manifest'
        );
        replaceState(updated);
      }
      const copied = await copyToClipboard(detailUrl);
      setShareFeedback({
        kind: 'success',
        message: shouldFlipToManifest
          ? copied
            ? 'Shared — link copied to clipboard.'
            : 'Shared. Copy the URL from the address bar to share it.'
          : copied
            ? 'Link copied to clipboard.'
            : 'Copy the URL from the address bar.',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to share evaluation.';
      setShareFeedback({ kind: 'error', message });
    } finally {
      setIsSharing(false);
    }
  };

  const handleStopSharing = async () => {
    if (isSharing) return;
    const confirmed = window.confirm(
      'Stop sharing this evaluation? Old shared links will stop working ' +
        'for everyone except you.'
    );
    if (!confirmed) return;
    setShareFeedback(null);
    setIsSharing(true);
    try {
      const updated = await evaluationStorage.setVisibility(
        evaluation.id,
        'private'
      );
      replaceState(updated);
      setShareFeedback({
        kind: 'success',
        message: 'Sharing stopped. Old shared links now 404 for others.',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to stop sharing.';
      setShareFeedback({ kind: 'error', message });
    } finally {
      setIsSharing(false);
    }
  };

  const openPublishModal = () => {
    setPublishSlug('');
    setPublishError(null);
    setPublishModal(true);
  };

  const closePublishModal = () => {
    if (isPublishing) return;
    setPublishModal(false);
  };

  const submitPublish = async () => {
    if (isPublishing) return;
    const slug = publishSlug.trim();
    if (!SLUG_PATTERN.test(slug)) {
      setPublishError(
        'Slug must be lowercase letters, numbers, and hyphens (e.g. speed-mod).'
      );
      return;
    }
    setPublishError(null);
    setIsPublishing(true);
    try {
      // Publish snapshots a NEW admin-owned Protocol (a different id). The
      // source Manifest is untouched; navigate the admin to the live
      // Protocol they just created.
      const protocol = await evaluationStorage.publish(evaluation.id, slug);
      setPublishModal(false);
      navigate(`/evaluations/${protocol.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to publish.';
      setPublishError(message);
    } finally {
      setIsPublishing(false);
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
              edgeColor="var(--color-primary)"
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
                <p className={styles.heroDesc}>
                  <LinkifiedText text={evaluation.description} />
                </p>
              )}

              <div className={styles.heroActions}>
                <Button variant="primary" onClick={handleUseThis}>
                  Use this
                </Button>
                {canEdit && (
                  <Link
                    to={`/evaluations/${evaluation.id}/edit${
                      viewSetId != null ? `?set=${viewSetId}` : ''
                    }`}
                  >
                    <Button variant="outline">Edit</Button>
                  </Link>
                )}
                {canCopy && (
                  <Button variant="outline" onClick={handleOpenCopy}>
                    Create a Copy
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleShare}
                  disabled={isSharing}
                >
                  {isSharing ? 'Sharing…' : 'Share'}
                </Button>
                {canStopSharing && (
                  <Button
                    variant="outline"
                    onClick={handleStopSharing}
                    disabled={isSharing}
                  >
                    Stop sharing
                  </Button>
                )}
                {canPublish && (
                  <Button variant="outline" onClick={openPublishModal}>
                    Publish as Protocol
                  </Button>
                )}
                <Button variant="outline" onClick={handleExport}>
                  Export
                </Button>
                {canDelete && (
                  <span className={styles.danger}>
                    <Button variant="danger" onClick={handleDelete}>
                      {canManageProtocol && !owner ? 'Delete Protocol' : 'Delete'}
                    </Button>
                  </span>
                )}
              </div>
              {shareFeedback && (
                <p
                  role="status"
                  className={
                    shareFeedback.kind === 'success'
                      ? styles.feedbackOk
                      : styles.feedbackErr
                  }
                >
                  {shareFeedback.message}
                </p>
              )}
            </Card>

            <Card
              chamfered
              chamferSize="md"
              showDiagonalBorders
              edgeColor="var(--color-primary)"
              padding="none"
              className={styles.statusCard}
            >
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

            <EvaluationView
              evaluation={evaluation}
              selectedSetId={viewSetId}
              onSelectSet={setViewSetId}
            />
          </div>
        </div>
      </Container>

      <Modal
        isOpen={publishModal}
        onClose={closePublishModal}
        title="Publish as Protocol"
        size="sm"
      >
        <div className={styles.publishBody}>
          <p>
            Promote this Manifest to a Protocol. Anyone will be able to
            find it in the Protocols list — including logged-out users.
          </p>
          <label className={styles.publishLabel}>
            <span>Protocol slug</span>
            <input
              type="text"
              value={publishSlug}
              onChange={(e) => setPublishSlug(e.target.value)}
              placeholder="speed-mod"
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
              className={styles.publishInput}
              disabled={isPublishing}
            />
            <small className={styles.publishHint}>
              Lowercase letters, numbers, and hyphens. This is the
              permanent identifier and can&apos;t be changed later.
            </small>
          </label>
          {publishError && (
            <p role="alert" className={styles.feedbackErr}>
              {publishError}
            </p>
          )}
          <div className={styles.publishActions}>
            <Button
              type="button"
              variant="outline"
              onClick={closePublishModal}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={submitPublish}
              disabled={isPublishing || publishSlug.trim().length === 0}
            >
              {isPublishing ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </div>
      </Modal>

      <CopyEvaluationDialog
        isOpen={copyModalOpen}
        source={evaluation}
        existingNames={myNames}
        isCopying={isCopying}
        onCancel={() => setCopyModalOpen(false)}
        onConfirm={handleConfirmCopy}
      />
    </Layout>
  );
}
