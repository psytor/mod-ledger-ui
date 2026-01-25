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
  roll_efficiency?: number;  // Average efficiency for scoring
  roll_efficiencies?: number[];  // Individual roll efficiencies for 5-bar visualization
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

export interface BlueprintMatch {
  blueprint_name: string;
  total_matches: number;
  matched_stats: number[];
  matched_stat_names: string[];
  matched_bonus_stats: number[];
  matched_bonus_stat_names: string[];
}

export interface SynergyResult {
  best_match: BlueprintMatch | null;
  all_matches: BlueprintMatch[];
  has_blueprint: boolean;
  primary_rejected: boolean;
  rejection_reason: string | null;
}

export interface GatekeeperResult {
  passed: boolean;
  enforced: boolean;
  failure_reason: string | null;
  rule_results: any[]; // Detailed rule pass/fail objects
}

export type EvaluationDecision =
  | 'UPGRADE_TO_3'
  | 'UPGRADE_TO_6'
  | 'UPGRADE_TO_9'
  | 'UPGRADE_TO_12'
  | 'UPGRADE_TO_15'
  | 'KEEP'
  | 'SELL';

export interface ModEvaluation {
  mod_id: string;
  decision: EvaluationDecision;
  current_level: number;
  current_tier: number;
  next_target_level: number | null;
  synergy_result: SynergyResult | null;
  gatekeeper_result: GatekeeperResult | null;
  has_speed: boolean;
  speed_value: number | null;
  speed_threshold: number | null;
  speed_passed: boolean | null;
  reason: string;
  workflow_step: string | null;
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
   * Evaluate player mods
   */
  async evaluatePlayerMods(allyCode: string): Promise<EvaluationResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/player/${allyCode}/evaluate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `Failed to evaluate mods: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform backend list results to frontend evaluations record
    const evaluations: Record<string, ModEvaluation> = {};
    if (data.evaluations && Array.isArray(data.evaluations)) {
      data.evaluations.forEach((item: any) => {
        evaluations[item.mod.mod_id] = item.evaluation;
      });
    }

    return {
      ally_code: data.ally_code || allyCode,
      profile_name: data.profile_used || 'standard-v1',
      evaluations: evaluations,
      cached: false
    };
  }
}

export const modLedgerApi = new ModLedgerApiClient();
