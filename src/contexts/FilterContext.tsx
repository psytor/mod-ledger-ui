import { createContext, useContext, useState, ReactNode } from 'react';

export interface ModFilters {
  sets: string[];
  slots: string[];
  tiers: string[];
  dots: number[];
  primaries: string[];
  characters: string[];
  locked: 'all' | 'locked' | 'unlocked';
}

interface FilterContextType {
  isPanelOpen: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  filters: ModFilters;
  setFilter: (key: keyof ModFilters, value: ModFilters[keyof ModFilters]) => void;
  clearFilters: () => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  setSortBy: (sortBy: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
}

const defaultFilters: ModFilters = {
  sets: [],
  slots: [],
  tiers: [],
  dots: [],
  primaries: [],
  characters: [],
  locked: 'all',
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [filters, setFilters] = useState<ModFilters>(defaultFilters);
  const [sortBy, setSortByState] = useState<string>('character');
  const [sortOrder, setSortOrderState] = useState<'asc' | 'desc'>('asc');

  const togglePanel = () => setIsPanelOpen((prev) => !prev);
  const closePanel = () => setIsPanelOpen(false);

  const setFilter = (key: keyof ModFilters, value: ModFilters[keyof ModFilters]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const setSortBy = (newSortBy: string) => {
    setSortByState(newSortBy);
  };

  const setSortOrder = (order: 'asc' | 'desc') => {
    setSortOrderState(order);
  };

  return (
    <FilterContext.Provider
      value={{
        isPanelOpen,
        togglePanel,
        closePanel,
        filters,
        setFilter,
        clearFilters,
        sortBy,
        sortOrder,
        setSortBy,
        setSortOrder,
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
