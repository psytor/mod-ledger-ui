import type { ParsedMod } from '@/services/modLedgerApi';

// A pilot assignment marks one mod (by its game instance id, ParsedMod.mod_id)
// as "kept for a ship pilot" so it is protected from the Sell pile. It is
// GENERAL — never tied to a specific pilot/character. The engine keeps
// evaluating an assigned mod; assignment only diverts a SELL verdict.

// One stat line in the snapshot — just what we need to redraw the mod later.
export interface ModSnapshotStat {
  stat_name: string;
  display_value: string;
}

// Denormalized copy of the mod card, captured at assign time. Used ONLY to
// show what an assigned mod looked like once it disappears from a pull —
// because Comlink returns only *equipped* mods, an assigned mod that gets
// unequipped (or sold) vanishes from the inventory and we have nothing live to
// render. `character` is the last-equipped character base_id, kept purely for
// this orphan-display message; it is NOT a per-character rule.
export interface ModSnapshot {
  set: string;
  slot: string;
  shape: string;
  level: number;
  rarity: number;
  tier_name: string;
  tier_color: string;
  primary: ModSnapshotStat;
  secondaries: ModSnapshotStat[];
  character: string;
}

export interface PilotAssignment {
  // Backend row id (or a client UUID for a local/offline record).
  id: string;
  // The mod's game instance id — the key everything joins on.
  modId: string;
  snapshot: ModSnapshot;
  createdAt: number;
  updatedAt: number;
}

// Build a snapshot from a live mod. Kept tiny and self-contained so a stored
// assignment can be rendered without re-fetching anything.
export function buildModSnapshot(mod: ParsedMod): ModSnapshot {
  return {
    set: mod.set,
    slot: mod.slot,
    shape: mod.shape,
    level: mod.level,
    rarity: mod.rarity,
    tier_name: mod.tier_name,
    tier_color: mod.tier_color,
    primary: {
      stat_name: mod.primary_stat.stat_name,
      display_value: mod.primary_stat.display_value,
    },
    secondaries: mod.secondary_stats.map((s) => ({
      stat_name: s.stat_name,
      display_value: s.display_value,
    })),
    character: mod.character,
  };
}
