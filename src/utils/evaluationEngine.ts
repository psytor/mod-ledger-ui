import type { ParsedMod } from '@/services/modLedgerApi';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  Evaluation,
  Variant,
  VariantResult,
  VerdictResult,
} from '@/types/evaluation';

const SHAPES_FIXED_PRIMARY = new Set(['Square', 'Diamond', 'Circle']);
const MILESTONES = [1, 3, 6, 9, 12, 15] as const;

// Stat names are not unique across primary+secondary pools (e.g. flat Health
// id 1 vs Health % id 55). The engine resolves each ModStat to a stat_id by
// matching (name, is_percent) against the loaded stat definitions.
type ModStatLike = { stat_name: string; is_percent: boolean; is_revealed?: boolean };

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

function isCheckpoint(rarity: number, tier: number, level: number): boolean {
  if (rarity === 6) return true; // 6-dot is always evaluable; engine emits SELL or PASS_RULES only.
  if (!MILESTONES.includes(level as (typeof MILESTONES)[number])) return false;
  if (tier <= 2 && level < 6) return false; // Grey/Green wait for L6.
  return true;
}

function nextMilestone(level: number): number {
  for (const m of MILESTONES) {
    if (m > level) return m;
  }
  return 15;
}

function findNextCheckpoint(
  rarity: number,
  tier: number,
  level: number
): number | null {
  for (const m of MILESTONES) {
    if (m > level && isCheckpoint(rarity, tier, m)) return m;
  }
  return null;
}

function checkPrimary(
  mod: ParsedMod,
  variant: Variant,
  primaryStatId: number | undefined
): boolean {
  // Square / Diamond / Circle: primary check skipped (Wanted AND Not_Wanted).
  if (SHAPES_FIXED_PRIMARY.has(mod.shape)) return true;

  // Defensive: unknown stat id → pass rather than wrongly sell.
  if (primaryStatId === undefined) return true;

  const classification = variant.primary_classifications[primaryStatId] ?? 'neutral';
  if (classification === 'not_wanted') return false;

  const anyWanted = Object.values(variant.primary_classifications).includes('wanted');
  if (!anyWanted) return true; // All-Neutral primary list → pass.

  return classification === 'wanted';
}

type SecondaryCheck = {
  pass: boolean;
  requiredCount: number;
  complementaryCount: number;
  reason?: string;
};

function checkSecondary(
  mod: ParsedMod,
  variant: Variant,
  primaryStatId: number | undefined,
  statIdLookup: Map<string, number>
): SecondaryCheck {
  const requiredStatIds = new Set<number>();
  for (const [key, classification] of Object.entries(variant.secondary_classifications)) {
    if (classification === 'required') requiredStatIds.add(Number(key));
  }

  const visibleSecondaries = mod.secondary_stats.filter(
    (s) => s.is_revealed !== false
  );
  const visibleCount = visibleSecondaries.length;

  let requiredCount = 0;
  let complementaryCount = 0;
  for (const sec of visibleSecondaries) {
    const id = resolveStatId(sec, statIdLookup);
    if (id === undefined) continue;
    const c = variant.secondary_classifications[id] ?? 'neutral';
    if (c === 'required') requiredCount++;
    else if (c === 'complementary') complementaryCount++;
  }

  // Auto-pass: variant defines no Required stats (parallel to all-Neutral primary rule).
  if (requiredStatIds.size === 0) {
    return { pass: true, requiredCount: 0, complementaryCount };
  }

  // Adjusted formula fires whenever the mod's primary lands on a Required stat,
  // regardless of slot. Square/Diamond/Circle aren't special here — Speed Arrow
  // in an offensive variant gets the same easier formula.
  const adjusted =
    primaryStatId !== undefined && requiredStatIds.has(primaryStatId);
  const minRequired = visibleCount - (adjusted ? 2 : 1);

  if (requiredCount < minRequired) {
    return {
      pass: false,
      requiredCount,
      complementaryCount,
      reason: `${requiredCount} Required of ${visibleCount} visible (need ≥${minRequired})`,
    };
  }

  return { pass: true, requiredCount, complementaryCount };
}

