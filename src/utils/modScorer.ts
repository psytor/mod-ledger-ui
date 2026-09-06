import type { ParsedMod } from '@/services/modLedgerApi';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  SecondaryClassification,
  Variant,
} from '@/types/evaluation';

// Hardcoded multipliers. Lever to tune later is the neutral multiplier
// (drop to 0.05 if lucky-garbage mods feel overrepresented in real inventories).
// Exported: calibrationAdvisor.ts reuses these exact weights rather than
// duplicating magic numbers that could drift out of sync.
export const TIER_MULTIPLIERS: Record<SecondaryClassification | 'neutral', number> = {
  required: 1.0,
  mandatory: 1.0, // same weight as Required — Mandatory is Required plus a hard gate
  complementary: 0.4,
  neutral: 0.1,
};

// Boosted Complementary weight used only when the rule's primary stat is
// itself marked Required or Mandatory (the same signal that eases the Stage 1
// threshold in evaluationEngine.ts's checkSecondary/applyQualityGates — the game
// blocks a primary from also rolling as a secondary, so that Required slot
// is structurally unreachable and the bar is loosened to compensate). A mod
// clearing that eased bar is leaning on its Complementary hits to do work a
// missing Required hit would have done, so they're worth more than the
// default 0.4 here — but deliberately still short of Required's 1.0, so a
// mod stacked with Complementary alone can't outscore one that actually met
// the Required bar.
export const COMPLEMENTARY_WEIGHT_WHEN_EASED = 0.7;

// A Wanted primary contributes to the score at the same weight as a Required
// secondary that rolled perfectly. Unlike a secondary, a primary has no roll
// variance to score against — it's a fixed, maxed value the instant the mod
// exists — so this is a flat, always-100%-efficiency contribution rather than
// a curveScore lookup. Neutral/unlisted primaries add nothing here (score is
// driven entirely by secondaries, same as before); Not_Wanted never reaches
// this function at all (rejected earlier by evaluationEngine's checkPrimary).
const PRIMARY_WANTED_WEIGHT = 1.0;

// Exported: buildMatchBreakdown (evaluationEngine.ts) uses this same fallback
// when populating SecondaryRole.target, so an un-authored stat reads the same
// "coin flip" target everywhere rather than two independently-chosen defaults.
export const DEFAULT_TARGET = 0.5;

// Piecewise linear with kink at (T, 50). Endpoints (0,0) and (1,100). UI clamps
// T to [0.01, 0.99]; the T=0/T=1 guards here are defensive against direct calls.
export function curveScore(efficiency: number, target: number): number {
  if (target <= 0) return efficiency > 0 ? 100 : 0;
  if (target >= 1) return efficiency >= 1 ? 100 : efficiency * 50;
  return efficiency <= target
    ? (efficiency / target) * 50
    : 50 + ((efficiency - target) / (1 - target)) * 50;
}

type ModStatLike = {
  stat_name: string;
  is_percent: boolean;
  is_revealed?: boolean;
  roll_efficiencies?: number[];
};

function buildStatIdLookup(statDefs: StatDefinition[]): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const s of statDefs) {
    lookup.set(`${s.name}|${s.is_percentage}`, s.stat_id);
  }
  return lookup;
}

function resolveStatId(
  stat: ModStatLike,
  lookup: Map<string, number>
): number | undefined {
  return lookup.get(`${stat.stat_name}|${stat.is_percent}`);
}

/**
 * Returns the mod's `absolute_quality` (0-100) under the given variant: how
 * close its revealed rolls came to perfect, weighted by how much the variant
 * cares about each stat. This is the single quality number the UI displays and
 * ranks by — the old raw running total was only ever used by the (removed)
 * cohort percentile, so it is no longer returned.
 */
export function scoreModForVariant(
  mod: ParsedMod,
  variant: Variant,
  statDefs: StatDefinition[]
): number {
  const statIdLookup = buildStatIdLookup(statDefs);
  const targets = variant.secondary_targets;

  const primaryStatId = resolveStatId(mod.primary_stat, statIdLookup);
  const primaryClass =
    primaryStatId !== undefined
      ? variant.secondary_classifications[primaryStatId]
      : undefined;
  const primaryInRequiredOrMandatory =
    primaryClass === 'required' || primaryClass === 'mandatory';
  const primaryIsWanted =
    primaryStatId !== undefined &&
    variant.primary_classifications[primaryStatId] === 'wanted';

  let total = 0;
  let theoreticalMax = 0;

  if (primaryIsWanted) {
    total += 100 * PRIMARY_WANTED_WEIGHT;
    theoreticalMax += 100 * PRIMARY_WANTED_WEIGHT;
  }

  for (const stat of mod.secondary_stats) {
    if (stat.is_revealed === false) continue;
    const efficiencies = stat.roll_efficiencies ?? [];
    if (efficiencies.length === 0) continue;
    const statId = resolveStatId(stat, statIdLookup);
    if (statId === undefined) continue;

    const target = targets[statId] ?? DEFAULT_TARGET;
    const classification: SecondaryClassification | 'neutral' =
      variant.secondary_classifications[statId] ?? 'neutral';
    const multiplier =
      classification === 'complementary' && primaryInRequiredOrMandatory
        ? COMPLEMENTARY_WEIGHT_WHEN_EASED
        : TIER_MULTIPLIERS[classification];

    // Backend roll efficiencies are 0-100 percentages (see mod-ledger
    // schemas/mod.py); curveScore expects a 0-1 scale to match targets.
    for (const efficiency of efficiencies) {
      total += curveScore(efficiency / 100, target) * multiplier;
    }
    theoreticalMax += efficiencies.length * 100 * multiplier;
  }

  return theoreticalMax > 0 ? (total / theoreticalMax) * 100 : 0;
}
