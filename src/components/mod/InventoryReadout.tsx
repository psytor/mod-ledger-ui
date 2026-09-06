import { Card } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import { usePilotAssignment } from '@/contexts/PilotAssignmentContext';
import { useMods } from '@/contexts/ModContext';
import {
  applyFlatFilters,
  getBucketCounts,
  getQualityBandCounts,
  getCalibrationCounts,
} from '@/utils/modFilters';
import {
  QUALITY_BAND_INFO,
  type BucketFilter,
  type QualityBand,
} from '@/utils/modDisposition';
import { CALIBRATION_PRIORITY_INFO, type CalibrationPriority } from '@/utils/calibrationAdvisor';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import styles from './InventoryReadout.module.css';

// Disposition lenses (the "what to do" row), in lifecycle order. 'for-pilot'
// sits before 'maxed' — it's an assignment overlay, not a verdict bucket.
const DISPOSITIONS: { key: BucketFilter; label: string }[] = [
  { key: 'sell', label: 'Sell' },
  { key: 'level', label: 'Level Up' },
  { key: 'slice', label: 'Slice' },
  { key: 'for-pilot', label: 'For Pilots' },
  { key: 'maxed', label: 'Maxed' },
  { key: 'unconfigured', label: 'Unconfigured' },
];

// mod.tier_name is the letter grade (E…A); show its colour name in the active-
// filter chip, matching how the filter drawer labels tiers.
const TIER_COLOR_BY_LETTER: Record<string, string> = {
  E: 'Grey',
  D: 'Green',
  C: 'Blue',
  B: 'Purple',
  A: 'Gold',
};

// Band tint class shared by the bar segments and the legend swatches — mirrors
// the card chip tints (ModCard.module.css) so the whole readout speaks one
// colour language.
const bandClass: Record<QualityBand, string> = {
  perfect: styles.perfect,
  'nearly-perfect': styles.nearlyPerfect,
  'on-target': styles.onTarget,
  'under-target': styles.underTarget,
  bad: styles.bad,
};

interface InventoryReadoutProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
}

/**
 * The console at the top of the flat view. One framed panel with three lenses:
 *
 *  • Disposition — what to do with each mod (Sell / Level / Slice / Maxed /
 *    Unconfigured). Clicking sets the `bucket` filter.
 *  • Quality — how good the scored mods are, as a segmented distribution bar
 *    plus an interactive legend. Clicking a band sets the `band` filter.
 *  • Calibration — which 6-dot mods with attempts left are worth spending an
 *    Attenuator on (Prime / Worth a Shot / Low Priority). Clicking a chip
 *    sets the `calibration` filter. See calibrationAdvisor.ts for the model.
 *
 * All three lenses are independent filters that can stack. Each lens's counts
 * cross-filter: they reflect every OTHER active filter (facets, cross-cutting,
 * and the sibling lenses) but never their own axis — so the readout describes
 * the slice you're actually looking at, while each chip stays a legible switch
 * target. The whole-inventory counts are kept alongside for the "N / total"
 * pair, shown only when something outside the lens is narrowing it.
 */
