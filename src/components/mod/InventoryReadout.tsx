import { Card } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import { usePilotAssignment } from '@/contexts/PilotAssignmentContext';
import { getBucketCounts, getQualityBandCounts } from '@/utils/modFilters';
import {
  QUALITY_BAND_INFO,
  type BucketFilter,
  type QualityBand,
} from '@/utils/modDisposition';
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
 * The console at the top of the flat view. One framed panel with two lenses:
 *
 *  • Disposition — what to do with each mod (Sell / Level / Slice / Maxed /
 *    Unconfigured). Clicking sets the `bucket` filter.
 *  • Quality — how good the scored mods are, as a segmented distribution bar
 *    plus an interactive legend. Clicking a band sets the `band` filter.
 *
 * Both lenses are independent filters that can stack, and both read off the
 * whole inventory (not the filtered view) so the counts are a stable overview.
 */
export default function InventoryReadout({ mods, verdicts }: InventoryReadoutProps) {
  const { filters, setFilter } = useFilters();
  const { assignments } = usePilotAssignment();
  const assignedModIds = new Set(assignments.keys());
  const counts = getBucketCounts(mods, verdicts, assignedModIds);
  const { scored, bands } = getQualityBandCounts(mods, verdicts);

  const hasFilter = filters.bucket !== null || filters.band !== null;

  const toggleBucket = (b: BucketFilter) =>
    setFilter('bucket', filters.bucket === b ? null : b);

  // 'for-pilot' maps to the forPilot count field and its own tint class; every
  // other bucket key matches its count field and style class directly.
  const countFor = (key: BucketFilter): number =>
    key === 'for-pilot' ? counts.forPilot : counts[key];
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
  const clearLenses = () => {
    setFilter('bucket', null);
    setFilter('band', null);
  };

  return (
    <Card
      chamfered
      chamferSize="lg"
      variant="outline"
      padding="none"
      showDiagonalBorders
      diagonalBorderColor="var(--color-primary)"
      className={styles.card}
    >
      <div className={styles.panel}>
        <header className={styles.head}>
          <p className={styles.eyebrow}>Inventory Readout</p>
          {hasFilter && (
            <button type="button" className={styles.clear} onClick={clearLenses}>
              Clear filter ✕
            </button>
          )}
        </header>

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
              <span className={styles.count}>{counts.total}</span>
              <span className={styles.label}>All</span>
            </button>
            {DISPOSITIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`${styles.chip} ${bucketClass[key]} ${
                  filters.bucket === key ? styles.chipActive : ''
                }`}
                aria-pressed={filters.bucket === key}
                onClick={() => toggleBucket(key)}
              >
                <span className={styles.count}>{countFor(key)}</span>
                <span className={styles.label}>{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Quality lens — only meaningful once something is scored. */}
        {scored > 0 && (
          <section className={styles.group}>
            <p className={styles.groupLabel}>
              Quality <span className={styles.groupHint}>{scored} scored</span>
            </p>

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
                    title={`${label} · ${priority} — ${count} mod${count === 1 ? '' : 's'} (${pct}%). ${action}.`}
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
      </div>
    </Card>
  );
}
