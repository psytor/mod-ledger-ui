import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { modLedgerApi } from '@/services/modLedgerApi';
import {
  gameDataApi,
  type ModSlotDefinition,
  type ModSetDefinition,
  type StatDefinition,
  type CalibrationCost,
} from '@/services/gameDataApi';
import { navichartsApi } from '@/services/navichartsApi';
import type { ParsedMod } from '@/services/modLedgerApi';

interface ModContextType {
  mods: ParsedMod[];
  modSlots: ModSlotDefinition[];
  modSets: ModSetDefinition[];
  primaryStats: StatDefinition[];
  secondaryStats: StatDefinition[];
  calibrationCosts: CalibrationCost[];
  // Character display name -> portrait URL, from navicharts' unit catalog.
  // Best-effort: empty map on fetch failure just means no avatars render.
  characterPortraits: Map<string, string>;
  isLoadingMods: boolean;
  modsError: string | null;
  /** When the underlying player data was pulled from Comlink (naive UTC ISO). */
  cachedAt: string | null;
  /** Epoch ms when a refresh may next pull fresh data (cooldown floor); null = no active cooldown. */
  refreshAvailableAt: number | null;
  /** Load the curated snapshot (no forced Comlink pull). */
  fetchMods: (allyCode: string) => Promise<void>;
  /** Force a fresh pull (subject to the per-ally Comlink floor). */
  refreshMods: (allyCode: string) => Promise<void>;
}

const ModContext = createContext<ModContextType | undefined>(undefined);

export function ModProvider({ children }: { children: ReactNode }) {
  const [mods, setMods] = useState<ParsedMod[]>([]);
  const [modSlots, setModSlots] = useState<ModSlotDefinition[]>([]);
  const [modSets, setModSets] = useState<ModSetDefinition[]>([]);
  const [primaryStats, setPrimaryStats] = useState<StatDefinition[]>([]);
  const [secondaryStats, setSecondaryStats] = useState<StatDefinition[]>([]);
  const [calibrationCosts, setCalibrationCosts] = useState<CalibrationCost[]>([]);
  const [characterPortraits, setCharacterPortraits] = useState<Map<string, string>>(new Map());
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [refreshAvailableAt, setRefreshAvailableAt] = useState<number | null>(null);

  const fetchMods = useCallback(async (allyCode: string) => {
    setIsLoadingMods(true);
    setModsError(null);

    try {
      const response = await modLedgerApi.fetchPlayerMods(allyCode);
      setMods(response.mods);
      setCachedAt(response.cached_at ?? null);
      // A plain load carries no cooldown info — clear any prior countdown
      // (e.g. when switching to a different ally code).
      setRefreshAvailableAt(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch mods';
      setModsError(message);
      setMods([]);
      setCachedAt(null);
      setRefreshAvailableAt(null);
    } finally {
      setIsLoadingMods(false);
    }
  }, []);

  const refreshMods = useCallback(async (allyCode: string) => {
    setIsLoadingMods(true);
    setModsError(null);

    try {
      const response = await modLedgerApi.refreshPlayerMods(allyCode);
      setMods(response.mods);
      setCachedAt(response.cached_at ?? null);
      const cooldown = response.next_refresh_in_seconds ?? 0;
      setRefreshAvailableAt(cooldown > 0 ? Date.now() + cooldown * 1000 : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh mods';
      setModsError(message);
      // Keep the existing mods on a failed refresh — don't blank the grid.
    } finally {
      setIsLoadingMods(false);
    }
  }, []);

  const loadGameData = useCallback(async () => {
    try {
      const [slots, sets, primaries, secondaries, costs] = await Promise.all([
        gameDataApi.fetchModSlots(),
        gameDataApi.fetchModSets(),
        gameDataApi.fetchStatDefinitions({ can_be_primary: true }),
        gameDataApi.fetchStatDefinitions({ can_be_secondary: true }),
        gameDataApi.fetchCalibrationCosts(),
      ]);
      setModSlots(slots);
      setModSets(sets);
      setPrimaryStats(primaries);
      setSecondaryStats(secondaries);
      setCalibrationCosts(costs);
    } catch (error) {
      console.error('Failed to load game data:', error);
    }
  }, []);

  // Fetched independently of loadGameData: a navicharts outage is cosmetic
  // (no avatars) and must never block mod-slot/set/stat loading, which the
  // evaluation engine actually depends on.
  const loadCharacterPortraits = useCallback(async () => {
    try {
      setCharacterPortraits(await navichartsApi.fetchCharacterPortraits());
    } catch (error) {
      console.error('Failed to load character portraits:', error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGameData();
    loadCharacterPortraits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModContext.Provider
      value={{
        mods,
        modSlots,
        modSets,
        primaryStats,
        secondaryStats,
        calibrationCosts,
        characterPortraits,
        isLoadingMods,
        modsError,
        cachedAt,
        refreshAvailableAt,
        fetchMods,
        refreshMods,
      }}
    >
      {children}
    </ModContext.Provider>
  );
}

export function useMods() {
  const context = useContext(ModContext);
  if (context === undefined) {
    throw new Error('useMods must be used within a ModProvider');
  }
  return context;
}
