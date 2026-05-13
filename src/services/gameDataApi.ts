/**
 * Game Data API Client
 * Fetches static game data from Astrogators Table API
 */

export interface AllowedPrimaryStat {
  name: string;
  stat_id: number;
  is_percentage: boolean;
}

export interface ModSlotDefinition {
  slot_id: number;
  name: string;      // e.g. "Transmitter"
  shape: string;     // e.g. "Square"
  description?: string;
  allowed_primary_stats: AllowedPrimaryStat[];
}

export interface ModSetDefinition {
  set_id: number;
  name: string;      // e.g. "Health", "Speed"
  required_count: number;
  bonus_stat: string;
  description?: string;
}

export interface StatDefinition {
  stat_id: number;
  name: string;            // Display name; NOT unique across primary+secondary pools.
  detailed_name?: string;
  is_percentage: boolean;
  can_be_primary: boolean;
  can_be_secondary: boolean;
  is_offensive?: boolean;
  is_defensive?: boolean;
  // Per-roll value bounds for the secondary stat pool. Absent for primary-only stats.
  // API returns decimal strings; client parses to numbers.
  min_roll_5?: number;
  max_roll_5?: number;
  min_roll_6?: number;
  max_roll_6?: number;
}

function parseRoll(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
}

class GameDataApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_ASTROGATORS_TABLE_URL || 'http://localhost/astrogators-table';
  }

  async fetchModSlots(): Promise<ModSlotDefinition[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/game-data/mod-slots`);
    if (!response.ok) {
      throw new Error(`Failed to fetch mod slots: ${response.statusText}`);
    }
    const data = await response.json();
    return data.mod_slots || [];
  }

  async fetchModSets(): Promise<ModSetDefinition[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/game-data/mod-sets`);
    if (!response.ok) {
      throw new Error(`Failed to fetch mod sets: ${response.statusText}`);
    }
    const data = await response.json();
    return data.mod_sets || [];
  }

  async fetchStatDefinitions(filter?: {
    can_be_primary?: boolean;
    can_be_secondary?: boolean;
  }): Promise<StatDefinition[]> {
    const params = new URLSearchParams();
    if (filter?.can_be_primary !== undefined) {
      params.set('can_be_primary', String(filter.can_be_primary));
    }
    if (filter?.can_be_secondary !== undefined) {
      params.set('can_be_secondary', String(filter.can_be_secondary));
    }
    params.set('page_size', '100');
    const response = await fetch(
      `${this.baseUrl}/api/v1/game-data/stat-definitions?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch stat definitions: ${response.statusText}`);
    }
    const data = await response.json();
    const stats: unknown[] = data.stats || [];
    return stats.map((raw) => {
      const s = raw as Record<string, unknown>;
      return {
        ...(s as object),
        min_roll_5: parseRoll(s.min_roll_5),
        max_roll_5: parseRoll(s.max_roll_5),
        min_roll_6: parseRoll(s.min_roll_6),
        max_roll_6: parseRoll(s.max_roll_6),
      } as StatDefinition;
    });
  }
}

export const gameDataApi = new GameDataApiClient();
