import { useState } from 'react';
import { Modal, Button } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { usePilotAssignment } from '@/contexts/PilotAssignmentContext';
import type { SecondaryRole, VerdictResult } from '@/types/evaluation';
import { explainVerdict, explainQualityScore } from '@/utils/verdictExplain';
import {
  actionOf,
  isPilotMod,
  qualityBand,
  qualityBandLabel,
  qualityBandPriority,
  qualityBandAction,
} from '@/utils/modDisposition';
import SecondaryStatColumn from './SecondaryStatColumn';
import styles from './ModDetailModal.module.css';

interface ModDetailModalProps {
  mod: ParsedMod | null;
  isOpen: boolean;
  onClose: () => void;
}

function verdictBadgeClass(v: VerdictResult['verdict']): string {
  switch (v) {
    case 'SELL': return styles.evalBadgeSell;
    case 'UPGRADE': return styles.evalBadgeUpgrade;
    case 'PASS_RULES': return styles.evalBadgePass;
    case 'UNCONFIGURED': return styles.evalBadgeUnconfigured;
  }
}

function verdictLabel(v: VerdictResult): string {
  if (v.verdict === 'UPGRADE' && v.target_level) return `↑L${v.target_level}`;
  if (v.verdict === 'PASS_RULES') return 'PASS';
  return v.verdict;
}

// A secondary's role under the reference rule. Unrevealed slots show "Hidden"
// regardless of role — the rule can't have judged a stat the game hasn't shown.
function roleDisplay(s: SecondaryRole): { label: string; cls: string } {
  if (!s.is_revealed) return { label: 'Hidden', cls: styles.secRoleNeutral };
  switch (s.role) {
    case 'required': return { label: 'Required', cls: styles.secRoleRequired };
    case 'complementary': return { label: 'Complementary', cls: styles.secRoleComplementary };
    case 'neutral': return { label: 'Not wanted', cls: styles.secRoleNeutral };
  }
}

