import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActionBucket } from '@/utils/cohortRanking';
import { defaultFilters } from './defaultFilters';

export type FilterMode = 'flat' | 'sell-pile' | 'unconfigured';
export type GroupBy = 'none' | 'shape' | 'tier' | 'set' | 'primary';

export interface ModFilters {
  mode: FilterMode;
  // flat view filters:
  flatSets: string[];
  flatSlots: string[];
  flatTiers: string[];
  flatRarity: number[];
  flatPrimaries: string[];
  // inventory-overview disposition (null = all dispositions):
  bucket: ActionBucket | null;
  // how the flat result grid is grouped (none = one flat list):
  groupBy: GroupBy;
  // sell-pile parallel filters:
  sellPileSets: string[];
  sellPileSlots: string[];
  // cross-cutting (all modes):
  locked: 'all' | 'locked' | 'unlocked';
  characters: string[];
}

interface FilterContextType {
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  filters: ModFilters;
  setFilter: <K extends keyof ModFilters>(key: K, value: ModFilters[K]) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [filters, setFilters] = useState<ModFilters>(defaultFilters);

  const togglePanel = () => setIsPanelOpen((prev) => !prev);
  const openPanel = () => setIsPanelOpen(true);
  const closePanel = () => setIsPanelOpen(false);

  const setFilter = <K extends keyof ModFilters>(key: K, value: ModFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  return (
    <FilterContext.Provider
      value={{
        isPanelOpen,
        togglePanel,
        openPanel,
        closePanel,
        filters,
        setFilter,
        clearFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
