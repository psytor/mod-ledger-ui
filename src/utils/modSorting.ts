import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';

/**
 * Sort mods by the specified field and order
 */
export function sortMods(
  mods: ParsedMod[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  evaluations: Record<string, ModEvaluation> | null = null
): ParsedMod[] {
  const sorted = [...mods];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'character':
        comparison = a.character.localeCompare(b.character);
        break;

      case 'set':
        comparison = a.set.localeCompare(b.set);
        break;

      case 'slot':
        comparison = a.slot.localeCompare(b.slot);
        break;

      case 'level':
        comparison = a.level - b.level;
        break;

      case 'dots':
        comparison = a.dots - b.dots;
        break;

      case 'tier':
        comparison = a.tier - b.tier;
        break;

    case 'speed': {
        // Sort by speed secondary stat value
        const aSpeed = a.secondary_stats.find((s) => s.stat_name === 'Speed')?.value || 0;
        const bSpeed = b.secondary_stats.find((s) => s.stat_name === 'Speed')?.value || 0;
        comparison = aSpeed - bSpeed;
        break;
      }

      case 'quality': {
        // Sort by average secondary efficiency
        const aEfficiency = calculateAverageEfficiency(a);
        const bEfficiency = calculateAverageEfficiency(b);
        comparison = aEfficiency - bEfficiency;
        break;
      }

      case 'overall': {
        // Sort by overall evaluation score
        const aOverall = evaluations?.[a.mod_id]?.scores.overall || 0;
        const bOverall = evaluations?.[b.mod_id]?.scores.overall || 0;
        comparison = aOverall - bOverall;
        break;
      }

      case 'eval_quality': {
        // Sort by quality evaluation score
        const aQuality = evaluations?.[a.mod_id]?.scores.quality || 0;
        const bQuality = evaluations?.[b.mod_id]?.scores.quality || 0;
        comparison = aQuality - bQuality;
        break;
      }

      case 'synergy': {
        // Sort by synergy evaluation score
        const aSynergy = evaluations?.[a.mod_id]?.scores.synergy || 0;
        const bSynergy = evaluations?.[b.mod_id]?.scores.synergy || 0;
        comparison = aSynergy - bSynergy;
        break;
      }

      case 'speed_bonus': {
        // Sort by speed bonus evaluation score
        const aSpeedBonus = evaluations?.[a.mod_id]?.scores.speed_bonus || 0;
        const bSpeedBonus = evaluations?.[b.mod_id]?.scores.speed_bonus || 0;
        comparison = aSpeedBonus - bSpeedBonus;
        break;
      }

      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Calculate average efficiency of secondary stats
 */
function calculateAverageEfficiency(mod: ParsedMod): number {
  if (mod.secondary_stats.length === 0) return 0;

  const totalEfficiency = mod.secondary_stats.reduce((sum, stat) => {
    return sum + (stat.efficiency || 0);
  }, 0);

  return totalEfficiency / mod.secondary_stats.length;
}
