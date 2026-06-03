import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import { QUALITY_BAND_BOUNDARIES } from './scoringConstants';

export type ModAction = 'level' | 'slice' | 'maxed' | 'pre-eval' | 'sell';

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

// The five player-facing inventory dispositions shown in the overview. Folds
// 'pre-eval' (a mod that must be levelled before it can be judged) into
// 'level', and maps the UNCONFIGURED verdict (actionOf → null) to
// 'unconfigured'.
export type ActionBucket = 'sell' | 'level' | 'slice' | 'maxed' | 'unconfigured';

export function bucketOf(mod: ParsedMod, verdict: VerdictResult): ActionBucket {
  const action = actionOf(mod, verdict);
  if (action === null) return 'unconfigured';
  if (action === 'pre-eval') return 'level';
  return action;
}

// ---------------------------------------------------------------------------
// Per-mod quality band (the slicing advice scale)
//
// A slice-candidate mod's advice is decided entirely by its own
// `absolute_quality` (0-100), split into five equal 20-point bands. There is no
// peer group / cohort: a single mod gets a real verdict, the displayed % always
// matches its band, and filtering never changes a mod's band (only what's shown
// and in what order). Higher band = better slice bet.
// ---------------------------------------------------------------------------

export type QualityBand =
  | 'slice-sure' // 80-100  Gold   "Slice For Sure"
  | 'consider' //   60-80   Purple "Consider"
  | 'average' //    40-60   Blue   "Average"
  | 'consider-sell' // 20-40 Green "Consider Selling"
  | 'sell'; //      0-20    Grey   "Sell"

// Ascending order so index 0 is the lowest band. The boundaries split the
// 0-100 range; a quality lands in the first band whose upper bound it is below.
const BAND_ORDER: QualityBand[] = [
  'sell',
  'consider-sell',
  'average',
  'consider',
  'slice-sure',
];

export function qualityBand(quality: number): QualityBand {
  for (let i = 0; i < QUALITY_BAND_BOUNDARIES.length; i++) {
    if (quality < QUALITY_BAND_BOUNDARIES[i]) return BAND_ORDER[i];
  }
  return BAND_ORDER[BAND_ORDER.length - 1];
}

export interface QualityBandInfo {
  band: QualityBand;
  label: string;
  range: string;
}

// Legend metadata, highest band first (matches how the legend reads top-down).
export const QUALITY_BAND_INFO: QualityBandInfo[] = [
  { band: 'slice-sure', label: 'Slice For Sure', range: '80–100%' },
  { band: 'consider', label: 'Consider', range: '60–80%' },
  { band: 'average', label: 'Average', range: '40–60%' },
  { band: 'consider-sell', label: 'Consider Selling', range: '20–40%' },
  { band: 'sell', label: 'Sell', range: '0–20%' },
];

// Position along the full upgrade journey, used only as a sort tiebreak when two
// mods have equal quality. A 6-dot outranks any 5-dot; color (tier 1-5) breaks
// ties within the same dot count. Higher = more advanced = closer to serving top
// characters, so it ranks first.
export function advancementRank(mod: ParsedMod): number {
  return mod.rarity * 10 + mod.tier;
}