function evaluateVariant(
  mod: ParsedMod,
  variant: Variant,
  statIdLookup: Map<string, number>
): VariantResult {
  const primaryStatId = resolveStatId(mod.primary_stat, statIdLookup);

  if (!checkPrimary(mod, variant, primaryStatId)) {
    return {
      variant_id: variant.id,
      variant_name: variant.name,
      verdict: 'SELL',
      required_count: 0,
      complementary_count: 0,
      reason: 'Primary stat mismatch',
    };
  }

  const sec = checkSecondary(mod, variant, primaryStatId, statIdLookup);
  if (!sec.pass) {
    return {
      variant_id: variant.id,
      variant_name: variant.name,
      verdict: 'SELL',
      required_count: sec.requiredCount,
      complementary_count: sec.complementaryCount,
      reason: sec.reason,
    };
  }

  return {
    variant_id: variant.id,
    variant_name: variant.name,
    verdict: 'PASS_RULES',
    required_count: sec.requiredCount,
    complementary_count: sec.complementaryCount,
  };
}

export function evaluateMod(
  mod: ParsedMod,
  evaluation: Evaluation,
  statDefs: StatDefinition[]
): VerdictResult {
  // 1-4 dot mods: no longer farmable, sell on sight.
  if (mod.rarity < 5) {
    return {
      verdict: 'SELL',
      reason: `${mod.rarity}-dot mod (no longer farmable)`,
    };
  }

  const config = evaluation.mod_set_configs.find((c) => c.set_id === mod.set_id);
  if (!config || config.variants.length === 0) {
    return { verdict: 'UNCONFIGURED' };
  }

  // Below first checkpoint (e.g. Grey at L1/L3): no decision to make yet,
  // just recommend leveling to the first checkpoint.
  if (mod.rarity === 5 && !isCheckpoint(mod.rarity, mod.tier, mod.level)) {
    const target = findNextCheckpoint(mod.rarity, mod.tier, mod.level);
    if (target !== null) {
      return {
        verdict: 'UPGRADE',
        target_level: target,
        reason: 'not at evaluation checkpoint',
      };
    }
  }

  const statIdLookup = buildStatIdLookup(statDefs);
  const results = config.variants.map((v) =>
    evaluateVariant(mod, v, statIdLookup)
  );

  const passing = results.filter((r) => r.verdict === 'PASS_RULES');

  if (passing.length === 0) {
    return {
      verdict: 'SELL',
      reason: 'no variant passed',
      all_results: results,
    };
  }

  // Tiebreak: most Complementary matches present on the mod, then insertion order.
  const variantOrder = new Map<string, number>();
  config.variants.forEach((v, i) => variantOrder.set(v.id, i));

  passing.sort((a, b) => {
    if (a.complementary_count !== b.complementary_count) {
      return b.complementary_count - a.complementary_count;
    }
    return (
      (variantOrder.get(a.variant_id) ?? 0) -
      (variantOrder.get(b.variant_id) ?? 0)
    );
  });

  const winner = passing[0];

  // 5-dot below L15: PASS at this checkpoint → recommend the next checkpoint.
  // 5-dot at L15 or any 6-dot: hand off to the slicing pipeline.
  if (mod.rarity === 5 && mod.level < 15) {
    return {
      verdict: 'UPGRADE',
      target_level: nextMilestone(mod.level),
      winning_variant_id: winner.variant_id,
      winning_variant_name: winner.variant_name,
      all_results: results,
    };
  }

  return {
    verdict: 'PASS_RULES',
    winning_variant_id: winner.variant_id,
    winning_variant_name: winner.variant_name,
    all_results: results,
  };
}

export function evaluateAll(
  mods: ParsedMod[],
  evaluation: Evaluation,
  statDefs: StatDefinition[]
): Map<string, VerdictResult> {
  const verdicts = new Map<string, VerdictResult>();
  for (const mod of mods) {
    verdicts.set(mod.mod_id, evaluateMod(mod, evaluation, statDefs));
  }
  return verdicts;
}
