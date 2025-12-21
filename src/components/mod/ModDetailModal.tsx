import { Modal } from 'astrogators-shared-ui';
import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';
import { formatDisplayValue } from '@/utils/formatters';
import SecondaryStatColumn from './SecondaryStatColumn';
import styles from './ModDetailModal.module.css';

interface ModDetailModalProps {
  mod: ParsedMod | null;
  isOpen: boolean;
  onClose: () => void;
  evaluation?: ModEvaluation;
}

export default function ModDetailModal({ mod, isOpen, onClose, evaluation }: ModDetailModalProps) {
  if (!isOpen || !mod) return null;

  // Helper to format recommendation labels
  const formatRecommendation = (rec: string): string => {
    if (rec === 'SLICE-PRIORITY') return 'Slice Priority';
    return rec.charAt(0) + rec.slice(1).toLowerCase();
  };

  // Helper to get recommendation badge class
  const getRecommendationClass = (rec: string): string => {
    switch (rec) {
      case 'KEEP': return styles.badgeKeep;
      case 'SELL': return styles.badgeSell;
      case 'UPGRADE': return styles.badgeUpgrade;
      case 'SLICE': return styles.badgeSlice;
      case 'SLICE-PRIORITY': return styles.badgeSlicePriority;
      default: return '';
    }
  };

  return (
    // The shared Modal component creates the overlay and a base modal-content div.
    // We can pass 'size="large"' which sets max-width to 800px, aligning with the original CSS.
    <Modal isOpen={isOpen} onClose={onClose} title="Mod Details" size="lg">
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

        {/* Calibration Section for 6-dot mods */}
        {mod.dots === 6 && mod.calibrations_left !== undefined && (
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

        {/* Evaluation section */}
        {evaluation && (
          <div className={styles['modal-evaluation-section']}>
            <h3>Evaluation Results</h3>

            <div className={styles['evaluation-recommendation']}>
              <span className={styles['eval-label']}>Recommendation:</span>
              <span className={`${styles['eval-badge']} ${getRecommendationClass(evaluation.recommendation)}`}>
                {formatRecommendation(evaluation.recommendation)}
              </span>
            </div>

            <div className={styles['evaluation-scores']}>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Overall</span>
                <span className={styles['score-value']}>{evaluation.scores.overall.toFixed(1)}</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Synergy</span>
                <span className={styles['score-value']}>{evaluation.scores.synergy.toFixed(1)}</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Quality</span>
                <span className={styles['score-value']}>{evaluation.scores.quality.toFixed(1)}</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Versatility</span>
                <span className={styles['score-value']}>{evaluation.scores.versatility.toFixed(1)}</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Speed Bonus</span>
                <span className={styles['score-value']}>{evaluation.scores.speed_bonus.toFixed(1)}</span>
              </div>
              {evaluation.scores.upgrade_potential !== null && (
                <div className={styles['score-item']}>
                  <span className={styles['score-label']}>Upgrade Potential</span>
                  <span className={styles['score-value']}>{evaluation.scores.upgrade_potential.toFixed(1)}</span>
                </div>
              )}
              {evaluation.scores.slice_value !== null && (
                <div className={styles['score-item']}>
                  <span className={styles['score-label']}>Slice Value</span>
                  <span className={styles['score-value']}>{evaluation.scores.slice_value.toFixed(1)}</span>
                </div>
              )}
            </div>

            <div className={styles['evaluation-reasoning']}>
              <h4>Reasoning</h4>
              <p>{evaluation.reasoning}</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
