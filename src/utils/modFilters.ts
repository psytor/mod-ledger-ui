import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import type { ModFilters, GroupBy } from '@/contexts/FilterContext';
import { bucketOf } from './cohortRanking';

function matchesCrossCutting(mod: ParsedMod, filters: ModFilters): boolean {
  if (filters.locked === 'locked' && !mod.locked) return false;
  if (filters.locked === 'unlocked' && mod.locked) return false;
  if (filters.characters.length > 0 && !filters.characters.includes(mod.character)) {
    return false;
  }
  return true;
}

/**
 * Flat view filter: every mod that matches the selected set/slot/tier/rarity/
 * primary plus cross-cutting filters. The facet checks have no verdict
 * dependency, so this works before any evaluation has been run; the optional
 * disposition `bucket` filter only engages when verdicts are supplied.
 */
export function applyFlatFilters(
  mods: ParsedMod[],
  filters: ModFilters,
  verdicts?: Map<string, VerdictResult>
): ParsedMod[] {
  return mods.filter((mod) => {
    if (filters.flatSets.length && !filters.flatSets.includes(mod.set)) return false;
    if (filters.flatSlots.length && !filters.flatSlots.includes(mod.slot)) return false;
    if (filters.flatTiers.length && !filters.flatTiers.includes(mod.tier_name)) return false;
    if (filters.flatRarity.length && !filters.flatRarity.includes(mod.rarity)) return false;
    if (
      filters.flatPrimaries.length &&
      !filters.flatPrimaries.includes(mod.primary_stat.stat_name)
    ) {
      return false;
    }
    // Bucket only engages with live verdicts — a stale bucket from a prior
    // evaluation is ignored (rather than emptying the grid) until one loads.
    if (filters.bucket && verdicts?.size) {
      const verdict = verdicts.get(mod.mod_id);
      if (!verdict || bucketOf(mod, verdict) !== filters.bucket) return false;
    }
    if (!matchesCrossCutting(mod, filters)) return false;
    return true;
  });
}

/** Per-disposition counts for the inventory overview. `total` is the whole inventory. */
export interface BucketCounts {
  total: number;
  sell: number;
  level: number;
  slice: number;
  maxed: number;
  unconfigured: number;
}

export function getBucketCounts(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): BucketCounts {
  const counts: BucketCounts = {
    total: mods.length,
    sell: 0,
    level: 0,
    slice: 0,
    maxed: 0,
    unconfigured: 0,
  };
  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    counts[bucketOf(mod, verdict)]++;
  }
  return counts;
}

// Display order for grouping headings; unknown values sort to the end.
const SHAPE_ORDER = ['Square', 'Arrow', 'Diamond', 'Triangle', 'Circle', 'Cross'];
const TIER_LETTER_ORDER = ['E', 'D', 'C', 'B', 'A'];
const TIER_COLOR_BY_LETTER: Record<string, string> = {
  E: 'Grey',
  D: 'Green',
  C: 'Blue',
  B: 'Purple',
  A: 'Gold',
};

export interface ModGroup {
  key: string;
  label: string;
  mods: ParsedMod[];
}

/**
 * Splits mods into display groups per the user-chosen axis. `none` returns a
 * single unlabelled group (the flat list). Groups are ordered for shape/tier;
 * set/primary fall back to alphabetical.
 */
export function groupMods(mods: ParsedMod[], groupBy: GroupBy): ModGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: '', mods }];

  const keyOf = (mod: ParsedMod): string => {
    switch (groupBy) {
      case 'shape':
        return mod.shape;
      case 'tier':
        return mod.tier_name;
      case 'set':
        return mod.set;
      case 'primary':
        return mod.primary_stat.stat_name;
    }
  };

  const groups = new Map<string, ParsedMod[]>();
  for (const mod of mods) {
    const k = keyOf(mod);
    const bucket = groups.get(k);
    if (bucket) bucket.push(mod);
    else groups.set(k, [mod]);
  }

  const rank = (order: string[], v: string): number => {
    const i = order.indexOf(v);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const compare = (a: string, b: string): number => {
    if (groupBy === 'shape') return rank(SHAPE_ORDER, a) - rank(SHAPE_ORDER, b);
    if (groupBy === 'tier') return rank(TIER_LETTER_ORDER, a) - rank(TIER_LETTER_ORDER, b);
    return a.localeCompare(b);
  };
  const labelOf = (k: string): string =>
    groupBy === 'tier' ? `${TIER_COLOR_BY_LETTER[k] ?? k} (${k})` : k;

  return [...groups.keys()].sort(compare).map((k) => ({
    key: k,
    label: labelOf(k),
    mods: groups.get(k)!,
  }));
}

/** Set / slot / tier / rarity / primary options across all mods, for the flat view panel. */
export function getFlatOptions(mods: ParsedMod[]): {
  sets: string[];
  slots: string[];
  tiers: string[];
  rarity: number[];
  primaries: string[];
} {
  const sets = new Set<string>();
  const slots = new Set<string>();
  const tiers = new Set<string>();
  const rarity = new Set<number>();
  const primaries = new Set<string>();
  for (const mod of mods) {
    sets.add(mod.set);
    slots.add(mod.slot);
    tiers.add(mod.tier_name);
    rarity.add(mod.rarity);
    primaries.add(mod.primary_stat.stat_name);
  }
  return {
    sets: [...sets].sort(),
    slots: [...slots].sort(),
    tiers: [...tiers].sort(),
    rarity: [...rarity].sort((a, b) => a - b),
    primaries: [...primaries].sort(),
  };
}

/** Sell-pile filter: SELL verdicts only, with flat parallel set/slot filters. */
export function applySellPileFilters(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  filters: ModFilters
): ParsedMod[] {
  return mods.filter((mod) => {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict || verdict.verdict !== 'SELL') return false;
    if (filters.sellPileSets.length > 0 && !filters.sellPileSets.includes(mod.set)) {
      return false;
    }
    if (filters.sellPileSlots.length > 0 && !filters.sellPileSlots.includes(mod.slot)) {
      return false;
    }
    if (!matchesCrossCutting(mod, filters)) return false;
    return true;
  });
}

/** Unconfigured filter: mods whose set has no variants in the active evaluation. */
export function applyUnconfiguredFilters(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): ParsedMod[] {
  return mods.filter((mod) => verdicts.get(mod.mod_id)?.verdict === 'UNCONFIGURED');
}

/** Set + slot options for the sell-pile parallel filters. */
export function getSellPileOptions(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): { sets: string[]; slots: string[] } {
  const sets = new Set<string>();
  const slots = new Set<string>();
  for (const mod of mods) {
    if (verdicts.get(mod.mod_id)?.verdict !== 'SELL') continue;
    sets.add(mod.set);
    slots.add(mod.slot);
  }
  return {
    sets: [...sets].sort(),
    slots: [...slots].sort(),
  };
}

/** Distinct characters that currently have a mod equipped, for the character filter. */
export function getCharacterOptions(mods: ParsedMod[]): string[] {
  const characters = new Set<string>();
  for (const mod of mods) {
    if (mod.character) characters.add(mod.character);
  }
  return [...characters].sort();
}
