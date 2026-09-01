import spriteStyles from './ModSprite.module.css';
import {
  MOD_SET_SPRITES,
  SET_ICON_ATLASES,
  type ModSet,
  type ModTierColor,
} from '@/utils/modSpriteConfig';

interface SetIconProps {
  /** Bare set name, e.g. "Health" — the same value ModSprite takes. */
  set: string;
  /** Final rendered pixel size (square). */
  size?: number;
  /** Tint applied via the shared .tint* filter classes. */
  tint?: ModTierColor;
  className?: string;
}

/**
 * Standalone mod-set bonus icon — just the set glyph, no shape frame or
 * inner layers. Mirrors ModSprite's renderSetIcon() background-crop math
 * (render at the real target size in one step, no upscale-then-scale-down)
 * but drops the shape-relative SET_ICON_LAYOUT_CONFIG offsets since there's
 * nothing to position against here.
 */
export default function SetIcon({
  set,
  size = 20,
  tint = 'Gold',
  className = '',
}: SetIconProps) {
  const setCoords = MOD_SET_SPRITES[set as ModSet];
  if (!setCoords) return null;

  const atlas = SET_ICON_ATLASES[setCoords.atlas];
  const scaleX = size / setCoords.w;
  const scaleY = size / setCoords.h;
  const crispClass = setCoords.crisp
    ? spriteStyles.modShapeSetIconContainerCrisp
    : '';

  return (
    <span
      className={`${spriteStyles.modShapeSetIconContainer} ${crispClass} ${spriteStyles[`tint${tint}`]} ${className}`}
      style={{
        position: 'static',
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        backgroundImage: `url(${atlas.url})`,
        backgroundPosition: `-${setCoords.x * scaleX}px -${setCoords.y * scaleY}px`,
        backgroundSize: `${atlas.width * scaleX}px ${atlas.height * scaleY}px`,
      }}
    />
  );
}
