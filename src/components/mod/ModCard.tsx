import React from 'react';
import { Card } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import { useEvaluation } from '@/contexts/EvaluationContext';
import { usePilotAssignment } from '@/contexts/PilotAssignmentContext';
import type { Verdict, VerdictResult } from '@/types/evaluation';
import {
  actionOf,
  isPilotMod,
  qualityBand,
  qualityBandLabel,
  qualityBandPriority,
  qualityBandAction,
  type QualityBand,
} from '@/utils/modDisposition';
import { verdictTooltip } from '@/utils/verdictExplain';
import ModSprite from './ModSprite';
import styles from './ModCard.module.css';

// `isPilot` re-skins a SELL badge as "FOR PILOT": the mod is already built, so
// it's a fine pilot mod rather than a literal sell. It stays in the Sell bucket
// until the user assigns it.
function verdictClassName(verdict: Verdict, isPilot: boolean): string {
  if (isPilot && verdict === 'SELL') return styles.verdictForPilot;
  switch (verdict) {
    case 'SELL': return styles.verdictSell;
    case 'UPGRADE': return styles.verdictUpgrade;
    case 'PASS_RULES': return styles.verdictPass;
    case 'UNCONFIGURED': return styles.verdictUnconfigured;
  }
}

function verdictLabel(v: VerdictResult, isPilot: boolean): string {
  if (isPilot && v.verdict === 'SELL') return 'FOR PILOT';
  if (v.verdict === 'UPGRADE' && v.target_level) return `↑L${v.target_level}`;
  if (v.verdict === 'PASS_RULES') return 'PASS';
  return v.verdict;
}

// Average roll efficiency for a secondary — mean of the per-roll efficiencies
// when present, otherwise the API's pre-averaged fallback (mirrors the detail
// view's 5-bar logic).
function avgRollEfficiency(stat: {
  roll_efficiencies?: number[];
  roll_efficiency?: number;
}): number {
  const effs = stat.roll_efficiencies;
  if (effs && effs.length > 0) {
    return effs.reduce((sum, e) => sum + e, 0) / effs.length;
  }
  return stat.roll_efficiency ?? 0;
}

function qualityBandClass(band: QualityBand): string {
  switch (band) {
    case 'perfect': return styles.qualityPerfect;
    case 'nearly-perfect': return styles.qualityNearlyPerfect;
    case 'on-target': return styles.qualityOnTarget;
    case 'under-target': return styles.qualityUnderTarget;
    case 'bad': return styles.qualityBad;
  }
}

// Same band hue, muted with dark slate — maxed mods read as "done", but the
// best ones still stand out by colour.
function maxedBandClass(band: QualityBand): string {
  switch (band) {
    case 'perfect': return styles.maxedPerfect;
    case 'nearly-perfect': return styles.maxedNearlyPerfect;
    case 'on-target': return styles.maxedOnTarget;
    case 'under-target': return styles.maxedUnderTarget;
    case 'bad': return styles.maxedBad;
  }
}

interface ModCardProps {
  mod: ParsedMod;
  onClick: () => void;
}

const tierBorderColors = {
  1: '#b4bac7',  // Grey
  2: '#84cc16',  // Green
  3: '#3b82f6',  // Blue
  4: '#8b5cf6',  // Purple
  5: '#fbbf24',  // Gold
} as const;

