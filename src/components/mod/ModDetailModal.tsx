import { Modal } from 'astrogators-shared-ui';
import type { ParsedMod, ModEvaluation, EvaluationDecision } from '@/services/modLedgerApi';
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

  // Helper to format decision labels (v4.0)
  const formatDecision = (decision: EvaluationDecision): string => {
    if (decision.startsWith('UPGRADE_TO_')) {
      return `Upgrade to ${decision.replace('UPGRADE_TO_', '')}`;
    }
    return decision.charAt(0) + decision.slice(1).toLowerCase();
  };

  // Helper to get recommendation badge class (v4.0)
  const getRecommendationClass = (decision: EvaluationDecision): string => {
    if (decision === 'KEEP') return styles.badgeKeep;
    if (decision === 'SELL') return styles.badgeSell;
    if (decision.startsWith('UPGRADE_TO_')) return styles.badgeUpgrade;
    return '';
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
              <span className={`${styles['eval-badge']} ${getRecommendationClass(evaluation.decision)}`}>
                {formatDecision(evaluation.decision)}
              </span>
              {evaluation.next_target_level && (
                <span className={styles['target-level']}>→ Level {evaluation.next_target_level}</span>
              )}
            </div>

            {/* Primary Mismatch Warning */}
            {evaluation.synergy_result?.primary_rejected && (
              <div className={styles['primary-mismatch-warning']}>
                <span className={styles['warning-icon']}>⚠️</span>
                <span className={styles['warning-text']}>
                  This mod has an <strong>invalid primary stat</strong> for its set. {evaluation.synergy_result.rejection_reason}
                </span>
              </div>
            )}

            {/* Core Scores Section */}
            <div className={styles['evaluation-scores']} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div 
                className={styles['score-item']}
                title={evaluation.synergy_result?.best_match?.matched_stat_names?.join(', ') || 'No matches found'}
              >
                <span className={styles['score-label']}>Matches</span>
                <span className={styles['score-value']}>{evaluation.synergy_result?.best_match?.total_matches ?? 0}/4</span>
                <span className={styles['score-hint']}>Matching stats</span>
              </div>
              <div className={styles['score-item']}>
                <span className={styles['score-label']}>Speed</span>
                <span className={styles['score-value']}>
                  {evaluation.speed_value !== null ? `+${evaluation.speed_value}` : '—'}
                </span>
                <span className={styles['score-hint']}>Speed bonus</span>
              </div>
            </div>

            {/* Archetype section removed - no longer available in API */}

            {/* Decision Transparency Section */}
            <div className={styles['detailed-analysis-section']}>
              <h4>Analysis</h4>
              <p className={styles['analysis-primary-reason']}>{evaluation.reason}</p>

              {/* Optional: Show synergy blueprint match */}
              {evaluation.synergy_result?.best_match && (
                <div className={styles['analysis-details']}>
                  <p className={styles['analysis-decision-path']}>
                    <strong>Blueprint:</strong> {evaluation.synergy_result.best_match.blueprint_name}
                  </p>
                  {/* NEW: Matched Stats */}
                  {evaluation.synergy_result.best_match.matched_stat_names && evaluation.synergy_result.best_match.matched_stat_names.length > 0 && (
                    <p className={styles['analysis-bonus-stats']}>
                      <strong>Matches:</strong> {evaluation.synergy_result.best_match.matched_stat_names.join(', ')}
                    </p>
                  )}
                  {evaluation.synergy_result.best_match.matched_bonus_stat_names && evaluation.synergy_result.best_match.matched_bonus_stat_names.length > 0 && (
                    <p className={styles['analysis-bonus-stats']}>
                      <strong>Bonus Matches:</strong> {evaluation.synergy_result.best_match.matched_bonus_stat_names.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Gatekeeper Rule Breakdown (if available) */}
              {evaluation.gatekeeper_result?.rule_results && evaluation.gatekeeper_result.rule_results.length > 0 && (
                <div className={styles['rule-breakdown']}>
                  <h5>Gatekeeper Rules</h5>
                  <ul className={styles['rule-list']}>
                    {evaluation.gatekeeper_result.rule_results.map((rule, idx) => (
                      <li key={idx} className={rule.passed ? styles['rule-pass'] : styles['rule-fail']}>
                        <span className={styles['rule-icon']}>{rule.passed ? '✅' : '❌'}</span>
                        <span className={styles['rule-name']}>{rule.step_name || `Rule ${idx + 1}`}</span>
                        {!rule.passed && rule.reason && (
                          <span className={styles['rule-reason']}> - {rule.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
