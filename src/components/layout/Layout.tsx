import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TopBar, Footer, Container, Button, AllyCodeDropdown, useAuth } from 'astrogators-shared-ui';
import MigrationPromptDialog from '@/components/evaluation/MigrationPromptDialog';
import { evaluationStorage } from '@/services/evaluationStorage';
import { pilotAssignmentStorage } from '@/services/pilotAssignmentStorage';
import { useMods } from '@/contexts/ModContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { PILOT_MIGRATED_EVENT } from '@/contexts/PilotAssignmentContext';
import styles from './Layout.module.css';

// Dispatched on `window` after a successful evaluation migration. Any
// component that derives state from the eval list (e.g. EvaluationsPage)
// can subscribe and refetch.
export const EVALS_MIGRATED_EVENT = 'mod-ledger:evals-migrated';

// The backend emits naive UTC ISO timestamps (no timezone suffix). new Date()
// would read those as LOCAL time, so append 'Z' when no offset is present.
function parseBackendTime(iso: string): Date {
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`);
}

// Compact "updated X ago" relative time.
function formatAgo(date: Date, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// m:ss countdown for the refresh cooldown.
function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout, authEnabled, selectedAllyCode } = useAuth();
  const { refreshMods, isLoadingMods, cachedAt, refreshAvailableAt } = useMods();
  const { clearVerdicts } = useEvaluation();

  // Tick a 1s clock only while there's a snapshot to age / a cooldown to count
  // down. This drives the "Updated X ago" label and the cooldown timer — it is
  // a display clock, NOT data polling (no network calls happen here).
  const [now, setNow] = useState<number>(() => Date.now());
  const showClock = Boolean(selectedAllyCode && cachedAt);
  useEffect(() => {
    if (!showClock) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [showClock]);

  const cooldownRemaining = refreshAvailableAt
    ? Math.max(0, Math.ceil((refreshAvailableAt - now) / 1000))
    : 0;
  const updatedAgo = cachedAt ? formatAgo(parseBackendTime(cachedAt), now) : null;
  const refreshDisabled = isLoadingMods || cooldownRemaining > 0;

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
    if (selectedAllyCode && !refreshDisabled) {
      clearVerdicts();
      refreshMods(selectedAllyCode);
    }
  }, [selectedAllyCode, refreshDisabled, clearVerdicts, refreshMods]);

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
              {selectedAllyCode && updatedAgo && (
                <span
                  className={styles.updatedLabel}
                  title={
                    cooldownRemaining > 0
                      ? `Fresh data available in ${formatCountdown(cooldownRemaining)}`
                      : 'Click refresh to pull the latest from the game'
                  }
                >
                  {cooldownRemaining > 0
                    ? `Updated ${updatedAgo} · fresh in ${formatCountdown(cooldownRemaining)}`
                    : `Updated ${updatedAgo}`}
                </span>
              )}
              {selectedAllyCode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshDisabled}
                  title={
                    cooldownRemaining > 0
                      ? `Fresh data available in ${formatCountdown(cooldownRemaining)}`
                      : 'Refresh inventory'
                  }
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
