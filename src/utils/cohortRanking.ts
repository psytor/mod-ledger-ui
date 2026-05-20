import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import {
  MIN_COHORT_SIZE_FOR_RANKING,
  PUSH_PERCENTILE_THRESHOLD,
  SELL_PERCENTILE_THRESHOLD,
  PUSH_ABSOLUTE_FLOOR,
  SELL_ABSOLUTE_CEILING,
  OVERALL_PUSH_QUALITY,
  OVERALL_SELL_QUALITY,
} from './scoringConstants';

export type ModAction = 'level' | 'slice' | 'maxed' | 'pre-eval' | 'sell';

// Developmental stages, in upgrade order. Used to sort stage pickers/sections.
export const STAGE_ORDER = [
  '5d-E', '5d-D', '5d-C', '5d-B', '5d-A',
  '6d-E', '6d-D', '6d-C', '6d-B', '6d-A',
] as const;

// Action sub-tab order: most-actionable first so a freshly-entered variant
// view defaults to something the player can act on.
export const ACTION_ORDER: ModAction[] = ['level', 'slice', 'maxed', 'pre-eval', 'sell'];

// Stage identifies the developmental peer group: 5d-E ... 6d-A. Returns null
// for rarity <4 (legacy, auto-sell) and any unexpected shape.
export function stageOf(mod: ParsedMod): string | null {
  if (mod.rarity < 5) return null;
  if (!mod.tier_name) return null;
  return `${mod.rarity}d-${mod.tier_name}`;
}

const TIER_LETTER_TO_COLOR: Record<string, string> = {
  A: 'Gold',
  B: 'Purple',
  C: 'Blue',
  D: 'Green',
  E: 'Grey',
};

// Renders an internal stage code ("5d-A") as the player-facing string ("5A Gold").
// Falls back to the raw code if the shape is unexpected.
export function formatStage(stage: string): string {
  const match = /^(\d)d-([A-E])$/.exec(stage);
  if (!match) return stage;
  const [, rarity, letter] = match;
  return `${rarity}${letter} ${TIER_LETTER_TO_COLOR[letter] ?? ''}`.trim();
}

// Maps verdict + mod state to the action the player is being asked to take.
// Returns null for UNCONFIGURED (no action; player needs to go set up rules).
export function actionOf(mod: ParsedMod, verdict: VerdictResult): ModAction | null {
  switch (verdict.verdict) {
    case 'SELL':
      return 'sell';
    case 'UPGRADE':
      return verdict.winning_variant_id ? 'level' : 'pre-eval';
    case 'PASS_RULES':
      if (mod.rarity === 6 && mod.tier_name === 'A') return 'maxed';
      return 'slice';
    case 'UNCONFIGURED':
      return null;
  }
}

// Cohort key for relative ranking. Mods sharing a key are direct peers.
// - Slicing: stage + variant. A 5d-A and a 6d-E are never peers because
//   slicing cost and roll opportunities differ.
// - Maxed: variant only, scoped to 6d-A by actionOf.
// - Level / Pre-eval / sell / null: no cohort. Level mods are judged
//   individually against the milestone quality gate (QUALITY_RAMP); the
//   relative-band UI doesn't apply to them.
export function cohortKey(mod: ParsedMod, verdict: VerdictResult): string | null {
  const action = actionOf(mod, verdict);
  if (action === null) return null;
  switch (action) {
    case 'slice': {
      const stage = stageOf(mod);
      if (!stage || !verdict.winning_variant_id) return null;
      return `slice|${stage}|${verdict.winning_variant_id}`;
    }
    case 'maxed':
      return `maxed|${verdict.winning_variant_id}`;
    default:
      return null;
  }
}

// Returns the metric used to rank within a given action's cohort.
// Slicing uses raw score (total accumulated quality vs peers); maxed uses
// per-roll absolute quality. Level mods have no cohort and aren't ranked.
function rankMetric(mod: ParsedMod, verdict: VerdictResult): number | null {
  const action = actionOf(mod, verdict);
  if (action === 'slice') return verdict.score ?? null;
  if (action === 'maxed') return verdict.absolute_quality ?? null;
  return null;
}

