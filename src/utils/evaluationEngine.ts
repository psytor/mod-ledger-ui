import type { ParsedMod } from '@/services/modLedgerApi';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  Evaluation,
  Variant,
  VariantResult,
  VerdictResult,
} from '@/types/evaluation';
import { scoreModForVariant } from '@/utils/modScorer';

const SHAPES_FIXED_PRIMARY = new Set(['Square', 'Diamond', 'Circle']);
const MILESTONES = [1, 3, 6, 9, 12, 15] as const;

// Stage 2 quality-gate relaxation when the primary stat is itself a Required
// stat. Game rule: a primary stat cannot also roll as a secondary on the same
// mod, so a Required stat that IS the primary is unreachable from the
// secondary pool. We shrink the bar by `requiredCount / reachable_required ×
// COVERAGE_DISCOUNT_K`. Coverage is "of what could be hit, how much was hit."
// k=0.2 caps the discount at 20% off the raw threshold.
const COVERAGE_DISCOUNT_K = 0.2;

// First level at which all 4 secondaries are revealed, per 5-dot tier.
const FIRST_EVAL_LEVEL: Record<number, number> = {
  1: 12, // Grey:   reveals at L3, L6, L9, L12
  2: 9,  // Green:  reveals at L1, L3, L6, L9
  3: 6,  // Blue:   reveals at L1, L3, L6
  4: 3,  // Purple: reveals at L1, L3
  5: 1,  // Gold:   all 4 visible from L1
};

// Stage 2 quality gate, keyed by the mod's CURRENT level. At L12 all rolls are
// revealed so the bar is highest (Q=50 ≈ rolls hit slider target on average).
// L1 extrapolates the +5 ramp for Gold-L1's "Stage 2 from L1" path.
export const QUALITY_RAMP: Record<number, number> = {
  1: 30,
  3: 35,
  6: 40,
  9: 45,
  12: 50,
};

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

function nextMilestone(level: number): number {
  for (const m of MILESTONES) {
    if (m > level) return m;
  }
  return 15;
}

function isInScoringZone(rarity: number, tier: number, level: number): boolean {
  if (rarity === 6) return true;
  return level >= (FIRST_EVAL_LEVEL[tier] ?? 6);
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
  visibleCount: number;
  threshold: number;
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
    return {
      pass: true,
      requiredCount: 0,
      complementaryCount,
      visibleCount,
      threshold: 0,
    };
  }

  // Threshold = how many Required secondaries the mod must hit. The bar scales
  // with the *reachable* Required pool, not just the presence of the primary:
  //
  //   bar = max(1, min(visibleCount - 1, reachableRequiredSize - 1))
  //
  // - `reachableRequiredSize` is the Required list minus the primary when the
  //   primary is itself a Required stat (the game blocks the primary stat from
  //   also rolling as a secondary, so it can never be hit there).
  // - `visibleCount - 1` is the "3 of 4" ideal — you're allowed to miss one of
  //   the four secondary slots. On a fully-revealed mod this is 3.
  // - `reachableRequiredSize - 1` is "allowed to miss one Required too". This
  //   only bites when the reachable pool is tight: a big pool (e.g. Defensive's
  //   7 Required, 6 reachable) stays capped at 3, while a tight pool (Offensive's
  //   4 Required, 3 reachable once the primary takes one) eases to 2.
  // - The floor of 1 covers the short-list case: 2 Required with the primary on
  //   one leaves only 1 reachable, so the bar can't exceed 1 — never impossible,
  //   never auto-pass at 0.
  const primaryInRequired =
    primaryStatId !== undefined && requiredStatIds.has(primaryStatId);
  const reachableRequiredSize = primaryInRequired
    ? requiredStatIds.size - 1
    : requiredStatIds.size;

  // Reachable pool empty: the sole Required stat IS the mod's primary, so the
  // game blocks it from also rolling as a secondary — there is nothing left to
  // demand of the secondaries. The primary itself satisfies the requirement, so
  // the gate passes and the mod's value/direction is decided downstream by
  // complementary coverage + quality. (Only reachable when primaryInRequired and
  // the Required list has exactly one stat; the requiredStatIds.size === 0
  // early-return above guarantees this can't be a zero-Required variant.)
  if (reachableRequiredSize === 0) {
    return {
      pass: true,
      requiredCount,
      complementaryCount,
      visibleCount,
      threshold: 0,
    };
  }

  const threshold = Math.max(
    1,
    Math.min(visibleCount - 1, reachableRequiredSize - 1)
  );

  return {
    pass: requiredCount >= threshold,
    requiredCount,
    complementaryCount,
    visibleCount,
    threshold,
  };
}

