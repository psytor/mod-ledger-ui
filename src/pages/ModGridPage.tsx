import { useEffect, useState } from 'react';
import { useAuth, Button, Select, Loader } from 'astrogators-shared-ui';
import { useMods } from '@/contexts/ModContext';
import { useFilters } from '@/contexts/FilterContext';
import { applyFilters } from '@/utils/modFilters';
import { sortMods } from '@/utils/modSorting';
import Layout from '@/components/layout/Layout';
import ModGrid from '@/components/mod/ModGrid';
import ModDetailModal from '@/components/mod/ModDetailModal';
import FilterPanel from '@/components/filter/FilterPanel';
import type { ParsedMod } from '@/services/modLedgerApi';
import styles from './ModGridPage.module.css';

export default function ModGridPage() {
  const { selectedAllyCode } = useAuth();
  const { mods, isLoadingMods, modsError, fetchMods } = useMods();
  const { filters, sortBy, sortOrder, setSortBy, setSortOrder, openPanel } = useFilters();

  const [selectedMod, setSelectedMod] = useState<ParsedMod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasActiveFilters =
    filters.sets.length > 0 ||
    filters.slots.length > 0 ||
    filters.tiers.length > 0 ||
    filters.rarity.length > 0 ||
    filters.primaries.length > 0 ||
    filters.locked !== 'all';

  useEffect(() => {
    if (selectedAllyCode) {
      fetchMods(selectedAllyCode);
    }
  }, [selectedAllyCode, fetchMods]);

  const filteredMods = applyFilters(mods, filters);
  const sortedMods = sortMods(filteredMods, sortBy, sortOrder);

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

  return (
    <Layout>
      <div className={styles.pageContainer}>
        {/* Header with controls */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>Mods</h1>
            <p className={styles.modCount}>
              Showing {sortedMods.length} of {mods.length} mods
            </p>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.sortControls}>
              <Button
                variant={hasActiveFilters ? 'primary' : 'outline'}
                onClick={openPanel}
                className={styles.filterButton}
              >
                Filters
                {hasActiveFilters && <span className={styles.filterDot} />}
              </Button>

              <Select
                value={sortBy}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value)}
                className={styles.sortSelect}
              >
                <option value="character">Character</option>
                <option value="set">Set</option>
                <option value="slot">Slot</option>
                <option value="level">Level</option>
                <option value="rarity">Rarity</option>
                <option value="tier">Tier</option>
                <option value="speed">Speed</option>
              </Select>

              <Button
                variant="outline"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className={styles.orderButton}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </div>

        <ModGrid mods={sortedMods} onModClick={handleModClick} />

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
