import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import { useFilters } from '@/contexts/FilterContext';
import { actionOf } from '@/utils/cohortRanking';
import styles from './InventoryOverview.module.css';

const SHAPES = ['Square', 'Diamond', 'Arrow', 'Triangle', 'Circle', 'Cross'] as const;
type Shape = (typeof SHAPES)[number];

type CategoryKey = 'level' | 'slice' | 'deploy' | 'pre-eval' | 'sell-pile' | 'unconfigured';

interface CategoryDef {
  key: CategoryKey;
  label: string;
  description: string;
  jumpsToMode?: 'sell-pile' | 'unconfigured';
}

// Order matches ACTION_ORDER in cohortRanking.ts, with Sell Pile and
// Unconfigured appended (they live in separate filter modes).
const CATEGORIES: readonly CategoryDef[] = [
  {
    key: 'level',
    label: 'Level',
    description: 'Passed rules — level to next checkpoint',
  },
  {
    key: 'slice',
    label: 'Slice',
    description: 'Passed rules — ready to slice up a dot tier',
  },
  {
    key: 'deploy',
    label: 'Deploy',
    description: '6-dot Gold passed rules — ready to equip',
  },
  {
    key: 'pre-eval',
    label: 'Pre-Eval',
    description: 'Level up further before evaluation is possible',
  },
  {
    key: 'sell-pile',
    label: 'Sell Pile',
    description: 'Failed primary or secondary rules',
    jumpsToMode: 'sell-pile',
  },
  {
    key: 'unconfigured',
    label: 'Unconfigured',
    description: 'No rules defined for this mod set',
    jumpsToMode: 'unconfigured',
  },
] as const;

interface InventoryOverviewProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
}

function categoryOf(
  mod: ParsedMod,
  verdict: VerdictResult
): CategoryKey | null {
  if (verdict.verdict === 'UNCONFIGURED') return 'unconfigured';
  const action = actionOf(mod, verdict);
  if (action === null) return null;
  if (action === 'sell') return 'sell-pile';
  return action; // 'level' | 'slice' | 'deploy' | 'pre-eval'
}

export default function InventoryOverview({
  mods,
  verdicts,
}: InventoryOverviewProps) {
  const { setFilter } = useFilters();

  // counts[category][shape] = number of mods
  const counts = new Map<CategoryKey, Map<Shape, number>>();
  const totals = new Map<CategoryKey, number>();
  let grandTotal = 0;

  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const cat = categoryOf(mod, verdict);
    if (cat === null) continue;
    if (!SHAPES.includes(mod.shape as Shape)) continue;

    let shapeCounts = counts.get(cat);
    if (!shapeCounts) {
      shapeCounts = new Map();
      counts.set(cat, shapeCounts);
    }
    const shape = mod.shape as Shape;
    shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
    totals.set(cat, (totals.get(cat) ?? 0) + 1);
    grandTotal++;
  }

  const visibleCategories = CATEGORIES.filter(
    (c) => (totals.get(c.key) ?? 0) > 0
  );

  if (visibleCategories.length === 0) return null;

  const shapeTotal = (shape: Shape): number => {
    let sum = 0;
    for (const cat of visibleCategories) {
      sum += counts.get(cat.key)?.get(shape) ?? 0;
    }
    return sum;
  };

  return (
    <section className={styles.overview}>
      <header className={styles.header}>
        <h2 className={styles.title}>Inventory Overview</h2>
        <span className={styles.subtitle}>
          {grandTotal} mods, grouped by what to do with them
        </span>
      </header>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colCategory}>Category</th>
              <th className={styles.colTotal}>Total</th>
              {SHAPES.map((shape) => (
                <th key={shape} className={styles.colShape}>
                  {shape}
                </th>
              ))}
              <th className={styles.colAction} aria-label="Action" />
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map((cat) => {
              const total = totals.get(cat.key) ?? 0;
              const shapeCounts = counts.get(cat.key);
              return (
                <tr key={cat.key} className={styles.row}>
                  <td className={styles.cellCategory}>
                    <span className={styles.categoryLabel}>{cat.label}</span>
                    <span className={styles.categoryDesc}>
                      {cat.description}
                    </span>
                  </td>
                  <td className={styles.cellTotal}>{total}</td>
                  {SHAPES.map((shape) => {
                    const n = shapeCounts?.get(shape) ?? 0;
                    return (
                      <td
                        key={shape}
                        className={`${styles.cellShape} ${n === 0 ? styles.cellShapeEmpty : ''}`}
                      >
                        {n === 0 ? '·' : n}
                      </td>
                    );
                  })}
                  <td className={styles.cellAction}>
                    {cat.jumpsToMode && (
                      <button
                        className={styles.viewButton}
                        onClick={() => setFilter('mode', cat.jumpsToMode!)}
                      >
                        View →
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className={styles.footerRow}>
              <td className={styles.cellCategory}>
                <span className={styles.footerLabel}>Total</span>
              </td>
              <td className={styles.cellTotal}>{grandTotal}</td>
              {SHAPES.map((shape) => (
                <td key={shape} className={styles.cellShape}>
                  {shapeTotal(shape)}
                </td>
              ))}
              <td className={styles.cellAction} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
