import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';
import type { ModFilters } from '@/contexts/FilterContext';

/**
 * Apply all active filters to the mods array
 */
export function applyFilters(
  mods: ParsedMod[],
  filters: ModFilters,
  evaluations: Record<string, ModEvaluation> | null = null
): ParsedMod[] {
  return mods.filter((mod) => {
    // Filter by set
    if (filters.sets.length > 0 && !filters.sets.includes(mod.set)) {
      return false;
    }

    // Filter by slot
    if (filters.slots.length > 0 && !filters.slots.includes(mod.slot)) {
      return false;
    }

    // Filter by tier
    if (filters.tiers.length > 0 && !filters.tiers.includes(mod.tier_name)) {
      return false;
    }

    // Filter by dots (pips)
    if (filters.dots.length > 0 && !filters.dots.includes(mod.dots)) {
      return false;
    }

    // Filter by primary stat
    if (filters.primaries.length > 0 && !filters.primaries.includes(mod.primary_stat.stat_name)) {
      return false;
    }

    // Filter by character
    if (filters.characters.length > 0 && !filters.characters.includes(mod.character)) {
      return false;
    }

    // Filter by locked status
    if (filters.locked === 'locked' && !mod.locked) {
      return false;
    }
    if (filters.locked === 'unlocked' && mod.locked) {
      return false;
    }

    // Filter by recommendation
    if (filters.recommendations.length > 0 && evaluations) {
      const evaluation = evaluations[mod.mod_id];
      if (!evaluation || !filters.recommendations.includes(evaluation.recommendation)) {
        return false;
      }
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
  const dots = new Set<number>();
  const primaries = new Set<string>();
  const characters = new Set<string>();

  mods.forEach((mod) => {
    sets.add(mod.set);
    slots.add(mod.slot);
    tiers.add(mod.tier_name);
    dots.add(mod.dots);
    primaries.add(mod.primary_stat.stat_name);
    characters.add(mod.character);
  });

  return {
    sets: Array.from(sets).sort(),
    slots: Array.from(slots).sort(),
    tiers: Array.from(tiers).sort(),
    dots: Array.from(dots).sort((a, b) => b - a), // Descending for dots
    primaries: Array.from(primaries).sort(),
    characters: Array.from(characters).sort(),
  };
}
