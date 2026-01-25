import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { modLedgerApi } from '@/services/modLedgerApi';
import { gameDataApi, type ModSlotDefinition } from '@/services/gameDataApi';
import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';

interface ModContextType {
  mods: ParsedMod[];
  evaluations: Record<string, ModEvaluation> | null;
  modSlots: ModSlotDefinition[];
  isLoadingMods: boolean;
  isLoadingEvaluations: boolean;
  modsError: string | null;
  evaluationsError: string | null;
  fetchMods: (allyCode: string) => Promise<void>;
  fetchEvaluations: (allyCode: string) => Promise<void>;
}

const ModContext = createContext<ModContextType | undefined>(undefined);

export function ModProvider({ children }: { children: ReactNode }) {
  const [mods, setMods] = useState<ParsedMod[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, ModEvaluation> | null>(null);
  const [modSlots, setModSlots] = useState<ModSlotDefinition[]>([]);
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [currentAllyCode, setCurrentAllyCode] = useState<string | null>(null);

  const fetchMods = useCallback(async (allyCode: string) => {
    setIsLoadingMods(true);
    setModsError(null);
    setCurrentAllyCode(allyCode);

    // Clear evaluations when fetching new mods
    setEvaluations(null);
    setEvaluationsError(null);

    try {
      const response = await modLedgerApi.fetchPlayerMods(allyCode);
      setMods(response.mods);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch mods';
      setModsError(message);
      setMods([]);
    } finally {
      setIsLoadingMods(false);
    }
  }, []);

  const fetchEvaluations = useCallback(async (allyCode: string) => {
    setIsLoadingEvaluations(true);
    setEvaluationsError(null);

    try {
      const response = await modLedgerApi.evaluatePlayerMods(allyCode);
      setEvaluations(response.evaluations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to evaluate mods';
      setEvaluationsError(message);
      setEvaluations(null);
    } finally {
      setIsLoadingEvaluations(false);
    }
  }, []);

  const loadGameData = useCallback(async () => {
    try {
      const slots = await gameDataApi.fetchModSlots();
      setModSlots(slots);
    } catch (error) {
      console.error('Failed to load game data:', error);
    }
  }, []);

  // Load game data on mount
  useEffect(() => {
    loadGameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-trigger evaluation after mods load successfully
  useEffect(() => {
    if (mods.length > 0 && currentAllyCode && !evaluations && !isLoadingEvaluations) {
      fetchEvaluations(currentAllyCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mods, currentAllyCode, evaluations, isLoadingEvaluations]);

  return (
    <ModContext.Provider
      value={{
        mods,
        evaluations,
        modSlots,
        isLoadingMods,
        isLoadingEvaluations,
        modsError,
        evaluationsError,
        fetchMods,
        fetchEvaluations,
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
