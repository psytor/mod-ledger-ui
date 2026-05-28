import type { StatDefinition } from '@/services/gameDataApi';
import { statDisplayName, type ChipState } from './evaluationHelpers';
import styles from './ChipSection.module.css';

interface SectionCount {
  color: string;
  label: string;
  value: number;
}

interface ChipSectionProps {
  title: string;
  stats: StatDefinition[];
  cycle: ChipState[];
  getClass: (statId: number) => string;
  setClass: (statId: number, value: string) => void;
  counts?: SectionCount[];
}

export default function ChipSection({
  title,
  stats,
  cycle,
  getClass,
  setClass,
  counts,
}: ChipSectionProps) {
  const nextState = (current: string): string => {
    const idx = cycle.findIndex((s) => s.value === current);
    return cycle[(idx + 1) % cycle.length].value;
  };

  const legendItems =
    counts ??
    cycle
      .filter((s) => s.value !== 'neutral')
      .map((s) => ({
        color: s.swatchColor,
        label: s.label,
        value: undefined as number | undefined,
      }));

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h4 className={styles.title}>{title}</h4>
        <div className={styles.legend}>
          {legendItems.map((item) => (
            <span key={item.label}>
              <span
                className={styles.swatch}
                style={{ background: item.color }}
              />
              {item.label}
              {item.value !== undefined && ` ${item.value}`}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.chips}>
        {stats.map((stat) => {
          const current = getClass(stat.stat_id);
          return (
            <button
              key={stat.stat_id}
              type="button"
              data-state={current}
              className={styles.chip}
              onClick={() => setClass(stat.stat_id, nextState(current))}
            >
              {statDisplayName(stat)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
