import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Container, useAuth } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import ImportEvaluationDialog from '@/components/evaluation/ImportEvaluationDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
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

export default function EvaluationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [evaluations] = useState<Evaluation[]>(() => evaluationStorage.listMine());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{
    payload: EvaluationExportV1;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice in a row still fires onChange.
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

  const handleImportConfirm = (nameOverride: string) => {
    if (!pendingImport) return;
    const created = evaluationStorage.importFromJson(
      JSON.stringify(pendingImport.payload),
      { nameOverride }
    );
    setPendingImport(null);
    navigate(`/evaluations/${created.id}`);
  };

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

          {evaluations.length === 0 ? (
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
            <>
              <p className={styles.divider}>Saved Loadouts</p>
              <div className={styles.grid}>
                {evaluations.map((e) => {
                  const dateLabel = new Date(e.createdAt).toLocaleDateString(
                    undefined,
                    DATE_FORMAT
                  );
                  const otherAuthor =
                    e.authoredBy?.username &&
                    e.authoredBy.userId !== (user?.id ?? null)
                      ? e.authoredBy.username
                      : null;
                  return (
                    <Link key={e.id} to={`/evaluations/${e.id}`} className={styles.cardLink}>
                      <Card
                        chamfered
                        hoverable
                        padding="none"
                        showDiagonalBorders
                        diagonalBorderColor="var(--color-primary)"
                        className={styles.card}
                      >
                        <span className={styles.cardAccent} aria-hidden="true" />
                        <p className={styles.cardEyebrow}>
                          {otherAuthor ? 'Imported' : 'Evaluation'}
                        </p>
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
                })}
              </div>
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
