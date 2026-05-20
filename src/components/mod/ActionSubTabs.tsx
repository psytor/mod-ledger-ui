import { useState } from 'react';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import { useFilters } from '@/contexts/FilterContext';
import type { ActionTab } from '@/contexts/FilterContext';
import {
  actionOf,
  stageOf,
  formatStage,
  computeRelativePositions,
  buildRankings,
  STAGE_ORDER,
  type ModAction,
  type ModRanking,
} from '@/utils/cohortRanking';
import ModGrid from './ModGrid';
import styles from './ActionSubTabs.module.css';

// Pre-eval is intentionally absent — pre-eval mods have no winning variant so
// they cannot live inside a variant view. They are surfaced in the Overview.
const TAB_ORDER: ActionTab[] = ['level', 'slice', 'deploy'];
const TAB_LABELS: Record<ActionTab, string> = {
  level: 'Upgrade',
  slice: 'Slice',
  deploy: 'Maxed',
  'pre-eval': 'Unrevealed',
};

interface ActionSubTabsProps {
  mods: ParsedMod[]; // variant-filtered, NOT action-filtered
  verdicts: Map<string, VerdictResult>;
  onModClick: (mod: ParsedMod) => void;
}

export default function ActionSubTabs({
  mods,
  verdicts,
  onModClick,
}: ActionSubTabsProps) {
  const { filters, setFilter } = useFilters();

  // Ephemeral view preference for the Slice tab: "stage" = the per-stage
  // grouped view (SliceGroups), "overall" = one flat list ranked by quality
  // across all stages. Local state (not persisted in FilterContext) because
  // it is a transient view choice, unlike actionTab.
  const [sliceView, setSliceView] = useState<'stage' | 'overall'>('stage');

  // Bucket mods by drilldown action.
  const byAction = new Map<ModAction, ParsedMod[]>();
  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const action = actionOf(mod, verdict);
    if (action === 'level' || action === 'slice' || action === 'deploy') {
      const bucket = byAction.get(action);
      if (bucket) bucket.push(mod);
      else byAction.set(action, [mod]);
    }
  }

  const availableTabs = TAB_ORDER.filter(
    (t) => (byAction.get(t)?.length ?? 0) > 0
  );

  if (availableTabs.length === 0) {
    return <div className={styles.empty}>No mods in this view.</div>;
  }

  // Derived active tab: persisted selection if still valid, else first available.
  const activeTab: ActionTab =
    filters.actionTab && availableTabs.includes(filters.actionTab)
      ? filters.actionTab
      : availableTabs[0];

  // Cohorts never cross action types, so computing positions once over the
  // whole variant view yields the same per-mod result as computing per-tab.
  const relativePositions = computeRelativePositions(mods, verdicts);
  const rankings = buildRankings(mods, verdicts, relativePositions);

  // Best-first: rank by cohort percentile when available, else absolute quality.
  const sortByRank = (a: ParsedMod, b: ParsedMod): number => {
    const ra = rankings.get(a.mod_id);
    const rb = rankings.get(b.mod_id);
    const va = ra?.relative_position ?? ra?.absolute_quality ?? 0;
    const vb = rb?.relative_position ?? rb?.absolute_quality ?? 0;
    return vb - va;
  };

  const activeMods = [...(byAction.get(activeTab) ?? [])].sort(sortByRank);

  return (
    <div>
      <div className={styles.tabStrip}>
        {availableTabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${
              activeTab === tab ? styles.tabActive : ''
            }`}
            onClick={() => setFilter('actionTab', tab)}
          >
            {TAB_LABELS[tab]}{' '}
            <span className={styles.tabCount}>
              {byAction.get(tab)?.length ?? 0}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'slice' ? (
        <>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.tab} ${sliceView === 'stage' ? styles.tabActive : ''}`}
              onClick={() => setSliceView('stage')}
            >
              By stage
            </button>
            <button
              className={`${styles.tab} ${sliceView === 'overall' ? styles.tabActive : ''}`}
              onClick={() => setSliceView('overall')}
            >
              Overall
            </button>
          </div>
          {sliceView === 'stage' ? (
            <SliceGroups
              mods={activeMods}
              rankings={rankings}
              onModClick={onModClick}
            />
          ) : (
            <SliceOverall
              mods={activeMods}
              verdicts={verdicts}
              rankings={rankings}
              onModClick={onModClick}
            />
          )}
        </>
      ) : activeTab === 'level' ? (
        <LevelGroups
          mods={activeMods}
          verdicts={verdicts}
          rankings={rankings}
          onModClick={onModClick}
        />
      ) : (
        <ModGrid
          mods={activeMods}
          rankings={rankings}
          onModClick={onModClick}
        />
      )}
    </div>
  );
}

