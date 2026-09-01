import { useState } from 'react';
import { Button } from 'astrogators-shared-ui';
import { useFilters } from '@/contexts/FilterContext';
import type { GroupBy, SortBy } from '@/contexts/FilterContext';
import { useMods } from '@/contexts/ModContext';
import { getFlatOptions, getCharacterOptions } from '@/utils/modFilters';
import SetIcon from '@/components/mod/SetIcon';
import ShapeIcon from '@/components/mod/ShapeIcon';
import FilterChip from './FilterChip';
import SegmentedToggle from './SegmentedToggle';
import styles from './FilterPanel.module.css';

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'shape', label: 'Shape' },
  { value: 'tier', label: 'Tier' },
  { value: 'set', label: 'Set' },
  { value: 'primary', label: 'Primary' },
];

const SORT_BY_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'score-desc', label: 'Score ↓' },
  { value: 'score-asc', label: 'Score ↑' },
];

const LOCK_OPTIONS: { value: 'all' | 'locked' | 'unlocked'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'locked', label: '🔒 Locked' },
  { value: 'unlocked', label: '🔓 Unlocked' },
];

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

// mod.tier_name is the letter grade (E…A). Map to its colour label for display.
// SWGOH convention: Gold = A, Grey = E.
const TIER_ORDER = ['E', 'D', 'C', 'B', 'A'];
const TIER_COLOR_BY_LETTER: Record<string, string> = {
  E: 'Grey',
  D: 'Green',
  C: 'Blue',
  B: 'Purple',
  A: 'Gold',
};
const TIER_VAR_BY_LETTER: Record<string, string> = {
  E: 'var(--tier-grey)',
  D: 'var(--tier-green)',
  C: 'var(--tier-blue)',
  B: 'var(--tier-purple)',
  A: 'var(--tier-gold)',
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

function CharAvatar({ url }: { url: string | undefined }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className={styles.charAvatarFallback} aria-hidden="true" />;
  return (
    <img
      className={styles.charAvatar}
      src={url}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

export default function FilterPanel() {
  const {
    isPanelOpen,
    closePanel,
    filters,
    setFilter,
    clearFilters,
  } = useFilters();
  const { mods, modSlots, characterPortraits } = useMods();
  const [charSearch, setCharSearch] = useState('');

  const shapeForSlot = (slotName: string): string =>
    modSlots.find((s) => s.name === slotName)?.shape ?? slotName;

  const flat = getFlatOptions(mods);
  const characterOptions = getCharacterOptions(mods);
  const charQuery = charSearch.trim().toLowerCase();
  const shownCharacters = charQuery
    ? characterOptions.filter((c) => c.toLowerCase().includes(charQuery))
    : characterOptions;

  const toggleCharacter = (value: string) => {
    const current = filters.characters;
    setFilter(
      'characters',
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  };

  const toggleFlatString = (
    key: 'flatSets' | 'flatSlots' | 'flatTiers' | 'flatPrimaries',
    value: string
  ) => {
    const current = filters[key];
    setFilter(
      key,
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  };

  const toggleFlatRarity = (value: number) => {
    const current = filters.flatRarity;
    setFilter(
      'flatRarity',
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
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
          <div className={styles.filterSection}>
            <h4>Sort By</h4>
            <SegmentedToggle
              ariaLabel="Sort by"
              options={SORT_BY_OPTIONS}
              value={filters.sortBy}
              onChange={(v) => setFilter('sortBy', v)}
            />
          </div>

          <div className={styles.filterSection}>
            <h4>Group By</h4>
            <SegmentedToggle
              ariaLabel="Group by"
              options={GROUP_BY_OPTIONS}
              value={filters.groupBy}
              onChange={(v) => setFilter('groupBy', v)}
            />
          </div>

          <div className={styles.filterSection}>
            <h4>
              Mod Sets{' '}
              <span className={styles.count}>
                ({filters.flatSets.length}/{flat.sets.length})
              </span>
            </h4>
            <div className={styles.chipGrid}>
              {flat.sets.map((set) => (
                <FilterChip
                  key={set}
                  active={filters.flatSets.includes(set)}
                  onClick={() => toggleFlatString('flatSets', set)}
                  title={set}
                >
                  <SetIcon
                    set={set}
                    size={18}
                    tint={filters.flatSets.includes(set) ? 'Gold' : 'Grey'}
                  />
                  <span>{set}</span>
                </FilterChip>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h4>
              Slots{' '}
              <span className={styles.count}>
                ({filters.flatSlots.length}/{flat.slots.length})
              </span>
            </h4>
            <div className={styles.chipGrid}>
              {sortedByOrder(flat.slots, SLOT_ORDER).map((slot) => {
                const active = filters.flatSlots.includes(slot);
                return (
                  <FilterChip
                    key={slot}
                    active={active}
                    onClick={() => toggleFlatString('flatSlots', slot)}
                    title={`${slot} (${shapeForSlot(slot)})`}
                  >
                    <ShapeIcon
                      shape={shapeForSlot(slot)}
                      size={20}
                      tint={active ? 'Gold' : 'Grey'}
                    />
                    <span>{shapeForSlot(slot)}</span>
                  </FilterChip>
                );
              })}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h4>
              Tiers{' '}
              <span className={styles.count}>
                ({filters.flatTiers.length}/{flat.tiers.length})
              </span>
            </h4>
            <div className={styles.chipGrid}>
              {sortedByOrder(flat.tiers, TIER_ORDER).map((tier) => {
                const color = TIER_COLOR_BY_LETTER[tier];
                return (
                  <FilterChip
                    key={tier}
                    active={filters.flatTiers.includes(tier)}
                    onClick={() => toggleFlatString('flatTiers', tier)}
                    accent={TIER_VAR_BY_LETTER[tier]}
                    title={color ? `${color} (${tier})` : tier}
                  >
                    <span
                      className={styles.tierSwatch}
                      style={{ background: TIER_VAR_BY_LETTER[tier] ?? 'var(--color-border)' }}
                      aria-hidden="true"
                    />
                    <span>{color ? `${color} (${tier})` : tier}</span>
                  </FilterChip>
                );
              })}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h4>
              Rarity{' '}
              <span className={styles.count}>
                ({filters.flatRarity.length}/{flat.rarity.length})
              </span>
            </h4>
            <div className={styles.chipGrid}>
              {flat.rarity.map((r) => (
                <FilterChip
                  key={r}
                  active={filters.flatRarity.includes(r)}
                  onClick={() => toggleFlatRarity(r)}
                  title={`${r} dots`}
                >
                  <span className={styles.pips} aria-hidden="true">
                    {Array.from({ length: r }, (_, i) => (
                      <span key={i} className={styles.pip} />
                    ))}
                  </span>
                  <span>{r}-dot</span>
                </FilterChip>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <h4>
              Primary Stats{' '}
              <span className={styles.count}>
                ({filters.flatPrimaries.length}/{flat.primaries.length})
              </span>
            </h4>
            <div className={styles.chipGrid}>
              {flat.primaries.map((p) => (
                <FilterChip
                  key={p}
                  active={filters.flatPrimaries.includes(p)}
                  onClick={() => toggleFlatString('flatPrimaries', p)}
                  title={p}
                >
                  <span>{p}</span>
                </FilterChip>
              ))}
            </div>
          </div>

          {/* Cross-cutting: character */}
          {characterOptions.length > 0 && (
            <div className={styles.filterSection}>
              <h4>
                Character{' '}
                <span className={styles.count}>
                  ({filters.characters.length}/{characterOptions.length})
                </span>
              </h4>

              {filters.characters.length > 0 && (
                <div className={styles.chipGrid}>
                  {filters.characters.map((c) => (
                    <FilterChip
                      key={c}
                      active
                      onClick={() => toggleCharacter(c)}
                      title={`Remove ${c}`}
                    >
                      <CharAvatar url={characterPortraits.get(c)} />
                      <span>{c}</span>
                      <span className={styles.chipX} aria-hidden="true">✕</span>
                    </FilterChip>
                  ))}
                </div>
              )}

              <input
                type="text"
                className={styles.search}
                placeholder="Search characters…"
                value={charSearch}
                onChange={(e) => setCharSearch(e.target.value)}
                autoComplete="off"
              />

              <div className={styles.charList}>
                {shownCharacters.map((character) => (
                  <FilterChip
                    key={character}
                    active={filters.characters.includes(character)}
                    onClick={() => toggleCharacter(character)}
                    title={character}
                  >
                    <CharAvatar url={characterPortraits.get(character)} />
                    <span>{character}</span>
                  </FilterChip>
                ))}
                {shownCharacters.length === 0 && (
                  <p className={styles.charEmpty}>No characters match “{charSearch}”.</p>
                )}
              </div>
            </div>
          )}

          {/* Cross-cutting: lock status */}
          <div className={styles.filterSection}>
            <h4>Lock Status</h4>
            <SegmentedToggle
              ariaLabel="Lock status"
              options={LOCK_OPTIONS}
              value={filters.locked}
              onChange={(v) => setFilter('locked', v)}
            />
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
