import { Card } from 'astrogators-shared-ui';
import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';
import { formatDisplayValue } from '@/utils/formatters';
import ModSprite from './ModSprite';
import styles from './ModCard.module.css';

interface ModCardProps {
  mod: ParsedMod;
  onClick: () => void;
  evaluation?: ModEvaluation;
}

// Tier color mapping for borders
const tierBorderColors = {
  1: '#b4bac7',  // Grey
  2: '#84cc16',  // Green
  3: '#3b82f6',  // Blue
  4: '#8b5cf6',  // Purple
  5: '#fbbf24',  // Gold
} as const;

// Tier color names for glow gradients
const tierColorNames = {
  1: 'Grey',
  2: 'Green',
  3: 'Blue',
  4: 'Purple',
  5: 'Gold',
} as const;

export default function ModCard({ mod, onClick, evaluation }: ModCardProps) {
  // Ensure we always have 4 secondary slots
  const secondarySlots = Array(4).fill(null).map((_, index) => {
    return mod.secondary_stats[index] || null;
  });

  // Calculate average efficiency from secondary stats
  const secondaryStatsWithEfficiency = mod.secondary_stats.filter(
    stat => stat.efficiency !== undefined && stat.efficiency !== null
  );
  const averageEfficiency = secondaryStatsWithEfficiency.length > 0
    ? secondaryStatsWithEfficiency.reduce((sum, stat) => sum + stat.efficiency!, 0) /
      secondaryStatsWithEfficiency.length
    : null;

  // Determine tier class
  const getTierClass = (tier: number): string => {
    if (tier >= 5) return styles.tierGold;
    if (tier >= 4) return styles.tierPurple;
    if (tier >= 3) return styles.tierBlue;
    if (tier >= 2) return styles.tierGreen;
    return styles.tierGrey;
  };

  const tierClass = getTierClass(mod.tier);
  const isSixDot = mod.dots === 6;
  const tierBorderColor = tierBorderColors[Math.min(5, Math.max(1, mod.tier)) as keyof typeof tierBorderColors];
  const tierColorName = tierColorNames[Math.min(5, Math.max(1, mod.tier)) as keyof typeof tierColorNames];

  // Glow gradient classes based on tier
  const glowGradientClass = {
    'Grey': styles.glowGrey,
    'Green': styles.glowGreen,
    'Blue': styles.glowBlue,
    'Purple': styles.glowPurple,
    'Gold': styles.glowGold,
  }[tierColorName];

  // Evaluation display
  const getEvaluationDisplay = (rec: string) => {
    switch (rec) {
      case 'KEEP': return { emoji: '✅', label: 'Keep', class: styles.badgeKeep };
      case 'SELL': return { emoji: '💰', label: 'Sell', class: styles.badgeSell };
      case 'UPGRADE': return { emoji: '⬆️', label: 'Upgrade', class: styles.badgeUpgrade };
      case 'SLICE': return { emoji: '🔪', label: 'Slice', class: styles.badgeSlice };
      case 'SLICE-PRIORITY': return { emoji: '🔪', label: 'Slice!', class: styles.badgeSlicePriority };
      default: return null;
    }
  };

  const evaluationDisplay = evaluation ? getEvaluationDisplay(evaluation.recommendation) : null;

  return (
    <div className={styles.cardWrapper}>
      {/* External glow background - matches mod tier color */}
      <div className={`${styles.glowBackground} ${glowGradientClass}`}></div>

      <Card
        chamfered
        chamferSize="asymmetric"
        showDiagonalBorders
        diagonalBorderColor={tierBorderColor}
        hoverable
        padding="none"
        onClick={onClick}
        className={`${styles.modCard} ${tierClass} ${isSixDot ? styles.sixDot : ''}`}
        style={{ '--border-color': tierBorderColor } as React.CSSProperties}
      >
        {/* Main content */}
        <div className={styles.cardContent}>
          {/* TOP ROW: Evaluation Badge (left) and Average Percentage (right) */}
          <div className={styles.topRow}>
            <div className={styles.topLeft}>
              {evaluationDisplay && (
                <div className={`${styles.badge} ${evaluationDisplay.class}`}>
                  {evaluationDisplay.emoji} {evaluationDisplay.label}
                </div>
              )}
            </div>
            <div className={styles.topRight}>
              {averageEfficiency !== null && (
                <div className={styles.averagePercentage}>
                  {averageEfficiency.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          {/* MIDDLE ROW: Mod Shape (left) and Stats (right) */}
          <div className={styles.middleRow}>
            {/* Left side - Dots, Sprite, Level */}
            <div className={styles.leftColumn}>
              {/* Dots indicator */}
              <div className={styles.dotsContainer}>
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className={i < mod.dots ? styles.dotActive : styles.dotInactive}
                  />
                ))}
              </div>

              {/* Mod sprite */}
              <div className={styles.spriteContainer}>
                <ModSprite
                  shape={mod.shape}
                  tier={mod.tier}
                  set={mod.set}
                  is6Dot={mod.dots === 6}
                  size={80}
                />
              </div>

              {/* Level and tier */}
              <div className={styles.modMeta}>
                <span className={styles.modLevel}>{mod.level} - {mod.tier_name}</span>
              </div>
            </div>

            {/* Right side - Primary and Secondary stats */}
            <div className={styles.rightColumn}>
              {/* Primary stat */}
              <div className={styles.primaryStat}>
                <span className={styles.primaryName}>{mod.primary_stat.stat_name}</span>
                <span className={styles.primaryValue}>{formatDisplayValue(mod.primary_stat.display_value)}</span>
              </div>

              {/* Secondary stats */}
              <div className={styles.secondaryStats}>
                {secondarySlots.map((stat, index) => (
                  <div key={index} className={styles.secondaryStat}>
                    {stat ? (
                      <>
                        <span className={styles.statValue}>{formatDisplayValue(stat.display_value)}</span>
                        <span className={styles.statName}>{stat.stat_name}</span>
                        {stat.efficiency !== undefined && stat.efficiency !== null && (
                          <span className={styles.efficiency}>{stat.efficiency.toFixed(1)}%</span>
                        )}
                      </>
                    ) : (
                      <span className={styles.emptySlot}>—</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Character name, Lock status, and Calibration info */}
          <div className={styles.bottomSection}>
            {/* Calibrations for 6-dot mods */}
            {isSixDot && mod.reroll_count !== undefined && (
              <div className={styles.calibrationRow}>
                <span className={styles.calibration}>🔄 Calibrations left ({5 - mod.reroll_count}/5)</span>
              </div>
            )}

            {/* Character name */}
            <div className={styles.characterRow}>
              <span className={styles.character}>{mod.character || 'Unassigned'}</span>
            </div>
          </div>

        {/* Lock indicator - Bottom Right */}
        <div className={styles.lockIndicator}>
          {mod.locked ? '🔒' : '🔓'}
        </div>
        </div>
      </Card>
    </div>
  );
}
