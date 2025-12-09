import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { modLedgerApi } from '@/services/modLedgerApi';
import type { ParsedMod, ModEvaluation, ProfileMetadata } from '@/services/modLedgerApi';

interface ModContextType {
  mods: ParsedMod[];
  evaluations: Record<string, ModEvaluation> | null;
  isLoadingMods: boolean;
  isLoadingEvaluations: boolean;
  modsError: string | null;
  evaluationsError: string | null;
  selectedProfile: string;
  setSelectedProfile: (profile: string) => void;
  availableProfiles: ProfileMetadata[];
  isLoadingProfiles: boolean;
  fetchMods: (allyCode: string) => Promise<void>;
  fetchEvaluations: (allyCode: string, profileName?: string) => Promise<void>;
  loadProfiles: () => Promise<void>;
}

const ModContext = createContext<ModContextType | undefined>(undefined);

export function ModProvider({ children }: { children: ReactNode }) {
  const [mods, setMods] = useState<ParsedMod[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, ModEvaluation> | null>(null);
  const [isLoadingMods, setIsLoadingMods] = useState(false);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string>('standard-v1');
  const [availableProfiles, setAvailableProfiles] = useState<ProfileMetadata[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
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

  const fetchEvaluations = useCallback(async (allyCode: string, profileName?: string) => {
    setIsLoadingEvaluations(true);
    setEvaluationsError(null);
    const profile = profileName || selectedProfile;

    try {
      const response = await modLedgerApi.evaluatePlayerMods(allyCode, profile);
      setEvaluations(response.evaluations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to evaluate mods';
      setEvaluationsError(message);
      setEvaluations(null);
    } finally {
      setIsLoadingEvaluations(false);
    }
  }, [selectedProfile]);

  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const response = await modLedgerApi.listProfiles();
      setAvailableProfiles(response.profiles);
    } catch (error) {
      console.error('Failed to load profiles:', error);
      // Set default profile if API fails
      setAvailableProfiles([
        { name: 'standard-v1', description: 'Balanced evaluation for general players', version: '1.0' }
      ]);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // Auto-trigger evaluation after mods load successfully
  useEffect(() => {
    if (mods.length > 0 && currentAllyCode && !evaluations && !isLoadingEvaluations) {
      fetchEvaluations(currentAllyCode, selectedProfile);
    }
  }, [mods, currentAllyCode, evaluations, isLoadingEvaluations, fetchEvaluations, selectedProfile]);

  return (
    <ModContext.Provider
      value={{
        mods,
        evaluations,
        isLoadingMods,
        isLoadingEvaluations,
        modsError,
        evaluationsError,
        selectedProfile,
        setSelectedProfile,
        availableProfiles,
        isLoadingProfiles,
        fetchMods,
        fetchEvaluations,
        loadProfiles,
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
