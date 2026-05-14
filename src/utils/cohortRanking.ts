import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import {
  MIN_COHORT_SIZE_FOR_RANKING,
  PUSH_PERCENTILE_THRESHOLD,
  SELL_PERCENTILE_THRESHOLD,
  PUSH_ABSOLUTE_FLOOR,
  SELL_ABSOLUTE_CEILING,
  LEVEL_PUSH_ABSOLUTE_THRESHOLD,
  LEVEL_SELL_ABSOLUTE_THRESHOLD,
} from './scoringConstants';

export type ModAction = 'level' | 'slice' | 'deploy' | 'pre-eval' | 'sell';

// Developmental stages, in upgrade order. Used to sort stage pickers/sections.
export const STAGE_ORDER = [
  '5d-E', '5d-D', '5d-C', '5d-B', '5d-A',
  '6d-E', '6d-D', '6d-C', '6d-B', '6d-A',
] as const;

// Action sub-tab order: most-actionable first so a freshly-entered variant
// view defaults to something the player can act on.
export const ACTION_ORDER: ModAction[] = ['level', 'slice', 'deploy', 'pre-eval', 'sell'];

// Stage identifies the developmental peer group: 5d-E ... 6d-A. Returns null
// for rarity <4 (legacy, auto-sell) and any unexpected shape.
export function stageOf(mod: ParsedMod): string | null {
  if (mod.rarity < 5) return null;
  if (!mod.tier_name) return null;
  return `${mod.rarity}d-${mod.tier_name}`;
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
      if (mod.rarity === 6 && mod.tier_name === 'A') return 'deploy';
      return 'slice';
    case 'UNCONFIGURED':
      return null;
  }
}

// Cohort key for relative ranking. Mods sharing a key are direct peers.
// - Leveling: variant only. A Grey-L12 and a Purple-L12 under the same lens
//   are peers because the question is per-roll quality, not total accumulation.
// - Slicing: stage + variant. A 5d-A and a 6d-E are never peers because
//   slicing cost and roll opportunities differ.
// - Deploy: variant only, scoped to 6d-A by actionOf.
// - Pre-eval / sell / null: no cohort.
export function cohortKey(mod: ParsedMod, verdict: VerdictResult): string | null {
  const action = actionOf(mod, verdict);
  if (action === null) return null;
  switch (action) {
    case 'level':
      return `level|${verdict.winning_variant_id}`;
    case 'slice': {
      const stage = stageOf(mod);
      if (!stage || !verdict.winning_variant_id) return null;
      return `slice|${stage}|${verdict.winning_variant_id}`;
    }
    case 'deploy':
      return `deploy|${verdict.winning_variant_id}`;
    default:
      return null;
  }
}

// Returns the metric used to rank within a given action's cohort.
// Slicing uses raw score (total accumulated quality vs peers); leveling and
// deploy use per-roll absolute quality.
function rankMetric(mod: ParsedMod, verdict: VerdictResult): number | null {
  const action = actionOf(mod, verdict);
  if (action === 'slice') return verdict.score ?? null;
  if (action === 'level' || action === 'deploy') return verdict.absolute_quality ?? null;
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
 * Only rankable mods (level/slice/deploy actions) are included; mods in
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
    if (action !== 'level' && action !== 'slice' && action !== 'deploy') continue;
    out.set(mod.mod_id, {
      action,
      relative_position: relativePositions.get(mod.mod_id) ?? null,
      absolute_quality: verdict.absolute_quality ?? 0,
    });
  }
  return out;
}

// 'none' = ranked but no push/sell call (deploy mods are already maxed).
export type ActionBand = 'push' | 'keep' | 'consider-selling' | 'none';

export interface ModRanking {
  action: ModAction;
  relative_position: number | null;
  absolute_quality: number;
}

/**
 * Derives the player-facing action band from a mod's action + scoring inputs.
 * Leveling uses absolute_quality alone (per-roll bet, sample size varies).
 * Slicing uses cohort percentile gated by an absolute floor/ceiling so a
 * best-of-a-bad-lot doesn't become Push, nor a worst-of-a-great-lot a Sell.
 */
export function deriveActionBand(ranking: ModRanking): ActionBand {
  const { action, relative_position, absolute_quality } = ranking;
  switch (action) {
    case 'level':
      if (absolute_quality >= LEVEL_PUSH_ABSOLUTE_THRESHOLD) return 'push';
      if (absolute_quality < LEVEL_SELL_ABSOLUTE_THRESHOLD) return 'consider-selling';
      return 'keep';
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
    case 'deploy':
      return 'none';
    default:
      return 'none';
  }
}