// Computes percentile rank (0-100) for each rankable mod within its cohort.
// Cohorts below MIN_COHORT_SIZE_FOR_RANKING are omitted entirely — those mods
// won't appear in the result map (UI shows absolute_quality only).
// Tiebreak is stable by mod_id so order is deterministic across renders.
export function computeRelativePositions(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): Map<string, number> {
  type Entry = { mod_id: string; metric: number };
  const cohorts = new Map<string, Entry[]>();

  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const key = cohortKey(mod, verdict);
    if (!key) continue;
    const metric = rankMetric(mod, verdict);
    if (metric === null) continue;
    const bucket = cohorts.get(key);
    if (bucket) bucket.push({ mod_id: mod.mod_id, metric });
    else cohorts.set(key, [{ mod_id: mod.mod_id, metric }]);
  }

  const out = new Map<string, number>();
  for (const bucket of cohorts.values()) {
    if (bucket.length < MIN_COHORT_SIZE_FOR_RANKING) continue;
    bucket.sort((a, b) => {
      if (a.metric !== b.metric) return a.metric - b.metric;
      return a.mod_id < b.mod_id ? -1 : a.mod_id > b.mod_id ? 1 : 0;
    });
    const n = bucket.length;
    for (let i = 0; i < n; i++) {
      // Percentile: midpoint of rank, so smallest gets (0.5/n)*100, largest gets ((n-0.5)/n)*100.
      // This keeps the band symmetric around 50 and avoids 0/100 extremes that misrepresent ties.
      const percentile = ((i + 0.5) / n) * 100;
      out.set(bucket[i].mod_id, percentile);
    }
  }

  return out;
}

/**
 * Assembles per-mod ModRanking objects from verdicts + a relative-position map.
 * Only rankable mods (level/slice/maxed actions) are included; mods in
 * sub-MIN_COHORT_SIZE cohorts get relative_position: null.
 */
export function buildRankings(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  relativePositions: Map<string, number>
): Map<string, ModRanking> {
  const out = new Map<string, ModRanking>();
  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const action = actionOf(mod, verdict);
    if (action !== 'level' && action !== 'slice' && action !== 'maxed') continue;
    out.set(mod.mod_id, {
      action,
      relative_position: relativePositions.get(mod.mod_id) ?? null,
      absolute_quality: verdict.absolute_quality ?? 0,
    });
  }
  return out;
}

// 'none' = ranked but no push/sell call (maxed mods have no further action).
export type ActionBand = 'push' | 'keep' | 'consider-selling' | 'none';

export interface ModRanking {
  action: ModAction;
  relative_position: number | null;
  absolute_quality: number;
}

/**
 * Derives the player-facing action band from a mod's action + scoring inputs.
 * Slicing uses cohort percentile gated by an absolute floor/ceiling so a
 * best-of-a-bad-lot doesn't become Push, nor a worst-of-a-great-lot a Sell.
 * Level mods don't get bands — the milestone gate chain has already made
 * the push/sell call by the time we get here.
 */
export function deriveActionBand(ranking: ModRanking): ActionBand {
  const { action, relative_position, absolute_quality } = ranking;
  switch (action) {
    case 'level':
      return 'none';
    case 'slice':
      if (relative_position === null) return 'keep'; // uncomparable cohort (singleton)
      if (
        relative_position >= PUSH_PERCENTILE_THRESHOLD &&
        absolute_quality >= PUSH_ABSOLUTE_FLOOR
      ) {
        return 'push';
      }
      if (
        relative_position <= SELL_PERCENTILE_THRESHOLD &&
        absolute_quality < SELL_ABSOLUTE_CEILING
      ) {
        return 'consider-selling';
      }
      return 'keep';
    case 'maxed':
      return 'none';
    default:
      return 'none';
  }
}

/**
 * Absolute-quality band for the "Overall" cross-stage slice list. Unlike
 * deriveActionBand, this ignores cohort percentile and labels a mod purely on
 * its own absolute_quality — so the chip stays consistent with that list's
 * absolute-% ordering, and a strong mod is not demoted to "Keep" merely
 * because better mods happen to share its stage. Level/maxed mods get no band.
 */
export function deriveAbsoluteBand(ranking: ModRanking): ActionBand {
  if (ranking.action === 'level' || ranking.action === 'maxed') return 'none';
  if (ranking.absolute_quality >= OVERALL_PUSH_QUALITY) return 'push';
  if (ranking.absolute_quality < OVERALL_SELL_QUALITY) return 'consider-selling';
  return 'keep';
}
