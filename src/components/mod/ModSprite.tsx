import styles from './ModSprite.module.css';
import {
  MOD_SHAPE_SPRITES_1TO5DOT,
  MOD_SHAPE_SPRITES_6DOT,
  MOD_SET_SPRITES,
  SET_ICON_ATLASES,
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
  // upscale-then-transform-down pass. The old version rasterized the
  // background at 3x via background-size, then shrank that raster again
  // with a CSS transform: a second lossy resize stacked on the first,
  // which softened the edges. A single background-size computed directly
  // at the target pixel size lets the browser downsample once, sharper.
  // (Deliberately NOT touching MOD_SET_SPRITES/SET_ICON_LAYOUT_CONFIG or
  // the atlas files here — this is only the render math.)
  const renderSetIcon = () => {
    const setCoords = MOD_SET_SPRITES[set as ModSet];
    const layoutConfig = SET_ICON_LAYOUT_CONFIG[shape as ModShape]?.[set as ModSet];

    if (!setCoords || !layoutConfig) {
      return null;
    }

    const atlas = SET_ICON_ATLASES[setCoords.atlas];
    const targetSize = layoutConfig.size;
    const scaleX = targetSize / setCoords.w;
    const scaleY = targetSize / setCoords.h;

    return (
      <div
        className={`${styles.modShapeSetIconContainer} ${styles[`tint${tierColor}`]}`}
        style={{
          width: targetSize,
          height: targetSize,
          left: layoutConfig.offsetX,
          top: layoutConfig.offsetY,
          backgroundImage: `url(${atlas.url})`,
          backgroundPosition: `-${setCoords.x * scaleX}px -${setCoords.y * scaleY}px`,
          backgroundSize: `${atlas.width * scaleX}px ${atlas.height * scaleY}px`
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