type VariantChainResult =
  | {
      kind: 'pass';
      variant: Variant;
      requiredCount: number;
      complementaryCount: number;
    }
  | {
      kind: 'fail';
      variant: Variant;
      requiredCount: number;
      complementaryCount: number;
      reason: string;
    };

function runVariantChain(
  mod: ParsedMod,
  variant: Variant,
  statIdLookup: Map<string, number>
): VariantChainResult {
  const primaryStatId = resolveStatId(mod.primary_stat, statIdLookup);

  if (!checkPrimary(mod, variant, primaryStatId)) {
    return {
      kind: 'fail',
      variant,
      requiredCount: 0,
      complementaryCount: 0,
      reason: 'Primary stat mismatch',
    };
  }

  const sec = checkSecondary(mod, variant, primaryStatId, statIdLookup);
  if (!sec.pass) {
    return {
      kind: 'fail',
      variant,
      requiredCount: sec.requiredCount,
      complementaryCount: sec.complementaryCount,
      reason: `${mod.tier_color} L${mod.level} gate: ${sec.requiredCount} of ${sec.visibleCount} visible are Required (need ≥${sec.threshold})`,
    };
  }

  return {
    kind: 'pass',
    variant,
    requiredCount: sec.requiredCount,
    complementaryCount: sec.complementaryCount,
  };
}

