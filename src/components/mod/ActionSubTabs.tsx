import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import { useFilters } from '@/contexts/FilterContext';
import type { ActionTab } from '@/contexts/FilterContext';
import {
  actionOf,
  stageOf,
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
  level: 'Level',
  slice: 'Slice',
  deploy: 'Deploy',
  'pre-eval': 'Pre-Eval',
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
        <SliceGroups
          mods={activeMods}
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
              {stage}
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
