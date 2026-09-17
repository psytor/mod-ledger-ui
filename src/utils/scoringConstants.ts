// Quality-band boundaries for the per-mod letter grade (S/A/B/C/D/F).
//
// The grade is derived purely from a mod's own `absolute_quality` (0-100) —
// there is no cross-mod comparison. The score answers ONE question: how close
// did the mod's rolls get to the targets YOU configured? In `curveScore` a
// single roll scores exactly 50 when it lands on your target (0 at nothing,
// 100 at a perfect max roll), so `absolute_quality` — the weighted mean of
// those roll scores — reads:
//
//   50  = the rolls hit the targets you asked for. This mod already does what
//         you want — push it forward (slice it).
//   >50 = the rolls BEAT your targets. Your best bets.
//   <50 = the rolls fell short of your targets.
//
// 50 is the TARGET (your success line), NOT "an average roll".
//
// The six bands are deliberately UNEVEN, not a straight 100/6 split. A plain
// even split would land 50 inside the middle letter (C) — and "C" reads as
// mediocre in both school-grade and gaming-tier-list culture, which is
// exactly the "this mod is bad" anxiety the letter grades exist to remove.
// Instead the boundaries are chosen so 50 sits inside B — a grade that reads
// as unambiguously good everywhere — matching the same "on target = a real
// yes, never a middling tier" rule this scale has always followed. See
// `qualityBand` in modDisposition.ts. Boundaries are ascending; a value lands
// in the lowest band whose upper bound it is below (>= 85 is the top band).
export const QUALITY_BAND_BOUNDARIES = [15, 30, 45, 65, 85] as const;