export default function ModCard({ mod, onClick }: ModCardProps) {
  const { verdicts } = useEvaluation();
  const { isAssigned } = usePilotAssignment();
  const verdict = verdicts.get(mod.mod_id);
  const action = verdict ? actionOf(mod, verdict) : null;
  const quality = verdict?.absolute_quality;
  const assigned = isAssigned(mod.mod_id);
  // Layer-1 relabel gate: a built SELL mod reads "FOR PILOT" instead of "SELL".
  const pilotMod = verdict ? isPilotMod(mod, verdict) : false;
  // The 5-band quality scale colours both slice candidates (vibrant) and maxed
  // 6d-A mods (same hue, dark-muted). Everything else relies on its verdict
  // badge.
  const band =
    (action === 'slice' || action === 'maxed') && quality !== undefined
      ? qualityBand(quality)
      : null;

  const secondarySlots = Array(4).fill(null).map((_, index) => {
    return mod.secondary_stats[index] || null;
  });

  const getTierClass = (tier: number): string => {
    if (tier >= 5) return styles.tierGold;
    if (tier >= 4) return styles.tierPurple;
    if (tier >= 3) return styles.tierBlue;
    if (tier >= 2) return styles.tierGreen;
    return styles.tierGrey;
  };

  const tierClass = getTierClass(mod.tier);
  const isSixDot = mod.rarity === 6;
  const tierBorderColor = tierBorderColors[Math.min(5, Math.max(1, mod.tier)) as keyof typeof tierBorderColors];

  const tierColorName = mod.tier_color || (() => {
    if (mod.tier >= 5) return 'Gold';
    if (mod.tier >= 4) return 'Purple';
    if (mod.tier >= 3) return 'Blue';
    if (mod.tier >= 2) return 'Green';
    return 'Grey';
  })();

  const glowGradientClass = {
    'Grey': styles.glowGrey,
    'Green': styles.glowGreen,
    'Blue': styles.glowBlue,
    'Purple': styles.glowPurple,
    'Gold': styles.glowGold,
  }[tierColorName];

  return (
    <div className={styles.cardWrapper}>
      <div className={`${styles.glowBackground} ${glowGradientClass}`}></div>

      {/* Right-side action badge. Assignment wins over the verdict: an assigned
          mod always shows a persistent "PILOT" badge (the "reclaim me" signal)
          regardless of how it currently evaluates — even a now-good slice/maxed
          mod, whose left quality chip still renders. Otherwise the verdict badge
          shows, with SELL re-skinned to "FOR PILOT" for built mods. PASS_RULES
          is omitted (the left slice/maxed chip already says "keeper"). */}
      {assigned ? (
        <div
          className={`${styles.verdictBadge} ${styles.verdictAssigned}`}
          title="Assigned to a pilot — protected from the Sell pile. Open the mod to Unassign it."
        >
          PILOT
        </div>
      ) : (
        verdict &&
        verdict.verdict !== 'PASS_RULES' && (
          <div
            className={`${styles.verdictBadge} ${verdictClassName(verdict.verdict, pilotMod)}`}
            title={verdictTooltip(verdict, { rarity: mod.rarity, isPilot: pilotMod })}
          >
            {verdictLabel(verdict, pilotMod)}
          </div>
        )
      )}

      {action === 'slice' && band && (
        <div
          className={`${styles.qualityChip} ${qualityBandClass(band)}`}
          title={`${qualityBandPriority(band)} — ${qualityBandAction(band)}`}
        >
          {qualityBandLabel(band)}
        </div>
      )}

      {action === 'maxed' && (
        <div
          className={`${styles.qualityChip} ${styles.qualityMaxed} ${
            band ? maxedBandClass(band) : ''
          }`}
          title={
            band
              ? `Maxed — ${qualityBandLabel(band)}-quality rolls. Fully sliced (6-dot); no further upgrade.`
              : 'Maxed — fully sliced (6-dot); no further upgrade.'
          }
        >
          Maxed
          {band && (
            <span className={styles.qualityPercent}>{qualityBandLabel(band)}</span>
          )}
        </div>
      )}

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
        <div className={`${styles.cardContent} ${verdict || assigned ? styles.withVerdict : ''}`}>
          {/* MIDDLE ROW: Mod Shape (left) and Stats (right) */}
          <div className={styles.middleRow}>
            <div className={styles.leftColumn}>
              <div className={styles.dotsContainer}>
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className={i < mod.rarity ? styles.dotActive : styles.dotInactive}
                  />
                ))}
              </div>

              <div
                className={styles.spriteContainer}
              >
                <ModSprite
                  shape={mod.shape}
                  tier={mod.tier}
                  set={mod.set}
                  is6Dot={mod.rarity === 6}
                  size={80}
                />
              </div>

              <div className={styles.modMeta}>
                <span className={styles.modLevel}>{mod.level} - {mod.tier_name}</span>
              </div>
            </div>

            <div className={styles.rightColumn}>
              <div className={styles.primaryStat}>
                <span className={styles.primaryName}>{mod.primary_stat.stat_name}</span>
                <span className={styles.primaryValue}>{mod.primary_stat.display_value}</span>
              </div>

              <div className={styles.secondaryStats}>
                {secondarySlots.map((stat, index) => (
                  <div key={index} className={styles.secondaryStat}>
                    {stat ? (
                      <>
                        <span className={styles.statValue}>{stat.display_value}</span>
                        <span className={styles.statName}>{stat.stat_name}</span>
                        {stat.rolls ? (
                          <span className={styles.statRolls}>
                            ({stat.rolls}) {Math.round(avgRollEfficiency(stat))}%
                          </span>
                        ) : null}
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
            {isSixDot && mod.calibrations_left !== undefined && mod.calibration_limit !== undefined && (
              <div className={styles.calibrationRow}>
                <span className={styles.calibration}>🔄 Calibrations left: {mod.calibrations_left} / {mod.calibration_limit}</span>
              </div>
            )}

            <div className={styles.characterRow}>
              <span className={styles.character}>{mod.character || 'Unassigned'}</span>
            </div>
          </div>

          <div className={styles.lockIndicator}>
            {mod.locked ? '🔒' : '🔓'}
          </div>
        </div>
      </Card>
    </div>
  );
}
