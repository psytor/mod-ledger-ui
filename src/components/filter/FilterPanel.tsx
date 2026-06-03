import { Button } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import type { FilterMode, GroupBy } from '@/contexts/FilterContext';
import { useMods } from '@/contexts/ModContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import {
  getFlatOptions,
  getSellPileOptions,
  getCharacterOptions,
} from '@/utils/modFilters';
import styles from './FilterPanel.module.css';

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'shape', label: 'Shape' },
  { value: 'tier', label: 'Tier' },
  { value: 'set', label: 'Set' },
  { value: 'primary', label: 'Primary' },
];

const MODE_LABELS: Record<FilterMode, string> = {
  flat: 'All Mods',
  'sell-pile': 'Sell Pile',
  unconfigured: 'Unconfigured',
};

// In-game shape layout: Square|Arrow / Diamond|Triangle / Circle|Cross.
// Reading top→bottom, left→right gives this slot-name order.
const SLOT_ORDER = [
  'Transmitter', // Square
  'Receiver',    // Arrow
  'Processor',   // Diamond
  'Holo-Array',  // Triangle
  'Data-Bus',    // Circle
  'Multiplexer', // Cross
];

// mod.tier_name is the letter grade (E…A). Map to its color label for display.
// SWGOH convention: Gold = A, Grey = E.
const TIER_ORDER = ['E', 'D', 'C', 'B', 'A'];
const TIER_COLOR_BY_LETTER: Record<string, string> = {
  E: 'Grey',
  D: 'Green',
  C: 'Blue',
  B: 'Purple',
  A: 'Gold',
};

