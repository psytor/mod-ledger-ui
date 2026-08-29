import type { ParsedMod } from '@/services/modLedgerApi';
import type { ModSlotDefinition, StatDefinition } from '@/services/gameDataApi';
import type { ModShape } from '@/utils/modSpriteConfig';
import type {
  Evaluation,
  MatchBreakdown,
  Variant,
  VariantResult,
  VerdictResult,
} from '@/types/evaluation';
import { scoreModForVariant } from '@/utils/modScorer';

const MILESTONES = [1, 3, 6, 9, 12, 15] as const;

// Which primary stats are game-legal on each shape, derived from the
// `allowed_primary_stats` game data (see ModContext). Used by checkPrimary to
// tell a real per-shape exclusion apart from one that would ban a whole shape
// (see the comment there).
export function buildShapePrimaryMap(
  modSlots: ModSlotDefinition[]
): Map<ModShape, Set<number>> {
  const map = new Map<ModShape, Set<number>>();
  for (const slot of modSlots) {
    const shape = slot.shape as ModShape;
    const ids = map.get(shape) ?? new Set<number>();
    for (const s of slot.allowed_primary_stats) ids.add(s.stat_id);
    map.set(shape, ids);
  }
  return map;
}

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
// revealed so the bar is highest (Q=50 ≈ rolls land on their slider targets).
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

// Hard pre-filter, checked before anything else: a mod whose shape isn't in
// the rule's scope never reaches the primary/secondary gates at all. Empty/
// absent `applicable_shapes` means "all shapes" — every evaluation stored
// before this field existed behaves exactly as it did before.
function checkShape(mod: ParsedMod, variant: Variant): boolean {
  if (!variant.applicable_shapes || variant.applicable_shapes.length === 0) {
    return true;
  }
  return variant.applicable_shapes.includes(mod.shape as ModShape);
}

function checkPrimary(
  mod: ParsedMod,
  variant: Variant,
  primaryStatId: number | undefined,
  shapePrimaryMap: Map<ModShape, Set<number>>
): boolean {
  // Defensive: unknown stat id → pass rather than wrongly sell.
  if (primaryStatId === undefined) return true;

  // Not_Wanted rejects; Wanted and Neutral (or unlisted) both pass the gate —
  // a Neutral primary is "not ideal but acceptable", so the secondary gate
  // (checkSecondary) and the Wanted scoring bonus (see modScorer.ts) decide
  // the rest. Not_Wanted is the only classification checked here.
  const classification = variant.primary_classifications[primaryStatId] ?? 'neutral';
  if (classification !== 'not_wanted') return true;

  // A Not_Wanted primary only rejects the mod if the shape has at least one
  // OTHER legal primary that isn't also Not_Wanted. Some shapes (Square,
  // Diamond) have exactly one legal primary, and some rules mark every legal
  // primary of a multi-option shape (e.g. Circle's Health%/Protection%)
  // Not_Wanted without meaning to ban the shape outright. If nothing survives,
  // there's no real preference expressed for this shape — treat it as
  // unconfigured and let it through, rather than silently banning every mod
  // of that shape from ever passing this rule.
  const legalPrimaries = shapePrimaryMap.get(mod.shape as ModShape);
  if (!legalPrimaries || legalPrimaries.size === 0) return true;
  const hasSurvivor = [...legalPrimaries].some(
    (id) => (variant.primary_classifications[id] ?? 'neutral') !== 'not_wanted'
  );
  return !hasSurvivor;
}

type SecondaryCheck = {
  pass: boolean;
  requiredCount: number;
  complementaryCount: number;
  visibleCount: number;
  threshold: number;
  mandatoryMissing: boolean;
};

