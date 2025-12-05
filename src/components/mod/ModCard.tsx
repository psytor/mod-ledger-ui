import { Card } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import { formatDisplayValue } from '@/utils/formatters';
import ModSprite from './ModSprite';
import PipIndicator from './PipIndicator';
import styles from './ModCard.module.css';

interface ModCardProps {
  mod: ParsedMod;
  onClick: () => void;
}

export default function ModCard({ mod, onClick }: ModCardProps) {
  // Ensure we always have 4 secondary slots
  const secondarySlots = Array(4).fill(null).map((_, index) => {
    return mod.secondary_stats[index] || null;
  });

  return (
    <Card chamfered hoverable onClick={onClick} className={styles.modCard}>
      {/* TOP: Primary stat */}
      <div className={styles.primaryStat}>
        <span className={styles.primaryValue}>{formatDisplayValue(mod.primary_stat.display_value)}</span>
        <span className={styles.primaryName}>{mod.primary_stat.stat_name}</span>
      </div>

      {/* MIDDLE ROW */}
      <div className={styles.middleRow}>
        {/* MIDDLE-LEFT: Sprite, level, tier, pips */}
        <div className={styles.middleLeft}>
          <ModSprite
            shape={mod.shape}
            tier={mod.tier}
            set={mod.set}
            is6Dot={mod.dots === 6}
            size={80}
          />
          <div className={styles.modMeta}>
            <div className={styles.modLevel}>Lvl {mod.level}</div>
            <PipIndicator dots={mod.dots} />
          </div>
        </div>

        {/* MIDDLE-RIGHT: Secondary stats - always 4 slots */}
        <div className={styles.middleRight}>
          {secondarySlots.map((stat, index) => (
            <div key={index} className={styles.secondaryStat}>
              {stat ? (
                <>
                  <span className={styles.statValue}>{formatDisplayValue(stat.display_value)}</span>
                  <span className={styles.statName}>{stat.stat_name}</span>
                </>
              ) : (
                <span className={styles.emptySlot}>—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM: Character, calibration, lock */}
      <div className={styles.bottomRow}>
        <span className={styles.character}>{mod.character || 'Unassigned'}</span>
        <div className={styles.bottomRight}>
          {mod.dots === 6 && mod.reroll_count !== undefined && (
            <span className={styles.calibration}>Cal: {mod.reroll_count}/5</span>
          )}
          <span className={styles.lockIcon}>{mod.locked ? '🔒' : '🔓'}</span>
        </div>
      </div>
    </Card>
  );
}