function toVariantResult(r: VariantChainResult): VariantResult {
  return {
    variant_id: r.variant.id,
    variant_name: r.variant.name,
    verdict: r.kind === 'pass' ? 'PASS_RULES' : 'SELL',
    required_count: r.requiredCount,
    complementary_count: r.complementaryCount,
    reason: r.kind === 'fail' ? r.reason : undefined,
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

  // 5-dot below L6: no gate, just level. Owner: "for a grey mod not at L6, we
  // level to 6." The chain doesn't start until L6 (or the tier's first eval
  // level, whichever is lower). Gold L1 IS in scoring zone — the L<6 check
  // would also apply, but Gold's first eval is L1, so we let scoring-zone
  // logic below handle it.
  if (mod.rarity === 5 && mod.level < 6 && !isInScoringZone(mod.rarity, mod.tier, mod.level)) {
    return {
      verdict: 'UPGRADE',
      target_level: 6,
      reason: 'level to L6 before any judgment',
    };
  }

  const statIdLookup = buildStatIdLookup(statDefs);
  const chains = config.variants.map((v) => runVariantChain(mod, v, statIdLookup));
  const results = chains.map(toVariantResult);

  const passing = chains.filter((r): r is Extract<VariantChainResult, { kind: 'pass' }> => r.kind === 'pass');

  if (passing.length === 0) {
    // Pick the most-informative failure: highest required_count → closest to passing.
    const sortedFails = [...chains]
      .filter((r): r is Extract<VariantChainResult, { kind: 'fail' }> => r.kind === 'fail')
      .sort((a, b) => b.requiredCount - a.requiredCount);
    return {
      verdict: 'SELL',
      reason: sortedFails[0]?.reason ?? 'no variant passed',
      all_results: results,
    };
  }

  // Winner picking (most-descriptive-rule-wins):
  // 1. Highest requiredCount — the rule whose own required stats the mod hits
  //    most thoroughly. A 3-of-4 match describes the mod better than a 1-of-1
  //    match even when the latter has higher absolute_quality (which it often
  //    does, since looser rules have smaller theoretical maxes).
  // 2. Highest complementaryCount — among rules tied on requiredCount, the one
  //    that "cares about" more of the mod's actual stats wins. This is the
  //    direction signal: when the Required gate is a tie (e.g. a Speed-primary
  //    mod in a Speed set, where every variant requires only Speed and the
  //    primary satisfies it for all of them), the complementary spread is what
  //    routes the mod into Offense / Defense / Tenacity / Potency flavor.
  //    absolute_quality can't do this — it's normalized per-variant, so it
  //    measures roll quality, not which direction the mod belongs to.
  // 3. Highest absolute_quality — among rules tied on required AND complementary
  //    coverage, the one that scores the mod's actual rolls best.
  // 4. Insertion order — final deterministic tiebreak.
  const variantOrder = new Map<string, number>();
  config.variants.forEach((v, i) => variantOrder.set(v.id, i));

  const scored = passing.map((p) => ({
    chain: p,
    score: scoreModForVariant(mod, p.variant, statDefs),
  }));

  scored.sort((a, b) => {
    if (a.chain.requiredCount !== b.chain.requiredCount) {
      return b.chain.requiredCount - a.chain.requiredCount;
    }
    if (a.chain.complementaryCount !== b.chain.complementaryCount) {
      return b.chain.complementaryCount - a.chain.complementaryCount;
    }
    if (a.score.absolute_quality !== b.score.absolute_quality) {
      return b.score.absolute_quality - a.score.absolute_quality;
    }
    return (
      (variantOrder.get(a.chain.variant.id) ?? 0) -
      (variantOrder.get(b.chain.variant.id) ?? 0)
    );
  });

  const winner = scored[0];

  // 5-dot below L15: PASS at this checkpoint → recommend the next milestone.
  // The Stage 2 quality gate runs in a post-pass (see applyQualityGates),
  // which may flip this UPGRADE to SELL once absolute_quality is known.
  // 5-dot at L15 or any 6-dot: hand off to the slicing pipeline.
  if (mod.rarity === 5 && mod.level < 15) {
    return {
      verdict: 'UPGRADE',
      target_level: nextMilestone(mod.level),
      winning_variant_id: winner.chain.variant.id,
      winning_variant_name: winner.chain.variant.name,
      score: winner.score.score,
      absolute_quality: winner.score.absolute_quality,
      all_results: results,
    };
  }

  return {
    verdict: 'PASS_RULES',
    winning_variant_id: winner.chain.variant.id,
    winning_variant_name: winner.chain.variant.name,
    score: winner.score.score,
    absolute_quality: winner.score.absolute_quality,
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

/**
 * Stage 2 post-pass: applies the absolute_quality gate to UPGRADE verdicts.
 * Runs AFTER scoreAll so each mod's score is available. A 5-dot mod in
 * scoring zone whose absolute_quality is below QUALITY_RAMP[current_level]
 * gets flipped from UPGRADE to SELL with an explicit reason.
 *
 * Stage 2 fires only when:
 *   - verdict is UPGRADE (we're considering a push), AND
 *   - the mod is 5-dot with a winning variant (not Pre-Eval), AND
 *   - the current level is in QUALITY_RAMP (L1, L3, L6, L9, L12), AND
 *   - the mod is in scoring zone (all 4 secondaries revealed).
 */
export function applyQualityGates(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>,
  evaluation: Evaluation,
  statDefs: StatDefinition[]
): Map<string, VerdictResult> {
  const out = new Map<string, VerdictResult>();
  const modById = new Map(mods.map((m) => [m.mod_id, m]));
  const statIdLookup = buildStatIdLookup(statDefs);

  for (const [modId, verdict] of verdicts) {
    const mod = modById.get(modId);
    if (!mod || verdict.verdict !== 'UPGRADE' || !verdict.winning_variant_id) {
      out.set(modId, verdict);
      continue;
    }
    if (mod.rarity !== 5) {
      out.set(modId, verdict);
      continue;
    }
    if (!isInScoringZone(mod.rarity, mod.tier, mod.level)) {
      out.set(modId, verdict);
      continue;
    }
    const rawThreshold = QUALITY_RAMP[mod.level];
    if (rawThreshold === undefined) {
      out.set(modId, verdict);
      continue;
    }
    const score = verdict.absolute_quality;
    if (score === undefined) {
      out.set(modId, verdict);
      continue;
    }

    // Primary-aware threshold relief. Only fires when the primary stat is
    // itself a Required stat — in that case the game blocks it from rolling
    // as a secondary, so the *reachable* Required pool is `required \ {primary}`.
    // The relief scales with how much of that reachable pool the mod hit.
    let threshold = rawThreshold;
    const config = evaluation.mod_set_configs.find((c) => c.set_id === mod.set_id);
    const winningVariant = config?.variants.find(
      (v) => v.id === verdict.winning_variant_id
    );
    const winningResult = verdict.all_results?.find(
      (r) => r.variant_id === verdict.winning_variant_id
    );
    if (winningVariant && winningResult) {
      const primaryStatId = resolveStatId(mod.primary_stat, statIdLookup);
      const requiredIds = new Set<number>();
      for (const [k, c] of Object.entries(winningVariant.secondary_classifications)) {
        if (c === 'required') requiredIds.add(Number(k));
      }
      const primaryInRequired =
        primaryStatId !== undefined && requiredIds.has(primaryStatId);
      if (primaryInRequired) {
        const reachableSize = requiredIds.size - 1;
        if (reachableSize > 0) {
          const coverage = winningResult.required_count / reachableSize;
          threshold = rawThreshold * (1 - coverage * COVERAGE_DISCOUNT_K);
        }
      }
    }

    if (score >= threshold) {
      out.set(modId, verdict);
      continue;
    }
    out.set(modId, {
      ...verdict,
      verdict: 'SELL',
      target_level: undefined,
      reason: `L${mod.level} quality gate: absolute_quality ${Math.round(score)} < ${Math.round(threshold)}`,
    });
  }
  return out;
}
