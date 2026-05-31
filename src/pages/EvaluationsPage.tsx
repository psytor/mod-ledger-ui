import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Container, useAuth } from 'astrogators-shared-ui';
import Layout, { EVALS_MIGRATED_EVENT } from '@/components/layout/Layout';
import ImportEvaluationDialog from '@/components/evaluation/ImportEvaluationDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
import { evaluationsApi } from '@/services/evaluationsApi';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { EvaluationImportError, type EvaluationExportV1 } from '@/types/evaluationExport';
import type { Evaluation } from '@/types/evaluation';
import styles from './EvaluationsPage.module.css';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

// Mobile breakpoint mirrors the existing CSS @media (max-width: 640px).
// Above this width: stack both sections; below: render tabs.
const MOBILE_QUERY = '(max-width: 640px)';

type Tab = 'mine' | 'protocols';

export default function EvaluationsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoadingEvals, setIsLoadingEvals] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [protocols, setProtocols] = useState<Evaluation[]>([]);
  const [isLoadingProtocols, setIsLoadingProtocols] = useState(true);
  const [protocolsError, setProtocolsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('mine');
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
        err instanceof Error ? err.message : 'Failed to load Protocols.';
      setProtocolsError(message);
      setProtocols([]);
    } finally {
      setIsLoadingProtocols(false);
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

  // Refetch Mine after the migration prompt (owned by Layout) imports
  // local evals to the backend.
  useEffect(() => {
    const onMigrated = () => {
      void reload();
    };
    window.addEventListener(EVALS_MIGRATED_EVENT, onMigrated);
    return () => window.removeEventListener(EVALS_MIGRATED_EVENT, onMigrated);
  }, [reload]);

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
            diagonalBorderColor="var(--color-primary)"
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

          {isMobile ? (
            <>
              <div className={styles.tabs} role="tablist" aria-label="Evaluations">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'mine'}
                  data-active={activeTab === 'mine'}
                  onClick={() => setActiveTab('mine')}
                  className={styles.tab}
                >
                  My Evaluations
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'protocols'}
                  data-active={activeTab === 'protocols'}
                  onClick={() => setActiveTab('protocols')}
                  className={styles.tab}
                >
                  Protocols
                </button>
              </div>
              {activeTab === 'mine' ? mineSection : protocolsSection}
            </>
          ) : (
            <>
              {mineSection}
              {protocolsSection}
            </>
          )}
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
    <section className={styles.section} aria-label="My Evaluations">
      <p className={styles.divider}>My Evaluations</p>
      {loadError && (
        <p className={styles.importError} role="alert">
          {loadError}
        </p>
      )}
      {isLoading ? (
        <Card chamfered padding="none" className={styles.empty}>
          <p className={styles.emptyText}>Loading evaluations…</p>
        </Card>
      ) : evaluations.length === 0 ? (
        <Card
          chamfered
          padding="none"
          showDiagonalBorders
          diagonalBorderColor="var(--color-primary)"
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
    <section className={styles.section} aria-label="Protocols">
      <p className={styles.divider}>Protocols</p>
      {loadError && (
        <p className={styles.importError} role="alert">
          {loadError}
        </p>
      )}
      {isLoading ? (
        <Card chamfered padding="none" className={styles.empty}>
          <p className={styles.emptyText}>Loading Protocols…</p>
        </Card>
      ) : protocols.length === 0 ? (
        <Card chamfered padding="none" className={styles.empty}>
          <p className={styles.emptyText}>
            No Protocols yet. Admin-curated rule sets show up here once
            they&apos;re published.
          </p>
        </Card>
      ) : (
        <div className={styles.grid}>
          {protocols.map((e) => (
            <EvaluationCard
              key={e.id}
              evaluation={e}
              currentUserId={null}
              eyebrowOverride="Protocol"
            />
          ))}
        </div>
      )}
    </section>
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
        diagonalBorderColor="var(--card-line-color)"
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
