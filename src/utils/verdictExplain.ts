// Plain-language explanations for evaluation verdicts.
//
// The engine (evaluationEngine.ts) emits terse verdicts and only attaches a
// `reason` string on failures. This module turns any VerdictResult into
// user-facing prose — used by the ModCard badge tooltip and the detail modal.
import type { VerdictResult } from '@/types/evaluation';

export interface VerdictExplanation {
  /** Short headline for the verdict (tooltip title). */
  label: string;
  /** What this verdict means, independent of the specific mod. */
  meaning: string;
  /** Why THIS mod got the verdict — null when there's nothing mod-specific. */
  detail: string | null;
  /** Recommended next action. */
  nextStep: string;
  /**
   * Softening context shown beneath the next step — e.g. that a sell-rated mod
   * may still suit another character or a ship pilot. Absent when there's no
   * caveat to add.
   */
  caveat?: string;
}

// Minimal mod facts verdictExplain needs for tone — not the full ParsedMod, and
// never used to re-derive the verdict (presentation only).
export interface ExplainModContext {
  /** 5 or 6. A 6-dot mod represents heavy player investment (a fully sliced mod). */
  rarity: number;
}

// Describes the winning scoring rule and how thoroughly the mod matched it.
function buildMatchDetail(v: VerdictResult): string | null {
  if (!v.winning_variant_name) return null;
  const win = v.all_results?.find((r) => r.variant_id === v.winning_variant_id);
  const parts: string[] = [`Matches scoring rule “${v.winning_variant_name}”`];
  if (win) {
    const segs: string[] = [`${win.required_count} required`];
    if (win.complementary_count > 0) {
      segs.push(`${win.complementary_count} complementary`);
    }
    const total = win.required_count + win.complementary_count;
    parts.push(`hit ${segs.join(' + ')} secondary ${total === 1 ? 'stat' : 'stats'}`);
  }
  if (v.absolute_quality !== undefined) {
    parts.push(`overall quality ${Math.round(v.absolute_quality)}/100`);
  }
  return parts.join(' — ') + '.';
}

export function explainVerdict(
  v: VerdictResult,
  mod?: ExplainModContext,
): VerdictExplanation {
  switch (v.verdict) {
    case 'UNCONFIGURED':
      return {
        label: 'Not evaluated',
        meaning:
          'No scoring rule has been defined for this mod’s set, so the engine has nothing to judge it against.',
        detail: null,
        nextStep: 'Add a scoring rule for this set in the Rule Builder to evaluate it.',
      };

    case 'SELL': {
      // A 6-dot mod is a fully sliced mod — significant materials sunk in — so
      // we soften the call to action and lead with the investment.
      const invested = mod?.rarity === 6;
      const caveat =
        (invested
          ? 'You invested a lot to bring this mod to 6 dots, so do not rush to let it go. '
          : '') +
        'This is a verdict against your current scoring rules, not the mod itself — it may still suit a character that wants these stats together. If none does, it makes a fine ship-pilot mod either way: a ship gains power from a mod’s dots and level, not its secondary stats.';
      return {
        label: 'Sell',
        meaning: 'This mod does not meet any of your current scoring rules.',
        detail: v.reason ?? null,
        nextStep: invested
          ? 'Based on your current evaluation, keep it for now — or sell for credits if you have no use for it.'
          : 'Based on your current evaluation, this mod is safe to sell for credits.',
        caveat,
      };
    }

    case 'UPGRADE': {
      const preEval = !v.winning_variant_id;
      return {
        label: v.target_level ? `Level to L${v.target_level}` : 'Upgrade',
        meaning: preEval
          ? 'This mod has not revealed enough secondary stats yet to be judged against your rules.'
          : 'This mod currently matches one of your scoring rules and is worth leveling further.',
        detail: preEval ? (v.reason ?? null) : buildMatchDetail(v),
        nextStep: v.target_level
          ? `Level it to L${v.target_level}, then it is re-evaluated automatically.`
          : 'Level it further to continue.',
      };
    }

    case 'PASS_RULES':
      return {
        label: 'Pass',
        meaning: 'This mod meets your scoring rules — it is a keeper.',
        detail: buildMatchDetail(v),
        nextStep: 'Keep it.',
      };
  }
}

// Compact multi-line string for a native `title` tooltip.
export function verdictTooltip(v: VerdictResult, mod?: ExplainModContext): string {
  const exp = explainVerdict(v, mod);
  const lines = [exp.label, exp.meaning];
  if (exp.detail) lines.push('', exp.detail);
  lines.push('', `→ ${exp.nextStep}`);
  if (exp.caveat) lines.push('', exp.caveat);
  return lines.join('\n');
}
