import type { ModShape } from '@/utils/modSpriteConfig';
import styles from './ShapeScopeToggle.module.css';

// Fixed display order, matching the layout used elsewhere in the app
// (e.g. modFilters.ts's SHAPE_ORDER): Square|Arrow / Diamond|Triangle / Circle|Cross.
const SHAPE_OPTIONS: ModShape[] = [
  'Square',
  'Arrow',
  'Diamond',
  'Triangle',
  'Circle',
  'Cross',
];

interface ShapeScopeToggleProps {
  shapes: ModShape[] | undefined;
  onChange: (shapes: ModShape[]) => void;
}

// Multi-select toggle (not a cycle like ChipSection) — shape membership has
// no ordered states, just "in scope" or not. Empty selection means "all
// shapes", shown as a hint rather than a fourth chip state.
export default function ShapeScopeToggle({ shapes, onChange }: ShapeScopeToggleProps) {
  const selected = new Set(shapes ?? []);

  const toggle = (shape: ModShape) => {
    const next = new Set(selected);
    if (next.has(shape)) next.delete(shape);
    else next.add(shape);
    onChange(Array.from(next));
  };

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h4 className={styles.title}>Shape scope</h4>
        <span className={styles.hint}>
          {selected.size === 0
            ? 'Applies to all shapes'
            : `Limited to ${selected.size} shape${selected.size === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className={styles.chips}>
        {SHAPE_OPTIONS.map((shape) => (
          <button
            key={shape}
            type="button"
            data-active={selected.has(shape)}
            className={styles.chip}
            onClick={() => toggle(shape)}
          >
            {shape}
          </button>
        ))}
      </div>
    </div>
  );
}
