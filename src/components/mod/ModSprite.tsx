import styles from './ModSprite.module.css';

interface ModSpriteProps {
  shape: string;
  tier: number;
}

export default function ModSprite({ shape, tier }: ModSpriteProps) {
  // Determine tier color based on tier number
  const getTierClass = (tier: number): string => {
    if (tier >= 5) return styles.tierGold;   // A tier
    if (tier >= 4) return styles.tierSilver; // B tier
    if (tier >= 3) return styles.tierBronze; // C tier
    return styles.tierGray;                  // D/E tier
  };

  // Map shape to display name (for accessibility/tooltip)
  const getShapeName = (shape: string): string => {
    const shapeMap: Record<string, string> = {
      'Arrow': 'Arrow',
      'Circle': 'Circle',
      'Cross': 'Cross',
      'Diamond': 'Diamond',
      'Square': 'Square',
      'Triangle': 'Triangle',
    };
    return shapeMap[shape] || shape;
  };

  return (
    <div
      className={`${styles.modSprite} ${getTierClass(tier)}`}
      title={`${getShapeName(shape)} - Tier ${tier}`}
    >
      <span className={styles.shapeIcon}>{shape.charAt(0)}</span>
    </div>
  );
}
