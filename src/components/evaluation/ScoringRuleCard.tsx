import { Button, Card } from 'astrogators-shared-ui';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  PrimaryClassification,
  SecondaryClassification,
  Variant,
} from '@/types/evaluation';
import {
  countClassifications,
  groupPrimaryClassified,
  groupSecondaryClassified,
  PRIMARY_CYCLE,
  SECONDARY_CYCLE,
  type TierView,
} from './evaluationHelpers';
import ChipSection from './ChipSection';
import ClassificationsList from './ClassificationsList';
import RollTargetsGrid from './RollTargetsGrid';
import RollTargetsList from './RollTargetsList';
import styles from './ScoringRuleCard.module.css';

interface ViewProps {
  mode: 'view';
  variant: Variant;
  primaryStats: StatDefinition[];
  secondaryStats: StatDefinition[];
  tierView: TierView;
}

interface EditProps {
  mode: 'edit';
  variant: Variant;
  index: number;
  total: number;
  primaryStats: StatDefinition[];
  secondaryStats: StatDefinition[];
  tierView: TierView;
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onSetPrimary: (statId: number, c: PrimaryClassification) => void;
  onSetSecondary: (statId: number, c: SecondaryClassification) => void;
  onSetTarget: (statId: number, sliderValue: number) => void;
  onToggleMaster: (checked: boolean) => void;
}

export type ScoringRuleCardProps = ViewProps | EditProps;

export default function ScoringRuleCard(props: ScoringRuleCardProps) {
  if (props.mode === 'view') return <ViewModeCard {...props} />;
  return <EditModeCard {...props} />;
}

function ViewModeCard({
  variant,
  primaryStats,
  secondaryStats,
  tierView,
}: ViewProps) {
  const primaryGroups = groupPrimaryClassified(variant, primaryStats);
  const secondaryGroups = groupSecondaryClassified(variant, secondaryStats);
  const following = variant.uses_master_targets;

  return (
    <Card chamfered chamferSize="sm" padding="none" className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.nameStatic}>{variant.name}</h4>
      </div>

      <hr className={styles.divider} />

      <ClassificationsList
        title="Primary stats"
        groups={[
          {
            label: 'Wanted',
            swatchColor: 'var(--color-secondary)',
            stats: primaryGroups.wanted,
          },
          {
            label: 'Not wanted',
            swatchColor: 'var(--color-error)',
            stats: primaryGroups.notWanted,
          },
        ]}
      />

      <hr className={styles.divider} />

      <ClassificationsList
        title="Secondary stats"
        groups={[
          {
            label: 'Required',
            swatchColor: 'var(--color-secondary)',
            stats: secondaryGroups.required,
          },
          {
            label: 'Complementary',
            swatchColor: 'var(--color-info)',
            stats: secondaryGroups.complementary,
          },
        ]}
      />

      <hr className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.sectionHeadInline}>
          <h4 className={styles.sectionTitle}>Roll targets</h4>
          {following && (
            <span className={styles.followingHint}>Following master</span>
          )}
        </div>
        <RollTargetsList
          values={variant.secondary_targets}
          secondaryStats={secondaryStats}
          tierView={tierView}
        />
      </div>
    </Card>
  );
}

function EditModeCard({
  variant,
  index,
  total,
  primaryStats,
  secondaryStats,
  tierView,
  onRename,
  onDelete,
  onMove,
  onSetPrimary,
  onSetSecondary,
  onSetTarget,
  onToggleMaster,
}: EditProps) {
  const counts = countClassifications(variant);
  const following = variant.uses_master_targets;

  return (
    <Card chamfered chamferSize="sm" padding="none" className={styles.card}>
      <div className={styles.header}>
        <input
          type="text"
          value={variant.name}
          onChange={(e) => onRename(e.target.value)}
          className={styles.nameInput}
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
        />
        <label
          className={styles.followMasterToggle}
          title="Mirror the master Roll Targets panel"
        >
          <input
            type="checkbox"
            checked={following}
            onChange={(e) => onToggleMaster(e.target.checked)}
          />
          <span>Follow master</span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          ↓
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>

      <hr className={styles.divider} />

      <ChipSection
        title="Primary stats"
        stats={primaryStats}
        cycle={PRIMARY_CYCLE}
        getClass={(sid) => variant.primary_classifications[sid] ?? 'neutral'}
        setClass={(sid, c) => onSetPrimary(sid, c as PrimaryClassification)}
        counts={[
          {
            color: 'var(--color-secondary)',
            label: 'Wanted',
            value: counts.wanted,
          },
          {
            color: 'var(--color-error)',
            label: 'Not wanted',
            value: counts.notWanted,
          },
        ]}
      />

      <hr className={styles.divider} />

      <ChipSection
        title="Secondary stats"
        stats={secondaryStats}
        cycle={SECONDARY_CYCLE}
        getClass={(sid) => variant.secondary_classifications[sid] ?? 'neutral'}
        setClass={(sid, c) => onSetSecondary(sid, c as SecondaryClassification)}
        counts={[
          {
            color: 'var(--color-secondary)',
            label: 'Required',
            value: counts.required,
          },
          {
            color: 'var(--color-info)',
            label: 'Complementary',
            value: counts.complementary,
          },
        ]}
      />

      <hr className={styles.divider} />

      <div className={styles.section}>
        <div className={styles.sectionHeadInline}>
          <h4 className={styles.sectionTitle}>Roll targets</h4>
          {following && (
            <span className={styles.followingHint}>Following master</span>
          )}
        </div>
        <p className={styles.targetIntro}>
          Efficiency you'd be happy to hit per stat. Target = 50 points,
          100% = 100 points; below scales down, above scales up steeply.
          The approximate value in parentheses is the per-roll stat amount at
          that efficiency for a {tierView}-dot mod.
        </p>
        <RollTargetsGrid
          values={variant.secondary_targets}
          secondaryStats={secondaryStats}
          tierView={tierView}
          onSetTarget={onSetTarget}
          disabled={following}
        />
      </div>
    </Card>
  );
}
