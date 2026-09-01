import spriteStyles from './ModSprite.module.css';
import {
  MOD_SHAPE_SPRITES_1TO5DOT,
  type ModShape,
  type ModTierColor,
} from '@/utils/modSpriteConfig';

const SHAPE_ATLAS_URL =
  '/mod-ledger/assets/sprites/charactermods_datacard_atlas.png';
const SHAPE_ATLAS_W = 1024;
const SHAPE_ATLAS_H = 512;
// Nominal shape footprint in the atlas (largest Main/Inner dim ~80px) — the
// box we scale each layer down into.
const SHAPE_BASE = 82;

interface ShapeIconProps {
  /** Shape name, e.g. "Square" — same value ModSprite takes. */
  shape: string;
  /** Final rendered pixel size (square). */
  size?: number;
  /** Tint applied to the Inner (fill) layer via the shared .tint* classes. */
  tint?: ModTierColor;
  className?: string;
}

/**
 * Standalone mod-shape glyph — the frame (Main) plus the tinted fill (Inner),
 * no set icon. Same one-step background-crop scaling as SetIcon, sized down
 * from the shape atlas's ~80px native sprites into `size`.
 */
export default function ShapeIcon({
  shape,
  size = 22,
  tint = 'Gold',
  className = '',
}: ShapeIconProps) {
  const coords = MOD_SHAPE_SPRITES_1TO5DOT[shape as ModShape];
  if (!coords) return null;

  const scale = size / SHAPE_BASE;
  const bgSize = `${SHAPE_ATLAS_W * scale}px ${SHAPE_ATLAS_H * scale}px`;

  const layer = (part: { x: number; y: number; w: number; h: number }) => ({
    position: 'absolute' as const,
    width: part.w * scale,
    height: part.h * scale,
    left: (size - part.w * scale) / 2,
    top: (size - part.h * scale) / 2,
    backgroundImage: `url(${SHAPE_ATLAS_URL})`,
    backgroundRepeat: 'no-repeat' as const,
    backgroundPosition: `-${part.x * scale}px -${part.y * scale}px`,
    backgroundSize: bgSize,
  });

  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
      }}
    >
      <span style={layer(coords.Main)} />
      <span
        className={spriteStyles[`tint${tint}`]}
        style={layer(coords.Inner)}
      />
    </span>
  );
}
