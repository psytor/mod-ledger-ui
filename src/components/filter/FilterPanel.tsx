import { Button } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import { useMods } from '@/contexts/ModContext';
import { getFilterOptions } from '@/utils/modFilters';
import styles from './FilterPanel.module.css';

export default function FilterPanel() {
  const { isPanelOpen, closePanel, filters, setFilter, clearFilters } = useFilters();
  const { mods } = useMods();

  // Get available filter options from current mods
  const options = getFilterOptions(mods);

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

          {/* Mod Sets */}
          <div className={styles.filterSection}>
            <h4>Mod Sets</h4>
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
            <h4>Slots</h4>
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
            <h4>Tiers</h4>
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
            <h4>Dots</h4>
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
            <h4>Primary Stats</h4>
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
