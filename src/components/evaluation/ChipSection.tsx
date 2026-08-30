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
  // When provided, chips at 'required'/'mandatory' show a pin toggle that
  // promotes/demotes between the two. Secondary section only.
  onPin?: (statId: number, pinned: boolean) => void;
}

export default function ChipSection({
  title,
  stats,
  cycle,
  getClass,
  setClass,
  counts,
  onPin,
}: ChipSectionProps) {
  const nextState = (current: string): string => {
    // A 'mandatory' chip isn't a member of the click cycle — treat a body
    // click on it as if it were 'required', so it advances to the next tier
    // (Complementary) and implicitly un-pins, rather than jumping to Neutral.
    const effective = current === 'mandatory' ? 'required' : current;
    const idx = cycle.findIndex((s) => s.value === effective);
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
          const pinnable =
            onPin !== undefined &&
            (current === 'required' || current === 'mandatory');
          const pinned = current === 'mandatory';
          return (
            <span key={stat.stat_id} className={styles.chipWrap}>
              <button
                type="button"
                data-state={current}
                className={styles.chip}
                onClick={() => setClass(stat.stat_id, nextState(current))}
              >
                {statDisplayName(stat)}
              </button>
              {pinnable && (
                <button
                  type="button"
                  className={styles.chipPin}
                  data-pinned={pinned}
                  aria-pressed={pinned}
                  title={pinned ? 'Unpin — back to Required' : 'Pin as Mandatory'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin!(stat.stat_id, !pinned);
                  }}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M9.5 1.5 8 3l.6.6-2.7 2.7-2-.4L1 7.4l3 3-3.2 3.2 1 1L6 11.4l3 3 1.5-1.9-.4-2 2.7-2.7.6.6 1.5-1.5-5.4-5.4Z"
                    />
                  </svg>
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
