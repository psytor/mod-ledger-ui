import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from 'astrogators-shared-ui';
import Layout from '@/components/layout/Layout';
import { evaluationStorage } from '@/services/evaluationStorage';
import { useMods } from '@/contexts/ModContext';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  Evaluation,
  ModSetConfig,
  PrimaryClassification,
  SecondaryClassification,
  Variant,
} from '@/types/evaluation';
import styles from './RuleBuilderPage.module.css';

function isOwner(ev: Evaluation): boolean {
  return ev.ownerUserId === null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; existing: Evaluation | null }
  | { kind: 'not-found' }
  | { kind: 'forbidden' };

function statDisplayName(s: StatDefinition): string {
  return s.is_percentage ? `${s.name} %` : s.name;
}

function emptyVariant(): Variant {
  return {
    id: crypto.randomUUID(),
    name: 'New variant',
    primary_classifications: {},
    secondary_classifications: {},
  };
}

export default function RuleBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { modSets, primaryStats, secondaryStats } = useMods();
  const isEditMode = Boolean(id);

  const [state, setState] = useState<LoadState>(
    isEditMode ? { kind: 'loading' } : { kind: 'ready', existing: null }
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [variantsBySet, setVariantsBySet] = useState<Map<number, Variant[]>>(new Map());

  useEffect(() => {
    if (!isEditMode || !id) return;
    const ev = evaluationStorage.get(id);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!ev) {
      setState({ kind: 'not-found' });
      return;
    }
    if (!isOwner(ev)) {
      setState({ kind: 'forbidden' });
      return;
    }
    setName(ev.name);
    setDescription(ev.description);
    const map = new Map<number, Variant[]>();
    for (const cfg of ev.mod_set_configs) {
      map.set(cfg.set_id, cfg.variants);
    }
    setVariantsBySet(map);
    setState({ kind: 'ready', existing: ev });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id, isEditMode]);

  const orderedPrimaryStats = useMemo(() => {
    const speed = primaryStats.find((s) => s.name === 'Speed');
    const rest = primaryStats.filter((s) => s.name !== 'Speed');
    return speed ? [speed, ...rest] : rest;
  }, [primaryStats]);

  const orderedSecondaryStats = useMemo(() => {
    const speed = secondaryStats.find((s) => s.name === 'Speed');
    const rest = secondaryStats.filter((s) => s.name !== 'Speed');
    return speed ? [speed, ...rest] : rest;
  }, [secondaryStats]);

  if (state.kind === 'loading') {
    return (
      <Layout>
        <p>Loading…</p>
      </Layout>
    );
  }
  if (state.kind === 'not-found') {
    return <Navigate to="/evaluations" replace />;
  }
  if (state.kind === 'forbidden') {
    return <Navigate to={`/evaluations/${id}`} replace />;
  }

  const { existing } = state;

  const updateVariants = (setId: number, mutator: (vs: Variant[]) => Variant[]) => {
    setVariantsBySet((prev) => {
      const next = new Map(prev);
      const current = next.get(setId) ?? [];
      next.set(setId, mutator(current));
      return next;
    });
  };

  const addVariant = (setId: number) => {
    updateVariants(setId, (vs) => [...vs, emptyVariant()]);
  };

  const deleteVariant = (setId: number, variantId: string) => {
    updateVariants(setId, (vs) => vs.filter((v) => v.id !== variantId));
  };

  const moveVariant = (setId: number, variantId: string, dir: -1 | 1) => {
    updateVariants(setId, (vs) => {
      const idx = vs.findIndex((v) => v.id === variantId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= vs.length) return vs;
      const copy = [...vs];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const renameVariant = (setId: number, variantId: string, newName: string) => {
    updateVariants(setId, (vs) =>
      vs.map((v) => (v.id === variantId ? { ...v, name: newName } : v))
    );
  };

  const setPrimaryClass = (
    setId: number,
    variantId: string,
    statId: number,
    classification: PrimaryClassification
  ) => {
    updateVariants(setId, (vs) =>
      vs.map((v) => {
        if (v.id !== variantId) return v;
        const next = { ...v.primary_classifications };
        if (classification === 'neutral') delete next[statId];
        else next[statId] = classification;
        return { ...v, primary_classifications: next };
      })
    );
  };

  const setSecondaryClass = (
    setId: number,
    variantId: string,
    statId: number,
    classification: SecondaryClassification
  ) => {
    updateVariants(setId, (vs) =>
      vs.map((v) => {
        if (v.id !== variantId) return v;
        const next = { ...v.secondary_classifications };
        if (classification === 'neutral') delete next[statId];
        else next[statId] = classification;
        return { ...v, secondary_classifications: next };
      })
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const configs: ModSetConfig[] = [];
    for (const [setId, variants] of variantsBySet.entries()) {
      if (variants.length === 0) continue;
      configs.push({ set_id: setId, variants });
    }

    if (existing) {
      evaluationStorage.update(existing.id, {
        name,
        description,
        mod_set_configs: configs,
      });
      navigate(`/evaluations/${existing.id}`);
    } else {
      const created = evaluationStorage.create({
        ownerUserId: null,
        isPublic: false,
        name,
        description,
        mod_set_configs: configs,
      });
      navigate(`/evaluations/${created.id}`);
    }
  };

  const handleCancel = () => {
    if (existing) navigate(`/evaluations/${existing.id}`);
    else navigate('/evaluations');
  };

  const totalVariants = Array.from(variantsBySet.values()).reduce(
    (sum, vs) => sum + vs.length,
    0
  );

  return (
    <Layout>
      <h1 className={styles.pageTitle}>
        {existing ? 'Edit evaluation' : 'New evaluation'}
      </h1>
      <form onSubmit={handleSubmit} className={styles.page}>
        <div className={styles.metaFields}>
          <label className={styles.fieldLabel}>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={styles.input}
            />
          </label>
          <label className={styles.fieldLabel}>
            <span>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={styles.textarea}
            />
          </label>
        </div>

        <div>
          <p className={styles.sectionIntro}>
            Each mod set holds one or more variants. A mod passes if any variant in
            its set passes — best result wins, with Complementary count as tiebreak.
            Sets with no variants stay UNCONFIGURED. {totalVariants} variant
            {totalVariants === 1 ? '' : 's'} defined.
          </p>

          {modSets.length === 0 ? (
            <p>Loading mod sets…</p>
          ) : (
            <div className={styles.setList}>
              {modSets.map((set) => {
                const variants = variantsBySet.get(set.set_id) ?? [];
                return (
                  <div key={set.set_id} className={styles.setCard}>
                    <div className={styles.setHeader}>
                      <h3 className={styles.setName}>{set.name} Set</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addVariant(set.set_id)}
                      >
                        + Add variant
                      </Button>
                    </div>

                    {variants.length === 0 ? (
                      <p className={styles.setEmpty}>
                        No variants — mods of this set will be UNCONFIGURED.
                      </p>
                    ) : (
                      <div className={styles.variantList}>
                        {variants.map((v, idx) => (
                          <VariantEditor
                            key={v.id}
                            variant={v}
                            index={idx}
                            total={variants.length}
                            primaryStats={orderedPrimaryStats}
                            secondaryStats={orderedSecondaryStats}
                            onRename={(n) => renameVariant(set.set_id, v.id, n)}
                            onDelete={() => deleteVariant(set.set_id, v.id)}
                            onMove={(dir) => moveVariant(set.set_id, v.id, dir)}
                            onSetPrimary={(sid, c) =>
                              setPrimaryClass(set.set_id, v.id, sid, c)
                            }
                            onSetSecondary={(sid, c) =>
                              setSecondaryClass(set.set_id, v.id, sid, c)
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            {existing ? 'Save changes' : 'Create evaluation'}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Layout>
  );
}

interface VariantEditorProps {
  variant: Variant;
  index: number;
  total: number;
  primaryStats: StatDefinition[];
  secondaryStats: StatDefinition[];
  onRename: (name: string) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onSetPrimary: (statId: number, c: PrimaryClassification) => void;
  onSetSecondary: (statId: number, c: SecondaryClassification) => void;
}

function VariantEditor({
  variant,
  index,
  total,
  primaryStats,
  secondaryStats,
  onRename,
  onDelete,
  onMove,
  onSetPrimary,
  onSetSecondary,
}: VariantEditorProps) {
  const counts = countClassifications(variant);

  return (
    <div className={styles.variantCard}>
      <div className={styles.variantHeader}>
        <input
          type="text"
          value={variant.name}
          onChange={(e) => onRename(e.target.value)}
          className={styles.variantNameInput}
        />
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
          { color: 'var(--color-secondary)', label: 'Wanted', value: counts.wanted },
          { color: 'var(--color-error)', label: 'Not wanted', value: counts.notWanted },
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
          { color: 'var(--color-secondary)', label: 'Required', value: counts.required },
          { color: 'var(--color-info)', label: 'Complementary', value: counts.complementary },
        ]}
      />
    </div>
  );
}

function countClassifications(variant: Variant) {
  let wanted = 0;
  let notWanted = 0;
  for (const c of Object.values(variant.primary_classifications)) {
    if (c === 'wanted') wanted++;
    else if (c === 'not_wanted') notWanted++;
  }
  let required = 0;
  let complementary = 0;
  for (const c of Object.values(variant.secondary_classifications)) {
    if (c === 'required') required++;
    else if (c === 'complementary') complementary++;
  }
  return { wanted, notWanted, required, complementary };
}

// State cycle: click neutral → first non-neutral state → second → back to neutral.
type ChipState = {
  value: string;
  label: string;
  swatchColor: string;
};

const PRIMARY_CYCLE: ChipState[] = [
  { value: 'neutral', label: 'Neutral', swatchColor: 'transparent' },
  { value: 'wanted', label: 'Wanted', swatchColor: 'var(--color-secondary)' },
  { value: 'not_wanted', label: 'Not wanted', swatchColor: 'var(--color-error)' },
];

const SECONDARY_CYCLE: ChipState[] = [
  { value: 'neutral', label: 'Neutral', swatchColor: 'transparent' },
  { value: 'required', label: 'Required', swatchColor: 'var(--color-secondary)' },
  { value: 'complementary', label: 'Complementary', swatchColor: 'var(--color-info)' },
];

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

function ChipSection({ title, stats, cycle, getClass, setClass, counts }: ChipSectionProps) {
  const nextState = (current: string): string => {
    const idx = cycle.findIndex((s) => s.value === current);
    return cycle[(idx + 1) % cycle.length].value;
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h4 className={styles.sectionTitle}>{title}</h4>
        <div className={styles.legend}>
          {(counts ?? cycle
            .filter((s) => s.value !== 'neutral')
            .map((s) => ({ color: s.swatchColor, label: s.label, value: undefined as number | undefined }))
          ).map((item) => (
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
