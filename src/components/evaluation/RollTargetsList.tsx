import type { StatDefinition } from '@/services/gameDataApi';
import { formatRollAt, statDisplayName, type TierView } from './evaluationHelpers';
import styles from './RollTargetsList.module.css';

// Stats absent from `values` fall back to this — the same default the scorer
// (modScorer DEFAULT_TARGET) and the editor grid use. So an untouched slider
// reads back at the exact value it scores at: what you see is what you save.
const DEFAULT_TARGET = 0.5;

interface RollTargetsListProps {
  // Stored efficiencies in [0, 1]; missing stats default to DEFAULT_TARGET so
  // every secondary is shown at its real (incl. default) value.
  values: Record<number, number>;
  secondaryStats: StatDefinition[];
  tierView: TierView;
}

export default function RollTargetsList({
  values,
  secondaryStats,
  tierView,
}: RollTargetsListProps) {
  if (secondaryStats.length === 0) {
    return <p className={styles.empty}>No roll targets set.</p>;
  }

  return (
    <ul className={styles.list}>
      {secondaryStats.map((stat) => {
        const efficiency = values[stat.stat_id] ?? DEFAULT_TARGET;
        const percent = Math.round(efficiency * 100);
        const rollText = formatRollAt(stat, efficiency, tierView);
        return (
          <li key={stat.stat_id} className={styles.row}>
            <span className={styles.name}>{statDisplayName(stat)}</span>
            <span className={styles.value}>
              {percent}%
              {rollText !== null && (
                <span className={styles.approx}> (≈{rollText})</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
