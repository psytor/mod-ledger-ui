import type { ParsedMod, ModEvaluation } from '@/services/modLedgerApi';
import ModCard from './ModCard';
import styles from './ModGrid.module.css';

interface ModGridProps {
  mods: ParsedMod[];
  onModClick: (mod: ParsedMod) => void;
  evaluations: Record<string, ModEvaluation> | null;
}

export default function ModGrid({ mods, onModClick, evaluations }: ModGridProps) {
  if (mods.length === 0) {
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
          evaluation={evaluations?.[mod.mod_id]}
        />
      ))}
    </div>
  );
}
