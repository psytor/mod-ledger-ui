import { Button, Card } from 'astrogators-shared-ui';
import type { ModSetDefinition, StatDefinition } from '@/services/gameDataApi';
import type {
  PrimaryClassification,
  SecondaryClassification,
  Variant,
} from '@/types/evaluation';
import ScoringRuleCard from './ScoringRuleCard';
import type { TierView } from './evaluationHelpers';
import styles from './SetBlock.module.css';

interface ViewProps {
  mode: 'view';
  set: ModSetDefinition;
  variants: Variant[];
  primaryStats: StatDefinition[];
  secondaryStats: StatDefinition[];
  tierView: TierView;
}

interface EditProps {
  mode: 'edit';
  set: ModSetDefinition;
  variants: Variant[];
  primaryStats: StatDefinition[];
  secondaryStats: StatDefinition[];
  tierView: TierView;
  onAddVariant: () => void;
  onRenameVariant: (variantId: string, name: string) => void;
  onDeleteVariant: (variantId: string) => void;
  onMoveVariant: (variantId: string, dir: -1 | 1) => void;
  onSetPrimary: (variantId: string, statId: number, c: PrimaryClassification) => void;
  onSetSecondary: (
    variantId: string,
    statId: number,
    c: SecondaryClassification
  ) => void;
  onSetTarget: (variantId: string, statId: number, sliderValue: number) => void;
  onToggleMaster: (variantId: string, checked: boolean) => void;
}

export type SetBlockProps = ViewProps | EditProps;

export default function SetBlock(props: SetBlockProps) {
  const configured = props.variants.length > 0;

  return (
    <Card
      chamfered
      chamferSize="md"
      padding="none"
      showDiagonalBorders
      diagonalBorderColor={configured ? 'var(--color-success)' : 'var(--color-border)'}
      className={`${styles.card} ${configured ? styles.cardConfigured : ''}`}
    >
      <div className={styles.header}>
        <h3 className={styles.name}>{props.set.name} Set</h3>
        {props.mode === 'edit' && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={props.onAddVariant}
          >
            + Add scoring rule
          </Button>
        )}
      </div>

      {props.mode === 'edit' ? (
        <EditBody {...props} />
      ) : (
        <ViewBody {...props} />
      )}
    </Card>
  );
}

function EditBody({
  variants,
  primaryStats,
  secondaryStats,
  tierView,
  onRenameVariant,
  onDeleteVariant,
  onMoveVariant,
  onSetPrimary,
  onSetSecondary,
  onSetTarget,
  onToggleMaster,
}: EditProps) {
  if (variants.length === 0) {
    return (
      <p className={styles.empty}>
        No scoring rules — mods of this set will be UNCONFIGURED.
      </p>
    );
  }
  return (
    <div className={styles.list}>
      {variants.map((v, idx) => (
        <ScoringRuleCard
          key={v.id}
          mode="edit"
          variant={v}
          index={idx}
          total={variants.length}
          primaryStats={primaryStats}
          secondaryStats={secondaryStats}
          tierView={tierView}
          onRename={(n) => onRenameVariant(v.id, n)}
          onDelete={() => onDeleteVariant(v.id)}
          onMove={(dir) => onMoveVariant(v.id, dir)}
          onSetPrimary={(sid, c) => onSetPrimary(v.id, sid, c)}
          onSetSecondary={(sid, c) => onSetSecondary(v.id, sid, c)}
          onSetTarget={(sid, val) => onSetTarget(v.id, sid, val)}
          onToggleMaster={(checked) => onToggleMaster(v.id, checked)}
        />
      ))}
    </div>
  );
}

function ViewBody({
  variants,
  primaryStats,
  secondaryStats,
  tierView,
}: ViewProps) {
  return (
    <div className={styles.list}>
      {variants.map((v) => (
        <ScoringRuleCard
          key={v.id}
          mode="view"
          variant={v}
          primaryStats={primaryStats}
          secondaryStats={secondaryStats}
          tierView={tierView}
        />
      ))}
    </div>
  );
}
