import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TopBar, Footer, Container, Button, AllyCodeDropdown, useAuth } from 'astrogators-shared-ui';
import MigrationPromptDialog from '@/components/evaluation/MigrationPromptDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
import { useMods } from '@/contexts/ModContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import styles from './Layout.module.css';

// Dispatched on `window` after a successful evaluation migration. Any
// component that derives state from the eval list (e.g. EvaluationsPage)
// can subscribe and refetch.
export const EVALS_MIGRATED_EVENT = 'mod-ledger:evals-migrated';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout, authEnabled, selectedAllyCode } = useAuth();
  const { fetchMods, isLoadingMods } = useMods();
  const { clearVerdicts } = useEvaluation();

  // Manual inventory refresh — re-pulls the selected ally code's mods. The
  // fetch lives in ModContext (not shared-ui): refreshing a mod inventory is a
  // mod-ledger concern, so the button lives here rather than inside the shared
  // AllyCodeDropdown.
  //
  // We clear verdicts first: the new mod data would otherwise be paired with
  // scoring computed against the *old* data (verdicts aren't recomputed
  // reactively — only the EvaluationSelector's Run button does that). A mod
  // that changed would keep a stale band/badge. Clearing drops the top
  // readout and every per-card band chip together, so the grid shows plain
  // mods until the user re-runs the evaluation. Mirrors the ally-code switch.
  const handleRefresh = useCallback(() => {
    if (selectedAllyCode && !isLoadingMods) {
      clearVerdicts();
      fetchMods(selectedAllyCode);
    }
  }, [selectedAllyCode, isLoadingMods, clearVerdicts, fetchMods]);

  // Migration prompt lives at the Layout level (not on EvaluationsPage)
  // so it fires no matter which mod-ledger-ui page the user lands on
  // first after logging in. Otherwise a user who only ever visits the
  // mod grid would never see the prompt and their local evals would
  // silently rot.
  const [localCount, setLocalCount] = useState<number>(
    () => evaluationStorage.listLocal().length
  );

  // Re-read localStorage whenever auth state settles or changes. Covers
  // the rare logout→create-local→login dance without forcing a reload.
  useEffect(() => {
    if (isAuthLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalCount(evaluationStorage.listLocal().length);
  }, [isAuthLoading, isAuthenticated]);

  const handleMigrationImport = useCallback(async () => {
    await evaluationStorage.migrateLocalToBackend();
    setLocalCount(0);
    // Notify listeners (e.g. EvaluationsPage if it's mounted) so they
    // refetch from the backend instead of showing stale state.
    window.dispatchEvent(new CustomEvent(EVALS_MIGRATED_EVENT));
  }, []);

  const handleMigrationDiscard = useCallback(() => {
    evaluationStorage.discardLocal();
    setLocalCount(0);
  }, []);

  const showMigrationPrompt =
    !isAuthLoading && isAuthenticated && localCount > 0;

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar
        className={styles.topBar}
        logo={
          <a href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            The Astrogator's Table
          </a>
        }
        leftContent={
          <span style={{ color: 'var(--color-text-secondary)', marginLeft: '1rem' }}>
            / Mod Ledger
          </span>
        }
        rightContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            {/* Refresh hugs the ally-code dropdown (tight gap) and sits just
                left of it, while the group keeps the normal 1rem gap to the
                rest of the bar. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {selectedAllyCode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoadingMods}
                  title="Refresh inventory"
                  aria-label="Refresh inventory"
                  className={styles.refreshButton}
                >
                  <span className={isLoadingMods ? styles.spin : undefined}>⟳</span>
                </Button>
              )}
              <AllyCodeDropdown />
            </div>
            {isAuthenticated ? (
              <>
                <a href="/profile" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                  {user?.username}
                </a>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : authEnabled ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </a>
                <a href="/register">
                  <Button variant="primary" size="sm">
                    Sign Up
                  </Button>
                </a>
              </div>
            ) : null}
          </div>
        }
      />
      <Container maxWidth="full" style={{ flex: 1, paddingTop: '2rem', paddingBottom: '2rem' }}>
        {children}
      </Container>
      <Footer />
      <MigrationPromptDialog
        isOpen={showMigrationPrompt}
        localCount={localCount}
        onImport={handleMigrationImport}
        onDiscard={handleMigrationDiscard}
      />
    </div>
  );
}
