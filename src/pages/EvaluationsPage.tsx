import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Container, Modal, fetchUsernames, useAuth } from 'astrogators-shared-ui';
import Layout, { EVALS_MIGRATED_EVENT } from '@/components/layout/Layout';
import ImportEvaluationDialog from '@/components/evaluation/ImportEvaluationDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
import { evaluationsApi } from '@/services/evaluationsApi';
import { canModerate } from '@/utils/permissions';
import { EvaluationImportError, type EvaluationExportV1 } from '@/types/evaluationExport';
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

export default function EvaluationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoadingEvals, setIsLoadingEvals] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [protocols, setProtocols] = useState<Evaluation[]>([]);
  const [isLoadingProtocols, setIsLoadingProtocols] = useState(true);
  const [protocolsError, setProtocolsError] = useState<string | null>(null);
  const [manifests, setManifests] = useState<Evaluation[]>([]);
  const [isLoadingManifests, setIsLoadingManifests] = useState(true);
  const [manifestsError, setManifestsError] = useState<string | null>(null);
  const [manifestUsernames, setManifestUsernames] = useState<Record<number, string>>({});
  // id -> newly-created Protocol, once published this session (the source
  // Manifest is untouched by /publish, so the row stays — this just swaps
  // the action for a link to what got created).
  const [published, setPublished] = useState<Record<string, Evaluation>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{
    payload: EvaluationExportV1;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    setIsLoadingEvals(true);
    try {
      const list = await evaluationStorage.listMine();
      setEvaluations(list);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load evaluations.';
      setLoadError(message);
      setEvaluations([]);
    } finally {
      setIsLoadingEvals(false);
    }
  }, []);

  const reloadProtocols = useCallback(async () => {
    setProtocolsError(null);
    setIsLoadingProtocols(true);
    try {
      const list = await evaluationsApi.listProtocols();
      setProtocols(list);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load the official evaluations.';
      setProtocolsError(message);
      setProtocols([]);
    } finally {
      setIsLoadingProtocols(false);
    }
  }, []);

  const reloadManifests = useCallback(async () => {
    setManifestsError(null);
    setIsLoadingManifests(true);
    try {
      const list = await evaluationsApi.listAllManifests();
      setManifests(list);

      const ownerIds = [
        ...new Set(list.map((e) => e.ownerUserId).filter((id): id is number => id !== null)),
      ];
      try {
        const names = await fetchUsernames(ownerIds);
        setManifestUsernames(names);
      } catch {
        // Non-fatal — cards fall back to a raw "User #N" label.
        setManifestUsernames({});
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load shared evaluations.';
      setManifestsError(message);
      setManifests([]);
    } finally {
      setIsLoadingManifests(false);
    }
  }, []);

  // Re-fetch Mine whenever auth resolves or flips — the storage adapter
  // swaps backends based on getAccessToken().
  useEffect(() => {
    if (isAuthLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [isAuthLoading, isAuthenticated, reload]);

  // Protocols are world-readable; fetch once on mount regardless of auth.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadProtocols();
  }, [reloadProtocols]);

  // Moderation (the Manifest review queue) is admin/mod-only — same gate as
  // the section's own render below. Always fetched alongside the other two
  // once auth resolves for an admin/mod, same as Protocols always fetching
  // regardless of which section you're actually looking at.
  useEffect(() => {
    if (isAuthLoading) return;
    if (!canModerate(user)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadManifests();
  }, [isAuthLoading, user, reloadManifests]);

  // Refetch Mine after the migration prompt (owned by Layout) imports
  // local evals to the backend.
  useEffect(() => {
    const onMigrated = () => {
      void reload();
    };
    window.addEventListener(EVALS_MIGRATED_EVENT, onMigrated);
    return () => window.removeEventListener(EVALS_MIGRATED_EVENT, onMigrated);
  }, [reload]);

  // Both sections are always on the page now — NavBar's "My Evaluations" /
  // "Official" links are just anchors into it (SUITE_NAV:
  // /evaluations, /evaluations#official). Scroll to whichever one was
  // clicked, whether arriving fresh or already on this page (same-route
  // hash-only navigations don't remount this component, so this needs to
  // re-run on every hash change, not just on mount).
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = evaluationStorage.parseImportJson(text);
      setPendingImport({ payload });
    } catch (err) {
      const message =
        err instanceof EvaluationImportError
          ? err.message
          : 'Could not read the selected file.';
      setImportError(message);
    }
  };

  const handleImportConfirm = async (nameOverride: string) => {
    if (!pendingImport) return;
    try {
      const created = await evaluationStorage.importFromJson(
        JSON.stringify(pendingImport.payload),
        { nameOverride }
      );
      setPendingImport(null);
      navigate(`/evaluations/${created.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to import evaluation.';
      setImportError(message);
      setPendingImport(null);
    }
  };

  const mineSection = (
    <MineSection
      evaluations={evaluations}
      isLoading={isLoadingEvals}
      loadError={loadError}
      currentUserId={user?.id ?? null}
    />
  );

  const protocolsSection = (
    <ProtocolsSection
      protocols={protocols}
      isLoading={isLoadingProtocols}
      loadError={protocolsError}
    />
  );

  // Same client-side gate ModerationPage used to enforce as a whole-route
  // redirect — now scoped to just this section, since the NavBar's own
  // roles gate only hides the link, it doesn't stop a direct #moderation
  // visit. Real enforcement stays server-side either way.
  const moderationSection = canModerate(user) ? (
    <ModerationSection
      manifests={manifests}
      isLoading={isLoadingManifests}
      loadError={manifestsError}
      usernames={manifestUsernames}
      published={published}
      onPublished={(manifestId, protocol) =>
        setPublished((prev) => ({ ...prev, [manifestId]: protocol }))
      }
    />
  ) : null;

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
            <p className={styles.eyebrow}>Mod Ledger // Evaluations</p>
            <h1 className={styles.title}>Evaluations</h1>
            <p className={styles.subtitle}>
              Score sets, save variants, and replay them across runs. Each evaluation is a saved
              lens for grading the mods you pull.
            </p>
            <div className={styles.heroAction}>
              {evaluations.length > 0 && (
                <span className={styles.heroCount}>
                  <strong>{evaluations.length}</strong> Saved
                </span>
              )}
              <Link to="/evaluations/new">
                <Button variant="primary">New evaluation</Button>
              </Link>
              <Button variant="outline" onClick={handleImportClick}>
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={handleFileChange}
              />
            </div>
            {importError && (
              <p className={styles.importError} role="alert">
                {importError}
              </p>
            )}
          </Card>

          {protocolsSection}
          {mineSection}
          {moderationSection}
        </div>
      </Container>
      <ImportEvaluationDialog
        isOpen={pendingImport !== null}
        payload={pendingImport?.payload ?? null}
        existingNames={evaluations.map((e) => e.name)}
        onCancel={() => setPendingImport(null)}
        onConfirm={handleImportConfirm}
      />
    </Layout>
  );
}

interface MineSectionProps {
  evaluations: Evaluation[];
  isLoading: boolean;
  loadError: string | null;
  currentUserId: string | null;
}

function MineSection({
  evaluations,
  isLoading,
  loadError,
  currentUserId,
}: MineSectionProps) {
  return (
    <section id="my-evaluations" className={styles.section} aria-label="My Evaluations">
      <p className={styles.divider}>My Evaluations</p>
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
          <p className={styles.emptyText}>Loading evaluations…</p>
        </Card>
      ) : evaluations.length === 0 ? (
        <Card
          chamfered
          padding="none"
          showDiagonalBorders
          edgeColor="var(--color-primary)"
          className={styles.empty}
        >
          <span className={styles.emptyAccent} aria-hidden="true" />
          <h2 className={styles.emptyTitle}>No evaluations yet</h2>
          <p className={styles.emptyText}>
            Build your first evaluation to start scoring mods. Configure variants per set, tune
            stat targets, and reuse the result whenever you want a verdict.
          </p>
          <Link to="/evaluations/new" className={styles.emptyAction}>
            <Button variant="primary">Create your first evaluation</Button>
          </Link>
        </Card>
      ) : (
        <div className={styles.grid}>
          {evaluations.map((e) => (
            <EvaluationCard
              key={e.id}
              evaluation={e}
              currentUserId={currentUserId}
              eyebrowOverride={undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface ProtocolsSectionProps {
  protocols: Evaluation[];
  isLoading: boolean;
  loadError: string | null;
}

function ProtocolsSection({
  protocols,
  isLoading,
  loadError,
}: ProtocolsSectionProps) {
  return (
    <section id="official" className={styles.section} aria-label="Official">
      <p className={styles.divider}>Official</p>
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
          <p className={styles.emptyText}>Loading…</p>
        </Card>
      ) : protocols.length === 0 ? (
        <Card
          chamfered
          padding="none"
          showDiagonalBorders
          edgeColor="var(--color-primary)"
          className={styles.empty}
        >
          <p className={styles.emptyText}>
            Nothing here yet. Evaluations picked by the site's admins show up
            here once they&apos;re published.
          </p>
        </Card>
      ) : (
        <div className={styles.grid}>
          {protocols.map((e) => (
            <EvaluationCard
              key={e.id}
              evaluation={e}
              currentUserId={null}
              eyebrowOverride="Official"
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface ModerationSectionProps {
  manifests: Evaluation[];
  isLoading: boolean;
  loadError: string | null;
  usernames: Record<number, string>;
  published: Record<string, Evaluation>;
  onPublished: (manifestId: string, protocol: Evaluation) => void;
}

function ModerationSection({
  manifests,
  isLoading,
  loadError,
  usernames,
  published,
  onPublished,
}: ModerationSectionProps) {
  return (
    <section id="moderation" className={styles.section} aria-label="Moderation">
      <p className={styles.divider}>Moderation</p>
      <p className={styles.emptyText}>
        Every Manifest (link-only shared evaluation) across every user. Publish a good one to
        the Official list.
      </p>
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
              onPublished={(protocol) => onPublished(e.id, protocol)}
            />
          ))}
        </div>
      )}
    </section>
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
        edgeColor="var(--color-border)"
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
              Open →
            </Link>
          ) : (
            <Button variant="outline" size="sm" onClick={openModal}>
              Publish
            </Button>
          )}
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={closeModal} title="Publish as Official" size="sm">
        <div>
          <p>
            Promote "{e.name}" to Official. Anyone will be able to find it in the Official
            list — including logged-out users.
          </p>
          <label>
            <span>Slug</span>
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

interface EvaluationCardProps {
  evaluation: Evaluation;
  currentUserId: string | null;
  eyebrowOverride: string | undefined;
}

function EvaluationCard({
  evaluation: e,
  currentUserId,
  eyebrowOverride,
}: EvaluationCardProps) {
  const dateLabel = new Date(e.createdAt).toLocaleDateString(
    undefined,
    DATE_FORMAT
  );
  const otherAuthor =
    e.authoredBy?.username && e.authoredBy.userId !== currentUserId
      ? e.authoredBy.username
      : null;
  const eyebrow =
    eyebrowOverride ?? (otherAuthor ? 'Imported' : 'Evaluation');
  return (
    <Link to={`/evaluations/${e.id}`} className={styles.cardLink}>
      <Card
        chamfered
        hoverable
        padding="none"
        showDiagonalBorders
        edgeColor="var(--color-border)"
        className={styles.card}
      >
        <span className={styles.cardAccent} aria-hidden="true" />
        <p className={styles.cardEyebrow}>{eyebrow}</p>
        <h2 className={styles.cardName}>{e.name}</h2>
        {e.description && <p className={styles.cardDesc}>{e.description}</p>}
        <p className={styles.cardMeta}>
          {otherAuthor && (
            <>
              <span>by {otherAuthor}</span>
              <span aria-hidden="true"> · </span>
            </>
          )}
          <span>{dateLabel}</span>
        </p>
        <div className={styles.cardFooter}>
          <span>Loadout</span>
          <span className={styles.cardOpen}>Open →</span>
        </div>
      </Card>
    </Link>
  );
}
