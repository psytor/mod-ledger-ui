import type { ParsedMod } from '@/services/modLedgerApi';
import type { CalibrationCost } from '@/services/gameDataApi';
import type { SecondaryClassification, VerdictResult } from '@/types/evaluation';
import { curveScore, TIER_MULTIPLIERS, COMPLEMENTARY_WEIGHT_WHEN_EASED } from '@/utils/modScorer';

/**
 * Advisory-only calibration-candidate scoring. See the design doc this was
 * verified against for the full derivation; the short version:
 *
 * Calibrating a mod strips one existing roll from a chosen secondary (picked
 * uniformly among that stat's own rolls, unrelated to that roll's value) and
 * adds a fresh roll to a secondary chosen uniformly among every stat
 * currently under the 5-roll cap AFTER the donor's count drops (the donor is
 * always back in that pool, even if it was at the cap). The player previews
 * the result and can reject it — so a bad reroll never actually happens, but
 * the Attenuator cost and one of a scarce, tier-limited attempt budget are
 * spent either way.
 *
 * Because a bad outcome is always rejectable, the realized value of one
 * attempt is E[max(0, delta)] over the full outcome space, computed PER
 * INDIVIDUAL ROLL of the donor (not the donor's average) — a stat whose
 * average looks fine can still be hiding one badly-rolled slot worth fishing
 * out, and this is the only way to see that.
 */

export type CalibrationPriority = 'prime' | 'worth-a-shot' | 'low-priority';

export interface CalibrationCandidacy {
  priority: CalibrationPriority;
  evPerCost: number;
  donorStatName: string;
  donorRole: SecondaryClassification | 'neutral';
  donorRollEfficiencies: number[];
  donorWorstRollEfficiency: number;
  poolStatNames: { name: string; role: SecondaryClassification | 'neutral' }[];
  nextAttemptNumber: number;
  nextAttemptCost: number;
}

// Fixed thresholds, same status as any other tuned constant (e.g.
// QUALITY_BAND_BOUNDARIES) — calibrated against a real inventory run, not
// derived analytically. evPerCost is always >= 0 (rejecting a bad outcome
// means there is no "risk" tier, only "lower priority than something else").
const PRIME_THRESHOLD = 1.8;
const WORTH_A_SHOT_THRESHOLD = 0.8;

// Fresh-roll efficiency is modeled as uniform over [0, 1]; this fixed grid
// approximates E_v[...] well enough at negligible cost (this runs once per
// mod per verdict recompute, not per render).
const V_SAMPLE_COUNT = 150;
const V_SAMPLES: number[] = Array.from(
  { length: V_SAMPLE_COUNT },
  (_, i) => (i + 0.5) / V_SAMPLE_COUNT
);

function roleWeight(
  role: SecondaryClassification | 'neutral',
  primaryEasesComplementary: boolean
): number {
  if (role === 'complementary' && primaryEasesComplementary) {
    return COMPLEMENTARY_WEIGHT_WHEN_EASED;
  }
  return TIER_MULTIPLIERS[role];
}

// E_v[max(0, weightY * curveScore(v, targetY) - threshold)] for v ~ Uniform(0,1).
function expectedPositiveGain(weightY: number, targetY: number, threshold: number): number {
  let total = 0;
  for (const v of V_SAMPLES) {
    const gain = weightY * curveScore(v, targetY) - threshold;
    if (gain > 0) total += gain;
  }
  return total / V_SAMPLE_COUNT;
}

type StatFacts = {
  statName: string;
  role: SecondaryClassification | 'neutral';
  target: number;
  rolls: number;
  rollEfficiencies: number[];
};

function priorityOf(evPerCost: number): CalibrationPriority {
  if (evPerCost >= PRIME_THRESHOLD) return 'prime';
  if (evPerCost >= WORTH_A_SHOT_THRESHOLD) return 'worth-a-shot';
  return 'low-priority';
}

/**
 * Returns null whenever the mod isn't a real calibration candidate: wrong
 * rarity, no attempts left, no reference rule to judge roles/targets against
 * (an UNCONFIGURED mod has no match_breakdown), or no secondary with enough
 * rolls to donate from at all.
 */
