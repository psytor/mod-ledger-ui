import type { StatDefinition } from '@/services/gameDataApi';
import { formatRollAt, statDisplayName, type TierView } from './evaluationHelpers';
import styles from './RollTargetsGrid.module.css';

interface RollTargetsGridProps {
  values: Record<number, number>;
  secondaryStats: StatDefinition[];
  tierView: TierView;
  onSetTarget: (statId: number, sliderValue: number) => void;
  disabled?: boolean;
}

export default function RollTargetsGrid({
  values,
  secondaryStats,
  tierView,
  onSetTarget,
  disabled = false,
}: RollTargetsGridProps) {
  return (
    <div className={styles.grid}>
      {secondaryStats.map((stat) => {
        const stored = values[stat.stat_id];
        const value = stored === undefined ? 50 : Math.round(stored * 100);
        const rollText = formatRollAt(stat, value / 100, tierView);
        return (
          <div
            key={stat.stat_id}
            className={styles.row}
            data-disabled={disabled || undefined}
          >
            <span className={styles.name}>{statDisplayName(stat)}</span>
            <span className={styles.value}>
              {value}%
              {rollText !== null && (
                <span className={styles.approx}> (≈{rollText})</span>
              )}
            </span>
            <input
              type="range"
              min={1}
              max={99}
              step={1}
              value={value}
              disabled={disabled}
              onChange={(e) => onSetTarget(stat.stat_id, Number(e.target.value))}
              className={styles.slider}
              autoComplete="off"
              data-lpignore="true"
              data-form-type="other"
            />
          </div>
        );
      })}
    </div>
  );
}