// Level mods are grouped by target_level — these are direct to-do lists:
// "Upgrade to L9: N mods", "Upgrade to L12: M mods", etc. Within each group
// they sort by absolute_quality desc so the highest-quality candidates show first.
function LevelGroups({
  mods,
  verdicts,
  rankings,
  onModClick,
}: {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
  rankings: Map<string, ModRanking>;
  onModClick: (mod: ParsedMod) => void;
}) {
  const byTarget = new Map<number, ParsedMod[]>();
  for (const mod of mods) {
    const target = verdicts.get(mod.mod_id)?.target_level;
    if (target === undefined) continue;
    const bucket = byTarget.get(target);
    if (bucket) bucket.push(mod);
    else byTarget.set(target, [mod]);
  }

  const orderedTargets = [...byTarget.keys()].sort((a, b) => a - b);

  const sortByQuality = (a: ParsedMod, b: ParsedMod): number => {
    const va = verdicts.get(a.mod_id)?.absolute_quality ?? 0;
    const vb = verdicts.get(b.mod_id)?.absolute_quality ?? 0;
    return vb - va;
  };

  return (
    <>
      {orderedTargets.map((target) => {
        const targetMods = [...(byTarget.get(target) ?? [])].sort(sortByQuality);
        return (
          <div key={target} className={styles.stageGroup}>
            <h3 className={styles.stageHeader}>
              Upgrade to L{target}
              <span className={styles.stageCount}>({targetMods.length})</span>
            </h3>
            <ModGrid
              mods={targetMods}
              rankings={rankings}
              onModClick={onModClick}
            />
          </div>
        );
      })}
    </>
  );
}

// Slice mods are grouped by stage so each (stage, variant) cohort reads as a
// distinct ranked block — a 5d-A and a 6d-E are never visually conflated.
function SliceGroups({
  mods,
  rankings,
  onModClick,
}: {
  mods: ParsedMod[];
  rankings: Map<string, ModRanking>;
  onModClick: (mod: ParsedMod) => void;
}) {
  const byStage = new Map<string, ParsedMod[]>();
  for (const mod of mods) {
    const stage = stageOf(mod) ?? 'unknown';
    const bucket = byStage.get(stage);
    if (bucket) bucket.push(mod);
    else byStage.set(stage, [mod]);
  }

  const orderedStages = [...byStage.keys()].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a as (typeof STAGE_ORDER)[number]) -
      STAGE_ORDER.indexOf(b as (typeof STAGE_ORDER)[number])
  );

  const sortByRank = (a: ParsedMod, b: ParsedMod): number => {
    const ra = rankings.get(a.mod_id);
    const rb = rankings.get(b.mod_id);
    const va = ra?.relative_position ?? ra?.absolute_quality ?? 0;
    const vb = rb?.relative_position ?? rb?.absolute_quality ?? 0;
    return vb - va;
  };

  return (
    <>
      {orderedStages.map((stage) => {
        const stageMods = [...(byStage.get(stage) ?? [])].sort(sortByRank);
        return (
          <div key={stage} className={styles.stageGroup}>
            <h3 className={styles.stageHeader}>
              {formatStage(stage)}
              <span className={styles.stageCount}>({stageMods.length})</span>
            </h3>
            <ModGrid
              mods={stageMods}
              rankings={rankings}
              onModClick={onModClick}
            />
          </div>
        );
      })}
    </>
  );
}

// "Overall" slice view: one flat list across ALL stages, ordered by
// absolute_quality desc — the global "best slicing candidate first" priority
// queue. relative_position is deliberately NOT the sort key: it is a
// per-(stage, variant) cohort percentile (see cohortRanking.ts cohortKey) and
// is not comparable across stages. The per-cohort band chips on each ModCard
// are unaffected — rankings is still passed through.
function SliceOverall({
  mods,
  verdicts,
  rankings,
  onModClick,
}: {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
  rankings: Map<string, ModRanking>;
  onModClick: (mod: ParsedMod) => void;
}) {
  const sorted = [...mods].sort((a, b) => {
    const va = verdicts.get(a.mod_id);
    const vb = verdicts.get(b.mod_id);
    const qa = va?.absolute_quality ?? 0;
    const qb = vb?.absolute_quality ?? 0;
    if (qa !== qb) return qb - qa;
    const sa = va?.score ?? 0;
    const sb = vb?.score ?? 0;
    if (sa !== sb) return sb - sa;
    return a.mod_id < b.mod_id ? -1 : a.mod_id > b.mod_id ? 1 : 0;
  });

  return (
    <ModGrid
      mods={sorted}
      rankings={rankings}
      onModClick={onModClick}
      absoluteBand
    />
  );
}
