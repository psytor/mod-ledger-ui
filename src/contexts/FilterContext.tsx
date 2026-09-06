import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { BucketFilter, QualityBand } from '@/utils/modDisposition';
import type { CalibrationPriority } from '@/utils/calibrationAdvisor';
import { defaultFilters } from './defaultFilters';

export type GroupBy = 'none' | 'shape' | 'tier' | 'set' | 'primary';
export type SortBy = 'none' | 'score-desc' | 'score-asc';

export interface ModFilters {
  // facet filters:
  flatSets: string[];
  flatSlots: string[];
  flatTiers: string[];
  flatRarity: number[];
  flatPrimaries: string[];
  // disposition lens (null = all dispositions). 'for-pilot' is an assignment
  // overlay rather than a verdict bucket; see BucketFilter. The Sell and
  // Unconfigured buckets replace the former Sell-Pile / Unconfigured view modes.
  bucket: BucketFilter | null;
  // quality-band lens (null = all bands); independent of `bucket` — both can
  // be active at once to narrow e.g. "slice mods in the gold band":
  band: QualityBand | null;
  // calibration-candidacy lens (null = all mods); independent of `bucket` and
  // `band` — only 6-dot mods with attempts left and a reference rule can ever
  // match a non-null value here (see calibrationAdvisor.ts).
  calibration: CalibrationPriority | null;
  // how the result grid is grouped (none = one flat list):
  groupBy: GroupBy;
  // how the result grid is ordered (none = inventory order):
  sortBy: SortBy;
  // cross-cutting:
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

  // The single canonical reset, surfaced both in the filter drawer and the
  // inventory readout. Resets every filter (facets, lenses, cross-cutting) but
  // preserves the display preferences (group/sort) — those order what's shown,
  // they don't filter it.
  const clearFilters = () => {
    setFilters((prev) => ({
      ...defaultFilters,
      groupBy: prev.groupBy,
      sortBy: prev.sortBy,
    }));
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