export function computeCalibrationCandidacy(
  mod: ParsedMod,
  verdict: VerdictResult | undefined,
  calibrationCosts: CalibrationCost[]
): CalibrationCandidacy | null {
  if (mod.rarity !== 6) return null;
  if (mod.calibrations_left === undefined || mod.calibrations_left <= 0) return null;
  const breakdown = verdict?.match_breakdown;
  if (!breakdown) return null;

  const nextAttemptNumber = (mod.reroll_count ?? 0) + 1;
  const nextAttemptCost = calibrationCosts.find(
    (c) => c.attempt_number === nextAttemptNumber
  )?.cost;
  if (nextAttemptCost === undefined) return null;

  // breakdown.secondaries is built from mod.secondary_stats.map(...) in
  // buildMatchBreakdown, so it stays index-aligned with mod.secondary_stats —
  // zip by index rather than re-resolving stat ids here.
  const length = Math.min(mod.secondary_stats.length, breakdown.secondaries.length);
  const stats: StatFacts[] = [];
  for (let i = 0; i < length; i++) {
    const sec = mod.secondary_stats[i];
    const role = breakdown.secondaries[i];
    if (sec.is_revealed === false) continue;
    const rollEfficiencies = sec.roll_efficiencies ?? [];
    const rolls = sec.rolls ?? rollEfficiencies.length;
    stats.push({
      statName: sec.stat_name,
      role: role.role,
      target: role.target,
      rolls,
      rollEfficiencies,
    });
  }

  const donorCandidates = stats.filter((s) => s.rolls >= 2 && s.rollEfficiencies.length >= 2);
  if (donorCandidates.length === 0) return null;

  const primaryEasesComplementary = breakdown.primary_eases_complementary;

  let best: { donor: StatFacts; evPerCost: number; poolStats: StatFacts[] } | null = null;

  for (const donor of donorCandidates) {
    const poolStats = stats.filter((s) => {
      const rollsAfter = s === donor ? s.rolls - 1 : s.rolls;
      return rollsAfter < 5;
    });
    const poolSize = poolStats.length;
    if (poolSize === 0) continue;

    const donorWeight = roleWeight(donor.role, primaryEasesComplementary);

    let evTotal = 0;
    for (const rollEff of donor.rollEfficiencies) {
      const threshold = donorWeight * curveScore(rollEff / 100, donor.target);
      let perRoll = 0;
      for (const dest of poolStats) {
        const destWeight = roleWeight(dest.role, primaryEasesComplementary);
        perRoll += expectedPositiveGain(destWeight, dest.target, threshold);
      }
      evTotal += perRoll / poolSize;
    }
    const ev = evTotal / donor.rollEfficiencies.length;
    const evPerCost = ev / nextAttemptCost;

    if (!best || evPerCost > best.evPerCost) {
      best = { donor, evPerCost, poolStats };
    }
  }

  if (!best) return null;

  return {
    priority: priorityOf(best.evPerCost),
    evPerCost: best.evPerCost,
    donorStatName: best.donor.statName,
    donorRole: best.donor.role,
    donorRollEfficiencies: best.donor.rollEfficiencies,
    donorWorstRollEfficiency: Math.min(...best.donor.rollEfficiencies),
    poolStatNames: best.poolStats.map((s) => ({ name: s.statName, role: s.role })),
    nextAttemptNumber,
    nextAttemptCost,
  };
}

export interface CalibrationExplanation {
  label: string;
  priority: string;
  action: string;
  detail: string;
  nextStep: string;
}

export interface CalibrationPriorityInfo {
  priority: CalibrationPriority;
  label: string;
  priorityText: string;
  action: string;
}

// Highest-priority-first, same convention as QUALITY_BAND_INFO — drives both
// the InventoryReadout chips and this file's own explain/tooltip text.
export const CALIBRATION_PRIORITY_INFO: CalibrationPriorityInfo[] = [
  {
    priority: 'prime',
    label: 'Prime',
    priorityText: 'Top Priority',
    action: 'Worth spending an Attenuator on now',
  },
  {
    priority: 'worth-a-shot',
    label: 'Worth a Shot',
    priorityText: 'Worth Trying',
    action: 'A reasonable use of an Attenuator when you have one to spare',
  },
  {
    priority: 'low-priority',
    label: 'Low Priority',
    priorityText: 'Low Priority',
    action: 'Only worth it if nothing else on your roster needs the Attenuator more',
  },
];

const PRIORITY_INFO: Record<CalibrationPriority, CalibrationPriorityInfo> = Object.fromEntries(
  CALIBRATION_PRIORITY_INFO.map((info) => [info.priority, info])
) as Record<CalibrationPriority, CalibrationPriorityInfo>;

function roleLabel(role: SecondaryClassification | 'neutral'): string {
  switch (role) {
    case 'mandatory': return 'Mandatory';
    case 'required': return 'Required';
    case 'complementary': return 'Complementary';
    case 'neutral': return 'Neutral';
  }
}

export function explainCalibration(candidacy: CalibrationCandidacy): CalibrationExplanation {
  const info = PRIORITY_INFO[candidacy.priority];
  const poolNames = candidacy.poolStatNames.map((p) => p.name).join(', ');
  return {
    label: info.label,
    priority: info.priorityText,
    action: info.action,
    detail: `Strip ${candidacy.donorStatName} (${roleLabel(candidacy.donorRole)}) — its weakest roll is ${candidacy.donorWorstRollEfficiency.toFixed(1)}%. Hoping the reroll lands on: ${poolNames}. Since a bad reroll can always be rejected, there's no downside to trying — only whether it beats spending the Attenuator elsewhere.`,
    nextStep: `Next attempt (#${candidacy.nextAttemptNumber}) costs ${candidacy.nextAttemptCost} Micro Attenuators.`,
  };
}

export function calibrationTooltip(candidacy: CalibrationCandidacy): string {
  const exp = explainCalibration(candidacy);
  return [`${exp.label} — ${exp.priority}`, exp.detail, exp.nextStep].join('\n');
}
