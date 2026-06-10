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

// The disposition-strip filter axis. Extends the verdict-derived ActionBucket
// with 'for-pilot' — an OVERLAY membership (the mods the user has assigned to
// the pilot pool), NOT a verdict. A mod can be in 'for-pilot' and its verdict
// bucket at once; only a SELL verdict is diverted out of Sell when assigned.
export type BucketFilter = ActionBucket | 'for-pilot';

// Layer-1 "FOR PILOT" relabel gate (display only, no persistence). A mod the
// engine flags SELL but that is already fully built is still a fine pilot mod —
// a ship draws power from a mod's dots + level, not its secondary stats — so we
// relabel its SELL badge to "FOR PILOT". Gate = already-built and pilot-ready:
// a 6-dot L15, or a 5-dot Gold (A-tier) L15 (one slice from a 6-dot pilot mod).
// Lower-investment SELL mods still read SELL — no reason to sink more materials.
export function isPilotMod(mod: ParsedMod, verdict: VerdictResult): boolean {
  if (verdict.verdict !== 'SELL') return false;
  if (mod.level !== 15) return false;
  if (mod.rarity === 6) return true;
  return mod.rarity === 5 && mod.tier_name === 'A';
}

// ---------------------------------------------------------------------------
// Per-mod quality band (the slicing advice scale)
//
// A slice-candidate mod's advice is decided entirely by its own
// `absolute_quality` (0-100): how close its rolls came to the targets YOU set.
// In `curveScore` a roll scores 50 when it lands on your target, so on the
// mod's overall score 50 = "rolls met your targets — this mod already does what
// you want, so push it forward", above 50 = "rolls beat your targets" (your
// best bets), and below 50 = "rolls fell short". 50 is the TARGET, not an
// average. The score splits into five even 20-point bands mapped to the game's
// quality colours (Grey → Green → Blue → Purple → Gold); the band holding 50 is
// "On Target", a green light — never "Average". There is no peer group /
// cohort: a single mod gets a real verdict, the displayed value always matches
// its band, and filtering never changes a mod's band (only what's shown and in
// what order). Higher band = closer to / further past your targets = better
// slice bet.
// ---------------------------------------------------------------------------

export type QualityBand =
  | 'perfect' //       80-100  Gold   "Elite"     (Top Priority  — rolls far beat your targets)
  | 'nearly-perfect' // 60-80  Purple "Strong"    (High Priority — rolls beat your targets)
  | 'on-target' //     40-60   Blue   "On Target" (Priority      — 50 = rolls hit your targets)
  | 'under-target' //  20-40   Green  "Weak"      (Low Priority  — rolls fell short)
  | 'bad'; //          0-20    Grey   "Poor"      (Skip          — rolls well short)

// Ascending order so index 0 is the lowest band. The boundaries split the
// 0-100 range; a quality lands in the first band whose upper bound it is below.
const BAND_ORDER: QualityBand[] = [
  'bad',
  'under-target',
  'on-target',
  'nearly-perfect',
  'perfect',
];

export function qualityBand(quality: number): QualityBand {
  for (let i = 0; i < QUALITY_BAND_BOUNDARIES.length; i++) {
    if (quality < QUALITY_BAND_BOUNDARIES[i]) return BAND_ORDER[i];
  }
  return BAND_ORDER[BAND_ORDER.length - 1];
}

export interface QualityBandInfo {
  band: QualityBand;
  /** One-word label shown on the card chip (Elite / Strong / On Target / Weak / Poor). */
  label: string;
  /** Score range on the 0-100 quality scale, e.g. "80–100". No "%" — the score
   *  is a quality score where 50 = on target, not a percentage. */
  range: string;
  /**
   * Slicing priority. The target band ("On Target", 40-60) is "Priority" — a
   * full yes, the actual goal — NOT "medium". The bands above stack Top/High
   * Priority on top of it (bonus past target); below it falls off to Low / Skip.
   */
  priority: string;
  /** Plain-language slicing instruction for the legend + tooltips. */
  action: string;
}

// Legend metadata, highest band first (matches how the legend reads top-down).
// label = card chip word; priority + action surface in the legend and tooltips.
export const QUALITY_BAND_INFO: QualityBandInfo[] = [
  { band: 'perfect',        label: 'Elite',     range: '80–100', priority: 'Top Priority',  action: 'Slice this first' },
  { band: 'nearly-perfect', label: 'Strong',    range: '60–80',  priority: 'High Priority', action: 'Slice soon' },
  { band: 'on-target',      label: 'On Target', range: '40–60',  priority: 'Priority',      action: 'Already meets your bar — slice normally' },
  { band: 'under-target',   label: 'Weak',      range: '20–40',  priority: 'Low Priority',  action: 'Slice only if you have spare materials' },
  { band: 'bad',            label: 'Poor',      range: '0–20',   priority: 'Skip',          action: 'Not worth your materials' },
];

const BAND_INFO = Object.fromEntries(
  QUALITY_BAND_INFO.map((b) => [b.band, b])
) as Record<QualityBand, QualityBandInfo>;

// Card chip word (Elite / Strong / On Target / Weak / Poor).
export function qualityBandLabel(band: QualityBand): string {
  return BAND_INFO[band].label;
}

// Slicing priority (Top Priority / High Priority / Priority / Low Priority / Skip).
// "On Target" is "Priority" — the goal, not a middling tier.
export function qualityBandPriority(band: QualityBand): string {
  return BAND_INFO[band].priority;
}

// Plain-language slicing instruction shown in tooltips and the detail modal.
export function qualityBandAction(band: QualityBand): string {
  return BAND_INFO[band].action;
}

// Position along the full upgrade journey, used only as a sort tiebreak when two
// mods have equal quality. A 6-dot outranks any 5-dot; color (tier 1-5) breaks
// ties within the same dot count. Higher = more advanced = closer to serving top
// characters, so it ranks first.
export function advancementRank(mod: ParsedMod): number {
  return mod.rarity * 10 + mod.tier;
}
