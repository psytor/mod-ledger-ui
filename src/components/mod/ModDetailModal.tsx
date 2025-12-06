import { Modal } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import { formatDisplayValue } from '@/utils/formatters';
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
    // The shared Modal component creates the overlay and a base modal-content div.
    // We can pass 'size="large"' which sets max-width to 800px, aligning with the original CSS.
    <Modal isOpen={isOpen} onClose={onClose} title="Mod Details" size="large">
      {/* The content inside the modal body should follow the original structure. */}
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

        {/* Primary Stat Section - Added for completeness */}
        <div className={styles['modal-stats-section']}>
            <h3>Primary Stat: {formatDisplayValue(mod.primary_stat.display_value)} {mod.primary_stat.stat_name}</h3>
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
      </div>
    </Modal>
  );
}
