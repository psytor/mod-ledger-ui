/**
 * Navicharts API Client
 * Only consumed for the unit catalog, to resolve a character's portrait for
 * ModCard's avatar. Unlike the navicharts-ui app, this app never needs
 * roster/ally-code-scoped unit data.
 */

interface UnitCatalogEntry {
  name: string;
  thumbnail_url: string | null;
}

class NavichartsApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_NAVICHARTS_URL || 'http://localhost/navicharts';
  }

  // Keyed by display name — matches ParsedMod.character exactly (both are the
  // game's human-readable unit name, e.g. "Greef Karga"). A few names collide
  // across event-variant base_ids (e.g. a Mandalorian-event reskin sharing a
  // base hero's name); observed collisions share the same portrait, so
  // first-wins is fine — this is cosmetic, not scoring-relevant.
  async fetchCharacterPortraits(): Promise<Map<string, string>> {
    const response = await fetch(`${this.baseUrl}/api/v1/units/catalog`);
    if (!response.ok) {
      throw new Error(`Failed to fetch unit catalog: ${response.statusText}`);
    }
    const units: UnitCatalogEntry[] = await response.json();
    const portraits = new Map<string, string>();
    for (const unit of units) {
      if (unit.thumbnail_url && !portraits.has(unit.name)) {
        portraits.set(unit.name, unit.thumbnail_url);
      }
    }
    return portraits;
  }
}

export const navichartsApi = new NavichartsApiClient();
