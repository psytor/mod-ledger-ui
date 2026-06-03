import { useFilters } from '@/contexts/FilterContext';
import { getBucketCounts } from '@/utils/modFilters';
import type { ActionBucket } from '@/utils/modDisposition';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import styles from './InventoryOverview.module.css';

// Player-facing label + chip colour key for each disposition bucket.
const BUCKETS: { key: ActionBucket; label: string }[] = [
  { key: 'sell', label: 'Sell' },
  { key: 'level', label: 'Level Up' },
  { key: 'slice', label: 'Slice' },
  { key: 'maxed', label: 'Maxed' },
  { key: 'unconfigured', label: 'Unconfigured' },
];

interface InventoryOverviewProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
}

/**
 * Status row at the top of the flat view: total inventory plus a count per
 * disposition. Each chip is a doorway — clicking it sets the `bucket` filter so
 * the grid below narrows to that disposition (clicking the active one, or
 * "All Mods", clears it).
 */
export default function InventoryOverview({ mods, verdicts }: InventoryOverviewProps) {
  const { filters, setFilter } = useFilters();
  const counts = getBucketCounts(mods, verdicts);

  const select = (bucket: ActionBucket) =>
    setFilter('bucket', filters.bucket === bucket ? null : bucket);

  return (
    <div className={styles.overview}>
      <button
        type="button"
        className={`${styles.chip} ${styles.total} ${filters.bucket === null ? styles.active : ''}`}
        onClick={() => setFilter('bucket', null)}
      >
        <span className={styles.count}>{counts.total}</span>
        <span className={styles.label}>All Mods</span>
      </button>

      {BUCKETS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`${styles.chip} ${styles[key]} ${
            filters.bucket === key ? styles.active : ''
          }`}
          onClick={() => select(key)}
        >
          <span className={styles.count}>{counts[key]}</span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  );
}
