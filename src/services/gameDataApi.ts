/**
 * Game Data API Client
 * Fetches static game data from Astrogators Table API
 */

export interface ModSlotDefinition {
  slot_id: number;
  name: string;      // e.g. "Transmitter"
  shape: string;     // e.g. "Square"
  description?: string;
}

export interface GameDataResponse<T> {
  total: number;
  mod_slots?: T[]; // API wraps list in specific key
  // Add other keys as needed (mod_sets, etc)
}

class GameDataApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_ASTROGATORS_TABLE_URL || 'http://localhost/astrogators-table';
  }

  /**
   * Fetch mod slot definitions
   */
  async fetchModSlots(): Promise<ModSlotDefinition[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/game-data/mod-slots`);

    if (!response.ok) {
      throw new Error(`Failed to fetch mod slots: ${response.statusText}`);
    }

    const data = await response.json();
    return data.mod_slots || [];
  }
}

export const gameDataApi = new GameDataApiClient();
