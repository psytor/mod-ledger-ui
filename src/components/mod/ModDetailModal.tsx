import { Modal, Badge } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import ModSprite from './ModSprite';
import PipIndicator from './PipIndicator';
import styles from './ModDetailModal.module.css';

interface ModDetailModalProps {
  mod: ParsedMod | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ModDetailModal({ mod, isOpen, onClose }: ModDetailModalProps) {
  if (!mod) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mod Details" size="medium">
      <div className={styles.modalContent}>
        {/* Header with sprite and basic info */}
        <div className={styles.header}>
          <ModSprite shape={mod.shape} tier={mod.tier} />
          <div className={styles.headerInfo}>
            <h3 className={styles.modSet}>{mod.set}</h3>
            <div className={styles.modSlot}>{mod.slot}</div>
            <div className={styles.modLevel}>Level {mod.level}</div>
            <PipIndicator dots={mod.dots} />
          </div>
        </div>

        {/* Character assignment */}
        <div className={styles.section}>
          <h4>Assigned To</h4>
          <p className={styles.character}>{mod.character || 'Unassigned'}</p>
        </div>

        {/* Primary stat */}
        <div className={styles.section}>
          <h4>Primary Stat</h4>
          <div className={styles.primaryStat}>
            <span className={styles.statValue}>{mod.primary_stat.display_value}</span>
            <span className={styles.statName}>{mod.primary_stat.stat_name}</span>
          </div>
        </div>

        {/* Secondary stats */}
        <div className={styles.section}>
          <h4>Secondary Stats</h4>
          {mod.secondary_stats.length > 0 ? (
            <div className={styles.secondaryStats}>
              {mod.secondary_stats.map((stat, index) => (
                <div key={index} className={styles.secondaryStat}>
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{stat.display_value}</span>
                    <span className={styles.statName}>{stat.stat_name}</span>
                  </div>
                  {stat.efficiency !== undefined && (
                    <Badge variant="info">{stat.efficiency.toFixed(1)}% efficiency</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.noStats}>No secondary stats</p>
          )}
        </div>

        {/* Additional info */}
        <div className={styles.section}>
          <h4>Additional Info</h4>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.label}>Tier:</span>
              <span>{mod.tier_name} (Tier {mod.tier})</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.label}>Locked:</span>
              <span>{mod.locked ? 'Yes 🔒' : 'No 🔓'}</span>
            </div>
            {mod.dots === 6 && mod.reroll_count !== undefined && (
              <div className={styles.infoItem}>
                <span className={styles.label}>Calibration:</span>
                <span>{mod.reroll_count} / 5</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
