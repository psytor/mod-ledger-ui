import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import { useAuth } from 'astrogators-shared-ui';
import { pilotAssignmentStorage } from '@/services/pilotAssignmentStorage';
import {
  buildModSnapshot,
  snapshotDiffers,
  type PilotAssignment,
} from '@/types/pilotAssignment';
import type { ParsedMod } from '@/services/modLedgerApi';

// Dispatched on `window` after a successful pilot-assignment migration (Layout
// owns the prompt). The context listens so the in-memory pool refetches from
// the backend instead of showing stale local state.
export const PILOT_MIGRATED_EVENT = 'mod-ledger:pilot-assignments-migrated';

interface PilotAssignmentContextType {
  // Keyed by modId for O(1) isAssigned lookups from every ModCard.
  assignments: Map<string, PilotAssignment>;
  isAssigned: (modId: string) => boolean;
  assign: (mod: ParsedMod) => Promise<void>;
  unassign: (modId: string) => Promise<void>;
  // Re-save any assigned mod whose live state has drifted from its stored
  // snapshot (moved to another character in-game, leveled, sliced). Keeps the
  // orphan-card "last seen" accurate. Pass the latest inventory pull.
  syncSnapshots: (mods: ParsedMod[]) => Promise<void>;
  reload: () => Promise<void>;
  isLoading: boolean;
}

const PilotAssignmentContext = createContext<PilotAssignmentContextType | undefined>(
  undefined
);

export function PilotAssignmentProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [assignments, setAssignments] = useState<Map<string, PilotAssignment>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  // Latest assignments map, readable from `syncSnapshots` without making that
  // callback depend on `assignments` (which would re-fire the sync effect on
  // every assignment change). Kept in sync via the effect below.
  const assignmentsRef = useRef(assignments);
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await pilotAssignmentStorage.listMine();
      setAssignments(new Map(list.map((a) => [a.modId, a])));
    } catch {
      // A failed load (e.g. backend down) leaves the pool empty rather than
      // crashing the grid; the user can refresh. Non-destructive: nothing is
      // written, so backend state is untouched.
      setAssignments(new Map());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount and whenever auth settles or flips — the storage adapter
  // swaps backends based on the token (mirrors EvaluationsPage).
  useEffect(() => {
    if (isAuthLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [isAuthLoading, isAuthenticated, reload]);

  // Refetch after the Layout migration prompt imports local assignments.
  useEffect(() => {
    const onMigrated = () => void reload();
    window.addEventListener(PILOT_MIGRATED_EVENT, onMigrated);
    return () => window.removeEventListener(PILOT_MIGRATED_EVENT, onMigrated);
  }, [reload]);

  const isAssigned = useCallback(
    (modId: string) => assignments.has(modId),
    [assignments]
  );

  const assign = useCallback(async (mod: ParsedMod) => {
    const saved = await pilotAssignmentStorage.assign({
      modId: mod.mod_id,
      snapshot: buildModSnapshot(mod),
    });
    setAssignments((prev) => {
      const next = new Map(prev);
      next.set(saved.modId, saved);
      return next;
    });
  }, []);

  const unassign = useCallback(async (modId: string) => {
    await pilotAssignmentStorage.unassign(modId);
    setAssignments((prev) => {
      const next = new Map(prev);
      next.delete(modId);
      return next;
    });
  }, []);

  const syncSnapshots = useCallback(async (mods: ParsedMod[]) => {
    const current = assignmentsRef.current;
    if (current.size === 0) return;
    const byModId = new Map(mods.map((m) => [m.mod_id, m]));
    // Re-build each present assigned mod's snapshot and keep only the drifted.
    const refreshed = [...current.values()]
      .map((a) => {
        const live = byModId.get(a.modId);
        return live ? { modId: a.modId, snapshot: buildModSnapshot(live), stored: a.snapshot } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && snapshotDiffers(x.snapshot, x.stored));
    if (refreshed.length === 0) return;
    try {
      // POST upserts the row; once saved the stored snapshot matches live, so a
      // later sync finds no drift — no loop. A failure leaves the stale snapshot
      // in place to retry on the next pull rather than crashing the grid.
      const saved = await Promise.all(
        refreshed.map(({ modId, snapshot }) =>
          pilotAssignmentStorage.assign({ modId, snapshot })
        )
      );
      setAssignments((prev) => {
        const next = new Map(prev);
        for (const a of saved) next.set(a.modId, a);
        return next;
      });
    } catch {
      // Swallow — see above. The next pull retries.
    }
  }, []);

  return (
    <PilotAssignmentContext.Provider
      value={{ assignments, isAssigned, assign, unassign, syncSnapshots, reload, isLoading }}
    >
      {children}
    </PilotAssignmentContext.Provider>
  );
}

export function usePilotAssignment() {
  const context = useContext(PilotAssignmentContext);
  if (context === undefined) {
    throw new Error(
      'usePilotAssignment must be used within a PilotAssignmentProvider'
    );
  }
  return context;
}
