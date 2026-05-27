import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Container, Modal, useAuth, type User } from 'astrogators-shared-ui';
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

// Ownership predicate — see EvaluationDetailPage.isOwner for the rationale.
function isOwner(ev: Evaluation, user: User | null): boolean {
  if (user == null) return ev.ownerUserId === null;
  return ev.ownerUserId === Number(user.id);
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; existing: Evaluation | null }
  | { kind: 'not-found' }
  | { kind: 'forbidden' };

function statDisplayName(s: StatDefinition): string {
  return s.is_percentage ? `${s.name} %` : s.name;
}

type TierView = 5 | 6;

// Linear interp on the stat's per-roll range. Whole number for flat stats,
// 2 decimals + "%" for percent stats (matches in-game presentation).
// Returns null when the stat has no roll bounds (e.g. primary-only stats).
function formatRollAt(
  stat: StatDefinition,
  efficiency: number,
  tier: TierView
): string | null {
  const min = tier === 6 ? stat.min_roll_6 : stat.min_roll_5;
  const max = tier === 6 ? stat.max_roll_6 : stat.max_roll_5;
  if (min === undefined || max === undefined) return null;
  const value = min + efficiency * (max - min);
  return stat.is_percentage ? `${value.toFixed(2)}%` : `${Math.round(value)}`;
}

function emptyVariant(masterTargets: Record<number, number> = {}): Variant {
  return {
    id: crypto.randomUUID(),
    name: 'New scoring rule',
    primary_classifications: {},
    secondary_classifications: {},
    // New variants follow the master by default — seed their stored targets
    // with the current master values so opt-out keeps something meaningful.
    secondary_targets: { ...masterTargets },
    uses_master_targets: true,
  };
}

