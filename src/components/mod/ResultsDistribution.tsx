import { getQualityBandCounts } from '@/utils/modFilters';
import { QUALITY_BAND_INFO, type QualityBand } from '@/utils/modDisposition';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import styles from './ResultsDistribution.module.css';

// Segment fill per band — mirrors the card chip tints (ModCard.module.css) and
// the legend swatches (SliceLegend.module.css) so the bar reads directly
// against the legend printed below it.
const segmentClass: Record<QualityBand, string> = {
  'slice-sure': styles.sliceSure,
  consider: styles.consider,
  average: styles.average,
  'consider-sell': styles.considerSell,
  sell: styles.sell,
};

interface ResultsDistributionProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
}

/**
 * The "shape of your inventory" at a glance: one horizontal bar split into
 * coloured segments, each sized by how many scored mods fall in that quality
 * band. Highest band sits left (the most-sliceable end). It's a read-only
 * graphic — the disposition chips above it remain the filters, and the
 * SliceLegend below it decodes the colours.
 */
export default function ResultsDistribution({ mods, verdicts }: ResultsDistributionProps) {
  const { scored, bands } = getQualityBandCounts(mods, verdicts);

  // Nothing scored yet (e.g. only UNCONFIGURED/pre-eval mods) — no shape to show.
  if (scored === 0) return null;

  const summary = QUALITY_BAND_INFO.filter(({ band }) => bands[band] > 0)
    .map(({ band, label }) => `${bands[band]} ${label}`)
    .join(', ');

  return (
    <div className={styles.results}>
      <div className={styles.head}>
        <span className={styles.title}>Quality distribution</span>
        <span className={styles.scored}>
          <strong>{scored}</strong> mods scored
        </span>
      </div>

      <div
        className={styles.bar}
        role="img"
        aria-label={`Quality distribution of ${scored} scored mods: ${summary}.`}
      >
        {QUALITY_BAND_INFO.map(({ band, label }, i) => {
          const count = bands[band];
          if (count === 0) return null;
          const pct = Math.round((count / scored) * 100);
          return (
            <div
              key={band}
              className={`${styles.segment} ${segmentClass[band]}`}
              style={{ flexGrow: count, ['--i' as string]: i }}
              title={`${label} — ${count} mod${count === 1 ? '' : 's'} (${pct}%)`}
            >
              <span className={styles.count}>{count}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.scale} aria-hidden="true">
        <span>← most sliceable</span>
        <span>least →</span>
      </div>
    </div>
  );
}
