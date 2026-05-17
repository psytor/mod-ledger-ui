import type { ParsedMod } from '@/services/modLedgerApi';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  SecondaryClassification,
  Variant,
} from '@/types/evaluation';

// v1: hardcoded. Lever to tune later is the neutral multiplier (drop to 0.05
// if lucky-garbage mods feel overrepresented in real inventories).
const TIER_MULTIPLIERS: Record<SecondaryClassification | 'neutral', number> = {
  required: 1.0,
  complementary: 0.4,
  neutral: 0.1,
};

const DEFAULT_TARGET = 0.5;

// Piecewise linear with kink at (T, 50). Endpoints (0,0) and (1,100). UI clamps
// T to [0.01, 0.99]; the T=0/T=1 guards here are defensive against direct calls.
export function curveScore(efficiency: number, target: number): number {
  if (target <= 0) return efficiency > 0 ? 100 : 0;
  if (target >= 1) return efficiency >= 1 ? 100 : efficiency * 50;
  return efficiency <= target
    ? (efficiency / target) * 50
    : 50 + ((efficiency - target) / (1 - target)) * 50;
}

type ModStatLike = {
  stat_name: string;
  is_percent: boolean;
  is_revealed?: boolean;
  roll_efficiencies?: number[];
};

function buildStatIdLookup(statDefs: StatDefinition[]): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const s of statDefs) {
    lookup.set(`${s.name}|${s.is_percentage}`, s.stat_id);
  }
  return lookup;
}

function resolveStatId(
  stat: ModStatLike,
  lookup: Map<string, number>
): number | undefined {
  return lookup.get(`${stat.stat_name}|${stat.is_percent}`);
}

export type ModScore = {
  score: number;
  absolute_quality: number; // 0-100
};

export function scoreModForVariant(
  mod: ParsedMod,
  variant: Variant,
  statDefs: StatDefinition[]
): ModScore {
  const statIdLookup = buildStatIdLookup(statDefs);
  const targets = variant.secondary_targets ?? {};

  let total = 0;
  let theoreticalMax = 0;
  for (const stat of mod.secondary_stats) {
    if (stat.is_revealed === false) continue;
    const efficiencies = stat.roll_efficiencies ?? [];
    if (efficiencies.length === 0) continue;
    const statId = resolveStatId(stat, statIdLookup);
    if (statId === undefined) continue;

    const target = targets[statId] ?? DEFAULT_TARGET;
    const classification: SecondaryClassification | 'neutral' =
      variant.secondary_classifications[statId] ?? 'neutral';
    const multiplier = TIER_MULTIPLIERS[classification];

    // Backend roll efficiencies are 0-100 percentages (see mod-ledger
    // schemas/mod.py); curveScore expects a 0-1 scale to match targets.
    for (const efficiency of efficiencies) {
      total += curveScore(efficiency / 100, target) * multiplier;
    }
    theoreticalMax += efficiencies.length * 100 * multiplier;
  }

  const absolute_quality = theoreticalMax > 0 ? (total / theoreticalMax) * 100 : 0;
  return { score: total, absolute_quality };
}
