import type { ModSetDefinition } from '@/services/gameDataApi';
import SetIcon from '@/components/mod/SetIcon';
import styles from './SetSwitcher.module.css';

interface SetSwitcherProps {
  sets: ModSetDefinition[];
  activeSetId: number | null;
  onSelect: (setId: number) => void;
}

/**
 * Sticky bar of set buttons (icon + name) that switches which single
 * SetBlock the Mod Sets section shows. All sets stay resident in the
 * parent's state — this only changes what's on screen.
 */
export default function SetSwitcher({
  sets,
  activeSetId,
  onSelect,
}: SetSwitcherProps) {
  return (
    <div className={styles.bar} role="tablist" aria-label="Mod set">
      {sets.map((set) => {
        const isActive = set.set_id === activeSetId;
        return (
          <button
            key={set.set_id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive}
            className={styles.tab}
            onClick={() => onSelect(set.set_id)}
          >
            <SetIcon set={set.name} size={20} tint={isActive ? 'Gold' : 'Grey'} />
            <span>{set.name}</span>
          </button>
        );
      })}
    </div>
  );
}
