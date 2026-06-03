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
  absolute_quality?: number;      // 0-100, raw_score / theoretical_max under the winning variant
};
