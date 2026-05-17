import React from 'react';
import { Card } from 'astrogators-shared-ui';
import type { ParsedMod } from '@/services/modLedgerApi';
import { useEvaluation } from '@/contexts/EvaluationContext';
import type { Verdict, VerdictResult } from '@/types/evaluation';
import { deriveActionBand, type ModRanking, type ActionBand } from '@/utils/cohortRanking';
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

function verdictTooltip(v: VerdictResult): string {
  const parts: string[] = [];
  if (v.reason) parts.push(v.reason);
  if (v.winning_variant_name) parts.push(`Winning variant: ${v.winning_variant_name}`);
  return parts.join(' · ');
}

function bandClassName(band: ActionBand): string {
  switch (band) {
    case 'push': return styles.bandPush;
    case 'keep': return styles.bandKeep;
    case 'consider-selling': return styles.bandSell;
    case 'none': return styles.bandNone;
  }
}

function bandLabel(band: ActionBand, ranking: ModRanking): string {
  switch (band) {
    case 'push':
      return ranking.action === 'level' ? '↑ Level' : '↑ Slice';
    case 'keep':
      return 'Keep';
    case 'consider-selling':
      return 'Consider Selling';
    case 'none':
      return 'Deploy';
  }
}

function bandTooltip(ranking: ModRanking): string {
  const parts: string[] = [`${Math.round(ranking.absolute_quality)}% of max`];
  if (ranking.relative_position !== null) {
    parts.push(`top ${Math.round(100 - ranking.relative_position)}% of cohort`);
  } else if (ranking.action === 'slice' || ranking.action === 'deploy') {
    parts.push('uncomparable cohort (too few peers)');
  }
  return parts.join(' · ');
}

interface ModCardProps {
  mod: ParsedMod;
  onClick: () => void;
  ranking?: ModRanking;
}

const tierBorderColors = {
  1: '#b4bac7',  // Grey
  2: '#84cc16',  // Green
  3: '#3b82f6',  // Blue
  4: '#8b5cf6',  // Purple
  5: '#fbbf24',  // Gold
} as const;

export default function ModCard({ mod, onClick, ranking }: ModCardProps) {
  const { verdicts } = useEvaluation();
  const verdict = verdicts.get(mod.mod_id);
  const band = ranking ? deriveActionBand(ranking) : null;

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

      {ranking && band && ranking.action !== 'level' && (
        <div
          className={`${styles.bandChip} ${bandClassName(band)}`}
          title={bandTooltip(ranking)}
        >
          {bandLabel(band, ranking)}
          <span className={styles.bandQuality}>
            {Math.round(ranking.absolute_quality)}%
          </span>
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

              <div className={styles.spriteContainer}>
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
