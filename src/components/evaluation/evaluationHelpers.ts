import type { StatDefinition } from '@/services/gameDataApi';
import type { ModShape } from '@/utils/modSpriteConfig';
import type {
  PrimaryClassification,
  SecondaryClassification,
  Variant,
} from '@/types/evaluation';

export type TierView = 5 | 6;

export function statDisplayName(s: StatDefinition): string {
  return s.is_percentage ? `${s.name} %` : s.name;
}

// The approximate per-roll value at a given target efficiency. The engine's
// efficiency is (rollValue - min) / (max - min), and the game *floors* the
// value it shows, so a target must be floored too: efficiency 0.50 on Speed is
// value 4.5, which the game (and real rolls at that efficiency) show as +4, not
// +5. Rounding here mislabels the whole 50-67% band of the Speed slider as "+5"
// when a real roll there reads +4 in-game. Verified against a live roster:
// displayed +3 = eff 0-33%, +4 = 33-67%, +5 = 67-100%.
// Percent stats keep 2 decimals (the game shows 2dp, so flooring at that
// precision matches without visibly changing the number).
// Returns null when the stat has no roll bounds (e.g. primary-only stats).
export function formatRollAt(
  stat: StatDefinition,
  efficiency: number,
  tier: TierView
): string | null {
  const min = tier === 6 ? stat.min_roll_6 : stat.min_roll_5;
  const max = tier === 6 ? stat.max_roll_6 : stat.max_roll_5;
  if (min === undefined || max === undefined) return null;
  const value = min + efficiency * (max - min);
  return stat.is_percentage
    ? `${(Math.floor(value * 100) / 100).toFixed(2)}%`
    : `${Math.floor(value)}`;
}

export function countClassifications(variant: Variant) {
  let wanted = 0;
  let notWanted = 0;
  for (const c of Object.values(variant.primary_classifications)) {
    if (c === 'wanted') wanted++;
    else if (c === 'not_wanted') notWanted++;
  }
  let required = 0;
  let mandatory = 0;
  let complementary = 0;
  for (const c of Object.values(variant.secondary_classifications)) {
    if (c === 'required') required++;
    else if (c === 'mandatory') mandatory++;
    else if (c === 'complementary') complementary++;
  }
  return { wanted, notWanted, required, mandatory, complementary };
}

// Edit-mode cycle config: click neutral → first non-neutral → second → back.
export type ChipState = {
  value: string;
  label: string;
  swatchColor: string;
};

export const PRIMARY_CYCLE: ChipState[] = [
  { value: 'neutral', label: 'Neutral', swatchColor: 'transparent' },
  { value: 'wanted', label: 'Wanted', swatchColor: 'var(--color-secondary)' },
  { value: 'not_wanted', label: 'Not wanted', swatchColor: 'var(--color-error)' },
];

export const SECONDARY_CYCLE: ChipState[] = [
  { value: 'neutral', label: 'Neutral', swatchColor: 'transparent' },
  { value: 'required', label: 'Required', swatchColor: 'var(--color-secondary)' },
  { value: 'complementary', label: 'Complementary', swatchColor: 'var(--color-info)' },
];

// Narrows the primary-stat picker to what the rule's selected shapes can
// actually roll. No shapes selected (all shapes) → no filtering, same list
// as today. Multiple shapes selected → union of what any of them allows, so
// the picker never hides a stat that's legal on at least one in-scope shape.
export function filterPrimaryStatsForShapes(
  stats: StatDefinition[],
  shapes: ModShape[] | undefined,
  shapePrimaryMap: Map<ModShape, Set<number>>
): StatDefinition[] {
  if (!shapes || shapes.length === 0) return stats;
  const allowed = new Set<number>();
  for (const shape of shapes) {
    for (const id of shapePrimaryMap.get(shape) ?? []) allowed.add(id);
  }
  return stats.filter((s) => allowed.has(s.stat_id));
}

// View-mode helpers: bucket classified stats by classification.
export function groupPrimaryClassified(
  variant: Variant,
  stats: StatDefinition[]
): { wanted: StatDefinition[]; notWanted: StatDefinition[] } {
  const wanted: StatDefinition[] = [];
  const notWanted: StatDefinition[] = [];
  for (const s of stats) {
    const c: PrimaryClassification | undefined =
      variant.primary_classifications[s.stat_id];
    if (c === 'wanted') wanted.push(s);
    else if (c === 'not_wanted') notWanted.push(s);
  }
  return { wanted, notWanted };
}

export function groupSecondaryClassified(
  variant: Variant,
  stats: StatDefinition[]
): {
  mandatory: StatDefinition[];
  required: StatDefinition[];
  complementary: StatDefinition[];
} {
  const mandatory: StatDefinition[] = [];
  const required: StatDefinition[] = [];
  const complementary: StatDefinition[] = [];
  for (const s of stats) {
    const c: SecondaryClassification | undefined =
      variant.secondary_classifications[s.stat_id];
    if (c === 'mandatory') mandatory.push(s);
    else if (c === 'required') required.push(s);
    else if (c === 'complementary') complementary.push(s);
  }
  return { mandatory, required, complementary };
}
