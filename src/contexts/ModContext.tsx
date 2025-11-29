import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { modLedgerApi } from '@/services/modLedgerApi';
import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';

interface ModContextType {
  mods: ParsedMod[];
  evaluations: Record<string, ModEvaluation> | null;
  isLoadingMods: boolean;
  isLoadingEvaluations: boolean;
  modsError: string | null;
  evaluationsError: string | null;
  fetchMods: (allyCode: string) => Promise<void>;
  fetchEvaluations: (allyCode: string, profileName?: string) => Promise<void>;
}

const ModContext = createContext<ModContextType | undefined>(undefined);

export function ModProvider({ children }: { children: ReactNode }) {
  const [mods, setMods] = useState<ParsedMod[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, ModEvaluation> | null>(null);
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);

  const fetchMods = async (allyCode: string) => {
    setIsLoadingMods(true);
    setModsError(null);
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
  };

  const fetchEvaluations = async (allyCode: string, profileName?: string) => {
    setIsLoadingEvaluations(true);
    setEvaluationsError(null);
    try {
      const response = await modLedgerApi.evaluatePlayerMods(allyCode, profileName);
      setEvaluations(response.evaluations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to evaluate mods';
      setEvaluationsError(message);
      setEvaluations(null);
    } finally {
      setIsLoadingEvaluations(false);
    }
  };

  return (
    <ModContext.Provider
      value={{
        mods,
        evaluations,
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
