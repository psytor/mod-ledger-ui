// mod-ledger-ui/src/components/mod/SecondaryStatColumn.tsx
import React from 'react';
import styles from './ModDetailModal.module.css';

const MAX_ROLLS = 5;

// Define the type for a single roll, mirroring the backend schema
interface RollDetail {
  value: number;
  efficiency: number;
}

// Define the type for a secondary stat
interface SecondaryStat {
  stat_name: string;
  display_value: string;
  rolls_details?: RollDetail[];
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

  const renderRolls = () => {
    const rolls = stat.rolls_details || [];
    const rollElements = [];

    for (let i = 0; i < MAX_ROLLS; i++) {
      if (i < rolls.length) {
        const roll = rolls[i];
        const efficiency = roll.efficiency || 0;
        rollElements.push(
          <div key={i} className={styles.statRoll}>
            {/* The filling bar, positioned absolutely from the left */}
            <div
              className={`${styles.efficiencyBar} ${getBarColorClass(efficiency)}`}
              style={{ width: `${Math.max(efficiency, 8)}%` }} // Minimum 8% for visibility
            />
            {/* The text, centered absolutely */}
            <span className={`${styles.efficiencyText} ${getTextColorClass(efficiency)}`}>
              {efficiency.toFixed(1)}%
            </span>
          </div>
        );
      } else {
        // Render a disabled/empty roll slot
        rollElements.push(
          <div
            key={i}
            className={`${styles.statRoll} ${styles.disabled}`}
          />
        );
      }
    }
    return rollElements;
  };

  return (
    <div className={styles.secondaryStatColumn}>
      <div className={styles.statInfo}>
        <span className={styles.statName}>{stat.stat_name}</span>
        <span className={styles.statValue}>{stat.display_value}</span>
      </div>
      <div className={styles.rollsContainer}>{renderRolls()}</div>
    </div>
  );
};

export default SecondaryStatColumn;
