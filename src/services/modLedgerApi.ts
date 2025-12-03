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
  efficiency?: number;
}

export interface ParsedMod {
  mod_id: string;
  set: string;
  slot: string;
  shape: string;
  level: number;
  dots: number;
  tier: number;
  tier_name: string;
  primary_stat: ModStat;
  secondary_stats: ModStat[];
  character: string;
  locked: boolean;
  reroll_count?: number;
}

export interface ModListResponse {
  ally_code: string;
  total_mods: number;
  mods: ParsedMod[];
  cached: boolean;
}

export interface EvaluationScores {
  synergy: number;
  quality: number;
  versatility: number;
  speed_bonus: number;
  upgrade_potential: number;
  slice_value: number;
  overall: number;
}

export interface ModEvaluation {
  mod_id: string;
  scores: EvaluationScores;
  recommendation: 'SELL' | 'UPGRADE' | 'KEEP' | 'SLICE' | 'SLICE-PRIORITY';
  reasoning: string;
}

export interface EvaluationResponse {
  ally_code: string;
  profile_name: string;
  evaluations: Record<string, ModEvaluation>;
  cached: boolean;
}

class ModLedgerApiClient {
  private baseUrl: string;

  constructor() {
    // Get full URL including nginx proxy path
    this.baseUrl = import.meta.env.VITE_MOD_LEDGER_URL || 'http://localhost/mod-ledger';
  }

  /**
   * Fetch all mods for a player by ally code
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
   * Evaluate player mods with optional profile selection
   */
  async evaluatePlayerMods(allyCode: string, profileName?: string): Promise<EvaluationResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/evaluate/${allyCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profile_name: profileName }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to evaluate mods: ${response.statusText}`);
    }

    return response.json();
  }
}

export const modLedgerApi = new ModLedgerApiClient();
