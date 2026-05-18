import type { ReactNode } from 'react';
import type { ParsedMod } from '@/services/modLedgerApi';
import type { ModRanking } from '@/utils/cohortRanking';
import ModCard from './ModCard';
import styles from './ModGrid.module.css';

interface ModGridProps {
  mods: ParsedMod[];
  onModClick: (mod: ParsedMod) => void;
  rankings?: Map<string, ModRanking>;
  trailing?: ReactNode;
}

export default function ModGrid({ mods, onModClick, rankings, trailing }: ModGridProps) {
  if (mods.length === 0 && !trailing) {
    return (
      <div className={styles.emptyState}>
        <p>No mods found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className={styles.modGrid}>
      {mods.map((mod) => (
        <ModCard
          key={mod.mod_id}
          mod={mod}
          onClick={() => onModClick(mod)}
          ranking={rankings?.get(mod.mod_id)}
        />
      ))}
      {trailing}
    </div>
  );
}
