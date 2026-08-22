/**
 * Sprite coordinate data for mod shapes and set icons.
 *
 * Sourced from the game's own exported sprite-atlas metadata (named regions
 * with exact X/Y/Width/Height — see the atlas .json files this was
 * generated from), not hand-measured. Each shape's atlas region is named
 * `modchip_{shape}_base` (1-5 dot frame), `modchip_{shape}_6dot` (6-dot
 * frame), and `modchip_{shape}_selected` (the tintable ring used as the
 * "Inner" layer — it's the shape's selection-highlight outline, reused here
 * as a tier-color-tinted accent, not a literal fill of the shape's
 * interior). Set icons are the same art used for in-combat buff icons
 * (`icon_buff_*`), which are meaningfully higher-resolution than the old
 * `icon_stat_*` UI icons — except Potency and Tenacity, where no
 * `icon_buff_*` variant exists in the atlas (Tenacity falls back to the
 * mid-res `icon_tenacity`; Potency has no larger alternative at all, so it
 * stays on `icon_stat_potency`).
 */

// Type definitions
export type ModShape = 'Square' | 'Arrow' | 'Diamond' | 'Triangle' | 'Circle' | 'Cross';
export type ModSet = 'Critical Chance' | 'Critical Damage' | 'Defense' | 'Health' | 'Offense' | 'Potency' | 'Speed' | 'Tenacity';
export type ModTierColor = 'Grey' | 'Green' | 'Blue' | 'Purple' | 'Gold';

// Sprite coordinate interface
export interface SpriteCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Shape sprite data interface
export interface ShapeSpriteData {
  Main: SpriteCoords;
  Inner: SpriteCoords;
}

// Set icon layout interface
export interface SetIconLayout {
  size: number;
  offsetX: number;
  offsetY: number;
}

// Sprite data for 1-5 Dot Mod Shapes (Main = modchip_{shape}_base, Inner = modchip_{shape}_selected)
export const MOD_SHAPE_SPRITES_1TO5DOT: Record<ModShape, ShapeSpriteData> = {
  Square: { Main: { x: 696, y: 117, w: 79, h: 77 }, Inner: { x: 0, y: 31, w: 80, h: 80 } },
  Arrow: { Main: { x: 696, y: 195, w: 79, h: 77 }, Inner: { x: 486, y: 31, w: 80, h: 80 } },
  Diamond: { Main: { x: 696, y: 433, w: 79, h: 79 }, Inner: { x: 81, y: 31, w: 80, h: 80 } },
  Triangle: { Main: { x: 854, y: 212, w: 78, h: 65 }, Inner: { x: 806, y: 52, w: 80, h: 69 } },
  Circle: { Main: { x: 775, y: 354, w: 79, h: 78 }, Inner: { x: 324, y: 31, w: 80, h: 80 } },
  Cross: { Main: { x: 729, y: 37, w: 76, h: 79 }, Inner: { x: 243, y: 31, w: 80, h: 80 } }
};

// Sprite data for 6-Dot Mod Shapes (Main = modchip_{shape}_6dot, Inner is the
// same selection-ring region — there's no separate 6-dot "selected" sprite).
export const MOD_SHAPE_SPRITES_6DOT: Record<ModShape, ShapeSpriteData> = {
  Square: { Main: { x: 853, y: 278, w: 77, h: 75 }, Inner: { x: 0, y: 31, w: 80, h: 80 } },
  Arrow: { Main: { x: 776, y: 198, w: 77, h: 76 }, Inner: { x: 486, y: 31, w: 80, h: 80 } },
  Diamond: { Main: { x: 776, y: 434, w: 78, h: 78 }, Inner: { x: 81, y: 31, w: 80, h: 80 } },
  Triangle: { Main: { x: 887, y: 66, w: 76, h: 63 }, Inner: { x: 806, y: 52, w: 80, h: 69 } },
  Circle: { Main: { x: 696, y: 273, w: 79, h: 78 }, Inner: { x: 324, y: 31, w: 80, h: 80 } },
  Cross: { Main: { x: 776, y: 275, w: 76, h: 78 }, Inner: { x: 243, y: 31, w: 80, h: 80 } }
};

// Sprite data for Mod Set Icons — the in-combat buff-icon art (icon_buff_*),
// not the small icon_stat_* UI icons the old config approximated. Real
// per-icon aspect ratios (not all square) — ModSprite.tsx fits each into its
// layout slot preserving aspect ratio.
export const MOD_SET_SPRITES: Record<ModSet, SpriteCoords> = {
  "Critical Chance": { x: 1210, y: 1682, w: 120, h: 120 },
  "Critical Damage": { x: 1231, y: 1225, w: 120, h: 120 },
  Defense: { x: 1812, y: 1948, w: 88, h: 100 },
  Health: { x: 1332, y: 1686, w: 112, h: 116 },
  Offense: { x: 1236, y: 1428, w: 120, h: 120 },
  Potency: { x: 1716, y: 1068, w: 50, h: 52 },
  Speed: { x: 1393, y: 990, w: 123, h: 113 },
  Tenacity: { x: 1676, y: 1433, w: 84, h: 112 }
};

