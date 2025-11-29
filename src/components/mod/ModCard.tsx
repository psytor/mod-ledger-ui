import { Card } from '@psytor/astrogators-shared-ui';
import { ParsedMod } from '@/services/modLedgerApi';
import ModSprite from './ModSprite';
import PipIndicator from './PipIndicator';
import styles from './ModCard.module.css';

interface ModCardProps {
  mod: ParsedMod;
  onClick: () => void;
}

export default function ModCard({ mod, onClick }: ModCardProps) {
  return (
    <Card chamfered hoverable onClick={onClick} className={styles.modCard}>
      {/* TOP: Primary stat */}
      <div className={styles.primaryStat}>
        <div className={styles.primaryValue}>{mod.primary_stat.display_value}</div>
        <div className={styles.primaryName}>{mod.primary_stat.stat_name}</div>
      </div>

      {/* MIDDLE ROW */}
      <div className={styles.middleRow}>
        {/* MIDDLE-LEFT: Sprite, level, tier, pips */}
        <div className={styles.middleLeft}>
          <ModSprite shape={mod.shape} tier={mod.tier} />
          <div className={styles.modMeta}>
            <div className={styles.modLevel}>Lvl {mod.level}</div>
            <div className={styles.modTier}>{mod.tier_name}</div>
            <PipIndicator dots={mod.dots} />
          </div>
        </div>

        {/* MIDDLE-RIGHT: Secondary stats */}
        <div className={styles.middleRight}>
          {mod.secondary_stats.length > 0 ? (
            mod.secondary_stats.map((stat, index) => (
              <div key={index} className={styles.secondaryStat}>
                <span className={styles.statValue}>{stat.display_value}</span>
                <span className={styles.statName}>{stat.stat_name}</span>
              </div>
            ))
          ) : (
            <div className={styles.noSecondaries}>No secondaries</div>
          )}
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
