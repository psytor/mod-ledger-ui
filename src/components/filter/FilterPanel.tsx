import { Button } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import type { FilterMode } from '@/contexts/FilterContext';
import { useMods } from '@/contexts/ModContext';
import { useEvaluation } from '@/contexts/EvaluationContext';
import {
  getDrilldownOptions,
  getFlatOptions,
  getSellPileOptions,
  isVariablePrimarySlot,
} from '@/utils/modFilters';
import { formatStage } from '@/utils/cohortRanking';
import styles from './FilterPanel.module.css';

const MODE_LABELS: Record<FilterMode, string> = {
  flat: 'All Mods',
  'push-or-sell': 'Review Mods',
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

  const drilldown = getDrilldownOptions(mods, verdicts, filters);
  const sellPile = getSellPileOptions(mods, verdicts);
  const flat = getFlatOptions(mods);

  // Stage change clears the whole downstream drilldown.
  const handleStageChange = (stage: string | null) => {
    setFilter('stage', stage);
    setFilter('variantId', null);
    setFilter('slot', null);
    setFilter('primary', null);
    setFilter('actionTab', null);
  };

  // Variant change clears slot/primary/action.
  const handleVariantChange = (variantId: string | null) => {
    setFilter('variantId', variantId);
    setFilter('slot', null);
    setFilter('primary', null);
    setFilter('actionTab', null);
  };

  // Slot change clears primary.
  const handleSlotChange = (slot: string | null) => {
    setFilter('slot', slot);
    setFilter('primary', null);
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

  const showPrimaryPicker =
    filters.slot !== null && isVariablePrimarySlot(filters.slot);

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

          {/* Push or Sell drilldown */}
          {filters.mode === 'push-or-sell' && (
            <>
              <div className={styles.filterSection}>
                <h4>Tier</h4>
                <select
                  className={styles.select}
                  value={filters.stage ?? ''}
                  onChange={(e) => handleStageChange(e.target.value || null)}
                >
                  <option value="">All tiers</option>
                  {drilldown.stages.map((s) => (
                    <option key={s.value} value={s.value}>
                      {formatStage(s.value)} ({s.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterSection}>
                <h4>Scoring Rule</h4>
                <select
                  className={styles.select}
                  value={filters.variantId ?? ''}
                  onChange={(e) => handleVariantChange(e.target.value || null)}
                >
                  <option value="">Overview — pick a scoring rule</option>
                  {drilldown.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.count})
                    </option>
                  ))}
                </select>
              </div>

              {filters.variantId && (
                <div className={styles.filterSection}>
                  <h4>Slot</h4>
                  <select
                    className={styles.select}
                    value={filters.slot ?? ''}
                    onChange={(e) => handleSlotChange(e.target.value || null)}
                  >
                    <option value="">All slots</option>
                    {drilldown.slots.map((s) => (
                      <option key={s.value} value={s.value}>
                        {slotDisplayName(s.value)} ({s.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filters.variantId && showPrimaryPicker && (
                <div className={styles.filterSection}>
                  <h4>Primary Stat</h4>
                  <select
                    className={styles.select}
                    value={filters.primary ?? ''}
                    onChange={(e) =>
                      setFilter('primary', e.target.value || null)
                    }
                  >
                    <option value="">All primaries</option>
                    {drilldown.primaries.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.value} ({p.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