// Set Icon positioning for each shape — visual placement tuning, unaffected
// by the coordinate-precision fix above (kept as-is; not what was reported
// as low quality).
export const SET_ICON_LAYOUT_CONFIG: Record<ModShape, Record<ModSet, SetIconLayout>> = {
  Square: {
    "Critical Chance": { size: 31, offsetX: 34, offsetY: 16 },
    "Critical Damage": { size: 31, offsetX: 34, offsetY: 16 },
    Defense: { size: 31, offsetX: 34, offsetY: 16 },
    Health: { size: 30, offsetX: 35, offsetY: 19 },
    Offense: { size: 30, offsetX: 34, offsetY: 17 },
    Potency: { size: 29, offsetX: 35, offsetY: 18 },
    Speed: { size: 29, offsetX: 36, offsetY: 17 },
    Tenacity: { size: 26, offsetX: 37, offsetY: 20 }
  },
  Arrow: {
    "Critical Chance": { size: 24, offsetX: 40, offsetY: 17 },
    "Critical Damage": { size: 24, offsetX: 40, offsetY: 17 },
    Defense: { size: 24, offsetX: 41, offsetY: 17 },
    Health: { size: 21, offsetX: 44, offsetY: 17 },
    Offense: { size: 23, offsetX: 41, offsetY: 17 },
    Potency: { size: 23, offsetX: 41, offsetY: 18 },
    Speed: { size: 22, offsetX: 42, offsetY: 17 },
    Tenacity: { size: 21, offsetX: 42, offsetY: 18 }
  },
  Diamond: {
    "Critical Chance": { size: 28, offsetX: 26, offsetY: 25 },
    "Critical Damage": { size: 28, offsetX: 26, offsetY: 25 },
    Offense: { size: 27, offsetX: 27, offsetY: 26 },
    Defense: { size: 25, offsetX: 28, offsetY: 26 },
    Health: { size: 26, offsetX: 28, offsetY: 26 },
    Potency: { size: 28, offsetX: 26, offsetY: 25 },
    Speed: { size: 26, offsetX: 27, offsetY: 26 },
    Tenacity: { size: 25, offsetX: 28, offsetY: 25 }
  },
  Triangle: {
    "Critical Chance": { size: 22, offsetX: 29, offsetY: 35 },
    "Critical Damage": { size: 22, offsetX: 29, offsetY: 36 },
    Offense: { size: 21, offsetX: 30, offsetY: 36 },
    Defense: { size: 22, offsetX: 30, offsetY: 34 },
    Health: { size: 20, offsetX: 31, offsetY: 36 },
    Potency: { size: 22, offsetX: 30, offsetY: 34 },
    Speed: { size: 20, offsetX: 29, offsetY: 35 },
    Tenacity: { size: 20, offsetX: 31, offsetY: 36 }
  },
  Circle: {
    "Critical Chance": { size: 27, offsetX: 27, offsetY: 27 },
    "Critical Damage": { size: 27, offsetX: 27, offsetY: 27 },
    Offense: { size: 27, offsetX: 27, offsetY: 27 },
    Defense: { size: 26, offsetX: 28, offsetY: 26 },
    Health: { size: 25, offsetX: 29, offsetY: 29 },
    Potency: { size: 28, offsetX: 26, offsetY: 26 },
    Speed: { size: 24, offsetX: 28, offsetY: 27 },
    Tenacity: { size: 24, offsetX: 30, offsetY: 28 }
  },
  Cross: {
    "Critical Chance": { size: 23, offsetX: 27, offsetY: 28 },
    "Critical Damage": { size: 23, offsetX: 27, offsetY: 28 },
    Offense: { size: 22, offsetX: 28, offsetY: 29 },
    Defense: { size: 23, offsetX: 29, offsetY: 28 },
    Health: { size: 21, offsetX: 31, offsetY: 29 },
    Potency: { size: 25, offsetX: 27, offsetY: 27 },
    Speed: { size: 22, offsetX: 28, offsetY: 28 },
    Tenacity: { size: 21, offsetX: 29, offsetY: 29 }
  }
};

// Hex colors for mod tiers (reference values)
export const MOD_TIER_COLORS: Record<ModTierColor, string> = {
  Grey: "#6b7280",
  Green: "#10b981",
  Blue: "#3b82f6",
  Purple: "#8b5cf6",
  Gold: "#f59e0b"
};
