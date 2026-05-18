import type { ParsedMod } from '@/services/modLedgerApi';
import type { VerdictResult } from '@/types/evaluation';
import { useFilters } from '@/contexts/FilterContext';
import {
  actionOf,
  stageOf,
  formatStage,
  computeRelativePositions,
  buildRankings,
  STAGE_ORDER,
} from '@/utils/cohortRanking';
import ModGrid from './ModGrid';
import styles from './OverviewView.module.css';

// Preview shape sized for a 4-wide grid: top-7 + "View more" tile = 8 tiles
// = two full rows. Top-only so the eye lands on the keepers — the at-a-glance
// "what's worth investing in" list. Groups of 8 or fewer show in full (a tile
// would only hide one mod, not worth the trade).
const PREVIEW_TOP = 7;
const PREVIEW_THRESHOLD = 8;

interface OverviewViewProps {
  mods: ParsedMod[];
  verdicts: Map<string, VerdictResult>;
  onModClick: (mod: ParsedMod) => void;
}

interface VariantGroup {
  variantId: string;
  variantName: string;
  mods: ParsedMod[]; // sorted best → worst by absolute_quality
}

interface StageGroup {
  stage: string;
  variants: VariantGroup[];
  preEval: ParsedMod[];
}

function buildStageGroups(
  mods: ParsedMod[],
  verdicts: Map<string, VerdictResult>
): StageGroup[] {
  // stage -> variantId -> mods, and stage -> pre-eval mods
  const byStage = new Map<
    string,
    { variants: Map<string, ParsedMod[]>; preEval: ParsedMod[] }
  >();

  const ensureStage = (stage: string) => {
    let entry = byStage.get(stage);
    if (!entry) {
      entry = { variants: new Map(), preEval: [] };
      byStage.set(stage, entry);
    }
    return entry;
  };

  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const stage = stageOf(mod);
    if (!stage) continue;
    const action = actionOf(mod, verdict);

    if (action === 'pre-eval') {
      ensureStage(stage).preEval.push(mod);
    } else if (
      (action === 'level' || action === 'slice' || action === 'deploy') &&
      verdict.winning_variant_id
    ) {
      const entry = ensureStage(stage);
      const bucket = entry.variants.get(verdict.winning_variant_id);
      if (bucket) bucket.push(mod);
      else entry.variants.set(verdict.winning_variant_id, [mod]);
    }
  }

  const result: StageGroup[] = [];
  for (const stage of STAGE_ORDER) {
    const entry = byStage.get(stage);
    if (!entry) continue;

    const variants: VariantGroup[] = [];
    for (const [variantId, variantMods] of entry.variants) {
      const sorted = [...variantMods].sort(
        (a, b) =>
          (verdicts.get(b.mod_id)?.absolute_quality ?? 0) -
          (verdicts.get(a.mod_id)?.absolute_quality ?? 0)
      );
      const variantName =
        verdicts.get(variantMods[0].mod_id)?.winning_variant_name ?? variantId;
      variants.push({ variantId, variantName, mods: sorted });
    }
    variants.sort((a, b) => b.mods.length - a.mods.length);

    result.push({ stage, variants, preEval: entry.preEval });
  }
  return result;
}

function previewMods(sorted: ParsedMod[]): ParsedMod[] {
  if (sorted.length <= PREVIEW_THRESHOLD) return sorted;
  return sorted.slice(0, PREVIEW_TOP);
}

export default function OverviewView({
  mods,
  verdicts,
  onModClick,
}: OverviewViewProps) {
  const { filters, setFilter } = useFilters();

  const relativePositions = computeRelativePositions(mods, verdicts);
  const rankings = buildRankings(mods, verdicts, relativePositions);
  const allStageGroups = buildStageGroups(mods, verdicts);
  // Honor the stage drilldown selection — when a stage is picked, only that
  // section shows.
  const stageGroups = filters.stage
    ? allStageGroups.filter((g) => g.stage === filters.stage)
    : allStageGroups;

  const drillInto = (stage: string, variantId: string) => {
    setFilter('stage', stage);
    setFilter('variantId', variantId);
    setFilter('slot', null);
    setFilter('primary', null);
    setFilter('actionTab', null);
  };

  if (stageGroups.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No evaluated mods yet. Select an evaluation to get started.</p>
      </div>
    );
  }

  return (
    <div className={styles.overview}>
      {stageGroups.map(({ stage, variants, preEval }) => (
        <section key={stage} className={styles.stageSection}>
          <h2 className={styles.stageTitle}>{formatStage(stage)}</h2>

          {variants.map((vg) => {
            const truncated = vg.mods.length > PREVIEW_THRESHOLD;
            const hiddenCount = truncated ? vg.mods.length - PREVIEW_TOP : 0;
            return (
              <div key={vg.variantId} className={styles.variantRow}>
                <button
                  className={styles.variantHeader}
                  onClick={() => drillInto(stage, vg.variantId)}
                >
                  <span className={styles.variantName}>{vg.variantName}</span>
                  <span className={styles.variantCount}>
                    {vg.mods.length} mods
                  </span>
                </button>
                <ModGrid
                  mods={previewMods(vg.mods)}
                  rankings={rankings}
                  onModClick={onModClick}
                  trailing={
                    truncated ? (
                      <button
                        type="button"
                        className={styles.viewMoreTile}
                        onClick={() => drillInto(stage, vg.variantId)}
                      >
                        <span className={styles.viewMoreCount}>
                          +{hiddenCount}
                        </span>
                        <span className={styles.viewMoreLabel}>
                          View all {vg.mods.length} mods
                        </span>
                        <span className={styles.viewMoreArrow} aria-hidden>
                          →
                        </span>
                      </button>
                    ) : null
                  }
                />
              </div>
            );
          })}

          {preEval.length > 0 && (
            <div className={styles.variantRow}>
              <div className={styles.preEvalHeader}>
                <span className={styles.variantName}>Unrevealed</span>
                <span className={styles.variantCount}>
                  {preEval.length} mods need leveling to reveal stats
                </span>
              </div>
              <ModGrid mods={preEval} onModClick={onModClick} />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
