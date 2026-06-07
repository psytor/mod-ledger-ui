// Quality-band boundaries for the per-mod slicing advice scale.
//
// Advice is derived purely from a mod's own `absolute_quality` (0-100) — there
// is no cross-mod comparison. The score answers ONE question: how close did the
// mod's rolls get to the targets YOU configured? In `curveScore` a single roll
// scores exactly 50 when it lands on your target (0 at nothing, 100 at a perfect
// max roll), so `absolute_quality` — the weighted mean of those roll scores —
// reads:
//
//   50  = the rolls hit the targets you asked for. This mod already does what
//         you want — push it forward (slice it).
//   >50 = the rolls BEAT your targets. Your best bets.
//   <50 = the rolls fell short of your targets.
//
// 50 is the TARGET (your success line), NOT "an average roll". The five even
// 20-point bands map to the game's own quality colours (Gold → Purple → Blue →
// Green → Grey); the band that contains 50 ("On Target", 40-60) is a green
// light, never "Average". Still a fixed per-mod scale, not a live cohort
// percentile. See `qualityBand` in modDisposition.ts. Boundaries are ascending;
// a value lands in the lowest band whose upper bound it is below (>= 80 is the
// top band).
export const QUALITY_BAND_BOUNDARIES = [20, 40, 60, 80] as const;
