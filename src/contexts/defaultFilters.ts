import type { ModFilters } from './FilterContext';

export const defaultFilters: ModFilters = {
  flatSets: [],
  flatSlots: [],
  flatTiers: [],
  flatRarity: [],
  flatPrimaries: [],
  bucket: null,
  band: null,
  calibration: null,
  groupBy: 'none',
  sortBy: 'none',
  locked: 'all',
  characters: [],
};
