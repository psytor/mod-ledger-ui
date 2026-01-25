// mod-ledger-ui/src/components/mod/SecondaryStatColumn.tsx
import React from 'react';
import styles from './ModDetailModal.module.css';

const MAX_ROLLS = 5;

// Define the type for a secondary stat (CLEAN BREAK: Using API's actual data)
interface SecondaryStat {
  stat_name: string;
  display_value: string;
  roll_efficiency?: number;      // Average efficiency for fallback
  roll_efficiencies?: number[];  // Individual roll efficiencies for 5-bar visualization
  rolls?: number;                // Total roll count from API
}

interface SecondaryStatColumnProps {
  stat: SecondaryStat;
}

const SecondaryStatColumn: React.FC<SecondaryStatColumnProps> = ({ stat }) => {
  // Color coding based on efficiency percentage - Blue scale from dark to bright
  const getBarColorClass = (efficiency: number): string => {
    if (efficiency >= 80) return styles.fillExcellent;    // blue-500
    if (efficiency >= 60) return styles.fillGood;         // blue-600
    if (efficiency >= 40) return styles.fillAverage;      // blue-700
    if (efficiency >= 20) return styles.fillBelowAverage; // blue-800
    return styles.fillPoor;                               // blue-900
  };

  // 5-Bar Visualization: Renders individual horizontal efficiency bars for each roll
  const renderRollVisualization = () => {
    const rollCount = stat.rolls || 0;
    const efficiencies = stat.roll_efficiencies || [];
    const fallbackEfficiency = stat.roll_efficiency || 0;

    // Calculate average efficiency from granular data or use fallback
    const avgEfficiency = efficiencies.length > 0
      ? efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length
      : fallbackEfficiency;

    // Create exactly 5 horizontal bars (max possible rolls)
    const bars = [];
    for (let i = 0; i < MAX_ROLLS; i++) {
      const hasRoll = i < rollCount;

      // Use granular data if available, fallback to average for legacy data
      const rollEff = efficiencies[i] !== undefined ? efficiencies[i] : fallbackEfficiency;

      // Bar width: 0% for empty slots, minimum 8% for visibility on actual rolls
      const barWidth = hasRoll ? Math.max(rollEff, 8) : 0;

      // Color class based on efficiency
      const barColorClass = hasRoll ? getBarColorClass(rollEff) : '';

      // Tooltip text
      const tooltipText = hasRoll
        ? `Roll ${i + 1}: ${rollEff.toFixed(1)}%`
        : 'Unused Slot';

      bars.push(
        <div
          key={i}
          className={`${styles.rollBarContainer} ${hasRoll ? '' : styles.rollBarInactive}`}
          title={tooltipText}
        >
          <div
            className={`${styles.rollBarFill} ${barColorClass}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      );
    }

    return (
      <>
        <div className={styles.rollBarsWrapper}>{bars}</div>
        {rollCount > 0 && (
          <div className={styles.rollAverageLabel}>
            {avgEfficiency.toFixed(1)}% Roll Efficiency
          </div>
        )}
      </>
    );
  };

  return (
    <div className={styles.secondaryStatColumn}>
      <div className={styles.statInfo}>
        <span className={styles.statName}>{stat.stat_name}</span>
        <span className={styles.statValue}>{stat.display_value}</span>
      </div>
      <div className={styles.rollsContainer}>{renderRollVisualization()}</div>
    </div>
  );
};

export default SecondaryStatColumn;
