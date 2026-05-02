import type { ParsedMod } from '@/services/modLedgerApi';
import type { ModFilters } from '@/contexts/FilterContext';

/**
 * Apply all active filters to the mods array
 */
export function applyFilters(mods: ParsedMod[], filters: ModFilters): ParsedMod[] {
  return mods.filter((mod) => {
    if (filters.sets.length > 0 && !filters.sets.includes(mod.set)) {
      return false;
    }

    if (filters.slots.length > 0 && !filters.slots.includes(mod.slot)) {
      return false;
    }

    if (filters.tiers.length > 0 && !filters.tiers.includes(mod.tier_name)) {
      return false;
    }

    if (filters.rarity.length > 0 && !filters.rarity.includes(mod.rarity)) {
      return false;
    }

    if (filters.primaries.length > 0 && !filters.primaries.includes(mod.primary_stat.stat_name)) {
      return false;
    }

    if (filters.characters.length > 0 && !filters.characters.includes(mod.character)) {
      return false;
    }

    if (filters.locked === 'locked' && !mod.locked) {
      return false;
    }
    if (filters.locked === 'unlocked' && mod.locked) {
      return false;
    }

    return true;
  });
}

/**
 * Extract unique values for filter options
 */
export function getFilterOptions(mods: ParsedMod[]) {
  const sets = new Set<string>();
  const slots = new Set<string>();
  const tiers = new Set<string>();
  const rarity = new Set<number>();
  const primaries = new Set<string>();
  const characters = new Set<string>();

  mods.forEach((mod) => {
    sets.add(mod.set);
    slots.add(mod.slot);
    tiers.add(mod.tier_name);
    rarity.add(mod.rarity);
    primaries.add(mod.primary_stat.stat_name);
    characters.add(mod.character);
  });

  return {
    sets: Array.from(sets).sort(),
    slots: Array.from(slots).sort(),
    tiers: Array.from(tiers).sort(),
    rarity: Array.from(rarity).sort((a, b) => b - a),
    primaries: Array.from(primaries).sort(),
    characters: Array.from(characters).sort(),
  };
}
