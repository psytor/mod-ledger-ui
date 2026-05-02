import { Modal } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import SecondaryStatColumn from './SecondaryStatColumn';
import styles from './ModDetailModal.module.css';

interface ModDetailModalProps {
  mod: ParsedMod | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ModDetailModal({ mod, isOpen, onClose }: ModDetailModalProps) {
  if (!isOpen || !mod) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mod Details" size="lg">
      <div className={styles['modal-body']}>
        {/* Basic mod info section */}
        <div className={styles['modal-mod-info']}>
          <div className={styles['mod-info-item']}>
            <span className={styles['info-label']}>Set:</span>
            <span className={styles['info-value']}>{mod.set}</span>
          </div>
          <div className={styles['mod-info-item']}>
            <span className={styles['info-label']}>Slot:</span>
            <span className={styles['info-value']}>{mod.slot}</span>
          </div>
          <div className={styles['mod-info-item']}>
            <span className={styles['info-label']}>Tier:</span>
            <span className={styles['info-value']}>{mod.tier_name}</span>
          </div>
          <div className={styles['mod-info-item']}>
            <span className={styles['info-label']}>Level:</span>
            <span className={styles['info-value']}>{mod.level}/15</span>
          </div>
        </div>

        {/* Primary Stat Section */}
        <div className={styles['modal-stats-section']}>
          <h3>Primary Stat: {mod.primary_stat.display_value} {mod.primary_stat.stat_name}</h3>
        </div>

        {/* Secondary stats section */}
        <div className={styles['modal-stats-section']}>
          <h3>Secondary Stats</h3>
          <div className={styles['stats-grid']}>
            {mod.secondary_stats && mod.secondary_stats.length > 0 ? (
              mod.secondary_stats.map((stat, index) => (
                <SecondaryStatColumn key={index} stat={stat} />
              ))
            ) : (
              <p className={styles['no-stats']}>No secondary stats</p>
            )}
          </div>
        </div>

        {/* Calibration Section for 6-rarity mods */}
        {mod.rarity === 6 && mod.calibrations_left !== undefined && (
          <div className={styles['modal-stats-section']}>
            <h3>Calibration Status</h3>
            <div className={styles['calibration-details']}>
              <div className={styles['mod-info-item']}>
                <span className={styles['info-label']}>Calibrations Left:</span>
                <span className={styles['info-value']}>{mod.calibrations_left} / {mod.calibration_limit}</span>
              </div>
              {mod.calibrations_left > 0 && mod.calibration_costs && (
                <div className={styles['mod-info-item']}>
                  <span className={styles['info-label']}>Next Reroll Cost:</span>
                  <span className={styles['info-value']}>
                    {mod.calibration_costs.find(c => c.attempt_number === (mod.reroll_count || 0) + 1)?.cost || 'Maxed'} Micro Attenuators
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
