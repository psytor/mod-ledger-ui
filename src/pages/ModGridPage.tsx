import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, Button, Loader } from 'astrogators-shared-ui';
import { useMods } from '@/contexts/ModContext';
import { useFilters } from '@/contexts/FilterContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { usePilotAssignment } from '@/contexts/PilotAssignmentContext';
import {
  applyFlatFilters,
  applySellPileFilters,
  applyUnconfiguredFilters,
  groupMods,
  sortMods,
} from '@/utils/modFilters';
import Layout from '@/components/layout/Layout';
import ModGrid from '@/components/mod/ModGrid';
import OrphanModCard from '@/components/mod/OrphanModCard';
import ModDetailModal from '@/components/mod/ModDetailModal';
import InventoryReadout from '@/components/mod/InventoryReadout';
import FilterPanel from '@/components/filter/FilterPanel';
import EvaluationSelector from '@/components/evaluation/EvaluationSelector';
import type { ParsedMod } from '@/services/modLedgerApi';
import styles from './ModGridPage.module.css';

const MODE_TITLES: Record<string, string> = {
  flat: 'All Mods',
  'sell-pile': 'Sell Pile',
  unconfigured: 'Unconfigured Mods',
};

function UnconfiguredView({
  mods,
  activeEvaluationId,
  onModClick,
}: {
  mods: ParsedMod[];
  activeEvaluationId: string | null;
  onModClick: (mod: ParsedMod) => void;
}) {
  if (mods.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No unconfigured mods — every set has rules defined.</p>
      </div>
    );
  }

  const bySet = new Map<string, ParsedMod[]>();
  for (const mod of mods) {
    const bucket = bySet.get(mod.set);
    if (bucket) bucket.push(mod);
    else bySet.set(mod.set, [mod]);
  }

  const editLink = activeEvaluationId
    ? `/evaluations/${activeEvaluationId}/edit`
    : '/evaluations';

  return (
    <div className={styles.unconfiguredContainer}>
      {[...bySet.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([set, setMods]) => (
          <div key={set} className={styles.unconfiguredGroup}>
            <div className={styles.unconfiguredHeader}>
              <span className={styles.unconfiguredSet}>
                {set} — {setMods.length} mods
              </span>
              <Link to={editLink} className={styles.configureLink}>
                Configure rules for this set →
              </Link>
            </div>
            <ModGrid mods={setMods} onModClick={onModClick} />
          </div>
        ))}
    </div>
  );
}

