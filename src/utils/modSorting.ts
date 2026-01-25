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

      case 'rarity':
        comparison = a.rarity - b.rarity;
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

      case 'matches': {
        // Sort by match count evaluation score
        const aMatches = evaluations?.[a.mod_id]?.synergy_result?.best_match?.total_matches || 0;
        const bMatches = evaluations?.[b.mod_id]?.synergy_result?.best_match?.total_matches || 0;
        comparison = aMatches - bMatches;
        break;
      }

      default:
        comparison = 0;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return sorted;
}
