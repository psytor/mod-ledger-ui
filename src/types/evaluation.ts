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
  score?: number;                 // Set by modScorer when a winning variant exists
};
