import { Button } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import { useMods } from '@/contexts/ModContext';
import { getFilterOptions } from '@/utils/modFilters';
import { useAuth } from 'astrogators-shared-ui';
import styles from './FilterPanel.module.css';

export default function FilterPanel() {
  const { isPanelOpen, openPanel, closePanel, filters, setFilter, clearFilters } = useFilters();
  const {
    mods,
    selectedProfile,
    setSelectedProfile,
    availableProfiles,
    isLoadingProfiles,
    fetchEvaluations,
  } = useMods();
  const { selectedAllyCode } = useAuth();

  // Get available filter options from current mods
  const options = getFilterOptions(mods);

  // Helper to format recommendation labels
  const formatRecommendation = (rec: string): string => {
    if (rec === 'SLICE-PRIORITY') return 'Slice Priority';
    return rec.charAt(0) + rec.slice(1).toLowerCase();
  };

  // Handle profile change
  const handleProfileChange = (newProfile: string) => {
    setSelectedProfile(newProfile);
    if (selectedAllyCode) {
      fetchEvaluations(selectedAllyCode, newProfile);
    }
  };

  const handleCheckboxChange = (
    key: keyof typeof filters,
    value: string | number,
    checked: boolean
  ) => {
    const currentArray = filters[key] as (string | number)[];
    const newArray = checked
      ? [...currentArray, value]
      : currentArray.filter((v) => v !== value);
    setFilter(key, newArray as any); // Type assertion needed due to union type complexity
  };

  // Check if there are any active filters
  const hasActiveFilters = () => {
    return (
      filters.recommendations.length > 0 ||
      filters.sets.length > 0 ||
      filters.slots.length > 0 ||
      filters.tiers.length > 0 ||
      filters.dots.length > 0 ||
      filters.primaries.length > 0 ||
      filters.locked !== 'all'
    );
  };

  return (
    <>
      {/* Overlay */}
      {isPanelOpen && <div className={styles.overlay} onClick={closePanel} />}

      {/* Sliding panel */}
      <div className={`${styles.panel} ${isPanelOpen ? styles.open : ''}`}>
        {/* Vertical FILTERS tab */}
        <div className={styles.filterTab} onClick={() => isPanelOpen ? closePanel() : openPanel()}>
          <div className={styles.filterTabText}>
            {'FILTERS'.split('').map((letter, index) => (
              <span key={index}>{letter}</span>
            ))}
          </div>
          {hasActiveFilters() && (
            <div className={styles.filterIndicator} />
          )}
        </div>
        <div className={styles.panelHeader}>
          <h3>Filters</h3>
          <button className={styles.closeButton} onClick={closePanel}>
            ✕
          </button>
        </div>

        <div className={styles.panelContent}>
          {/* Clear all button */}
          <div className={styles.filterSection}>
            <Button variant="secondary" onClick={clearFilters} fullWidth>
              Clear All Filters
            </Button>
          </div>

          {/* Evaluation Profile */}
          <div className={styles.filterSection}>
            <h4>Evaluation Profile</h4>
            <select
              className={styles.profileSelect}
              value={selectedProfile}
              onChange={(e) => handleProfileChange(e.target.value)}
              disabled={isLoadingProfiles}
            >
              {availableProfiles.map((profile) => (
                <option key={profile.name} value={profile.name} title={profile.description}>
                  {profile.name}
                </option>
              ))}
            </select>
            {selectedProfile && (
              <p className={styles.profileDescription}>
                {availableProfiles.find((p) => p.name === selectedProfile)?.description}
              </p>
            )}
          </div>

          {/* Recommendations */}
          <div className={styles.filterSection}>
            <h4>Recommendations</h4>
            {['SELL', 'UPGRADE', 'KEEP', 'SLICE', 'SLICE-PRIORITY'].map((rec) => (
              <label key={rec} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.recommendations as string[]).includes(rec)}
                  onChange={(e) => handleCheckboxChange('recommendations', rec, e.target.checked)}
                />
                <span>{formatRecommendation(rec)}</span>
              </label>
            ))}
          </div>

          {/* Mod Sets */}
          <div className={styles.filterSection}>
            <h4>Mod Sets <span className={styles.count}>({filters.sets.length}/{options.sets.length})</span></h4>
            {options.sets.map((set) => (
              <label key={set} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.sets as string[]).includes(set)}
                  onChange={(e) => handleCheckboxChange('sets', set, e.target.checked)}
                />
                <span>{set}</span>
              </label>
            ))}
          </div>

          {/* Slots */}
          <div className={styles.filterSection}>
            <h4>Slots <span className={styles.count}>({filters.slots.length}/{options.slots.length})</span></h4>
            {options.slots.map((slot) => (
              <label key={slot} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.slots as string[]).includes(slot)}
                  onChange={(e) => handleCheckboxChange('slots', slot, e.target.checked)}
                />
                <span>{slot}</span>
              </label>
            ))}
          </div>

          {/* Tiers */}
          <div className={styles.filterSection}>
            <h4>Tiers <span className={styles.count}>({filters.tiers.length}/{options.tiers.length})</span></h4>
            {options.tiers.map((tier) => (
              <label key={tier} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.tiers as string[]).includes(tier)}
                  onChange={(e) => handleCheckboxChange('tiers', tier, e.target.checked)}
                />
                <span>{tier}</span>
              </label>
            ))}
          </div>

          {/* Dots (Pips) */}
          <div className={styles.filterSection}>
            <h4>Dots <span className={styles.count}>({filters.dots.length}/{options.dots.length})</span></h4>
            {options.dots.map((dot) => (
              <label key={dot} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.dots as number[]).includes(dot)}
                  onChange={(e) => handleCheckboxChange('dots', dot, e.target.checked)}
                />
                <span>{dot} Dots</span>
              </label>
            ))}
          </div>

          {/* Primary Stats */}
          <div className={styles.filterSection}>
            <h4>Primary Stats <span className={styles.count}>({filters.primaries.length}/{options.primaries.length})</span></h4>
            {options.primaries.map((primary) => (
              <label key={primary} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.primaries as string[]).includes(primary)}
                  onChange={(e) => handleCheckboxChange('primaries', primary, e.target.checked)}
                />
                <span>{primary}</span>
              </label>
            ))}
          </div>

          {/* Locked status */}
          <div className={styles.filterSection}>
            <h4>Lock Status</h4>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="locked"
                value="all"
                checked={filters.locked === 'all'}
                onChange={() => setFilter('locked', 'all')}
              />
              <span>All</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="locked"
                value="locked"
                checked={filters.locked === 'locked'}
                onChange={() => setFilter('locked', 'locked')}
              />
              <span>Locked Only</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="locked"
                value="unlocked"
                checked={filters.locked === 'unlocked'}
                onChange={() => setFilter('locked', 'unlocked')}
              />
              <span>Unlocked Only</span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
