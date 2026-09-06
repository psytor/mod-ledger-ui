import type { ParsedMod } from '@/services/modLedgerApi';
import type { CalibrationCost } from '@/services/gameDataApi';
import type { VerdictResult } from '@/types/evaluation';
import type { ModFilters, GroupBy, SortBy } from '@/contexts/FilterContext';
import { bucketOf, advancementRank, qualityBand, type QualityBand } from './modDisposition';
import { computeCalibrationCandidacy, type CalibrationPriority } from './calibrationAdvisor';

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
 *
 * `assignedModIds` (the pilot pool) drives the 'for-pilot' overlay bucket and
 * diverts assigned mods out of the Sell bucket (assigning a SELL mod protects
 * it). Non-Sell buckets still show assigned mods — overlay semantics.
 */
export function applyFlatFilters(
  mods: ParsedMod[],
  filters: ModFilters,
  verdicts?: Map<string, VerdictResult>,
  assignedModIds?: Set<string>,
  calibrationCosts?: CalibrationCost[]
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
    // 'for-pilot' is an assignment overlay — no verdict needed; it lists exactly
    // the mods in the pilot pool. Every other bucket is verdict-derived and only
    // engages with live verdicts (a stale bucket is ignored until one loads).
    if (filters.bucket === 'for-pilot') {
      if (!assignedModIds?.has(mod.mod_id)) return false;
    } else if (filters.bucket && verdicts?.size) {
      const verdict = verdicts.get(mod.mod_id);
      if (!verdict || bucketOf(mod, verdict) !== filters.bucket) return false;
      // Assigned mods are diverted out of Sell (protected from accidental sale).
      if (filters.bucket === 'sell' && assignedModIds?.has(mod.mod_id)) return false;
    }
    // Quality-band lens — same stale-guard. Mods with no score (UNCONFIGURED /
    // pre-eval) have no band, so a band filter excludes them.
    if (filters.band && verdicts?.size) {
      const quality = verdicts.get(mod.mod_id)?.absolute_quality;
      if (quality === undefined || qualityBand(quality) !== filters.band) return false;
    }
    // Calibration-candidacy lens — same stale-guard as band. A mod that isn't
    // a real candidate (wrong rarity, no attempts left, no reference rule) has
    // no priority, so a calibration filter excludes it, same treatment as an
    // unscored mod under the band filter.
    if (filters.calibration && verdicts?.size) {
      const candidacy = computeCalibrationCandidacy(
        mod,
        verdicts.get(mod.mod_id),
        calibrationCosts ?? []
      );
      if (!candidacy || candidacy.priority !== filters.calibration) return false;
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
  forPilot: number;
}

export function getBucketCounts(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  assignedModIds?: Set<string>
): BucketCounts {
  const counts: BucketCounts = {
    total: mods.length,
    sell: 0,
    level: 0,
    slice: 0,
    maxed: 0,
    unconfigured: 0,
    // For Pilots is an overlay, so it counts the whole pool — every assignment,
    // whether the mod is present in the pull or an orphan (assigned but
    // unequipped/sold, so absent). Orphans are surfaced as synthetic cards in
    // the For Pilots view; counting them here keeps the chip honest.
    forPilot: assignedModIds?.size ?? 0,
  };
  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const bucket = bucketOf(mod, verdict);
    // Assigned mods are diverted out of Sell.
    if (bucket === 'sell' && assignedModIds?.has(mod.mod_id)) continue;
    counts[bucket]++;
  }
  return counts;
}

/**
 * Distribution of every *scored* mod across the five quality bands. "Scored"
 * means the verdict carries a finite `absolute_quality` (the % shown on the
 * card) — UNCONFIGURED and pre-eval mods have none and are excluded. The band
 * is intrinsic to each mod (no cross-mod comparison), so this is computed over
 * the whole inventory, not the filtered view: filtering changes what's *shown*,
 * never a mod's band.
 */
export interface QualityBandCounts {
  scored: number;
  bands: Record<QualityBand, number>;
}

export function getQualityBandCounts(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): QualityBandCounts {
  const bands: Record<QualityBand, number> = {
    perfect: 0,
    'nearly-perfect': 0,
    'on-target': 0,
    'under-target': 0,
    bad: 0,
  };
  let scored = 0;
  for (const mod of mods) {
    const quality = verdicts.get(mod.mod_id)?.absolute_quality;
    if (quality === undefined || !Number.isFinite(quality)) continue;
    scored++;
    bands[qualityBand(quality)]++;
  }
  return { scored, bands };
}

/**
 * Distribution of every calibration-*eligible* mod across the three priority
 * tiers. "Eligible" means computeCalibrationCandidacy returned non-null (6-dot,
 * attempts left, has a reference rule, has a viable donor) — everything else
 * (wrong rarity, maxed attempts, UNCONFIGURED) is excluded entirely, same
 * treatment as an unscored mod under getQualityBandCounts.
 */
export interface CalibrationCounts {
  eligible: number;
  priorities: Record<CalibrationPriority, number>;
}

export function getCalibrationCounts(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  calibrationCosts: CalibrationCost[]
): CalibrationCounts {
  const priorities: Record<CalibrationPriority, number> = {
    prime: 0,
    'worth-a-shot': 0,
    'low-priority': 0,
  };
  let eligible = 0;
  for (const mod of mods) {
    const candidacy = computeCalibrationCandidacy(mod, verdicts.get(mod.mod_id), calibrationCosts);
    if (!candidacy) continue;
    eligible++;
    priorities[candidacy.priority]++;
  }
  return { eligible, priorities };
}

/**
 * Orders mods by their evaluation quality (absolute_quality — the % shown on the
 * card). `none` keeps inventory order. Mods without a score always sink to the
 * bottom regardless of direction. Ties are broken toward the more-advanced mod
 * (6-dot > 5-dot, then higher tier) — the better slice bet, since holding a
 * given quality through more rolls is harder and it's closer to top characters.
 */
export function sortMods(
  mods: ParsedMod[],
  sortBy: SortBy,
  verdicts?: Map<string, VerdictResult>
): ParsedMod[] {
  if (sortBy === 'none' || !verdicts) return mods;
  const missing = sortBy === 'score-asc' ? Infinity : -Infinity;
  const scoreOf = (mod: ParsedMod): number =>
    verdicts.get(mod.mod_id)?.absolute_quality ?? missing;
  return [...mods].sort((a, b) => {
    const diff = sortBy === 'score-asc' ? scoreOf(a) - scoreOf(b) : scoreOf(b) - scoreOf(a);
    if (diff !== 0) return diff;
    return advancementRank(b) - advancementRank(a);
  });
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

/** Distinct characters that currently have a mod equipped, for the character filter. */
export function getCharacterOptions(mods: ParsedMod[]): string[] {
  const characters = new Set<string>();
  for (const mod of mods) {
    if (mod.character) characters.add(mod.character);
  }
  return [...characters].sort();
}
