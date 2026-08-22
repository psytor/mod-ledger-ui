/**
 * Sprite coordinate data for mod shapes and set icons
 * Adapted from SWGOH game assets
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

// Set icons are pulled from whichever atlas actually holds up at small
// size for that specific icon — see SET_ICON_ATLASES and MOD_SET_SPRITES
// below for the per-set reasoning.
export type SpriteAtlasName = 'misc' | 'battleui';

export interface SetSpriteCoords extends SpriteCoords {
  atlas: SpriteAtlasName;
  // True when this icon has a second baked-in opaque color (e.g. a glyph
  // painted in solid black rather than cut as a transparent hole) that the
  // normal filter-based tint (below) would flatten into the surrounding
  // shape — that filter chain starts with brightness(0), which crushes
  // every opaque pixel to the same value regardless of its original shade,
  // erasing any second color. Rendered instead via a mix-blend-mode:
  // multiply overlay masked to the icon's own alpha: white areas take the
  // tier color, but black areas stay black (black × anything = black in
  // multiply blending), so the glyph survives. See MOD_SET_SPRITES below
  // for which sets need it and why.
  blendTint?: boolean;
}

export interface SpriteAtlasInfo {
  url: string;
  width: number;
  height: number;
}

export const SET_ICON_ATLASES: Record<SpriteAtlasName, SpriteAtlasInfo> = {
  misc: { url: '/mod-ledger/assets/sprites/misc_atlas.png', width: 2048, height: 2048 },
  battleui: { url: '/mod-ledger/assets/sprites/battleui_view_rgba_atlas.png', width: 2048, height: 1024 }
};

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

// Sprite data for 1-5 Dot Mod Shapes (Main and Inner layers)
export const MOD_SHAPE_SPRITES_1TO5DOT: Record<ModShape, ShapeSpriteData> = {
  Square: { Main: { x: 696, y: 117, w: 79, h: 77 }, Inner: { x: 647, y: 31, w: 80, h: 80 } },
  Arrow: { Main: { x: 696, y: 195, w: 79, h: 77 }, Inner: { x: 566, y: 31, w: 80, h: 80 } },
  Diamond: { Main: { x: 696, y: 433, w: 79, h: 79 }, Inner: { x: 161, y: 31, w: 80, h: 80 } },
  Triangle: { Main: { x: 854, y: 212, w: 78, h: 64 }, Inner: { x: 851, y: 130, w: 81, h: 67 } },
  Circle: { Main: { x: 775, y: 354, w: 79, h: 78 }, Inner: { x: 404, y: 31, w: 80, h: 80 } },
  Cross: { Main: { x: 729, y: 37, w: 76, h: 79 }, Inner: { x: 696, y: 352, w: 78, h: 80 } }
};

// Sprite data for 6-Dot Mod Shapes (6 Dots frame and Inner layer)
export const MOD_SHAPE_SPRITES_6DOT: Record<ModShape, ShapeSpriteData> = {
  Square: { Main: { x: 852, y: 279, w: 78, h: 75 }, Inner: { x: 647, y: 31, w: 80, h: 80 } },
  Arrow: { Main: { x: 776, y: 198, w: 77, h: 76 }, Inner: { x: 566, y: 31, w: 80, h: 80 } },
  Diamond: { Main: { x: 777, y: 434, w: 77, h: 78 }, Inner: { x: 161, y: 31, w: 80, h: 80 } },
  Triangle: { Main: { x: 887, y: 66, w: 76, h: 63 }, Inner: { x: 851, y: 130, w: 81, h: 67 } },
  Circle: { Main: { x: 696, y: 273, w: 78, h: 78 }, Inner: { x: 404, y: 31, w: 80, h: 80 } },
  Cross: { Main: { x: 776, y: 275, w: 76, h: 78 }, Inner: { x: 696, y: 352, w: 78, h: 80 } }
};

// Sprite data for Mod Set Icons.
//
// Health/Offense/Defense/Speed/Tenacity/Critical Chance/Critical Damage all
// come from battleui_view_rgba_atlas's real 32x32 mipmaps — actual small
// exports from the game's own asset pipeline, not this code downscaling the
// old 120px misc_atlas versions. Going from a 32px source to a ~30px display
// size is a tiny resize instead of a ~4x one, so fine detail (Speed's motion
// lines, the "2x"/"!" glyph) actually survives.
//
// Critical Chance/Critical Damage need `blendTint: true` on top of that:
// their "2x"/"!" glyph is baked in as solid opaque BLACK on the white
// starburst (checked the raw pixel values — (0,0,0,255) at the glyph,
// vs (255,255,255,255) on the burst), not a transparent cutout like the
// other icons. The normal filter-based tint (brightness(0) first, which
// crushes every opaque pixel to the same value) would erase that glyph
// entirely — Crit Chance and Crit Damage would render as the identical
// plain starburst. blendTint switches these two to a mix-blend-mode:
// multiply overlay instead (see ModSprite.tsx) — white areas take the tier
// color, black areas stay black, so the glyph survives. Do not flip
// blendTint off for these two, and do not set it on an icon without first
// checking its raw pixel values the same way — a same-looking icon can
// still be single-tone (no benefit, added complexity for nothing) or
// encoded a third way this technique doesn't handle.
//
// Potency has no smaller/higher-quality alternative in any available atlas
// — stays on the small icon_stat_potency UI icon, misc_atlas 50x52.
export const MOD_SET_SPRITES: Record<ModSet, SetSpriteCoords> = {
  "Critical Chance": { atlas: 'battleui', x: 1365, y: 466, w: 32, h: 32, blendTint: true },
  "Critical Damage": { atlas: 'battleui', x: 1615, y: 924, w: 32, h: 32, blendTint: true },
  Defense: { atlas: 'battleui', x: 1519, y: 348, w: 32, h: 32 },
  Health: { atlas: 'battleui', x: 1496, y: 856, w: 32, h: 32 },
  Offense: { atlas: 'battleui', x: 1424, y: 730, w: 32, h: 32 },
  Potency: { atlas: 'misc', x: 1143, y: 1117, w: 120, h: 120 },
  Speed: { atlas: 'battleui', x: 1371, y: 206, w: 32, h: 32 },
  Tenacity: { atlas: 'battleui', x: 1637, y: 584, w: 32, h: 32 }
};

// Set Icon positioning for each shape
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
