// Verdicts emitted by the variant engine.
// Slicing pipeline (downstream) splits PASS_RULES into KEEP/SLICE.
export type Verdict = 'SELL' | 'UPGRADE' | 'PASS_RULES' | 'UNCONFIGURED';

export type PrimaryClassification = 'wanted' | 'not_wanted' | 'neutral';
export type SecondaryClassification = 'required' | 'complementary' | 'neutral';

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
};

export type ModSetConfig = {
  set_id: number;
  variants: Variant[]; // Insertion order is the sub-tiebreak when verdicts tie.
};

export type Evaluation = {
  id: string;
  // Matches astrogators-table users.id (Integer). null = local/unauth record.
  ownerUserId: number | null;
  isPublic: boolean;
  name: string;
  description: string;
  mod_set_configs: ModSetConfig[];
  // Editor-level master values that opted-in variants follow. Same shape as
  // Variant.secondary_targets. Empty {} means "all sliders at default".
  master_secondary_targets: Record<number, number>;
  createdAt: number;
  updatedAt: number;
};

export type VariantResult = {
  variant_id: string;
  variant_name: string;
  verdict: Extract<Verdict, 'SELL' | 'PASS_RULES'>;
  required_count: number;
  complementary_count: number;
  reason?: string;
};

export type VerdictResult = {
  verdict: Verdict;
  target_level?: number;          // Set when verdict === 'UPGRADE'
  winning_variant_id?: string;    // Set when a variant produced the winning verdict
  winning_variant_name?: string;
  reason?: string;
  all_results?: VariantResult[];  // Per-variant breakdown for debug / UI
  score?: number;                 // Raw score, set by modScorer when a winning variant exists
  absolute_quality?: number;      // 0-100, raw_score / theoretical_max under the winning variant
};
