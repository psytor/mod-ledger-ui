import React from 'react';
import { Card } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import { useEvaluation } from '@/contexts/EvaluationContext';
import type { Verdict, VerdictResult } from '@/types/evaluation';
import { actionOf, qualityBand, type QualityBand } from '@/utils/modDisposition';
import { verdictTooltip } from '@/utils/verdictExplain';
import ModSprite from './ModSprite';
import styles from './ModCard.module.css';

function verdictClassName(verdict: Verdict): string {
  switch (verdict) {
    case 'SELL': return styles.verdictSell;
    case 'UPGRADE': return styles.verdictUpgrade;
    case 'PASS_RULES': return styles.verdictPass;
    case 'UNCONFIGURED': return styles.verdictUnconfigured;
  }
}

function verdictLabel(v: VerdictResult): string {
  if (v.verdict === 'UPGRADE' && v.target_level) return `↑L${v.target_level}`;
  if (v.verdict === 'PASS_RULES') return 'PASS';
  return v.verdict;
}

function qualityBandClass(band: QualityBand): string {
  switch (band) {
    case 'slice-sure': return styles.qualitySliceSure;
    case 'consider': return styles.qualityConsider;
    case 'average': return styles.qualityAverage;
    case 'consider-sell': return styles.qualityConsiderSell;
    case 'sell': return styles.qualitySell;
  }
}

// Same band hue, muted with dark slate — maxed mods read as "done", but the
// best ones still stand out by colour.
function maxedBandClass(band: QualityBand): string {
  switch (band) {
    case 'slice-sure': return styles.maxedSliceSure;
    case 'consider': return styles.maxedConsider;
    case 'average': return styles.maxedAverage;
    case 'consider-sell': return styles.maxedConsiderSell;
    case 'sell': return styles.maxedSell;
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
  const verdict = verdicts.get(mod.mod_id);
  const action = verdict ? actionOf(mod, verdict) : null;
  const quality = verdict?.absolute_quality;
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

      {verdict && (
        <div
          className={`${styles.verdictBadge} ${verdictClassName(verdict.verdict)}`}
          title={verdictTooltip(verdict)}
        >
          {verdictLabel(verdict)}
        </div>
      )}

      {action === 'slice' && band && quality !== undefined && (
        <div className={`${styles.qualityChip} ${qualityBandClass(band)}`}>
          {Math.round(quality)}%
        </div>
      )}

      {action === 'maxed' && (
        <div
          className={`${styles.qualityChip} ${styles.qualityMaxed} ${
            band ? maxedBandClass(band) : ''
          }`}
        >
          Maxed
          {quality !== undefined && (
            <span className={styles.qualityPercent}>{Math.round(quality)}%</span>
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
        <div className={`${styles.cardContent} ${verdict ? styles.withVerdict : ''}`}>
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
