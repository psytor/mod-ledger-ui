import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import type { ModFilters } from '@/contexts/FilterContext';
import { actionOf, stageOf, STAGE_ORDER, ACTION_ORDER, type ModAction } from './cohortRanking';

// Slots whose primary stat varies; the primary picker only matters for these.
// Square/Diamond/Circle have a fixed primary.
const VARIABLE_PRIMARY_SLOTS = new Set(['Arrow', 'Triangle', 'Cross', 'Plus']);

export function isVariablePrimarySlot(slot: string): boolean {
  return VARIABLE_PRIMARY_SLOTS.has(slot);
}

// Actions reachable via the variant drilldown. Pre-eval mods have no winning
// variant, so they are surfaced separately (Overview), not in this pool.
const DRILLDOWN_ACTIONS = new Set<ModAction>(['level', 'slice', 'maxed']);

function matchesCrossCutting(mod: ParsedMod, filters: ModFilters): boolean {
  if (filters.locked === 'locked' && !mod.locked) return false;
  if (filters.locked === 'unlocked' && mod.locked) return false;
  if (filters.characters.length > 0 && !filters.characters.includes(mod.character)) {
    return false;
  }
  return true;
}

function isDrilldownMod(mod: ParsedMod, verdicts: Map<string, VerdictResult>): boolean {
  const verdict = verdicts.get(mod.mod_id);
  if (!verdict) return false;
  const action = actionOf(mod, verdict);
  return action !== null && DRILLDOWN_ACTIONS.has(action);
}

/**
 * Push-or-sell drilldown filter. Applies stage → variant → slot → primary plus
 * cross-cutting filters. Does NOT filter by actionTab — ActionSubTabs buckets
 * by action itself so it can render every available tab.
 */
export function applyPushOrSellFilters(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  filters: ModFilters
): ParsedMod[] {
  return mods.filter((mod) => {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) return false;
    const action = actionOf(mod, verdict);
    if (action === null || !DRILLDOWN_ACTIONS.has(action)) return false;

    if (filters.stage && stageOf(mod) !== filters.stage) return false;
    if (filters.variantId && verdict.winning_variant_id !== filters.variantId) return false;
    if (filters.slot && mod.slot !== filters.slot) return false;
    if (filters.primary && mod.primary_stat.stat_name !== filters.primary) return false;
    if (!matchesCrossCutting(mod, filters)) return false;
    return true;
  });
}

/**
 * Flat view filter: every mod that matches the selected set/slot/tier/rarity/
 * primary plus cross-cutting filters. No verdict dependency, so this works
 * before any evaluation has been run.
 */
export function applyFlatFilters(
  mods: ParsedMod[],
  filters: ModFilters
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
    if (!matchesCrossCutting(mod, filters)) return false;
    return true;
  });
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

/** Pre-eval mods: UPGRADE verdict with no winning variant. Surfaced in Overview. */
export function getPreEvalMods(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): ParsedMod[] {
  return mods.filter((mod) => {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) return false;
    return actionOf(mod, verdict) === 'pre-eval';
  });
}

export interface DrilldownOption<T = string> {
  value: T;
  count: number;
}

export interface VariantOption {
  id: string;
  name: string;
  count: number;
}

export interface DrilldownOptions {
  stages: DrilldownOption[];
  variants: VariantOption[];
  slots: DrilldownOption[];
  primaries: DrilldownOption[];
  actionTabs: DrilldownOption<ModAction>[];
}

/**
 * Cascading option lists for the push-or-sell drilldown. Each level is computed
 * against the upstream selections so pickers only show options that yield
 * non-empty results. Counts reflect the narrowed pool at that level.
 */
export function getDrilldownOptions(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  filters: ModFilters
): DrilldownOptions {
  // Base pool: drilldown-eligible mods passing cross-cutting filters.
  const base = mods.filter(
    (mod) => isDrilldownMod(mod, verdicts) && matchesCrossCutting(mod, filters)
  );

  const stageCount = new Map<string, number>();
  for (const mod of base) {
    const s = stageOf(mod);
    if (s) stageCount.set(s, (stageCount.get(s) ?? 0) + 1);
  }

  const afterStage = filters.stage
    ? base.filter((m) => stageOf(m) === filters.stage)
    : base;

  const variantCount = new Map<string, { name: string; count: number }>();
  for (const mod of afterStage) {
    const v = verdicts.get(mod.mod_id);
    const id = v?.winning_variant_id;
    if (!id) continue;
    const existing = variantCount.get(id);
    if (existing) existing.count++;
    else variantCount.set(id, { name: v.winning_variant_name ?? id, count: 1 });
  }

  const afterVariant = filters.variantId
    ? afterStage.filter(
        (m) => verdicts.get(m.mod_id)?.winning_variant_id === filters.variantId
      )
    : afterStage;

  const slotCount = new Map<string, number>();
  for (const mod of afterVariant) {
    slotCount.set(mod.slot, (slotCount.get(mod.slot) ?? 0) + 1);
  }

  const afterSlot = filters.slot
    ? afterVariant.filter((m) => m.slot === filters.slot)
    : afterVariant;

  const primaryCount = new Map<string, number>();
  for (const mod of afterSlot) {
    const p = mod.primary_stat.stat_name;
    primaryCount.set(p, (primaryCount.get(p) ?? 0) + 1);
  }

  const afterPrimary = filters.primary
    ? afterSlot.filter((m) => m.primary_stat.stat_name === filters.primary)
    : afterSlot;

  const actionCount = new Map<ModAction, number>();
  for (const mod of afterPrimary) {
    const v = verdicts.get(mod.mod_id);
    if (!v) continue;
    const a = actionOf(mod, v);
    if (a) actionCount.set(a, (actionCount.get(a) ?? 0) + 1);
  }

  return {
    stages: [...stageCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.value as (typeof STAGE_ORDER)[number]) -
          STAGE_ORDER.indexOf(b.value as (typeof STAGE_ORDER)[number])
      ),
    variants: [...variantCount.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    slots: [...slotCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    primaries: [...primaryCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    actionTabs: [...actionCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => ACTION_ORDER.indexOf(a.value) - ACTION_ORDER.indexOf(b.value)),
  };
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

/** Distinct character names across the inventory, for the cross-cutting filter. */
export function getCharacterOptions(mods: ParsedMod[]): string[] {
  const characters = new Set<string>();
  for (const mod of mods) {
    if (mod.character) characters.add(mod.character);
  }
  return [...characters].sort();
}
