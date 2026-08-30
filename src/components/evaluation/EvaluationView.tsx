import { useMemo, useState } from 'react';
import { Card } from 'astrogators-shared-ui';
import { useMods } from '@/contexts/ModContext';
import type { Evaluation } from '@/types/evaluation';
import RollTargetsList from './RollTargetsList';
import SetBlock from './SetBlock';
import type { TierView } from './evaluationHelpers';
import styles from './EvaluationView.module.css';

interface EvaluationViewProps {
  evaluation: Evaluation;
}

export default function EvaluationView({ evaluation }: EvaluationViewProps) {
  const { modSets, primaryStats, secondaryStats } = useMods();
  const [tierView, setTierView] = useState<TierView>(5);

  const orderedPrimaryStats = useMemo(
    () => [...primaryStats].sort((a, b) => a.name.localeCompare(b.name)),
    [primaryStats]
  );
  const orderedSecondaryStats = useMemo(
    () => [...secondaryStats].sort((a, b) => a.name.localeCompare(b.name)),
    [secondaryStats]
  );

  // Every set, configured or not. Empty sets render with an "Empty" marker
  // so the detail view matches the editor — you can see what's unconfigured,
  // not just what's filled in.
  const allSets = useMemo(() => {
    return modSets.map((set) => {
      const cfg = evaluation.mod_set_configs.find(
        (c) => c.set_id === set.set_id
      );
      return { set, variants: cfg?.variants ?? [] };
    });
  }, [modSets, evaluation.mod_set_configs]);

  const configuredCount = allSets.filter(
    (row) => row.variants.length > 0
  ).length;
  const totalVariants = allSets.reduce(
    (sum, row) => sum + row.variants.length,
    0
  );

  return (
    <div className={styles.view}>
      <section className={styles.sectionBlock}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Master roll targets</h2>
          <p className={styles.sectionMeta}>Shared across all sets &amp; variants</p>
        </header>
        <Card
          chamfered
          chamferSize="md"
          padding="none"
          showDiagonalBorders
          edgeColor="var(--color-info)"
          className={styles.masterCard}
        >
          {/* Show every secondary, not just customised ones. Untouched stats
              render at the 50% default the scorer actually uses, so the view
              matches the editor — what you see is what you save. */}
          <RollTargetsList
            values={evaluation.master_secondary_targets}
            secondaryStats={orderedSecondaryStats}
            tierView={tierView}
          />
        </Card>
      </section>

      <section className={styles.sectionBlock}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Mod sets</h2>
          <p className={styles.sectionMeta}>
            <strong>{configuredCount}</strong> configured ·{' '}
            <strong>{totalVariants}</strong> scoring rule
            {totalVariants === 1 ? '' : 's'}
          </p>
        </header>

        <div className={styles.tierToggle} role="group" aria-label="Roll value tier">
          <span className={styles.tierToggleLabel}>Roll values:</span>
          <div className={styles.tierToggleButtons}>
            <button
              type="button"
              data-active={tierView === 5}
              onClick={() => setTierView(5)}
              className={styles.tierToggleButton}
            >
              5-dot
            </button>
            <button
              type="button"
              data-active={tierView === 6}
              onClick={() => setTierView(6)}
              className={styles.tierToggleButton}
            >
              6-dot
            </button>
          </div>
        </div>

        {modSets.length === 0 ? (
          <p className={styles.empty}>Loading mod sets…</p>
        ) : configuredCount === 0 ? (
          <p className={styles.empty}>
            No scoring rules configured. Edit to add some.
          </p>
        ) : (
          <div className={styles.setList}>
            {allSets.map(({ set, variants }) => (
              <SetBlock
                key={set.set_id}
                mode="view"
                set={set}
                variants={variants}
                primaryStats={orderedPrimaryStats}
                secondaryStats={orderedSecondaryStats}
                tierView={tierView}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