function sortedByOrder<T extends string>(values: T[], order: readonly string[]): T[] {
  return [...values].sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function FilterPanel() {
  const {
    isPanelOpen,
    closePanel,
    filters,
    setFilter,
    clearFilters,
  } = useFilters();
  const { mods, modSlots } = useMods();
  const { verdicts } = useEvaluation();

  const slotDisplayName = (slotName: string): string => {
    const def = modSlots.find((s) => s.name === slotName);
    return def ? `${def.name} (${def.shape})` : slotName;
  };

  const sellPile = getSellPileOptions(mods, verdicts);
  const flat = getFlatOptions(mods);
  const characterOptions = getCharacterOptions(mods);

  const toggleCharacter = (value: string, checked: boolean) => {
    const current = filters.characters;
    setFilter(
      'characters',
      checked ? [...current, value] : current.filter((v) => v !== value)
    );
  };

  const toggleSellPileArray = (
    key: 'sellPileSets' | 'sellPileSlots',
    value: string,
    checked: boolean
  ) => {
    const current = filters[key];
    setFilter(
      key,
      checked ? [...current, value] : current.filter((v) => v !== value)
    );
  };

  const toggleFlatString = (
    key: 'flatSets' | 'flatSlots' | 'flatTiers' | 'flatPrimaries',
    value: string,
    checked: boolean
  ) => {
    const current = filters[key];
    setFilter(
      key,
      checked ? [...current, value] : current.filter((v) => v !== value)
    );
  };

  const toggleFlatRarity = (value: number, checked: boolean) => {
    const current = filters.flatRarity;
    setFilter(
      'flatRarity',
      checked ? [...current, value] : current.filter((v) => v !== value)
    );
  };

  return (
    <>
      {isPanelOpen && <div className={styles.overlay} onClick={closePanel} />}

      <div className={`${styles.panel} ${isPanelOpen ? styles.open : ''}`}>
        <div className={styles.panelHeader}>
          <h3>Filters</h3>
          <button className={styles.closeButton} onClick={closePanel}>
            ✕
          </button>
        </div>

        <div className={styles.panelContent}>
          {/* Mode tabs */}
          <div className={styles.modeTabs}>
            {(Object.keys(MODE_LABELS) as FilterMode[]).map((mode) => (
              <button
                key={mode}
                className={`${styles.modeTab} ${
                  filters.mode === mode ? styles.modeTabActive : ''
                }`}
                onClick={() => setFilter('mode', mode)}
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {/* Flat view filters */}
          {filters.mode === 'flat' && (
            <>
              <div className={styles.filterSection}>
                <h4>Group By</h4>
                <select
                  className={styles.select}
                  value={filters.groupBy}
                  onChange={(e) => setFilter('groupBy', e.target.value as GroupBy)}
                >
                  {GROUP_BY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterSection}>
                <h4>
                  Mod Sets{' '}
                  <span className={styles.count}>
                    ({filters.flatSets.length}/{flat.sets.length})
                  </span>
                </h4>
                {flat.sets.map((set) => (
                  <label key={set} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.flatSets.includes(set)}
                      onChange={(e) =>
                        toggleFlatString('flatSets', set, e.target.checked)
                      }
                    />
                    <span>{set}</span>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <h4>
                  Slots{' '}
                  <span className={styles.count}>
                    ({filters.flatSlots.length}/{flat.slots.length})
                  </span>
                </h4>
                {sortedByOrder(flat.slots, SLOT_ORDER).map((slot) => (
                  <label key={slot} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.flatSlots.includes(slot)}
                      onChange={(e) =>
                        toggleFlatString('flatSlots', slot, e.target.checked)
                      }
                    />
                    <span>{slotDisplayName(slot)}</span>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <h4>
                  Tiers{' '}
                  <span className={styles.count}>
                    ({filters.flatTiers.length}/{flat.tiers.length})
                  </span>
                </h4>
                {sortedByOrder(flat.tiers, TIER_ORDER).map((tier) => {
                  const color = TIER_COLOR_BY_LETTER[tier];
                  return (
                    <label key={tier} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={filters.flatTiers.includes(tier)}
                        onChange={(e) =>
                          toggleFlatString('flatTiers', tier, e.target.checked)
                        }
                      />
                      <span>{color ? `${color} (${tier})` : tier}</span>
                    </label>
                  );
                })}
              </div>

              <div className={styles.filterSection}>
                <h4>
                  Rarity{' '}
                  <span className={styles.count}>
                    ({filters.flatRarity.length}/{flat.rarity.length})
                  </span>
                </h4>
                {flat.rarity.map((r) => (
                  <label key={r} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.flatRarity.includes(r)}
                      onChange={(e) => toggleFlatRarity(r, e.target.checked)}
                    />
                    <span>{r} Dots</span>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <h4>
                  Primary Stats{' '}
                  <span className={styles.count}>
                    ({filters.flatPrimaries.length}/{flat.primaries.length})
                  </span>
                </h4>
                {flat.primaries.map((p) => (
                  <label key={p} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.flatPrimaries.includes(p)}
                      onChange={(e) =>
                        toggleFlatString('flatPrimaries', p, e.target.checked)
                      }
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Sell Pile parallel filters */}
          {filters.mode === 'sell-pile' && (
            <>
              <div className={styles.filterSection}>
                <h4>
                  Mod Sets{' '}
                  <span className={styles.count}>
                    ({filters.sellPileSets.length}/{sellPile.sets.length})
                  </span>
                </h4>
                {sellPile.sets.map((set) => (
                  <label key={set} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.sellPileSets.includes(set)}
                      onChange={(e) =>
                        toggleSellPileArray('sellPileSets', set, e.target.checked)
                      }
                    />
                    <span>{set}</span>
                  </label>
                ))}
              </div>

              <div className={styles.filterSection}>
                <h4>
                  Slots{' '}
                  <span className={styles.count}>
                    ({filters.sellPileSlots.length}/{sellPile.slots.length})
                  </span>
                </h4>
                {sellPile.slots.map((slot) => (
                  <label key={slot} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.sellPileSlots.includes(slot)}
                      onChange={(e) =>
                        toggleSellPileArray(
                          'sellPileSlots',
                          slot,
                          e.target.checked
                        )
                      }
                    />
                    <span>{slotDisplayName(slot)}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {filters.mode === 'unconfigured' && (
            <div className={styles.filterSection}>
              <p className={styles.profileDescription}>
                Mods whose set has no variants defined in the active
                evaluation. Configure rules for those sets to start evaluating
                them.
              </p>
            </div>
          )}

          {/* Cross-cutting: character (all modes) */}
          {characterOptions.length > 0 && (
            <div className={styles.filterSection}>
              <h4>
                Character{' '}
                <span className={styles.count}>
                  ({filters.characters.length}/{characterOptions.length})
                </span>
              </h4>
              <div style={{ maxHeight: '12rem', overflowY: 'auto' }}>
                {characterOptions.map((character) => (
                  <label key={character} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.characters.includes(character)}
                      onChange={(e) => toggleCharacter(character, e.target.checked)}
                    />
                    <span>{character}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Cross-cutting: lock status (all modes) */}
          <div className={styles.filterSection}>
            <h4>Lock Status</h4>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="locked"
                checked={filters.locked === 'all'}
                onChange={() => setFilter('locked', 'all')}
              />
              <span>All</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="locked"
                checked={filters.locked === 'locked'}
                onChange={() => setFilter('locked', 'locked')}
              />
              <span>Locked Only</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="locked"
                checked={filters.locked === 'unlocked'}
                onChange={() => setFilter('locked', 'unlocked')}
              />
              <span>Unlocked Only</span>
            </label>
          </div>

          <div className={styles.filterSection}>
            <Button variant="secondary" onClick={clearFilters} fullWidth>
              Clear All Filters
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
