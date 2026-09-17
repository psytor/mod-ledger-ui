// Plain-language explanations for evaluation verdicts.
//
// The engine (evaluationEngine.ts) emits terse verdicts and only attaches a
// `reason` string on failures. This module turns any VerdictResult into
// user-facing prose — used by the ModCard badge tooltip and the detail modal.
import type { VerdictResult } from '@/types/evaluation';
import { qualityBandLabel, type QualityBand } from '@/utils/modDisposition';

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
  /**
   * True when this SELL mod passes the "FOR PILOT" relabel gate (built + L15).
   * Reframes the SELL prose around pilot use. Computed by the caller via
   * isPilotMod — verdictExplain never derives it.
   */
  isPilot?: boolean;
  /**
   * The mod's letter grade (S/A/B/C/D/F), when it has a score. Computed by
   * the caller via qualityBand — verdictExplain never derives it. Used to
   * name the grade in a SELL's `label`/`meaning` instead of the bare word
   * "Sell"; absent (or null) only when there's no score at all yet.
   */
  band?: QualityBand | null;
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
      // The letter grade, when there's a score — names the grade in the
      // headline/meaning instead of the bare word "Sell". Absent only for
      // the narrower case where the mod has no score at all (pre-eval, or
      // the instant "N-dot, no longer farmable" sell a few lines up, which
      // never reaches this branch since it returns earlier in the engine).
      const grade = mod?.band ? qualityBandLabel(mod.band) : null;

      // A built mod that fails the rules is still a great pilot mod — a ship
      // draws power from dots + level, not stats. Lead with that framing.
      if (mod?.isPilot) {
        return {
          label: 'For pilot',
          meaning:
            'This mod does not meet your current scoring rules, but it is already fully built (L15) — and a ship gains power from a mod’s dots and level, not its stats. That makes it a great pilot mod.' +
            (grade
              ? ` The “Grade ${grade}” next to it is a read on how well it rolled against your rules — a separate number from this mod’s own Tier rating above, and irrelevant for pilot use either way, since a pilot only cares about dots and level.`
              : ''),
          detail: v.reason ?? null,
          nextStep:
            'If one of your pilots needs a mod, use this one. Open the mod and “Assign to a pilot” to keep it out of the Sell pile.',
          caveat:
            'Until you assign it, it stays in the Sell bucket. Assigning is reversible — you can unassign and put it on a character later.',
        };
      }

      // Road 2 — quality-gate SELL: the mod DID match a scoring rule, but its
      // roll quality fell below the bar for its current level (Stage 2 flipped
      // UPGRADE → SELL). Only 5-dot mods below L15 reach this path.
      // Distinguished from a no-rule-matched SELL (Road 1) by the presence of
      // a winning variant — without this branch the headline wrongly reads
      // "does not meet any of your current scoring rules" while the modal
      // shows the matched rule below.
      //
      // No sell/keep directive here on purpose: this is a grade describing
      // how the rolls compare to your targets, not a command. Beta feedback
      // was specific about this — a flat "sell it" reads as certain, when
      // the tool only knows what it's been told to look for.
      if (v.winning_variant_name) {
        const q =
          v.absolute_quality !== undefined ? Math.round(v.absolute_quality) : undefined;
        return {
          label: grade ?? 'Sell',
          meaning:
            `This mod matches your “${v.winning_variant_name}” rule` +
            (grade ? `, graded ${grade}` : '') +
            ` — its roll quality${q !== undefined ? ` (${q}/100)` : ''} is below the bar ` +
            `for its current level.`,
          detail: v.reason ?? null,
          nextStep:
            'It’s sitting in your Sell pile because the rolls haven’t caught up yet at ' +
            'this level — not because the rule is wrong about the mod. Keep leveling it ' +
            'if you’d rather give it more rolls, or let it go if you’d rather not.',
          caveat:
            'The grade describes the rolls against your current targets — it isn’t a ' +
            'final call on the mod. A tweaked target or a different rule might read it ' +
            'differently.',
        };
      }

      // Road 1 — no rule matched at all. A 6-dot mod is a fully sliced mod
      // (significant materials sunk in), so lead with the investment.
      const invested = mod?.rarity === 6;
      const caveat =
        (invested
          ? 'You invested a lot to bring this mod to 6 dots, so there’s no rush to let it go. '
          : '') +
        'This is a read against your current scoring rules, not a verdict on the mod ' +
        'itself — it may still suit a character that wants these stats together, or work ' +
        'well as a ship-pilot mod either way: a ship gains power from a mod’s dots and ' +
        'level, not its secondary stats.';
      return {
        label: grade ?? 'Sell',
        meaning: grade
          ? `This mod doesn’t match any of your current scoring rules — graded ${grade} ` +
            `against the rule it came closest to.`
          : 'This mod does not meet any of your current scoring rules.',
        detail: v.reason ?? null,
        nextStep:
          'It’s sitting in your Sell pile because nothing currently claims it. Tune or add ' +
          'a rule if you think it deserves better' +
          (invested ? ' — otherwise there’s no rush to let it go.' : ', or let it go.'),
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

// Plain-language explanation of the 0-100 quality score (`absolute_quality`).
//
// The score answers ONE question: how close did this mod's rolls land to the
// targets you set? In curveScore a single roll scores 50 when it hits your
// target — so 50 = rolls met your targets, above 50 = beat them, below 50 =
// fell short. It is NOT an average, and NOT a percentage. (See modDisposition.)
//
// `note` makes the distinction that trips players up: the score measures roll
// quality, which is separate from whether the mod matched your rule. A mod can
// hit every Required stat your rule asks for and still score low here if those
// rolls came up weak. Boundaries (45 / 65) align with the "B" grade band.
export function explainQualityScore(quality: number): { line: string; note: string } {
  const q = Math.round(quality);
  const rel =
    q >= 65 ? 'beat the targets you set'
    : q < 45 ? 'fell short of the targets you set'
    : 'met the targets you set';
  return {
    line:
      `Roll quality ${q}/100 — your rolls ${rel}. ` +
      `50 means the rolls hit your targets, above 50 means they beat them, ` +
      `below 50 means they fell short. It scores how good the rolls are, not ` +
      `how many stats matched.`,
    note:
      'Matching your rule and rolling well are two different things — a mod can ' +
      'have every Required stat and still score low here if those rolls came up weak.',
  };
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