export default function ModGridPage() {
  const { selectedAllyCode } = useAuth();
  const { mods, isLoadingMods, modsError, fetchMods } = useMods();
  const { filters, openPanel } = useFilters();
  const { verdicts, clearVerdicts, activeEvaluationId } = useEvaluation();
  const { assignments } = usePilotAssignment();
  const assignedModIds = new Set(assignments.keys());

  const [selectedMod, setSelectedMod] = useState<ParsedMod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (selectedAllyCode) {
      clearVerdicts();
      fetchMods(selectedAllyCode);
    }
  }, [selectedAllyCode, fetchMods, clearVerdicts]);

  const handleModClick = (mod: ParsedMod) => {
    setSelectedMod(mod);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMod(null);
  };

  // Full-page loader only on the *initial* load (nothing to show yet). A manual
  // refresh keeps the existing grid on screen and dims it (see contentArea
  // below) while the ⟳ spins in the TopBar — no jarring blank-and-pop.
  if (isLoadingMods && mods.length === 0) {
    return (
      <Layout>
        <div className={styles.loaderContainer}>
          <Loader size="lg" />
          <p>Loading your mods...</p>
        </div>
      </Layout>
    );
  }

  if (modsError) {
    return (
      <Layout>
        <div className={styles.errorContainer}>
          <h2>Error Loading Mods</h2>
          <p>{modsError}</p>
          <Button onClick={() => selectedAllyCode && fetchMods(selectedAllyCode)}>
            Try Again
          </Button>
        </div>
      </Layout>
    );
  }

  // No evaluation selected (or not yet run): show every mod plainly, with no
  // scoring/banding and no mode title — the mode is meaningless without verdicts.
  const noEvaluation = !activeEvaluationId || verdicts.size === 0;

  const renderContent = () => {
    if (filters.mode === 'flat') {
      const filtered = applyFlatFilters(mods, filters, verdicts, assignedModIds);
      const sorted = sortMods(filtered, filters.sortBy, verdicts);
      const groups = groupMods(sorted, filters.groupBy);

      // Orphan pilot mods: assigned but absent from the current pull (unequipped
      // or sold — Comlink only reports equipped mods, so we can't tell which).
      // They only belong in the For Pilots bucket; every other lens shows live
      // inventory. Rendered from their stored snapshot below the present mods.
      const presentModIds = new Set(mods.map((m) => m.mod_id));
      const orphans =
        filters.bucket === 'for-pilot'
          ? [...assignments.values()].filter((a) => !presentModIds.has(a.modId))
          : [];

      return (
        <>
          {!noEvaluation && <InventoryReadout mods={mods} verdicts={verdicts} />}
          {/* Suppress the present-mods grid (and its "no mods" empty state) only
              when there are zero present mods but orphans to show — otherwise the
              empty state would lie. Every other case renders the groups. */}
          {(filtered.length > 0 || orphans.length === 0) &&
            groups.map((group) => (
              <div key={group.key} className={styles.group}>
                {group.label && <h2 className={styles.groupHeading}>{group.label}</h2>}
                <ModGrid
                  mods={group.mods}
                  onModClick={handleModClick}
                />
              </div>
            ))}
          {orphans.length > 0 && (
            <div className={styles.group}>
              <h2 className={styles.groupHeading}>Not currently equipped</h2>
              <p className={styles.orphanNote}>
                These mods are assigned to your pilot pool but weren&rsquo;t in your
                latest inventory pull — the game only reports equipped mods. If you
                unequipped one, leave it assigned. If you sold it, remove it.
              </p>
              <ModGrid
                mods={[]}
                onModClick={handleModClick}
                trailing={orphans.map((a) => (
                  <OrphanModCard key={a.modId} assignment={a} />
                ))}
              />
            </div>
          )}
        </>
      );
    }

    if (noEvaluation) {
      return <ModGrid mods={mods} onModClick={handleModClick} />;
    }

    if (filters.mode === 'sell-pile') {
      const sellMods = applySellPileFilters(mods, verdicts, filters, assignedModIds);
      return <ModGrid mods={sellMods} onModClick={handleModClick} />;
    }

    // unconfigured
    const unconfigured = applyUnconfiguredFilters(mods, verdicts);
    return (
      <UnconfiguredView
        mods={unconfigured}
        activeEvaluationId={activeEvaluationId}
        onModClick={handleModClick}
      />
    );
  };

  return (
    <Layout>
      <div className={styles.pageContainer}>
        <EvaluationSelector />

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>
              {filters.mode === 'flat'
                ? 'All Mods'
                : noEvaluation
                  ? 'Mods'
                  : MODE_TITLES[filters.mode] ?? 'Mods'}
            </h1>
            <p className={styles.modCount}>
              {filters.mode === 'flat'
                ? `Showing ${applyFlatFilters(mods, filters, verdicts).length} of ${mods.length} mods`
                : `${mods.length} mods loaded`}
            </p>
          </div>

          <div className={styles.headerRight}>
            <Button
              variant="primary"
              onClick={openPanel}
              className={styles.filterButton}
            >
              Filters
            </Button>
          </div>
        </div>

        <div
          className={`${styles.contentArea} ${isLoadingMods ? styles.refreshing : ''}`}
          aria-busy={isLoadingMods}
        >
          {renderContent()}
        </div>

        <FilterPanel />

        <ModDetailModal
          mod={selectedMod}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </div>
    </Layout>
  );
}
