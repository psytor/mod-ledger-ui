import type { ParsedMod } from '@/services/modLedgerApi';
import type { StatDefinition } from '@/services/gameDataApi';
import type {
  Evaluation,
  SecondaryClassification,
  VerdictResult,
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

export function scoreMod(
  mod: ParsedMod,
  evaluation: Evaluation,
  verdict: VerdictResult,
  statDefs: StatDefinition[]
): number | null {
  if (!verdict.winning_variant_id) return null;

  const config = evaluation.mod_set_configs.find((c) => c.set_id === mod.set_id);
  if (!config) return null;
  const variant = config.variants.find((v) => v.id === verdict.winning_variant_id);
  if (!variant) return null;

  const statIdLookup = buildStatIdLookup(statDefs);
  const targets = variant.secondary_targets ?? {};

  let total = 0;
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

    for (const efficiency of efficiencies) {
      total += curveScore(efficiency, target) * multiplier;
    }
  }

  return total;
}

export function scoreAll(
  mods: ParsedMod[],
  evaluation: Evaluation,
  verdicts: Map<string, VerdictResult>,
  statDefs: StatDefinition[]
): Map<string, VerdictResult> {
  const out = new Map<string, VerdictResult>();
  for (const mod of mods) {
    const verdict = verdicts.get(mod.mod_id);
    if (!verdict) continue;
    const score = scoreMod(mod, evaluation, verdict, statDefs);
    out.set(mod.mod_id, score === null ? verdict : { ...verdict, score });
  }
  return out;
}
