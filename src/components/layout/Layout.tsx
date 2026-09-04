import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { NavBar, Footer, Container, RosterRefresh, useAuth } from 'astrogators-shared-ui';
import MigrationPromptDialog from '@/components/evaluation/MigrationPromptDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
import { pilotAssignmentStorage } from '@/services/pilotAssignmentStorage';
import { useMods } from '@/contexts/ModContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { PILOT_MIGRATED_EVENT } from '@/contexts/PilotAssignmentContext';
import { canModerate } from '@/utils/permissions';
import styles from './Layout.module.css';

// Dispatched on `window` after a successful evaluation migration. Any
// component that derives state from the eval list (e.g. EvaluationsPage)
// can subscribe and refetch.
export const EVALS_MIGRATED_EVENT = 'mod-ledger:evals-migrated';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading, selectedAllyCode } = useAuth();
  const { refreshMods, isLoadingMods, cachedAt, refreshAvailableAt } = useMods();
  const { clearVerdicts } = useEvaluation();
  const location = useLocation();

  // Manual inventory refresh — re-pulls the selected ally code's mods. The
  // fetch lives in ModContext (not shared-ui): refreshing a mod inventory is a
  // mod-ledger concern, so the handler lives here; the shared RosterRefresh
  // control owns only the button + "Updated X ago" / cooldown readout, and
  // disables itself while a pull is in flight or the floor is active.
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
      refreshMods(selectedAllyCode);
    }
  }, [selectedAllyCode, isLoadingMods, clearVerdicts, refreshMods]);

  // Migration prompt lives at the Layout level (not on EvaluationsPage)
  // so it fires no matter which mod-ledger-ui page the user lands on
  // first after logging in. Otherwise a user who only ever visits the
  // mod grid would never see the prompt and their local evals would
  // silently rot.
  const [localCount, setLocalCount] = useState<number>(
    () => evaluationStorage.listLocal().length
  );
  // Pilot-pool localStorage leftovers get the same forced Import-or-Discard on
  // login. Two non-dismissable prompts can't stack, so this one waits until the
  // evaluations prompt is resolved (localCount === 0); see showPilotPrompt.
  const [pilotLocalCount, setPilotLocalCount] = useState<number>(
    () => pilotAssignmentStorage.listLocal().length
  );

  // Re-read localStorage whenever auth state settles or changes. Covers
  // the rare logout→create-local→login dance without forcing a reload.
  useEffect(() => {
    if (isAuthLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalCount(evaluationStorage.listLocal().length);
    setPilotLocalCount(pilotAssignmentStorage.listLocal().length);
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

  const handlePilotMigrationImport = useCallback(async () => {
    await pilotAssignmentStorage.migrateLocalToBackend();
    setPilotLocalCount(0);
    // Notify the PilotAssignmentContext so the in-memory pool refetches.
    window.dispatchEvent(new CustomEvent(PILOT_MIGRATED_EVENT));
  }, []);

  const handlePilotMigrationDiscard = useCallback(() => {
    pilotAssignmentStorage.discardLocal();
    setPilotLocalCount(0);
  }, []);

  const showMigrationPrompt =
    !isAuthLoading && isAuthenticated && localCount > 0;
  // Pilot prompt yields to the evaluations prompt — only one non-dismissable
  // dialog at a time.
  const showPilotMigrationPrompt =
    !isAuthLoading && isAuthenticated && localCount === 0 && pilotLocalCount > 0;

  const navItems = [
    {
      label: 'Grid',
      href: '/',
      active: location.pathname === '/',
      render: (p: { className: string; children: ReactNode }) => <Link to="/" {...p} />,
    },
    {
      label: 'Evaluations',
      href: '/evaluations',
      active: location.pathname.startsWith('/evaluations'),
      render: (p: { className: string; children: ReactNode }) => <Link to="/evaluations" {...p} />,
    },
    ...(canModerate(user)
      ? [
          {
            label: 'Moderation',
            href: '/moderation',
            active: location.pathname === '/moderation',
            render: (p: { className: string; children: ReactNode }) => (
              <Link to="/moderation" {...p} />
            ),
          },
        ]
      : []),
  ];

  // App-specific control for the NavBar's right cluster: the shared
  // RosterRefresh (the "Updated X ago" readout + manual inventory re-pull).
  // NavBar renders it just left of the ally-code dropdown.
  const rightExtras = selectedAllyCode ? (
    <RosterRefresh
      onRefresh={handleRefresh}
      isRefreshing={isLoadingMods}
      cachedAt={cachedAt}
      refreshAvailableAt={refreshAvailableAt}
    />
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <NavBar
        className={styles.topBar}
        hubUrl="/"
        appName="Mod Ledger"
        appHref="/mod-ledger/"
        navItems={navItems}
        showAllyCode
        rightExtras={rightExtras}
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
      <MigrationPromptDialog
        isOpen={showPilotMigrationPrompt}
        localCount={pilotLocalCount}
        onImport={handlePilotMigrationImport}
        onDiscard={handlePilotMigrationDiscard}
        title="Local pilot assignments found"
        itemNoun="pilot assignment"
      />
    </div>
  );
}