export function checkSecondary(
  mod: ParsedMod,
  variant: Variant,
  primaryStatId: number | undefined,
  statIdLookup: Map<string, number>
): SecondaryCheck {
  const requiredStatIds = new Set<number>();
  const mandatoryStatIds = new Set<number>();
  for (const [key, classification] of Object.entries(variant.secondary_classifications)) {
    if (classification === 'required') requiredStatIds.add(Number(key));
    else if (classification === 'mandatory') mandatoryStatIds.add(Number(key));
  }

  const visibleSecondaries = mod.secondary_stats.filter(
    (s) => s.is_revealed !== false
  );
  const visibleCount = visibleSecondaries.length;

  const visibleSecondaryIds = new Set<number>();
  let requiredHits = 0;
  let complementaryCount = 0;
  for (const sec of visibleSecondaries) {
    const id = resolveStatId(sec, statIdLookup);
    if (id === undefined) continue;
    visibleSecondaryIds.add(id);
    const c = variant.secondary_classifications[id] ?? 'neutral';
    if (c === 'required') requiredHits++;
    else if (c === 'complementary') complementaryCount++;
  }

  // Mandatory hard gate: each Mandatory stat must show up as a revealed secondary
  // OR be the mod's primary. A satisfied Mandatory stat still counts toward the
  // match tally (including via the primary — unlike a Required stat that is the
  // primary, which is instead subtracted from the reachable pool below).
  let mandatoryHits = 0;
  for (const mid of mandatoryStatIds) {
    if (visibleSecondaryIds.has(mid) || (primaryStatId !== undefined && primaryStatId === mid)) {
      mandatoryHits++;
    }
  }
  const mandatoryMissing = mandatoryHits !== mandatoryStatIds.size;

  // The tally the threshold is compared against: Required hits + satisfied
  // Mandatory stats. Named `requiredCount` on the result for continuity with the
  // fail-reason string, the winner tiebreak, and the Stage-2 coverage discount.
  const matchTally = requiredHits + mandatoryHits;

  // Auto-pass: variant defines no Required AND no Mandatory stats (parallel to
  // the all-Neutral primary rule).
  const poolSize = requiredStatIds.size + mandatoryStatIds.size;
  if (poolSize === 0) {
    return {
      pass: true,
      requiredCount: 0,
      complementaryCount,
      visibleCount,
      threshold: 0,
      mandatoryMissing: false,
    };
  }

  // Threshold = how many pool stats (Required ∪ Mandatory) the mod must hit. The
  // bar scales with the *reachable* pool, not just the presence of the primary:
  //
  //   bar = reachablePoolSize <= 2
  //       ? reachablePoolSize
  //       : max(1, min(visibleCount - 1, reachablePoolSize - 1))
  //
  // - `reachablePoolSize` subtracts the primary only when it is a *Required*
  //   stat (the game blocks the primary from also rolling as a secondary, so it
  //   can never be hit there). A *Mandatory* primary is NOT subtracted — it is
  //   satisfied by the primary and still counts toward `matchTally`.
  // - `visibleCount - 1` is the "3 of 4" ideal — you're allowed to miss one of
  //   the four secondary slots. On a fully-revealed mod this is 3.
  // - `reachablePoolSize - 1` is "allowed to miss one pool stat too". This only
  //   bites when the reachable pool is tight: a big pool (e.g. Defensive's 7,
  //   6 reachable) stays capped at 3, while a tight pool (Offensive's 4, 3
  //   reachable once the primary takes one) eases to 2.
  // - Below reachablePoolSize 3, that same "-1" leniency degenerates into "hit
  //   any 1 of 2" or "hit the 1 of 1" — silently turning a rule authored as
  //   "these 2 stats must BOTH show up" into an OR. So the "-1" allowance only
  //   applies once the reachable pool is 3 or more; at 1 or 2, every reachable
  //   pool stat is demanded, no miss allowed.
  //
  // With no Mandatory stats every quantity above reduces exactly to the old
  // Required-only computation, so zero-Mandatory rules are unchanged.
  const primaryInRequired =
    primaryStatId !== undefined && requiredStatIds.has(primaryStatId);
  const reachablePoolSize = primaryInRequired ? poolSize - 1 : poolSize;

  // Reachable pool empty: the sole pool member IS a Required primary (=> zero
  // Mandatory, Required list of exactly one). The primary satisfies it; the
  // gate passes and direction is decided downstream by complementary coverage
  // + quality. (poolSize === 0 early-return guarantees this isn't an empty rule.)
  if (reachablePoolSize === 0) {
    return {
      pass: true,
      requiredCount: matchTally,
      complementaryCount,
      visibleCount,
      threshold: 0,
      mandatoryMissing: false,
    };
  }

  const threshold =
    reachablePoolSize <= 2
      ? reachablePoolSize
      : Math.max(1, Math.min(visibleCount - 1, reachablePoolSize - 1));

  return {
    pass: !mandatoryMissing && matchTally >= threshold,
    requiredCount: matchTally,
    complementaryCount,
    visibleCount,
    threshold,
    mandatoryMissing,
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

// Caller (evaluateMod) has already filtered to shape-eligible variants via
// checkShape — a rule that doesn't apply to this mod's shape never generates
// a chain result at all, so it can't show up as a confusing "SELL" row in the
// per-rule table for a rule that never actually looked at the mod.
function runVariantChain(
  mod: ParsedMod,
  variant: Variant,
  statIdLookup: Map<string, number>,
  shapePrimaryMap: Map<ModShape, Set<number>>
): VariantChainResult {
  const primaryStatId = resolveStatId(mod.primary_stat, statIdLookup);

  if (!checkPrimary(mod, variant, primaryStatId, shapePrimaryMap)) {
    return {
      kind: 'fail',
      variant,
      requiredCount: 0,
      complementaryCount: 0,
      reason: 'Primary stat is Not Wanted',
    };
  }

  const sec = checkSecondary(mod, variant, primaryStatId, statIdLookup);
  if (!sec.pass) {
    return {
      kind: 'fail',
      variant,
      requiredCount: sec.requiredCount,
      complementaryCount: sec.complementaryCount,
      reason: sec.mandatoryMissing
        ? 'Missing a stat this rule marks Mandatory.'
        : `Matched ${sec.requiredCount} of ${sec.visibleCount} secondaries as Required — this rule needs at least ${sec.threshold}.`,
    };
  }

  return {
    kind: 'pass',
    variant,
    requiredCount: sec.requiredCount,
    complementaryCount: sec.complementaryCount,
  };
}

// Tags the mod's own secondaries with the role a given variant assigns each,
// and lists the variant's full Required / Complementary stat names. Presentation
// data only — the modal renders it so a player can see *which* stats counted.
function buildMatchBreakdown(
  mod: ParsedMod,
  variant: Variant,
  statDefs: StatDefinition[],
  statIdLookup: Map<string, number>
): MatchBreakdown {
  const nameById = new Map<number, string>();
  for (const s of statDefs) {
    nameById.set(s.stat_id, s.is_percentage ? `${s.name} %` : s.name);
  }

  const secondaries = mod.secondary_stats.map((sec) => {
    const id = resolveStatId(sec, statIdLookup);
    const role =
      id !== undefined ? variant.secondary_classifications[id] ?? 'neutral' : 'neutral';
    return {
      stat_name: sec.stat_name,
      display_value: sec.display_value,
      role,
      is_revealed: sec.is_revealed !== false,
    };
  });

  const mandatory_wanted: string[] = [];
  const required_wanted: string[] = [];
  const complementary_wanted: string[] = [];
  for (const [key, classification] of Object.entries(variant.secondary_classifications)) {
    const label = nameById.get(Number(key));
    if (!label) continue;
    if (classification === 'mandatory') mandatory_wanted.push(label);
    else if (classification === 'required') required_wanted.push(label);
    else if (classification === 'complementary') complementary_wanted.push(label);
  }

  return {
    variant_name: variant.name,
    secondaries,
    mandatory_wanted,
    required_wanted,
    complementary_wanted,
  };
}

function toVariantResult(r: VariantChainResult, quality: number | undefined): VariantResult {
  return {
    variant_id: r.variant.id,
    variant_name: r.variant.name,
    verdict: r.kind === 'pass' ? 'PASS' : 'FAIL',
    required_count: r.requiredCount,
    complementary_count: r.complementaryCount,
    reason: r.kind === 'fail' ? r.reason : undefined,
    quality,
  };
}

export function evaluateMod(
  mod: ParsedMod,
  evaluation: Evaluation,
  statDefs: StatDefinition[],
  shapePrimaryMap: Map<ModShape, Set<number>>
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
  // A rule that doesn't apply to this mod's shape never runs at all — it's not
  // a checked-and-rejected result, so it shouldn't appear as one in the table.
  const eligibleVariants = config.variants.filter((v) => checkShape(mod, v));
  const chains = eligibleVariants.map((v) => runVariantChain(mod, v, statIdLookup, shapePrimaryMap));

  const passing = chains.filter((r): r is Extract<VariantChainResult, { kind: 'pass' }> => r.kind === 'pass');

  // Quality is computed once per passing variant here (not just for the
  // eventual winner) so the per-rule table can show every candidate's score —
  // making it clear why one rule beat another when several passed.
  const qualityByVariantId = new Map<string, number>();
  for (const p of passing) {
    qualityByVariantId.set(p.variant.id, scoreModForVariant(mod, p.variant, statDefs));
  }
  const results = chains.map((r) => toVariantResult(r, qualityByVariantId.get(r.variant.id)));

  if (passing.length === 0) {
    // Pick the most-informative failure: highest required_count → closest to passing.
    const sortedFails = [...chains]
      .filter((r): r is Extract<VariantChainResult, { kind: 'fail' }> => r.kind === 'fail')
      .sort((a, b) => b.requiredCount - a.requiredCount);
    const reference = sortedFails[0]?.variant;
    return {
      verdict: 'SELL',
      reason: sortedFails[0]?.reason ?? 'no variant passed',
      all_results: results,
      match_breakdown: reference
        ? buildMatchBreakdown(mod, reference, statDefs, statIdLookup)
        : undefined,
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
    quality: qualityByVariantId.get(p.variant.id) ?? 0,
  }));

  scored.sort((a, b) => {
    if (a.chain.requiredCount !== b.chain.requiredCount) {
      return b.chain.requiredCount - a.chain.requiredCount;
    }
    if (a.chain.complementaryCount !== b.chain.complementaryCount) {
      return b.chain.complementaryCount - a.chain.complementaryCount;
    }
    if (a.quality !== b.quality) {
      return b.quality - a.quality;
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
      absolute_quality: winner.quality,
      all_results: results,
      match_breakdown: buildMatchBreakdown(mod, winner.chain.variant, statDefs, statIdLookup),
    };
  }

  return {
    verdict: 'PASS_RULES',
    winning_variant_id: winner.chain.variant.id,
    winning_variant_name: winner.chain.variant.name,
    absolute_quality: winner.quality,
    all_results: results,
    match_breakdown: buildMatchBreakdown(mod, winner.chain.variant, statDefs, statIdLookup),
  };
}

export function evaluateAll(
  mods: ParsedMod[],
  evaluation: Evaluation,
  statDefs: StatDefinition[],
  modSlots: ModSlotDefinition[]
): Map<string, VerdictResult> {
  const shapePrimaryMap = buildShapePrimaryMap(modSlots);
  const verdicts = new Map<string, VerdictResult>();
  for (const mod of mods) {
    verdicts.set(mod.mod_id, evaluateMod(mod, evaluation, statDefs, shapePrimaryMap));
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

    // Primary-aware threshold relief. Fires when the primary stat is itself a
    // Required OR Mandatory pool stat — in that case the game blocks it from
    // rolling as a secondary, so the *reachable* pool is `(required ∪ mandatory)
    // \ {primary}` when the primary is Required. A Mandatory primary is not
    // subtracted (it's satisfied by the primary and counts toward the tally),
    // matching checkSecondary. The relief scales with how much of that reachable
    // pool the mod hit. With no Mandatory stats this reduces to the old
    // Required-only computation.
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
      const mandatoryIds = new Set<number>();
      for (const [k, c] of Object.entries(winningVariant.secondary_classifications)) {
        if (c === 'required') requiredIds.add(Number(k));
        else if (c === 'mandatory') mandatoryIds.add(Number(k));
      }
      const primaryInRequired =
        primaryStatId !== undefined && requiredIds.has(primaryStatId);
      const primaryInMandatory =
        primaryStatId !== undefined && mandatoryIds.has(primaryStatId);
      if (primaryInRequired || primaryInMandatory) {
        const reachableSize =
          requiredIds.size + mandatoryIds.size - (primaryInRequired ? 1 : 0);
        if (reachableSize > 0) {
          const coverage = Math.min(
            1,
            winningResult.required_count / reachableSize
          );
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
