import type { ModShape } from '@/utils/modSpriteConfig';

// Verdicts emitted by the variant engine.
// Slicing pipeline (downstream) splits PASS_RULES into KEEP/SLICE.
export type Verdict = 'SELL' | 'UPGRADE' | 'PASS_RULES' | 'UNCONFIGURED';

export type PrimaryClassification = 'wanted' | 'not_wanted' | 'neutral';
// 'mandatory' is 'required' plus a hard gate: the stat must appear on the mod
// as a revealed secondary OR be the mod's primary, or the variant fails — no
// "miss one" grace. A satisfied mandatory stat still counts toward the match
// tally (including when it's the primary). Authored in the rule builder as a
// pin on a Required chip; the chip cycle itself never lands on it.
export type SecondaryClassification =
  | 'required'
  | 'mandatory'
  | 'complementary'
  | 'neutral';

// Classifications are keyed by stat_id (number). Stat names are NOT unique —
// e.g. flat "Health" (id 1) and percent "Health" (id 55) collide.
// Stats absent from the map default to 'neutral'.
export type Variant = {
  id: string;
  name: string;
  cloned_from?: string;
  template_id?: string;
  primary_classifications: Record<number, PrimaryClassification>;
  secondary_classifications: Record<number, SecondaryClassification>;
  // Per-secondary-stat target efficiency in [0, 1]. Stats absent default to 0.5.
  // Slider UI clamps stored values to [0.01, 0.99]; modScorer guards 0/1 anyway.
  secondary_targets: Record<number, number>;
  // When true, the rule builder mirrors evaluation.master_secondary_targets into
  // this variant's secondary_targets on every master change. Purely an editor
  // convenience — modScorer always reads secondary_targets directly.
  uses_master_targets: boolean;
  // Shapes this rule applies to. Empty/absent = all shapes (default — matches
  // every evaluation stored before this field existed). Checked before
  // anything else in the variant chain: a mod of an excluded shape never
  // reaches the primary/secondary gates at all.
  applicable_shapes?: ModShape[];
};

export type ModSetConfig = {
  set_id: number;
  variants: Variant[]; // Insertion order is the sub-tiebreak when verdicts tie.
};

// Snapshot of the original author, captured at export time and carried with
// imported copies. Denormalized into the JSON because the recipient has no
// way to look up astrogators-table at Phase 1. userId is a string to match
// shared-ui's User.id type (the auth context exposes id as a string).
export type EvaluationAuthor = {
  userId: string | null;
  username: string | null;
};

// Visibility levels: mirrors the backend enum.
// - private: owner-only (the default)
// - protocol: admin-curated, anyone can Use or copy
// - manifest: reserved for the future user-shared surface; no UI yet.
export type EvaluationVisibility = 'private' | 'protocol' | 'manifest';

export type Evaluation = {
  id: string;
  // Matches astrogators-table users.id (Integer). null = local/unauth record.
  ownerUserId: number | null;
  visibility: EvaluationVisibility;
  // Bumps on every save server-side. Local-only records use 1.
  version: number;
  name: string;
  description: string;
  mod_set_configs: ModSetConfig[];
  // Editor-level master values that opted-in variants follow. Same shape as
  // Variant.secondary_targets. Empty {} means "all sliders at default".
  master_secondary_targets: Record<number, number>;
  authoredBy: EvaluationAuthor | null;
  createdAt: number;
  updatedAt: number;
};

// A single rule's own outcome for a mod — distinct from the overall Verdict:
// "FAIL" here means "this one rule didn't match", not "sell this mod" (the
// mod may still pass a different rule in the same set).
export type PerRuleVerdict = 'PASS' | 'FAIL';

export type VariantResult = {
  variant_id: string;
  variant_name: string;
  verdict: PerRuleVerdict;
  required_count: number;
  complementary_count: number;
  reason?: string;
  // absolute_quality under this rule specifically, only computed for a rule
  // this mod actually passed — lets the UI show why one passing rule beat
  // another instead of only exposing the eventual winner's score.
  quality?: number;
};

// One of the mod's own secondaries, tagged with the role the reference rule
// assigns it. Presentation only — lets the modal show *which* stats counted.
// `stat_id`/`target` are additive (calibrationAdvisor.ts): since this array is
// built via `mod.secondary_stats.map(...)` in buildMatchBreakdown, it stays
// index-aligned with `ParsedMod.secondary_stats` — callers needing both the
// role/target AND the roll data (rolls/roll_efficiencies) zip the two arrays
// by index rather than re-resolving stat ids themselves.
export type SecondaryRole = {
  stat_name: string;
  display_value: string;        // e.g. "+15" / "+2.12%"
  role: SecondaryClassification; // 'required' | 'mandatory' | 'complementary' | 'neutral'
  is_revealed: boolean;
  stat_id: number;
  target: number;                // variant.secondary_targets[stat_id] ?? DEFAULT_TARGET (0.5)
};

// Per-mod breakdown against the reference rule (the winner on a pass, or the
// closest-fail rule on a sell — whichever drives the verdict's `reason`).
// Built at eval time so the modal needn't reach back into the Evaluation.
export type MatchBreakdown = {
  variant_name: string;
  secondaries: SecondaryRole[];       // the mod's secondaries, role-tagged
  mandatory_wanted: string[];         // stat names the rule marks Mandatory
  required_wanted: string[];          // stat names the rule marks Required
  complementary_wanted: string[];     // stat names the rule marks Complementary
  // True when the reference variant's primary classification is 'required' or
  // 'mandatory' — the same "eased Complementary weight" signal modScorer.ts
  // and evaluationEngine.ts's applyQualityGates each already compute for
  // their own purposes. Carried here so calibrationAdvisor.ts can reuse the
  // exact same weighting without re-deriving it from the raw Variant.
  primary_eases_complementary: boolean;
};

export type VerdictResult = {
  verdict: Verdict;
  target_level?: number;          // Set when verdict === 'UPGRADE'
  winning_variant_id?: string;    // Set when a variant produced the winning verdict
  winning_variant_name?: string;
  reason?: string;
  all_results?: VariantResult[];  // Per-variant breakdown for debug / UI
  absolute_quality?: number;      // 0-100, raw_score / theoretical_max under the winning variant
  match_breakdown?: MatchBreakdown; // Which secondaries the reference rule wanted (UI only)
};
