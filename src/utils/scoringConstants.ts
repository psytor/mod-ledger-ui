// Quality-band boundaries for the per-mod slicing advice scale.
//
// Advice is derived purely from a mod's own `absolute_quality` (0-100) — there
// is no cross-mod comparison. The cuts are NOT equal-width: `absolute_quality`
// is a bell centred near 50 (an average roll scores 50 by construction in
// `curveScore`), so equal 20-point bands piled everything into the middle and
// left the top band empty even for elite inventories. These boundaries are
// calibrated to the observed distribution across real accounts (top band ≈ the
// best ~5-12% of slice mods, "Average" centred on the ~50-55 median). Still a
// fixed per-mod scale, not a live cohort percentile. See `qualityBand` in
// modDisposition.ts. Boundaries are ascending; a value lands in the lowest band
// whose upper bound it is below (>= 70 is the top band).
export const QUALITY_BAND_BOUNDARIES = [35, 50, 60, 70] as const;
