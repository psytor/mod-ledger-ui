// Quality-band boundaries for the per-mod slicing advice scale.
//
// Advice is derived purely from a mod's own `absolute_quality` (0-100) — there
// is no cross-mod comparison. The 0-100 range is split into five equal 20-point
// bands; a mod's band is decided by where its quality falls. See `qualityBand`
// in modDisposition.ts. Boundaries are ascending; a value lands in the lowest
// band whose upper bound it is below (>= 80 is the top band).
export const QUALITY_BAND_BOUNDARIES = [20, 40, 60, 80] as const;
