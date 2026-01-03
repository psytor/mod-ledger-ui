import { Modal } from 'astrogators-shared-ui';
import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';
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

  // Helper to format recommendation labels (CLEAN BREAK: Removed SLICE-PRIORITY)
  const formatRecommendation = (rec: string): string => {
    return rec.charAt(0) + rec.slice(1).toLowerCase();
  };

  // Helper to get recommendation badge class (CLEAN BREAK: Removed SLICE-PRIORITY)
  const getRecommendationClass = (rec: string): string => {
    switch (rec) {
      case 'KEEP': return styles.badgeKeep;
      case 'SELL': return styles.badgeSell;
      case 'UPGRADE': return styles.badgeUpgrade;
      case 'SLICE': return styles.badgeSlice;
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

        {/* Calibration Section for 6-rarity mods (CLEAN BREAK: Changed from "dots") */}
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

        {/* Evaluation section - CLEAN BREAK: New schema */}
        {evaluation && (
          <div className={styles['modal-evaluation-section']}>
            <h3>Evaluation Results</h3>

            {/* Recommendation Badge */}
            <div className={styles['evaluation-recommendation']}>
              <span className={styles['eval-label']}>Recommendation:</span>
              <span className={`${styles['eval-badge']} ${getRecommendationClass(evaluation.recommendation)}`}>
                {formatRecommendation(evaluation.recommendation)}
              </span>
              {evaluation.target_level && (
                <span className={styles['target-level']}>→ Level {evaluation.target_level}</span>
              )}
            </div>

            {/* Core Scores Section */}
            <div className={styles['evaluation-scores']}>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Synergy</span>
                <span className={styles['score-value']}>{evaluation.scores.synergy}/4</span>
                <span className={styles['score-hint']}>Strategic stat matches</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Quality</span>
                <span className={styles['score-value']}>{evaluation.scores.quality.toFixed(1)}%</span>
                <span className={styles['score-hint']}>Roll efficiency</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Scalability</span>
                <span className={styles['score-value']}>{evaluation.scores.scalability}/4</span>
                <span className={styles['score-hint']}>Slicing potential</span>
              </div>
            </div>

            {/* Archetype Badge */}
            <div className={styles['archetype-section']}>
              <span className={styles['archetype-label']}>Archetype:</span>
              <span className={styles['archetype-badge']}>{evaluation.scores.archetype}</span>
            </div>

            {/* Decision Transparency Section */}
            <div className={styles['detailed-analysis-section']}>
              <h4>Decision Analysis</h4>

              {/* Primary Reason */}
              <div className={styles['analysis-primary-reason']}>
                <strong>Primary Reason:</strong> {evaluation.detailed_analysis.primary_reason}
              </div>

              {/* Decision Path */}
              <div className={styles['analysis-decision-path']}>
                <strong>Decision Path:</strong> {evaluation.detailed_analysis.decision_path}
              </div>

              {/* Sub-reasons */}
              {evaluation.detailed_analysis.sub_reasons.length > 0 && (
                <div className={styles['analysis-sub-reasons']}>
                  <strong>Supporting Reasons:</strong>
                  <ul>
                    {evaluation.detailed_analysis.sub_reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transparency Table */}
              {evaluation.detailed_analysis.thresholds_checked.length > 0 && (
                <div className={styles['transparency-table']}>
                  <strong>Thresholds Evaluated:</strong>
                  <table className={styles['threshold-table']}>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Actual</th>
                        <th>Operator</th>
                        <th>Threshold</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluation.detailed_analysis.thresholds_checked.map((tc, idx) => (
                        <tr key={idx} className={tc.passed ? styles['threshold-passed'] : styles['threshold-failed']}>
                          <td>{tc.metric}</td>
                          <td>{tc.actual}</td>
                          <td>{tc.operator}</td>
                          <td>{tc.threshold}</td>
                          <td>{tc.passed ? '✅ Pass' : '❌ Fail'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
