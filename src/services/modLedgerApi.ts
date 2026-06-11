/**
 * Mod Ledger API Client
 * Handles all communication with the mod-ledger backend service
 */

interface ModStat {
  stat_name: string;
  display_value: string;
  value: number;
  is_percent: boolean;
  rolls?: number;
  roll_efficiency?: number;       // Average efficiency for scoring
  roll_efficiencies?: number[];   // Individual roll efficiencies for 5-bar visualization
  is_speed?: boolean;
  is_offensive?: boolean;
  is_defensive?: boolean;
  is_revealed?: boolean;          // Secondaries only
}

export interface ParsedMod {
  mod_id: string;
  definition_id: string;
  set: string;
  set_id: number;
  slot: string;
  slot_id: number;
  shape: string;
  level: number;
  rarity: number;
  tier: number;
  tier_name: string;
  tier_color: string;
  primary_stat: ModStat;
  secondary_stats: ModStat[];
  character: string;
  locked: boolean;
  reroll_count?: number;
  calibrations_left?: number;
  calibration_limit?: number;
  calibration_costs?: { attempt_number: number; cost: number }[];
}

export interface ModListResponse {
  ally_code: string;
  total_mods: number;
  mods: ParsedMod[];
  cached: boolean;
  /** When the underlying player data was pulled from Comlink (naive UTC ISO). */
  cached_at?: string | null;
  /**
   * Seconds until a refresh will pull genuinely fresh data (per-ally Comlink
   * floor). 0 = fresh data available now. Only set by the refresh endpoint.
   */
  next_refresh_in_seconds?: number | null;
}

class ModLedgerApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_MOD_LEDGER_URL || 'http://localhost/mod-ledger';
  }

  /**
   * Fetch all mods for a player by ally code (serves mod-ledger's curated
   * snapshot; does not force a fresh Comlink pull).
   */
  async fetchPlayerMods(allyCode: string): Promise<ModListResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/player/${allyCode}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch mods: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Force a fresh pull of a player's mods. The backend enforces a per-ally
   * Comlink floor: if the floor is active it returns the latest data plus a
   * `next_refresh_in_seconds` countdown instead of hitting Comlink.
   */
  async refreshPlayerMods(allyCode: string): Promise<ModListResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/player/${allyCode}/refresh`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to refresh mods: ${response.statusText}`);
    }

    return response.json();
  }
}

export const modLedgerApi = new ModLedgerApiClient();
