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
  stat_name: keyof typeof STAT_NAMES;
  display_value: string;
  rolls_details?: RollDetail[];
}

interface SecondaryStatColumnProps {
  stat: SecondaryStat;
}

const SecondaryStatColumn: React.FC<SecondaryStatColumnProps> = ({ stat }) => {
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
              className={styles.efficiencyBar}
              style={{ width: `${efficiency}%` }}
            />
            {/* The text, centered absolutely */}
            <span className={styles.efficiencyText}>
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
