import { Button, Select } from 'astrogators-shared-ui';
import { useFilters, type ModFilters } from '@/contexts/FilterContext';
import { useMods } from '@/contexts/ModContext';
import { getFilterOptions } from '@/utils/modFilters';
import { useAuth } from 'astrogators-shared-ui';
import styles from './FilterPanel.module.css';

export default function FilterPanel() {
  const { isPanelOpen, closePanel, filters, setFilter, clearFilters } = useFilters();
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

  // Helper to format recommendation labels (CLEAN BREAK: Removed SLICE-PRIORITY)
  const formatRecommendation = (rec: string): string => {
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
    setFilter(key, newArray as ModFilters[typeof key]); // Refined type assertion
  };

  return (
    <>
      {/* Overlay */}
      {isPanelOpen && <div className={styles.overlay} onClick={closePanel} />}

      {/* Sliding panel */}
      <div className={`${styles.panel} ${isPanelOpen ? styles.open : ''}`}>
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
            <Select
              value={selectedProfile}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleProfileChange(e.target.value)}
              disabled={isLoadingProfiles}
            >
              {availableProfiles.map((profile) => (
                <option key={profile.name} value={profile.name} title={profile.description}>
                  {profile.profile_name}
                </option>
              ))}
            </Select>
            {selectedProfile && (() => {
              const currentProfile = availableProfiles.find((p) => p.name === selectedProfile);
              return (
                <>
                  <p className={styles.profileDescription}>
                    {currentProfile?.description}
                  </p>
                  {currentProfile?.frontend_link && (
                    <a
                      href={currentProfile.frontend_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.profileLink}
                    >
                      Learn more about this profile
                    </a>
                  )}
                </>
              );
            })()}
          </div>

          {/* Recommendations - CLEAN BREAK: Removed SLICE-PRIORITY */}
          <div className={styles.filterSection}>
            <h4>Recommendations</h4>
            {['SELL', 'UPGRADE', 'KEEP', 'SLICE'].map((rec) => (
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

          {/* Rarity (Dots/Pips) - CLEAN BREAK: Changed from "dots" to "rarity" */}
          <div className={styles.filterSection}>
            <h4>Rarity <span className={styles.count}>({filters.rarity.length}/{options.rarity.length})</span></h4>
            {options.rarity.map((rarityValue) => (
              <label key={rarityValue} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={(filters.rarity as number[]).includes(rarityValue)}
                  onChange={(e) => handleCheckboxChange('rarity', rarityValue, e.target.checked)}
                />
                <span>{rarityValue} Dots</span>
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