export default function RuleBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { modSets, primaryStats, secondaryStats } = useMods();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isEditMode = Boolean(id);

  const [state, setState] = useState<LoadState>(
    isEditMode ? { kind: 'loading' } : { kind: 'ready', existing: null }
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [variantsBySet, setVariantsBySet] = useState<Map<number, Variant[]>>(new Map());
  const [masterTargets, setMasterTargets] = useState<Record<number, number>>({});
  const [tierView, setTierView] = useState<TierView>(5);
  const [pendingMasterOptIn, setPendingMasterOptIn] = useState<
    { setId: number; variantId: string } | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Loaded once for live name-collision detection. We don't refresh
  // during the page session (no other tab is editing this user's evals
  // concurrently from this UI).
  const [otherEvaluations, setOtherEvaluations] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (isAuthLoading) return;
    let cancelled = false;
    void evaluationStorage
      .listMine()
      .then((list) => {
        if (cancelled) return;
        setOtherEvaluations(list.map((e) => ({ id: e.id, name: e.name })));
      })
      .catch(() => {
        if (cancelled) return;
        setOtherEvaluations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading]);

  useEffect(() => {
    if (!isEditMode || !id) return;
    if (isAuthLoading) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    void evaluationStorage
      .get(id)
      .then((ev) => {
        if (cancelled) return;
        if (!ev) {
          setState({ kind: 'not-found' });
          return;
        }
        if (!isOwner(ev, user)) {
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
        setMasterTargets(ev.master_secondary_targets);
        setState({ kind: 'ready', existing: ev });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: 'not-found' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEditMode, isAuthLoading, user]);

  const orderedPrimaryStats = useMemo(() => {
    return [...primaryStats].sort((a, b) => a.name.localeCompare(b.name));
  }, [primaryStats]);

  const orderedSecondaryStats = useMemo(() => {
    return [...secondaryStats].sort((a, b) => a.name.localeCompare(b.name));
  }, [secondaryStats]);

  if (state.kind === 'loading') {
    return (
      <Layout>
        <Container maxWidth="xl">
          <div className={styles.page}>
            <p className={styles.loadingState}>Loading…</p>
          </div>
        </Container>
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

  const trimmedName = name.trim();
  const nameCollides =
    trimmedName.length > 0 &&
    otherEvaluations.some(
      (e) =>
        e.id !== existing?.id &&
        e.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

  const updateVariants = (setId: number, mutator: (vs: Variant[]) => Variant[]) => {
    setVariantsBySet((prev) => {
      const next = new Map(prev);
      const current = next.get(setId) ?? [];
      next.set(setId, mutator(current));
      return next;
    });
  };

  const addVariant = (setId: number) => {
    updateVariants(setId, (vs) => [...vs, emptyVariant(masterTargets)]);
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

  // Slider value comes in as integer 0–100; persisted as 0–1 float.
  const setSecondaryTarget = (
    setId: number,
    variantId: string,
    statId: number,
    sliderValue: number
  ) => {
    updateVariants(setId, (vs) =>
      vs.map((v) => {
        if (v.id !== variantId) return v;
        return {
          ...v,
          secondary_targets: {
            ...v.secondary_targets,
            [statId]: sliderValue / 100,
          },
        };
      })
    );
  };

  // Master slider write-through: store in masterTargets and mirror the value
  // into every opted-in variant's secondary_targets, across all six sets.
  const setMasterTarget = (statId: number, sliderValue: number) => {
    const stored = sliderValue / 100;
    setMasterTargets((prev) => ({ ...prev, [statId]: stored }));
    setVariantsBySet((prev) => {
      const next = new Map<number, Variant[]>();
      for (const [setId, vs] of prev.entries()) {
        next.set(
          setId,
          vs.map((v) =>
            v.uses_master_targets
              ? { ...v, secondary_targets: { ...v.secondary_targets, [statId]: stored } }
              : v
          )
        );
      }
      return next;
    });
  };

  const applyMasterToVariant = (setId: number, variantId: string) => {
    updateVariants(setId, (vs) =>
      vs.map((v) =>
        v.id === variantId
          ? { ...v, uses_master_targets: true, secondary_targets: { ...masterTargets } }
          : v
      )
    );
  };

  const toggleVariantMaster = (setId: number, variantId: string, nextChecked: boolean) => {
    if (!nextChecked) {
      // Opting out — preserve current values, just flip the flag.
      updateVariants(setId, (vs) =>
        vs.map((v) => (v.id === variantId ? { ...v, uses_master_targets: false } : v))
      );
      return;
    }
    // Opting in — confirm overwrite if there's anything stored to lose.
    const vs = variantsBySet.get(setId) ?? [];
    const variant = vs.find((v) => v.id === variantId);
    const hasStoredTargets =
      variant != null && Object.keys(variant.secondary_targets).length > 0;
    if (hasStoredTargets) {
      setPendingMasterOptIn({ setId, variantId });
    } else {
      applyMasterToVariant(setId, variantId);
    }
  };

  const confirmMasterOptIn = () => {
    if (!pendingMasterOptIn) return;
    applyMasterToVariant(pendingMasterOptIn.setId, pendingMasterOptIn.variantId);
    setPendingMasterOptIn(null);
  };

  const cancelMasterOptIn = () => setPendingMasterOptIn(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const configs: ModSetConfig[] = [];
    for (const [setId, variants] of variantsBySet.entries()) {
      if (variants.length === 0) continue;
      configs.push({ set_id: setId, variants });
    }

    setSaveError(null);
    setIsSaving(true);
    try {
      if (existing) {
        await evaluationStorage.update(existing.id, {
          name,
          description,
          mod_set_configs: configs,
          master_secondary_targets: masterTargets,
        });
        navigate(`/evaluations/${existing.id}`);
      } else {
        const created = await evaluationStorage.create({
          ownerUserId: null,
          visibility: 'private',
          version: 1,
          name,
          description,
          mod_set_configs: configs,
          master_secondary_targets: masterTargets,
          authoredBy: null,
          sourceProtocol: null,
        });
        navigate(`/evaluations/${created.id}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save evaluation.';
      setSaveError(message);
      setIsSaving(false);
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
  const configuredSetCount = Array.from(variantsBySet.values()).filter(
    (vs) => vs.length > 0
  ).length;

  return (
    <Layout>
      <Container maxWidth="xl">
        <div className={styles.page}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <Card
              chamfered
              chamferSize="lg"
              variant="outline"
              padding="none"
              showDiagonalBorders
              diagonalBorderColor="var(--color-primary)"
              className={styles.hero}
            >
              <span className={styles.heroAccent} aria-hidden="true" />
              <header className={styles.heroHeader}>
                <p className={styles.eyebrow}>
                  Mod Ledger // {existing ? 'Edit Evaluation' : 'New Evaluation'}
                </p>
                <h1 className={styles.pageTitle}>
                  {existing ? 'Edit evaluation' : 'New evaluation'}
                </h1>
                <p className={styles.heroSubtitle}>
                  Define how mods score by configuring scoring rules per set. Each rule captures a
                  combination of stats you'd accept; a mod passes if any rule in its set passes.
                </p>
              </header>

              <div className={styles.metaFields}>
                <label className={styles.fieldLabel}>
                  <span>Evaluation name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={styles.input}
                    autoComplete="off"
                  />
                  {nameCollides && (
                    <small className={styles.fieldWarning}>
                      An evaluation named "{trimmedName}" already exists. Saving
                      will create a separate one with the same name.
                    </small>
                  )}
                </label>
                <label className={styles.fieldLabel}>
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className={styles.textarea}
                    autoComplete="off"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                </label>
              </div>
            </Card>

            <section className={styles.sectionBlock}>
              <header className={styles.sectionHead}>
                <h2 className={styles.sectionTitleLg}>Master roll targets</h2>
                <p className={styles.sectionMeta}>
                  Shared across all sets &amp; variants
                </p>
              </header>

              <p className={styles.sectionIntro}>
                Set roll-target efficiencies once here. Every variant with
                "Follow master" checked mirrors these values automatically. Uncheck
                a variant to customise its targets independently.
              </p>

              <Card
                chamfered
                chamferSize="sm"
                padding="none"
                className={`${styles.variantCard} ${styles.masterCard}`}
              >
                <div className={styles.section}>
                  <RollTargetsGrid
                    values={masterTargets}
                    secondaryStats={orderedSecondaryStats}
                    tierView={tierView}
                    onSetTarget={setMasterTarget}
                  />
                </div>
              </Card>
            </section>

            <section className={styles.sectionBlock}>
              <header className={styles.sectionHead}>
                <h2 className={styles.sectionTitleLg}>Mod sets</h2>
                <p className={styles.sectionMeta}>
                  <strong>{configuredSetCount}</strong> /{' '}
                  {modSets.length || '—'} configured ·{' '}
                  <strong>{totalVariants}</strong> scoring rule
                  {totalVariants === 1 ? '' : 's'}
                </p>
              </header>

              <p className={styles.sectionIntro}>
                Each mod set holds one or more scoring rules. A mod passes if any rule in its set
                passes — best result wins, with Complementary count as tiebreak. Sets with no
                rules stay UNCONFIGURED.
              </p>

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
                <p className={styles.loadingState}>Loading mod sets…</p>
              ) : (
                <div className={styles.setList}>
                  {modSets.map((set) => {
                    const variants = variantsBySet.get(set.set_id) ?? [];
                    const configured = variants.length > 0;
                    return (
                      <Card
                        key={set.set_id}
                        chamfered
                        chamferSize="md"
                        padding="none"
                        showDiagonalBorders
                        diagonalBorderColor={configured ? 'var(--color-success)' : 'var(--color-border)'}
                        className={`${styles.setCard} ${configured ? styles.setCardConfigured : ''}`}
                      >
                        <div className={styles.setHeader}>
                          <h3 className={styles.setName}>{set.name} Set</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addVariant(set.set_id)}
                          >
                            + Add scoring rule
                          </Button>
                        </div>

                        {variants.length === 0 ? (
                          <p className={styles.setEmpty}>
                            No scoring rules — mods of this set will be UNCONFIGURED.
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
                                tierView={tierView}
                                onRename={(n) => renameVariant(set.set_id, v.id, n)}
                                onDelete={() => deleteVariant(set.set_id, v.id)}
                                onMove={(dir) => moveVariant(set.set_id, v.id, dir)}
                                onSetPrimary={(sid, c) =>
                                  setPrimaryClass(set.set_id, v.id, sid, c)
                                }
                                onSetSecondary={(sid, c) =>
                                  setSecondaryClass(set.set_id, v.id, sid, c)
                                }
                                onSetTarget={(sid, val) =>
                                  setSecondaryTarget(set.set_id, v.id, sid, val)
                                }
                                onToggleMaster={(checked) =>
                                  toggleVariantMaster(set.set_id, v.id, checked)
                                }
                              />
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <Card chamfered chamferSize="sm" padding="none" className={styles.actionsBar}>
              <p className={styles.actionsCount}>
                <strong>{configuredSetCount}</strong> configured ·{' '}
                <strong>{totalVariants}</strong> scoring rule{totalVariants === 1 ? '' : 's'}
              </p>
              {saveError && (
                <p
                  role="alert"
                  style={{ color: 'var(--color-danger, #d33)', margin: 0 }}
                >
                  {saveError}
                </p>
              )}
              <div className={styles.actionsButtons}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!name.trim() || isSaving}
                >
                  {isSaving
                    ? 'Saving…'
                    : existing
                      ? 'Save changes'
                      : 'Create evaluation'}
                </Button>
              </div>
            </Card>
          </form>
        </div>
      </Container>

      <Modal
        isOpen={pendingMasterOptIn !== null}
        onClose={cancelMasterOptIn}
        title="Follow master roll targets?"
        size="sm"
      >
        <div className={styles.confirmBody}>
          <p>
            This variant's current roll targets will be replaced with the master values.
          </p>
          <p className={styles.confirmHint}>
            Uncheck "Follow master" later to customise this variant again — the master
            values will be left in place to edit from.
          </p>
          <div className={styles.confirmActions}>
            <Button type="button" variant="outline" onClick={cancelMasterOptIn}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={confirmMasterOptIn}>
              Replace with master
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

interface RollTargetsGridProps {
  values: Record<number, number>;
  secondaryStats: StatDefinition[];
  tierView: TierView;
  onSetTarget: (statId: number, sliderValue: number) => void;
  disabled?: boolean;
}

function RollTargetsGrid({
  values,
  secondaryStats,
  tierView,
  onSetTarget,
  disabled = false,
}: RollTargetsGridProps) {
  return (
    <div className={styles.targetGrid}>
      {secondaryStats.map((stat) => {
        const stored = values[stat.stat_id];
        const value = stored === undefined ? 50 : Math.round(stored * 100);
        const rollText = formatRollAt(stat, value / 100, tierView);
        return (
          <div
            key={stat.stat_id}
            className={styles.targetRow}
            data-disabled={disabled || undefined}
          >
            <span className={styles.targetName}>
              {stat.is_percentage ? `${stat.name} %` : stat.name}
            </span>
            <span className={styles.targetValue}>
              {value}%
              {rollText !== null && (
                <span className={styles.targetApprox}> (≈{rollText})</span>
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
              className={styles.targetSlider}
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

interface VariantEditorProps {
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

function VariantEditor({
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
}: VariantEditorProps) {
  const counts = countClassifications(variant);
  const following = variant.uses_master_targets;

  return (
    <Card chamfered chamferSize="sm" padding="none" className={styles.variantCard}>
      <div className={styles.variantHeader}>
        <input
          type="text"
          value={variant.name}
          onChange={(e) => onRename(e.target.value)}
          className={styles.variantNameInput}
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
        />
        <label className={styles.followMasterToggle} title="Mirror the master Roll Targets panel">
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
      <div className={styles.sectionHeadInline}>
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
