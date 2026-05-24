// Tunable thresholds for the action-band UI. Hardcoded for now —
// revisit after we see real distributions in production.

// Slicing: percentile cutoffs within (stage, variant) cohort.
export const PUSH_PERCENTILE_THRESHOLD = 70;
export const SELL_PERCENTILE_THRESHOLD = 30;

// Slicing: absolute_quality floor/ceiling. The percentile-based band only
// fires when these are also satisfied — so a "best of a bad lot" doesn't
// become Push and a "worst of a brilliant lot" doesn't become Consider Selling.
export const PUSH_ABSOLUTE_FLOOR = 45;
export const SELL_ABSOLUTE_CEILING = 65;

// Minimum cohort size for a percentile to be meaningful. Singletons get
// no relative_position; the UI shows absolute_quality only.
export const MIN_COHORT_SIZE_FOR_RANKING = 2;

// Slicing — "Overall" cross-stage view: absolute_quality band thresholds.
// NOT percentile-based — the chip labels a mod purely on its own quality so
// it stays consistent with that list's absolute-% ordering (a mod isn't
// demoted to "Keep" just because better mods share its stage). Same edges as
// the relative bands' absolute guardrails: ≥65 = Slice, <45 = Consider Selling.
export const OVERALL_PUSH_QUALITY = 65;
export const OVERALL_SELL_QUALITY = 45;