export default function ModDetailModal({ mod, isOpen, onClose }: ModDetailModalProps) {
  const { verdicts } = useEvaluation();
  const { isAssigned, assign, unassign } = usePilotAssignment();
  const [pilotBusy, setPilotBusy] = useState(false);
  const [pilotError, setPilotError] = useState<string | null>(null);
  if (!isOpen || !mod) return null;

  const verdict = verdicts.get(mod.mod_id);
  const assigned = isAssigned(mod.mod_id);
  const pilotMod = verdict ? isPilotMod(mod, verdict) : false;

  const handleAssign = async () => {
    setPilotError(null);
    setPilotBusy(true);
    try {
      await assign(mod);
    } catch (err) {
      setPilotError(err instanceof Error ? err.message : 'Failed to assign the mod.');
    } finally {
      setPilotBusy(false);
    }
  };

  const handleUnassign = async () => {
    setPilotError(null);
    setPilotBusy(true);
    try {
      await unassign(mod.mod_id);
    } catch (err) {
      setPilotError(err instanceof Error ? err.message : 'Failed to unassign the mod.');
    } finally {
      setPilotBusy(false);
    }
  };

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

        {/* Evaluation Section — only when an evaluation is active for this mod */}
        {verdict && (() => {
          const exp = explainVerdict(verdict, { rarity: mod.rarity, isPilot: pilotMod });
          // Slicing advice band — only on slice candidates and maxed (6d-A) mods,
          // matching the card chip. The quality % is how close the rolls came to
          // the targets you set (50 = on target); see modDisposition.ts.
          const sliceAction = actionOf(mod, verdict);
          const sliceQuality = verdict.absolute_quality;
          const sliceBand =
            (sliceAction === 'slice' || sliceAction === 'maxed') &&
            sliceQuality !== undefined &&
            Number.isFinite(sliceQuality)
              ? qualityBand(sliceQuality)
              : null;
          return (
          <div className={styles['modal-stats-section']}>
            <h3>Evaluation</h3>
            <div className={styles.evalSummary}>
              <span className={`${styles.evalBadge} ${verdictBadgeClass(verdict.verdict)}`}>
                {verdictLabel(verdict)}
              </span>
              <span className={styles.evalMeaning}>{exp.meaning}</span>
            </div>

            <div className={styles.evalExplain}>
              {exp.detail && (
                <p className={styles.evalExplainDetail}>{exp.detail}</p>
              )}
              <p className={styles.evalNextStep}>
                <span className={styles.evalNextStepLabel}>Next step:</span> {exp.nextStep}
              </p>
              {exp.caveat && (
                <p className={styles.evalCaveat}>{exp.caveat}</p>
              )}
            </div>

            {sliceBand && (
              <p className={styles.evalSlice}>
                <span className={styles.evalSliceLabel}>Slicing advice:</span>{' '}
                {sliceAction === 'maxed' ? (
                  <>Fully sliced (6-dot) — {qualityBandLabel(sliceBand)}-quality rolls. No further upgrade.</>
                ) : (
                  <>
                    <strong>{qualityBandPriority(sliceBand)}</strong> (
                    {qualityBandLabel(sliceBand)}) — {qualityBandAction(sliceBand)}.
                  </>
                )}
              </p>
            )}

            {/* What the score actually means — answers "all my required stats
                are there, so why is it only 40/100?". Shown whenever the engine
                produced a quality score. */}
            {verdict.absolute_quality !== undefined &&
              Number.isFinite(verdict.absolute_quality) && (() => {
                const qs = explainQualityScore(verdict.absolute_quality);
                return (
                  <div className={styles.evalQualityExplain}>
                    <p className={styles.evalQualityExplainLine}>
                      <span className={styles.evalQualityExplainLabel}>What the score means:</span>{' '}
                      {qs.line}
                    </p>
                    <p className={styles.evalQualityExplainNote}>{qs.note}</p>
                  </div>
                );
              })()}

            {verdict.winning_variant_name && (
              <div className={styles.evalWinner}>
                <span className={styles['info-label']}>Winning scoring rule:</span>
                <span className={styles['info-value']}>{verdict.winning_variant_name}</span>
                {verdict.absolute_quality !== undefined && (
                  <span className={styles.evalQuality}>
                    Quality {Math.round(verdict.absolute_quality)}/100
                  </span>
                )}
              </div>
            )}

            {verdict.match_breakdown && (
              <div className={styles.evalBreakdown}>
                <div className={styles.evalBreakdownLabel}>
                  How rule “{verdict.match_breakdown.variant_name}” reads this mod’s secondaries:
                </div>
                <ul className={styles.evalSecList}>
                  {verdict.match_breakdown.secondaries.map((s, i) => {
                    const role = roleDisplay(s);
                    return (
                      <li key={i} className={styles.evalSecRow}>
                        <span className={styles.evalSecName}>
                          {s.stat_name} {s.display_value}
                        </span>
                        <span className={`${styles.evalSecRole} ${role.cls}`}>{role.label}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className={styles.evalWanted}>
                  <span className={styles.evalWantedLabel}>Rule wants —</span>{' '}
                  Required: {verdict.match_breakdown.required_wanted.join(', ') || '—'}
                  {verdict.match_breakdown.complementary_wanted.length > 0 && (
                    <> · Complementary: {verdict.match_breakdown.complementary_wanted.join(', ')}</>
                  )}
                </div>
              </div>
            )}

            {verdict.all_results && verdict.all_results.length > 0 && (
              <table className={styles.evalTable}>
                <thead>
                  <tr>
                    <th>Scoring Rule</th>
                    <th>Result</th>
                    <th>Required hits</th>
                    <th>Comp. hits</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {verdict.all_results.map((r) => {
                    const isWinner = r.variant_id === verdict.winning_variant_id;
                    return (
                      <tr key={r.variant_id} className={isWinner ? styles.evalRowWinner : undefined}>
                        <td>{r.variant_name}{isWinner ? ' ★' : ''}</td>
                        <td>
                          <span
                            className={`${styles.evalBadgeSmall} ${
                              r.verdict === 'PASS_RULES' ? styles.evalBadgePass : styles.evalBadgeSell
                            }`}
                          >
                            {r.verdict === 'PASS_RULES' ? 'PASS' : 'SELL'}
                          </span>
                        </td>
                        <td>{r.required_count}</td>
                        <td>{r.complementary_count}</td>
                        <td className={styles.evalReasonCell}>{r.reason ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          );
        })()}

        {/* Pilot pool — Assign/Unassign is available on ANY mod, and lives here
            (not on the card) so it is a deliberate action that never fires on a
            stray click. Assignment is independent of the verdict: the engine
            keeps grading the mod; assigning only protects it from the Sell pile. */}
        <div className={styles['modal-stats-section']}>
          <h3>Pilot</h3>
          {assigned ? (
            <>
              <p className={styles.pilotNote}>
                Assigned to your pilot pool — protected from the Sell pile. Unassign
                it if you’d rather put it on a character.
              </p>
              <Button variant="secondary" onClick={handleUnassign} disabled={pilotBusy}>
                {pilotBusy ? 'Working…' : 'Unassign from pilots'}
              </Button>
            </>
          ) : (
            <>
              <p className={styles.pilotNote}>
                {pilotMod
                  ? 'This is a great pilot mod — already built, and a ship draws power from a mod’s dots and level, not its stats. '
                  : 'Keep this mod for a ship pilot — pilots draw power from a mod’s dots and level, not its stats. '}
                Assigning protects it from the Sell pile and is reversible.
              </p>
              <Button variant="primary" onClick={handleAssign} disabled={pilotBusy}>
                {pilotBusy ? 'Working…' : 'Assign to a pilot'}
              </Button>
            </>
          )}
          {pilotError && <p className={styles.pilotError}>{pilotError}</p>}
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
