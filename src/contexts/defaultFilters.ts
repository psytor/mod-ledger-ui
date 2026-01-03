import type { ModFilters } from './FilterContext';

export const defaultFilters: ModFilters = {
  sets: [],
  slots: [],
  tiers: [],
  rarity: [],  // CLEAN BREAK: Changed from "dots"
  primaries: [],
  characters: [],
  locked: 'all',
  recommendations: [],
};