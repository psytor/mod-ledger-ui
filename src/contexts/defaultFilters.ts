import type { ModFilters } from './FilterContext';

export const defaultFilters: ModFilters = {
  mode: 'push-or-sell',
  stage: null,
  variantId: null,
  slot: null,
  primary: null,
  actionTab: null,
  sellPileSets: [],
  sellPileSlots: [],
  locked: 'all',
  characters: [],
};