export default function InventoryReadout({ mods, verdicts }: InventoryReadoutProps) {
  const { filters, setFilter, clearFilters } = useFilters();
  const { assignments } = usePilotAssignment();
  const { calibrationCosts } = useMods();
  const assignedModIds = new Set(assignments.keys());

  // Disposition counts see every filter except `bucket`; quality counts see
  // every filter except `band`. `fullCounts` / `fullQuality` are the unfiltered
  // whole-inventory tallies behind the "N / total" pair.
  const fullCounts = getBucketCounts(mods, verdicts, assignedModIds);
  const counts = getBucketCounts(
    applyFlatFilters(mods, { ...filters, bucket: null }, verdicts, assignedModIds, calibrationCosts),
    verdicts,
    assignedModIds
  );
  const fullQuality = getQualityBandCounts(mods, verdicts);
  const fullScored = fullQuality.scored;
  const fullBands = fullQuality.bands;
  const { scored, bands } = getQualityBandCounts(
    applyFlatFilters(mods, { ...filters, band: null }, verdicts, assignedModIds, calibrationCosts),
    verdicts
  );
  // Calibration counts see every filter except `calibration` itself — same
  // cross-filter contract as the other two lenses. `eligible` only ever
  // includes 6-dot mods with attempts left and a reference rule (see
  // calibrationAdvisor.ts) — everything else is excluded, not just uncounted.
  const fullCalibration = getCalibrationCounts(mods, verdicts, calibrationCosts);
  const calibration = getCalibrationCounts(
    applyFlatFilters(mods, { ...filters, calibration: null }, verdicts, assignedModIds, calibrationCosts),
    verdicts,
    calibrationCosts
  );

  // Facet + cross-cutting filters — everything the drawer drives except the two
  // readout lenses. Narrowing from any of these flows into BOTH lens counts.
  const facetActive =
    filters.flatSets.length > 0 ||
    filters.flatSlots.length > 0 ||
    filters.flatTiers.length > 0 ||
    filters.flatRarity.length > 0 ||
    filters.flatPrimaries.length > 0 ||
    filters.characters.length > 0 ||
    filters.locked !== 'all';

  // The readout's Clear is the same canonical reset as the filter drawer's
  // (clearFilters), so there is one Clear, surfaced in two places. It appears
  // whenever ANY filter is active — not just the lenses — so clearing here never
  // leaves a facet filter silently narrowing the grid from inside the drawer.
  const hasFilter =
    facetActive || filters.bucket !== null || filters.band !== null || filters.calibration !== null;

  // Show the "N / total" pair in a lens only when something OUTSIDE that lens is
  // narrowing it — otherwise N === total and the pair is just noise.
  const dispositionNarrowed = facetActive || filters.band !== null || filters.calibration !== null;
  const qualityNarrowed = facetActive || filters.bucket !== null || filters.calibration !== null;
  const calibrationNarrowed = facetActive || filters.bucket !== null || filters.band !== null;

  const toggleBucket = (b: BucketFilter) =>
    setFilter('bucket', filters.bucket === b ? null : b);

  // 'for-pilot' maps to the forPilot count field and its own tint class; every
  // other bucket key matches its count field and style class directly.
  const countFor = (key: BucketFilter): number =>
    key === 'for-pilot' ? counts.forPilot : counts[key];
  const fullCountFor = (key: BucketFilter): number =>
    key === 'for-pilot' ? fullCounts.forPilot : fullCounts[key];
  const bucketClass: Record<BucketFilter, string> = {
    sell: styles.sell,
    level: styles.level,
    slice: styles.slice,
    'for-pilot': styles.forPilot,
    maxed: styles.maxed,
    unconfigured: styles.unconfigured,
  };
  const toggleBand = (b: QualityBand) =>
    setFilter('band', filters.band === b ? null : b);

  const toggleCalibration = (p: CalibrationPriority) =>
    setFilter('calibration', filters.calibration === p ? null : p);

  const calibrationClass: Record<CalibrationPriority, string> = {
    prime: styles.calibrationPrime,
    'worth-a-shot': styles.calibrationWorthAShot,
    'low-priority': styles.calibrationLowPriority,
  };

  // Removable summary of the panel-driven filters (facets + cross-cutting), so
  // the readout shows WHICH other filters are narrowing the grid — not just that
  // some are (the Clear button). The bucket/band lenses already surface their own
  // active state below, so they're intentionally excluded here.
  const removeString = (
    key: 'flatSets' | 'flatSlots' | 'flatTiers' | 'flatPrimaries' | 'characters',
    value: string
  ) => setFilter(key, filters[key].filter((v) => v !== value));

  interface ActiveChip {
    id: string;
    group: string;
    label: string;
    remove: () => void;
  }
  const activeFilters: ActiveChip[] = [
    ...filters.flatSets.map((v) => ({
      id: `set:${v}`, group: 'Set', label: v, remove: () => removeString('flatSets', v),
    })),
    ...filters.flatSlots.map((v) => ({
      id: `slot:${v}`, group: 'Slot', label: v, remove: () => removeString('flatSlots', v),
    })),
    ...filters.flatTiers.map((v) => ({
      id: `tier:${v}`,
      group: 'Tier',
      label: TIER_COLOR_BY_LETTER[v] ? `${TIER_COLOR_BY_LETTER[v]} (${v})` : v,
      remove: () => removeString('flatTiers', v),
    })),
    ...filters.flatRarity.map((v) => ({
      id: `rarity:${v}`,
      group: 'Rarity',
      label: `${v} Dots`,
      remove: () => setFilter('flatRarity', filters.flatRarity.filter((x) => x !== v)),
    })),
    ...filters.flatPrimaries.map((v) => ({
      id: `primary:${v}`, group: 'Primary', label: v, remove: () => removeString('flatPrimaries', v),
    })),
    ...filters.characters.map((v) => ({
      id: `char:${v}`, group: 'Character', label: v, remove: () => removeString('characters', v),
    })),
    ...(filters.locked !== 'all'
      ? [{
          id: 'locked',
          group: 'Lock',
          label: filters.locked === 'locked' ? 'Locked only' : 'Unlocked only',
          remove: () => setFilter('locked', 'all'),
        }]
      : []),
  ];

  return (
    <Card
      chamfered
      chamferSize="lg"
      variant="outline"
      padding="none"
      showDiagonalBorders
      edgeColor="var(--color-primary)"
      className={styles.card}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Inventory Readout</p>
          {hasFilter && (
            <button type="button" className={styles.clear} onClick={clearFilters}>
              Clear all filters ✕
            </button>
          )}
        </header>

        {/* Active panel filters — removable chips so the readout shows exactly
            which set/slot/tier/rarity/primary/character/lock filters are on. */}
        {activeFilters.length > 0 && (
          <div className={styles.activeFilters}>
            <span className={styles.activeLabel}>Filters</span>
            {activeFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.activeChip}
                onClick={f.remove}
                title={`Remove ${f.group} filter: ${f.label}`}
              >
                <span className={styles.activeGroup}>{f.group}</span>
                <span className={styles.activeValue}>{f.label}</span>
                <span className={styles.activeX} aria-hidden="true">✕</span>
              </button>
            ))}
          </div>
        )}

        {/* Disposition lens */}
        <section className={styles.group}>
          <p className={styles.groupLabel}>
            Disposition <span className={styles.groupHint}>what to do</span>
          </p>
          <div className={styles.chips}>
            <button
              type="button"
              className={`${styles.chip} ${styles.total} ${
                filters.bucket === null ? styles.chipActive : ''
              }`}
              aria-pressed={filters.bucket === null}
              onClick={() => setFilter('bucket', null)}
            >
              <span className={styles.count}>
                {counts.total}
                {dispositionNarrowed && (
                  <span className={styles.countTotal}> / {fullCounts.total}</span>
                )}
              </span>
              <span className={styles.label}>All</span>
            </button>
            {DISPOSITIONS.map(({ key, label }) => {
              const count = countFor(key);
              const fullCount = fullCountFor(key);
              // Hide a bucket only when the inventory holds none of that type at
              // all. A bucket that exists but is filtered down to 0 stays
              // visible as a dimmed "0 / N" so it's still a legible switch
              // target. The active filter's own chip never hides.
              if (fullCount === 0 && filters.bucket !== key) return null;
              const emptyUnderFilter = count === 0 && fullCount > 0;
              return (
                <button
                  key={key}
                  type="button"
                  className={`${styles.chip} ${bucketClass[key]} ${
                    filters.bucket === key ? styles.chipActive : ''
                  } ${emptyUnderFilter ? styles.chipEmpty : ''}`}
                  aria-pressed={filters.bucket === key}
                  onClick={() => toggleBucket(key)}
                >
                  <span className={styles.count}>
                    {count}
                    {/* 'for-pilot' is an overlay on the whole assignment pool,
                        not a facet-narrowed bucket — a "N / N" pair there would
                        imply a filter that isn't being applied. */}
                    {dispositionNarrowed && key !== 'for-pilot' && (
                      <span className={styles.countTotal}> / {fullCount}</span>
                    )}
                  </span>
                  <span className={styles.label}>{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quality lens — only meaningful once something is scored. Stays
            mounted while any scored mod exists in inventory, even if the current
            filters narrow the shown-scored count to zero. */}
        {fullScored > 0 && (
          <section className={styles.group}>
            <p className={styles.groupLabel}>
              Quality{' '}
              <span className={styles.groupHint}>
                {qualityNarrowed ? `${scored} of ${fullScored} scored` : `${scored} scored`}
              </span>
            </p>

            {scored > 0 ? (
              <>
                <div
                  className={styles.bar}
                  role="group"
                  aria-label="Quality distribution — click a band to filter"
                >
                  {QUALITY_BAND_INFO.map(({ band, label, priority, action }, i) => {
                    const count = bands[band];
                    if (count === 0) return null;
                    const pct = Math.round((count / scored) * 100);
                    const dim = filters.band !== null && filters.band !== band;
                    const tip = qualityNarrowed
                      ? `${label} · ${priority} — ${count} of ${fullBands[band]} mod${
                          fullBands[band] === 1 ? '' : 's'
                        } (${pct}% of shown). ${action}.`
                      : `${label} · ${priority} — ${count} mod${
                          count === 1 ? '' : 's'
                        } (${pct}%). ${action}.`;
                    return (
                      <button
                        key={band}
                        type="button"
                        className={`${styles.segment} ${bandClass[band]} ${
                          filters.band === band ? styles.segActive : ''
                        } ${dim ? styles.segDim : ''}`}
                        style={{ flexGrow: count, ['--i' as string]: i }}
                        aria-pressed={filters.band === band}
                        onClick={() => toggleBand(band)}
                        title={tip}
                      >
                        <span className={styles.segCount}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                <div className={styles.scaleHint} aria-hidden="true">
                  <span>← most sliceable</span>
                  <span>least →</span>
                </div>
              </>
            ) : (
              <p className={styles.emptyNote}>
                No scored mods match the current filters.
              </p>
            )}

            <div className={styles.legend}>
              {QUALITY_BAND_INFO.map(({ band, label, range, priority, action }) => {
                const dim = filters.band !== null && filters.band !== band;
                return (
                  <button
                    key={band}
                    type="button"
                    className={`${styles.legendItem} ${
                      filters.band === band ? styles.legendActive : ''
                    } ${dim ? styles.legendDim : ''}`}
                    aria-pressed={filters.band === band}
                    onClick={() => toggleBand(band)}
                    title={`${priority} — ${action}.`}
                  >
                    <span className={`${styles.swatch} ${bandClass[band]}`} />
                    <span className={styles.legendRange}>{range}</span>
                    <span className={styles.legendLabel}>{label}</span>
                    <span className={styles.legendPriority}>{priority}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Calibration lens — only meaningful once at least one mod is a real
            candidate (6-dot, attempts left, judged against a reference rule).
            Stays mounted while any eligible mod exists in inventory, even if
            the current filters narrow the shown-eligible count to zero. */}
        {fullCalibration.eligible > 0 && (
          <section className={styles.group}>
            <p className={styles.groupLabel}>
              Calibration{' '}
              <span className={styles.groupHint}>
                {calibrationNarrowed
                  ? `${calibration.eligible} of ${fullCalibration.eligible} eligible`
                  : `${calibration.eligible} eligible`}
              </span>
            </p>
            <div className={styles.chips}>
              {CALIBRATION_PRIORITY_INFO.map(({ priority, label, priorityText, action }) => {
                const count = calibration.priorities[priority];
                const fullCount = fullCalibration.priorities[priority];
                if (fullCount === 0 && filters.calibration !== priority) return null;
                const emptyUnderFilter = count === 0 && fullCount > 0;
                return (
                  <button
                    key={priority}
                    type="button"
                    className={`${styles.chip} ${calibrationClass[priority]} ${
                      filters.calibration === priority ? styles.chipActive : ''
                    } ${emptyUnderFilter ? styles.chipEmpty : ''}`}
                    aria-pressed={filters.calibration === priority}
                    onClick={() => toggleCalibration(priority)}
                    title={`${priorityText} — ${action}.`}
                  >
                    <span className={styles.count}>
                      {count}
                      {calibrationNarrowed && (
                        <span className={styles.countTotal}> / {fullCount}</span>
                      )}
                    </span>
                    <span className={styles.label}>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}
