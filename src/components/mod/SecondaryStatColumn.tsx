// mod-ledger-ui/src/components/mod/SecondaryStatColumn.tsx
import React from 'react';
import styles from './ModDetailModal.module.css';

const MAX_ROLLS = 5;

// Define the type for a secondary stat (CLEAN BREAK: Using API's actual data)
interface SecondaryStat {
  stat_name: string;
  display_value: string;
  roll_efficiency?: number;  // Aggregate average efficiency from API
  rolls?: number;            // Total roll count from API
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

  // Text color based on efficiency (lighter text on darker backgrounds)
  const getTextColorClass = (efficiency: number): string => {
    if (efficiency >= 60) return styles.textLight;
    return styles.textDark;
  };

  // CLEAN BREAK: Aggregate visualization using roll_efficiency and rolls count
  const renderRollVisualization = () => {
    const rollCount = stat.rolls || 0;
    const efficiency = stat.roll_efficiency || 0;

    // Visual pips showing roll count (max 5)
    const rollPips = [];
    for (let i = 0; i < MAX_ROLLS; i++) {
      rollPips.push(
        <div
          key={i}
          className={i < rollCount ? styles.rollPipActive : styles.rollPipInactive}
          title={i < rollCount ? `Roll ${i + 1}` : 'No roll'}
        />
      );
    }

    // Aggregate efficiency bar
    return (
      <>
        {/* Roll count pips */}
        <div className={styles.rollPipsContainer}>
          {rollPips}
        </div>

        {/* Aggregate efficiency bar */}
        {rollCount > 0 && (
          <div className={styles.aggregateEfficiencyBar}>
            <div
              className={`${styles.efficiencyBarFill} ${getBarColorClass(efficiency)}`}
              style={{ width: `${Math.max(efficiency, 8)}%` }} // Minimum 8% for visibility
            />
            <span className={`${styles.efficiencyBarText} ${getTextColorClass(efficiency)}`}>
              {efficiency.toFixed(1)}% avg
            </span>
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
