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
  roll_efficiency?: number;  // CLEAN BREAK: Changed from "efficiency"
  is_speed?: boolean;
  is_offensive?: boolean;
  is_defensive?: boolean;
  is_revealed?: boolean;  // For secondary stats only
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
  rarity: number;  // CLEAN BREAK: Changed from "dots"
  tier: number;
  tier_name: string;
  tier_color: string;  // NEW: Backend provides tier color ("Gold", "Purple", etc.)
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
}

export interface EvaluationScores {
  synergy: number;        // Count of strategic stat matches (0-4)
  quality: number;        // Weighted roll efficiency score (0-100)
  scalability: number;    // Slicing potential indicator (0-4)
  archetype: string;      // Strategic classification ("High Roller", "Synergy Bomb", etc.)
}

export interface ThresholdCheck {
  metric: string;         // Metric name (e.g., "synergy", "quality", "speed")
  actual: number;         // Actual value from mod
  threshold: number;      // Required threshold value
  operator: string;       // Comparison operator (">=" | "<=" | "==" | ">", "<")
  passed: boolean;        // Whether threshold was met
}

export interface DetailedAnalysis {
  primary_reason: string;           // Main reason for decision (e.g., "High Synergy AND High Speed")
  sub_reasons: string[];            // Supporting reasons (e.g., ["Synergy Score: 4 matches", "Speed Value: 21"])
  decision_path: string;            // Rule path taken (e.g., "Level 15 → Slice (Synergy >= 3)")
  thresholds_checked: ThresholdCheck[];  // All threshold evaluations for transparency
}

export interface ModEvaluation {
  mod_id: string;
  scores: EvaluationScores;
  recommendation: 'SELL' | 'UPGRADE' | 'KEEP' | 'SLICE';  // CLEAN BREAK: Removed "SLICE-PRIORITY"
  detailed_analysis: DetailedAnalysis;  // CLEAN BREAK: Changed from "reasoning: string"
  target_level?: number;  // For UPGRADE recommendations
}

export interface EvaluationResponse {
  ally_code: string;
  profile_name: string;
  evaluations: Record<string, ModEvaluation>;
  cached: boolean;
}

export interface ProfileMetadata {
  name: string;
  profile_name: string;
  description: string;
  version: string;
  frontend_link?: string;
}

export interface ProfileListResponse {
  total: number;
  profiles: ProfileMetadata[];
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
    const response = await fetch(`${this.baseUrl}/api/v1/evaluate/player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        ally_code: allyCode,
        profile: profileName 
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to evaluate mods: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform backend list results to frontend evaluations record
    const evaluations: Record<string, ModEvaluation> = {};
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((result: any) => {
        // The backend returns the full transformed mod AND the scores
        // We just need the evaluation part for the evaluations record
        evaluations[result.mod.mod_id] = {
          mod_id: result.mod.mod_id,
          scores: result.scores,
          recommendation: result.recommendation,
          detailed_analysis: result.detailed_analysis,
          target_level: result.target_level
        };
      });
    }

    return {
      ally_code: data.player_info?.ally_code || allyCode,
      profile_name: profileName || 'standard-v1',
      evaluations: evaluations,
      cached: false
    };
  }

  /**
   * List all available evaluation profiles
   */
  async listProfiles(): Promise<ProfileListResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/profiles`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to fetch profiles: ${response.statusText}`);
    }

    return response.json();
  }
}

export const modLedgerApi = new ModLedgerApiClient();
