import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { modLedgerApi } from '@/services/modLedgerApi';
import { gameDataApi, type ModSlotDefinition } from '@/services/gameDataApi';
import type { ParsedMod } from '@/services/modLedgerApi';

interface ModContextType {
  mods: ParsedMod[];
  modSlots: ModSlotDefinition[];
  isLoadingMods: boolean;
  modsError: string | null;
  fetchMods: (allyCode: string) => Promise<void>;
}

const ModContext = createContext<ModContextType | undefined>(undefined);

export function ModProvider({ children }: { children: ReactNode }) {
  const [mods, setMods] = useState<ParsedMod[]>([]);
  const [modSlots, setModSlots] = useState<ModSlotDefinition[]>([]);
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);

  const fetchMods = useCallback(async (allyCode: string) => {
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
  }, []);

  const loadGameData = useCallback(async () => {
    try {
      const slots = await gameDataApi.fetchModSlots();
      setModSlots(slots);
    } catch (error) {
      console.error('Failed to load game data:', error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGameData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModContext.Provider
      value={{
        mods,
        modSlots,
        isLoadingMods,
        modsError,
        fetchMods,
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
