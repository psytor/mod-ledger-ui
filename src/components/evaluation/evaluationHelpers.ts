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

// Linear interp on the stat's per-roll range. Whole number for flat stats,
// 2 decimals + "%" for percent stats (matches in-game presentation).
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
  return stat.is_percentage ? `${value.toFixed(2)}%` : `${Math.round(value)}`;
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
