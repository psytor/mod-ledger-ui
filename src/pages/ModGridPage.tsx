import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, Button, Loader } from 'astrogators-shared-ui';
import { useMods } from '@/contexts/ModContext';
import { useFilters } from '@/contexts/FilterContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import {
  applyFlatFilters,
  applySellPileFilters,
  applyUnconfiguredFilters,
  groupMods,
  sortMods,
} from '@/utils/modFilters';
import Layout from '@/components/layout/Layout';
import ModGrid from '@/components/mod/ModGrid';
import ModDetailModal from '@/components/mod/ModDetailModal';
import InventoryOverview from '@/components/mod/InventoryOverview';
import { buildRankings, computeRelativePositions } from '@/utils/cohortRanking';
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

  if (isLoadingMods) {
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
      const filtered = applyFlatFilters(mods, filters, verdicts);
      const rankings = noEvaluation
        ? undefined
        : buildRankings(mods, verdicts, computeRelativePositions(mods, verdicts));
      const sorted = sortMods(filtered, filters.sortBy, verdicts);
      const groups = groupMods(sorted, filters.groupBy);
      return (
        <>
          {!noEvaluation && <InventoryOverview mods={mods} verdicts={verdicts} />}
          {groups.map((group) => (
            <div key={group.key} className={styles.group}>
              {group.label && <h2 className={styles.groupHeading}>{group.label}</h2>}
              <ModGrid
                mods={group.mods}
                rankings={rankings}
                onModClick={handleModClick}
              />
            </div>
          ))}
        </>
      );
    }

    if (noEvaluation) {
      return <ModGrid mods={mods} onModClick={handleModClick} />;
    }

    if (filters.mode === 'sell-pile') {
      const sellMods = applySellPileFilters(mods, verdicts, filters);
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

        <div className={styles.contentArea}>{renderContent()}</div>

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
