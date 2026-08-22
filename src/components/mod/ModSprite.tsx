import styles from './ModSprite.module.css';
import {
  MOD_SHAPE_SPRITES_1TO5DOT,
  MOD_SHAPE_SPRITES_6DOT,
  MOD_SET_SPRITES,
  SET_ICON_LAYOUT_CONFIG,
  type ModShape,
  type ModSet,
  type ModTierColor
} from '@/utils/modSpriteConfig';

interface ModSpriteProps {
  shape: string;
  tier: number;
  set: string;
  is6Dot: boolean;
  size?: number;
}

export default function ModSprite({ shape, tier, set, is6Dot, size = 80 }: ModSpriteProps) {
  // Map tier number to color name
  const getTierColor = (tier: number): ModTierColor => {
    if (tier >= 5) return 'Gold';
    if (tier >= 4) return 'Purple';
    if (tier >= 3) return 'Blue';
    if (tier >= 2) return 'Green';
    return 'Grey';
  };

  // Select sprite atlas based on is6Dot
  const shapeSpriteData = is6Dot ? MOD_SHAPE_SPRITES_6DOT : MOD_SHAPE_SPRITES_1TO5DOT;
  const shapeCoords = shapeSpriteData[shape as ModShape];

  // Handle unknown shape gracefully
  if (!shapeCoords) {
    console.warn(`Unknown mod shape: ${shape}`);
    return (
      <div
        className={styles.modSpriteContainer}
        style={{ width: size, height: size }}
        title={`Unknown shape: ${shape}`}
      />
    );
  }

  const tierColor = getTierColor(tier);

  // Calculate centering offsets for Main layer
  const mainLeftOffset = (size - shapeCoords.Main.w) / 2;
  const mainTopOffset = (size - shapeCoords.Main.h) / 2;

  // Calculate centering offsets for Inner layer
  const innerLeftOffset = (size - shapeCoords.Inner.w) / 2;
  const innerTopOffset = (size - shapeCoords.Inner.h) / 2;

  // Render the set icon at its real final size in one step — no
  // upscale-then-transform-down pass (that used to blur it: rasterizing at
  // an intermediate size via background-size, then shrinking that raster
  // again with a CSS transform, is a second lossy resize on top of the
  // first). A single background-size computed directly at the target pixel
  // size lets the browser downsample once, which is sharper.
  //
  // `layoutConfig.size` is a bounding-box max dimension, not an assumed
  // square — the real icon art isn't square for every set (e.g. Defense's
  // shield, Tenacity's fist), so we scale by the icon's longer edge and let
  // the shorter edge come out proportionally smaller, rather than
  // stretching it to fill a square.
  const renderSetIcon = () => {
    const setCoords = MOD_SET_SPRITES[set as ModSet];
    const layoutConfig = SET_ICON_LAYOUT_CONFIG[shape as ModShape]?.[set as ModSet];

    if (!setCoords || !layoutConfig) {
      return null;
    }

    const scale = layoutConfig.size / Math.max(setCoords.w, setCoords.h);
    const iconWidth = setCoords.w * scale;
    const iconHeight = setCoords.h * scale;
    // Center the (possibly non-square) icon within the old square-slot
    // offset, so existing per-shape/per-set placements still line up.
    const centeredOffsetX = layoutConfig.offsetX + (layoutConfig.size - iconWidth) / 2;
    const centeredOffsetY = layoutConfig.offsetY + (layoutConfig.size - iconHeight) / 2;

    return (
      <div
        className={`${styles.modShapeSetIconContainer} ${styles[`tint${tierColor}`]}`}
        style={{
          width: iconWidth,
          height: iconHeight,
          left: centeredOffsetX,
          top: centeredOffsetY,
          backgroundImage: `url(/mod-ledger/assets/sprites/misc_atlas.png)`,
          backgroundPosition: `-${setCoords.x * scale}px -${setCoords.y * scale}px`,
          backgroundSize: `${2048 * scale}px ${2048 * scale}px`
        }}
      />
    );
  };

  return (
    <div
      className={styles.modSpriteContainer}
      style={{ width: size, height: size }}
      title={`${shape} - Tier ${tier} (${tierColor})`}
    >
      {/* Layer 1: Main Shape (untinted) */}
      <div
        className={styles.modShapeMain}
        style={{
          width: shapeCoords.Main.w,
          height: shapeCoords.Main.h,
          left: mainLeftOffset,
          top: mainTopOffset,
          backgroundImage: `url(/mod-ledger/assets/sprites/charactermods_datacard_atlas.png)`,
          backgroundPosition: `-${shapeCoords.Main.x}px -${shapeCoords.Main.y}px`
        }}
      />

      {/* Layer 2: Inner Shape (tinted based on tier) */}
      <div
        className={`${styles.modShapeInner} ${styles[`tint${tierColor}`]}`}
        style={{
          width: shapeCoords.Inner.w,
          height: shapeCoords.Inner.h,
          left: innerLeftOffset,
          top: innerTopOffset,
          backgroundImage: `url(/mod-ledger/assets/sprites/charactermods_datacard_atlas.png)`,
          backgroundPosition: `-${shapeCoords.Inner.x}px -${shapeCoords.Inner.y}px`
        }}
      />

      {/* Layer 3: Set Icon (with upscaling) */}
      {renderSetIcon()}
    </div>
  );
}
