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

  const configuredSets = useMemo(() => {
    return modSets
      .map((set) => {
        const cfg = evaluation.mod_set_configs.find(
          (c) => c.set_id === set.set_id
        );
        return { set, variants: cfg?.variants ?? [] };
      })
      .filter((row) => row.variants.length > 0);
  }, [modSets, evaluation.mod_set_configs]);

  const hasMaster =
    Object.keys(evaluation.master_secondary_targets).length > 0;
  const totalVariants = configuredSets.reduce(
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
        <Card chamfered chamferSize="sm" padding="none" className={styles.masterCard}>
          {hasMaster ? (
            <RollTargetsList
              values={evaluation.master_secondary_targets}
              secondaryStats={orderedSecondaryStats}
              tierView={tierView}
            />
          ) : (
            <p className={styles.masterEmpty}>
              Using default roll targets — nothing customised at the master
              level.
            </p>
          )}
        </Card>
      </section>

      <section className={styles.sectionBlock}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Mod sets</h2>
          <p className={styles.sectionMeta}>
            <strong>{configuredSets.length}</strong> configured ·{' '}
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
        ) : configuredSets.length === 0 ? (
          <p className={styles.empty}>
            No scoring rules configured. Edit to add some.
          </p>
        ) : (
          <div className={styles.setList}>
            {configuredSets.map(({ set, variants }) => (
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
